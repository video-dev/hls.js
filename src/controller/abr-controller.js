/*
 * simple ABR Controller
 *  - compute next level based on last fragment bw heuristics
 *  - implement an abandon rules triggered if we have less than 2 frag buffered and if computed bw shows that we risk buffer stalling
 */

import Event from '../events';
import EventHandler from '../event-handler';
import { BufferHelper } from '../utils/buffer-helper';
import { ErrorDetails } from '../errors';
import { logger } from '../utils/logger';
import EwmaBandWidthEstimator from '../utils/ewma-bandwidth-estimator';

const { performance } = window;

class AbrController extends EventHandler {
  constructor (hls) {
    super(hls, Event.FRAG_LOADING,
      Event.FRAG_LOADED,
      Event.FRAG_BUFFERED,
      Event.ERROR);
    this.lastLoadedFragLevel = 0;
    this._nextAutoLevel = -1;
    this.hls = hls;
    this.timer = null;
    this._bwEstimator = null;
    this.onCheck = this._abandonRulesCheck.bind(this);
  }

  destroy () {
    this.clearTimer();
    EventHandler.prototype.destroy.call(this);
  }

  onFragLoading (data) {
    const frag = data.frag;
    if (frag.type === 'main') {
      if (!this.timer) {
        this.fragCurrent = frag;
        this.timer = setInterval(this.onCheck, 100);
      }

      // lazy init of BwEstimator, rationale is that we use different params for Live/VoD
      // so we need to wait for stream manifest / playlist type to instantiate it.
      if (!this._bwEstimator) {
        const hls = this.hls;
        const config = hls.config;
        const level = frag.level;
        const isLive = hls.levels[level].details.live;

        let ewmaFast;
        let ewmaSlow;
        if (isLive) {
          ewmaFast = config.abrEwmaFastLive;
          ewmaSlow = config.abrEwmaSlowLive;
        } else {
          ewmaFast = config.abrEwmaFastVoD;
          ewmaSlow = config.abrEwmaSlowVoD;
        }
        this._bwEstimator = new EwmaBandWidthEstimator(hls, ewmaSlow, ewmaFast, config.abrEwmaDefaultEstimate);
      }
    }
  }

  _abandonRulesCheck () {
    /*
      monitor fragment retrieval time...
      we compute expected time of arrival of the complete fragment.
      we compare it to expected time of buffer starvation
    */
    const hls = this.hls;
    const video = hls.media;
    const frag = this.fragCurrent;

    if (!frag) {
      return;
    }

    const loader = frag.loader;
    const minAutoLevel = hls.minAutoLevel;

    // if loader has been destroyed or loading has been aborted, stop timer and return
    if (!loader || (loader.stats && loader.stats.aborted)) {
      logger.warn('frag loader destroy or aborted, disarm abandonRules');
      this.clearTimer();
      // reset forced auto level value so that next level will be selected
      this._nextAutoLevel = -1;
      return;
    }
    let stats = loader.stats;
    /* only monitor frag retrieval time if
    (video not paused OR first fragment being loaded(ready state === HAVE_NOTHING = 0)) AND autoswitching enabled AND not lowest level (=> means that we have several levels) */
    if (video && stats && ((!video.paused && (video.playbackRate !== 0)) || !video.readyState) && frag.autoLevel && frag.level) {
      const requestDelay = performance.now() - stats.trequest;
      const playbackRate = Math.abs(video.playbackRate);

      // monitor fragment load progress after half of expected fragment duration,to stabilize bitrate
      if (requestDelay > (500 * frag.duration / playbackRate)) {
        const levels = hls.levels;
        const loadRate = Math.max(1, stats.bw ? stats.bw / 8 : stats.loaded * 1000 / requestDelay); // byte/s; at least 1 byte/s to avoid division by zero

        // compute expected fragment length using frag duration and level bitrate. also ensure that expected len is gte than already loaded size
        const level = levels[frag.level];
        const levelBitrate = level.realBitrate ? Math.max(level.realBitrate, level.bitrate) : level.bitrate;
        const expectedLen = stats.total ? stats.total : Math.max(stats.loaded, Math.round(frag.duration * levelBitrate / 8));
        const pos = video.currentTime;
        const fragLoadedDelay = (expectedLen - stats.loaded) / loadRate;
        const bufferStarvationDelay = (BufferHelper.bufferInfo(video, pos, hls.config.maxBufferHole).end - pos) / playbackRate;

        // consider emergency switch down only if we have less than 2 frag buffered AND
        // time to finish loading current fragment is bigger than buffer starvation delay
        // ie if we risk buffer starvation if bw does not increase quickly
        if ((bufferStarvationDelay < (2 * frag.duration / playbackRate)) && (fragLoadedDelay > bufferStarvationDelay)) {
          let fragLevelNextLoadedDelay;
          let nextLoadLevel;
          // lets iterate through lower level and try to find the biggest one that could avoid rebuffering
          // we start from current level - 1 and we step down , until we find a matching level
          for (nextLoadLevel = frag.level - 1; nextLoadLevel > minAutoLevel; nextLoadLevel--) {
            // compute time to load next fragment at lower level
            // 0.8 : consider only 80% of current bw to be conservative
            // 8 = bits per byte (bps/Bps)
            const levelNextBitrate = levels[nextLoadLevel].realBitrate
              ? Math.max(levels[nextLoadLevel].realBitrate, levels[nextLoadLevel].bitrate)
              : levels[nextLoadLevel].bitrate;

            const fragLevelNextLoadedDelay = frag.duration * levelNextBitrate / (8 * 0.8 * loadRate);

            if (fragLevelNextLoadedDelay < bufferStarvationDelay) {
              // we found a lower level that be rebuffering free with current estimated bw !
              break;
            }
          }
          // only emergency switch down if it takes less time to load new fragment at lowest level instead
          // of finishing loading current one ...
          if (fragLevelNextLoadedDelay < fragLoadedDelay) {
            logger.warn(`loading too slow, abort fragment loading and switch to level ${nextLoadLevel}:fragLoadedDelay[${nextLoadLevel}]<fragLoadedDelay[${frag.level - 1}];bufferStarvationDelay:${fragLevelNextLoadedDelay.toFixed(1)}<${fragLoadedDelay.toFixed(1)}:${bufferStarvationDelay.toFixed(1)}`);
            // force next load level in auto mode
            hls.nextLoadLevel = nextLoadLevel;
            // update bw estimate for this fragment before cancelling load (this will help reducing the bw)
            this._bwEstimator.sample(requestDelay, stats.loaded);
            // abort fragment loading
            loader.abort();
            // stop abandon rules timer
            this.clearTimer();
            hls.trigger(Event.FRAG_LOAD_EMERGENCY_ABORTED, { frag: frag, stats: stats });
          }
        }
      }
    }
  }

  onFragLoaded (data) {
    const frag = data.frag;
    if (frag.type === 'main' && Number.isFinite(frag.sn)) {
      // stop monitoring bw once frag loaded
      this.clearTimer();
      // store level id after successful fragment load
      this.lastLoadedFragLevel = frag.level;
      // reset forced auto level value so that next level will be selected
      this._nextAutoLevel = -1;

      // compute level average bitrate
      if (this.hls.config.abrMaxWithRealBitrate) {
        const level = this.hls.levels[frag.level];
        let loadedBytes = (level.loaded ? level.loaded.bytes : 0) + data.stats.loaded;
        let loadedDuration = (level.loaded ? level.loaded.duration : 0) + data.frag.duration;
        level.loaded = { bytes: loadedBytes, duration: loadedDuration };
        level.realBitrate = Math.round(8 * loadedBytes / loadedDuration);
      }
      // if fragment has been loaded to perform a bitrate test,
      if (data.frag.bitrateTest) {
        let stats = data.stats;
        stats.tparsed = stats.tbuffered = stats.tload;
        this.onFragBuffered(data);
      }
    }
  }

  onFragBuffered (data) {
    const stats = data.stats;
    const frag = data.frag;
    // only update stats on first frag buffering
    // if same frag is loaded multiple times, it might be in browser cache, and loaded quickly
    // and leading to wrong bw estimation
    // on bitrate test, also only update stats once (if tload = tbuffered == on FRAG_LOADED)
    if (stats.aborted !== true && frag.type === 'main' && Number.isFinite(frag.sn) && ((!frag.bitrateTest || stats.tload === stats.tbuffered))) {
      // use tparsed-trequest instead of tbuffered-trequest to compute fragLoadingProcessing; rationale is that  buffer appending only happens once media is attached
      // in case we use config.startFragPrefetch while media is not attached yet, fragment might be parsed while media not attached yet, but it will only be buffered on media attached
      // as a consequence it could happen really late in the process. meaning that appending duration might appears huge ... leading to underestimated throughput estimation
      let fragLoadingProcessingMs = stats.tparsed - stats.trequest;
      logger.log(`latency/loading/parsing/append/kbps:${Math.round(stats.tfirst - stats.trequest)}/${Math.round(stats.tload - stats.tfirst)}/${Math.round(stats.tparsed - stats.tload)}/${Math.round(stats.tbuffered - stats.tparsed)}/${Math.round(8 * stats.loaded / (stats.tbuffered - stats.trequest))}`);
      this._bwEstimator.sample(fragLoadingProcessingMs, stats.loaded);
      stats.bwEstimate = this._bwEstimator.getEstimate();
      // if fragment has been loaded to perform a bitrate test, (hls.startLevel = -1), store bitrate test delay duration
      if (frag.bitrateTest) {
        this.bitrateTestDelay = fragLoadingProcessingMs / 1000;
      } else {
        this.bitrateTestDelay = 0;
      }
    }
  }

  onError (data) {
    // stop timer in case of frag loading error
    switch (data.details) {
    case ErrorDetails.FRAG_LOAD_ERROR:
    case ErrorDetails.FRAG_LOAD_TIMEOUT:
      this.clearTimer();
      break;
    default:
      break;
    }
  }

  clearTimer () {
    clearInterval(this.timer);
    this.timer = null;
  }

  // return next auto level
  get nextAutoLevel () {
    const forcedAutoLevel = this._nextAutoLevel;
    const bwEstimator = this._bwEstimator;
    // in case next auto level has been forced, and bw not available or not reliable, return forced value
    if (forcedAutoLevel !== -1 && (!bwEstimator || !bwEstimator.canEstimate())) {
      return forcedAutoLevel;
    }

    // compute next level using ABR logic
    let nextABRAutoLevel = this._nextABRAutoLevel;
    // if forced auto level has been defined, use it to cap ABR computed quality level
    if (forcedAutoLevel !== -1) {
      nextABRAutoLevel = Math.min(forcedAutoLevel, nextABRAutoLevel);
    }

    return nextABRAutoLevel;
  }
  get _nextABRAutoLevel () {
    let hls = this.hls;
    const { maxAutoLevel, levels, config, minAutoLevel } = hls;
    const video = hls.media;
    const currentLevel = this.lastLoadedFragLevel;
    const currentFragDuration = this.fragCurrent ? this.fragCurrent.duration : 0;
    const pos = (video ? video.currentTime : 0);

    // playbackRate is the absolute value of the playback rate; if video.playbackRate is 0, we use 1 to load as
    // if we're playing back at the normal rate.
    const playbackRate = ((video && (video.playbackRate !== 0)) ? Math.abs(video.playbackRate) : 1.0);
    const avgbw = this._bwEstimator ? this._bwEstimator.getEstimate() : config.abrEwmaDefaultEstimate;
    // bufferStarvationDelay is the wall-clock time left until the playback buffer is exhausted.
    const bufferStarvationDelay = (BufferHelper.bufferInfo(video, pos, config.maxBufferHole).end - pos) / playbackRate;

    // First, look to see if we can find a level matching with our avg bandwidth AND that could also guarantee no rebuffering at all
    let bestLevel = this._findBestLevel(currentLevel, currentFragDuration, avgbw, minAutoLevel, maxAutoLevel, bufferStarvationDelay, config.abrBandWidthFactor, config.abrBandWidthUpFactor, levels);
    if (bestLevel >= 0) {
      return bestLevel;
    } else {
      logger.trace('rebuffering expected to happen, lets try to find a quality level minimizing the rebuffering');
      // not possible to get rid of rebuffering ... let's try to find level that will guarantee less than maxStarvationDelay of rebuffering
      // if no matching level found, logic will return 0
      let maxStarvationDelay = currentFragDuration ? Math.min(currentFragDuration, config.maxStarvationDelay) : config.maxStarvationDelay;
      let bwFactor = config.abrBandWidthFactor;
      let bwUpFactor = config.abrBandWidthUpFactor;

      if (bufferStarvationDelay === 0) {
        // in case buffer is empty, let's check if previous fragment was loaded to perform a bitrate test
        let bitrateTestDelay = this.bitrateTestDelay;
        if (bitrateTestDelay) {
          // if it is the case, then we need to adjust our max starvation delay using maxLoadingDelay config value
          // max video loading delay used in  automatic start level selection :
          // in that mode ABR controller will ensure that video loading time (ie the time to fetch the first fragment at lowest quality level +
          // the time to fetch the fragment at the appropriate quality level is less than ```maxLoadingDelay``` )
          // cap maxLoadingDelay and ensure it is not bigger 'than bitrate test' frag duration
          const maxLoadingDelay = currentFragDuration ? Math.min(currentFragDuration, config.maxLoadingDelay) : config.maxLoadingDelay;
          maxStarvationDelay = maxLoadingDelay - bitrateTestDelay;
          logger.trace(`bitrate test took ${Math.round(1000 * bitrateTestDelay)}ms, set first fragment max fetchDuration to ${Math.round(1000 * maxStarvationDelay)} ms`);
          // don't use conservative factor on bitrate test
          bwFactor = bwUpFactor = 1;
        }
      }
      bestLevel = this._findBestLevel(currentLevel, currentFragDuration, avgbw, minAutoLevel, maxAutoLevel, bufferStarvationDelay + maxStarvationDelay, bwFactor, bwUpFactor, levels);
      return Math.max(bestLevel, 0);
    }
  }

  _findBestLevel (currentLevel, currentFragDuration, currentBw, minAutoLevel, maxAutoLevel, maxFetchDuration, bwFactor, bwUpFactor, levels) {
    for (let i = maxAutoLevel; i >= minAutoLevel; i--) {
      let levelInfo = levels[i];

      if (!levelInfo) {
        continue;
      }

      const levelDetails = levelInfo.details;
      const avgDuration = levelDetails ? levelDetails.totalduration / levelDetails.fragments.length : currentFragDuration;
      const live = levelDetails ? levelDetails.live : false;

      let adjustedbw;
      // follow algorithm captured from stagefright :
      // https://android.googlesource.com/platform/frameworks/av/+/master/media/libstagefright/httplive/LiveSession.cpp
      // Pick the highest bandwidth stream below or equal to estimated bandwidth.
      // consider only 80% of the available bandwidth, but if we are switching up,
      // be even more conservative (70%) to avoid overestimating and immediately
      // switching back.
      if (i <= currentLevel) {
        adjustedbw = bwFactor * currentBw;
      } else {
        adjustedbw = bwUpFactor * currentBw;
      }

      const bitrate = levels[i].realBitrate ? Math.max(levels[i].realBitrate, levels[i].bitrate) : levels[i].bitrate;
      const fetchDuration = bitrate * avgDuration / adjustedbw;

      logger.trace(`level/adjustedbw/bitrate/avgDuration/maxFetchDuration/fetchDuration: ${i}/${Math.round(adjustedbw)}/${bitrate}/${avgDuration}/${maxFetchDuration}/${fetchDuration}`);
      // if adjusted bw is greater than level bitrate AND
      if (adjustedbw > bitrate &&
      // fragment fetchDuration unknown OR live stream OR fragment fetchDuration less than max allowed fetch duration, then this level matches
      // we don't account for max Fetch Duration for live streams, this is to avoid switching down when near the edge of live sliding window ...
      // special case to support startLevel = -1 (bitrateTest) on live streams : in that case we should not exit loop so that _findBestLevel will return -1
        (!fetchDuration || (live && !this.bitrateTestDelay) || fetchDuration < maxFetchDuration)) {
        // as we are looping from highest to lowest, this will return the best achievable quality level
        return i;
      }
    }
    // not enough time budget even with quality level 0 ... rebuffering might happen
    return -1;
  }

  set nextAutoLevel (nextLevel) {
    this._nextAutoLevel = nextLevel;
  }
}

export default AbrController;
