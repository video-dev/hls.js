/*
 * simple ABR Controller
 *  - compute next level based on last fragment bw heuristics
 *  - implement an abandon rules triggered if we have less than 2 frag buffered and if computed bw shows that we risk buffer stalling
 */

import Event from '../events';
import EventHandler from '../event-handler';
import BufferHelper from '../helper/buffer-helper';
import {ErrorDetails} from '../errors';
import {logger} from '../utils/logger';
import EwmaBandWidthEstimator from './ewma-bandwidth-estimator';

class AbrController extends EventHandler {

  constructor(hls) {
    super(hls, Event.FRAG_LOADING,
               Event.FRAG_LOADED,
               Event.FRAG_BUFFERED,
               Event.ERROR);
    this.lastLoadedFragLevel = 0;
    this._autoLevelCapping = -1;
    this._nextAutoLevel = -1;
    this.hls = hls;
    this.onCheck = this.abandonRulesCheck.bind(this);
  }

  destroy() {
    this.clearTimer();
    EventHandler.prototype.destroy.call(this);
  }

  onFragLoading(data) {
    let frag = data.frag;
    if (frag.type === 'main') {
      if (!this.timer) {
        this.timer = setInterval(this.onCheck, 100);
      }
      // lazy init of bw Estimator, rationale is that we use different params for Live/VoD
      // so we need to wait for stream manifest / playlist type to instantiate it.
      if (!this.bwEstimator) {
        let hls = this.hls,
            level = data.frag.level,
            isLive = hls.levels[level].details.live,
            config = hls.config,
            ewmaFast, ewmaSlow;

        if (isLive) {
          ewmaFast = config.abrEwmaFastLive;
          ewmaSlow = config.abrEwmaSlowLive;
        } else {
          ewmaFast = config.abrEwmaFastVoD;
          ewmaSlow = config.abrEwmaSlowVoD;
        }
        this.bwEstimator = new EwmaBandWidthEstimator(hls,ewmaSlow,ewmaFast,config.abrEwmaDefaultEstimate);
      }
      this.fragCurrent = frag;
    }
  }

  abandonRulesCheck() {
    /*
      monitor fragment retrieval time...
      we compute expected time of arrival of the complete fragment.
      we compare it to expected time of buffer starvation
    */
    let hls = this.hls, v = hls.media,frag = this.fragCurrent, loader = frag.loader, minAutoLevel = this.minAutoLevel;

    // if loader has been destroyed or loading has been aborted, stop timer and return
    if(!loader || ( loader.stats && loader.stats.aborted)) {
      logger.warn('frag loader destroy or aborted, disarm abandonRules');
      this.clearTimer();
      return;
    }
    let stats = loader.stats;
    /* only monitor frag retrieval time if
    (video not paused OR first fragment being loaded(ready state === HAVE_NOTHING = 0)) AND autoswitching enabled AND not lowest level (=> means that we have several levels) */
    if (v && ((!v.paused && (v.playbackRate !== 0)) || !v.readyState) && frag.autoLevel && frag.level) {
      let requestDelay = performance.now() - stats.trequest,
          playbackRate = Math.abs(v.playbackRate);
      // monitor fragment load progress after half of expected fragment duration,to stabilize bitrate
      if (requestDelay > (500 * frag.duration / playbackRate)) {
        let levels = hls.levels,
            loadRate = Math.max(1, stats.bw ? stats.bw / 8 : stats.loaded * 1000 / requestDelay), // byte/s; at least 1 byte/s to avoid division by zero
            // compute expected fragment length using frag duration and level bitrate. also ensure that expected len is gte than already loaded size
            expectedLen = stats.total ? stats.total : Math.max(stats.loaded, Math.round(frag.duration * levels[frag.level].bitrate / 8)),
            pos = v.currentTime,
            fragLoadedDelay = (expectedLen - stats.loaded) / loadRate,
            bufferStarvationDelay = (BufferHelper.bufferInfo(v,pos,hls.config.maxBufferHole).end - pos) / playbackRate;
        // consider emergency switch down only if we have less than 2 frag buffered AND
        // time to finish loading current fragment is bigger than buffer starvation delay
        // ie if we risk buffer starvation if bw does not increase quickly
        if ((bufferStarvationDelay < (2 * frag.duration / playbackRate)) && (fragLoadedDelay > bufferStarvationDelay)) {
          let fragLevelNextLoadedDelay, nextLoadLevel;
          // lets iterate through lower level and try to find the biggest one that could avoid rebuffering
          // we start from current level - 1 and we step down , until we find a matching level
          for (nextLoadLevel = frag.level - 1 ; nextLoadLevel > minAutoLevel ; nextLoadLevel--) {
            // compute time to load next fragment at lower level
            // 0.8 : consider only 80% of current bw to be conservative
            // 8 = bits per byte (bps/Bps)
            fragLevelNextLoadedDelay = frag.duration * levels[nextLoadLevel].bitrate / (8 * 0.8 * loadRate);
            if (fragLevelNextLoadedDelay < bufferStarvationDelay) {
              // we found a lower level that be rebuffering free with current estimated bw !
              break;
            }
          }
          // only emergency switch down if it takes less time to load new fragment at lowest level instead
          // of finishing loading current one ...
          if (fragLevelNextLoadedDelay < fragLoadedDelay) {
            logger.warn(`loading too slow, abort fragment loading and switch to level ${nextLoadLevel}:fragLoadedDelay[${nextLoadLevel}]<fragLoadedDelay[${frag.level-1}];bufferStarvationDelay:${fragLevelNextLoadedDelay.toFixed(1)}<${fragLoadedDelay.toFixed(1)}:${bufferStarvationDelay.toFixed(1)}`);
            // force next load level in auto mode
            hls.nextLoadLevel = nextLoadLevel;
            // update bw estimate for this fragment before cancelling load (this will help reducing the bw)
            this.bwEstimator.sample(requestDelay,stats.loaded);
            //abort fragment loading
            loader.abort();
            // stop abandon rules timer
            this.clearTimer();
            hls.trigger(Event.FRAG_LOAD_EMERGENCY_ABORTED, {frag: frag, stats: stats });
          }
        }
      }
    }
  }

  onFragLoaded(data) {
    let frag = data.frag;
    if (frag.type === 'main') {
      // stop monitoring bw once frag loaded
      this.clearTimer();
      // store level id after successful fragment load
      this.lastLoadedFragLevel = frag.level;
      // reset forced auto level value so that next level will be selected
      this._nextAutoLevel = -1;
      // if fragment has been loaded to perform a bitrate test,
      if (data.frag.bitrateTest) {
        let stats = data.stats;
        stats.tparsed = stats.tbuffered = stats.tload;
        this.onFragBuffered(data);
      }
    }
  }

  onFragBuffered(data) {
    var stats = data.stats, frag = data.frag;
    // only update stats on first frag buffering
    // if same frag is loaded multiple times, it might be in browser cache, and loaded quickly
    // and leading to wrong bw estimation
    // on bitrate test, also only update stats once (if tload = tbuffered == on FRAG_LOADED)
    if (stats.aborted !== true && frag.loadCounter === 1 && frag.type === 'main' && ((!frag.bitrateTest || stats.tload === stats.tbuffered))) {
      // use tparsed-trequest instead of tbuffered-trequest to compute fragLoadingProcessing; rationale is that  buffer appending only happens once media is attached
      // in case we use config.startFragPrefetch while media is not attached yet, fragment might be parsed while media not attached yet, but it will only be buffered on media attached
      // as a consequence it could happen really late in the process. meaning that appending duration might appears huge ... leading to underestimated throughput estimation
      let fragLoadingProcessingMs = stats.tparsed - stats.trequest;
      logger.log(`latency/loading/parsing/append/chunks/avg chunk/kbps:${Math.round(stats.tfirst-stats.trequest)}/${Math.round(stats.tload-stats.tfirst)}/${Math.round(stats.tparsed-stats.tload)}/${Math.round(stats.tbuffered-stats.tparsed)}/${stats.chunks}/${Math.round(stats.loaded/stats.chunks)}/${Math.round(8*stats.loaded/(stats.tbuffered-stats.trequest))}`);
      this.bwEstimator.sample(fragLoadingProcessingMs,stats.loaded);
      // if fragment has been loaded to perform a bitrate test, (hls.startLevel = -1), store bitrate test delay duration
      if (frag.bitrateTest) {
        this.bitrateTestDelay = fragLoadingProcessingMs/1000;
      } else {
        this.bitrateTestDelay = 0;
      }
    }
  }

  onError(data) {
    // stop timer in case of frag loading error
    switch(data.details) {
      case ErrorDetails.FRAG_LOAD_ERROR:
      case ErrorDetails.FRAG_LOAD_TIMEOUT:
        this.clearTimer();
        break;
      default:
        break;
    }
  }

 clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
 }

  /** Return the capping/max level value that could be used by automatic level selection algorithm **/
  get autoLevelCapping() {
    return this._autoLevelCapping;
  }

  /** set the capping/max level value that could be used by automatic level selection algorithm **/
  set autoLevelCapping(newLevel) {
    this._autoLevelCapping = newLevel;
  }

  get nextAutoLevel() {
    let nextAutoLevel = this._nextAutoLevel, bwEstimator = this.bwEstimator, hls = this.hls,
      levels = hls.levels, minAutoBitrate = hls.config.minAutoBitrate;
    // in case next auto level has been forced, and bw not available or not reliable
    if (nextAutoLevel !== -1 && (!bwEstimator || !bwEstimator.canEstimate())) {
      // cap next auto level by max auto level
      return Math.min(nextAutoLevel,this.maxAutoLevel);
    }
    // compute next level using ABR logic
    let nextABRAutoLevel = this.nextABRAutoLevel;
    if (nextAutoLevel !== -1) {
      // nextAutoLevel is defined, use it to cap ABR computed quality level
      nextABRAutoLevel = Math.min(nextAutoLevel,nextABRAutoLevel);
    }
    if(minAutoBitrate !== undefined) {
      while (levels[nextABRAutoLevel].bitrate < minAutoBitrate) {
        nextABRAutoLevel++;
      }
    }
    return nextABRAutoLevel;
  }

  get minAutoLevel() {
    let hls = this.hls, levels = hls.levels, minAutoBitrate = hls.config.minAutoBitrate, len = levels ? levels.length : 0;
    for (let i = 0; i < len; i++) {
      if (levels[i].bitrate > minAutoBitrate) {
        return i;
      }
    }
    return 0;
  }

  get maxAutoLevel() {
    var levels = this.hls.levels,autoLevelCapping = this._autoLevelCapping, maxAutoLevel;
    if (autoLevelCapping=== -1 && levels && levels.length) {
      maxAutoLevel = levels.length - 1;
    } else {
      maxAutoLevel = autoLevelCapping;
    }
    return maxAutoLevel;
  }

  get nextABRAutoLevel() {
    var hls = this.hls, maxAutoLevel = this.maxAutoLevel, levels = hls.levels, config = hls.config, minAutoLevel = this.minAutoLevel;
    const v = hls.media,
          currentLevel = this.lastLoadedFragLevel,
          currentFragDuration = this.fragCurrent ? this.fragCurrent.duration : 0,
          pos = (v ? v.currentTime : 0),
          // playbackRate is the absolute value of the playback rate; if v.playbackRate is 0, we use 1 to load as
          // if we're playing back at the normal rate.
          playbackRate = ((v && (v.playbackRate !== 0)) ? Math.abs(v.playbackRate) : 1.0),
          avgbw = this.bwEstimator ? this.bwEstimator.getEstimate() : config.abrEwmaDefaultEstimate,
          // bufferStarvationDelay is the wall-clock time left until the playback buffer is exhausted.
          bufferStarvationDelay = (BufferHelper.bufferInfo(v, pos, config.maxBufferHole).end - pos) / playbackRate;

    // First, look to see if we can find a level matching with our avg bandwidth AND that could also guarantee no rebuffering at all
    let bestLevel = this.findBestLevel(currentLevel,currentFragDuration,avgbw,minAutoLevel,maxAutoLevel,bufferStarvationDelay,config.abrBandWidthFactor,config.abrBandWidthUpFactor,levels);
    if (bestLevel >= 0) {
      return bestLevel;
    } else {
      logger.trace('rebuffering expected to happen, lets try to find a quality level minimizing the rebuffering');
      // not possible to get rid of rebuffering ... let's try to find level that will guarantee less than maxStarvationDelay of rebuffering
      // if no matching level found, logic will return 0
      let maxStarvationDelay = config.maxStarvationDelay,
          bwFactor = config.abrBandWidthFactor,
          bwUpFactor = config.abrBandWidthUpFactor;
      if (bufferStarvationDelay === 0) {
        // in case buffer is empty, let's check if previous fragment was loaded to perform a bitrate test
        let bitrateTestDelay = this.bitrateTestDelay;
        if (bitrateTestDelay) {
          // if it is the case, then we need to adjust our max starvation delay using maxLoadingDelay config value
          // max video loading delay used in  automatic start level selection :
          // in that mode ABR controller will ensure that video loading time (ie the time to fetch the first fragment at lowest quality level +
          // the time to fetch the fragment at the appropriate quality level is less than ```maxLoadingDelay``` )
          maxStarvationDelay = config.maxLoadingDelay - bitrateTestDelay;
          logger.trace(`bitrate test took ${Math.round(1000*bitrateTestDelay)}ms, set first fragment max fetchDuration to ${Math.round(1000*maxStarvationDelay)} ms`);
          // don't use conservative factor on bitrate test
          bwFactor = bwUpFactor = 1;
        }
      }
      bestLevel = this.findBestLevel(currentLevel,currentFragDuration,avgbw,minAutoLevel,maxAutoLevel,bufferStarvationDelay+maxStarvationDelay,bwFactor,bwUpFactor,levels);
      return Math.max(bestLevel,0);
    }
  }

  findBestLevel(currentLevel,currentFragDuration,currentBw,minAutoLevel,maxAutoLevel,maxFetchDuration,bwFactor,bwUpFactor,levels) {
    for (let i = maxAutoLevel; i >= minAutoLevel; i--) {
      let levelInfo = levels[i],
          levelDetails = levelInfo.details,
          avgDuration = levelDetails ? levelDetails.totalduration/levelDetails.fragments.length : currentFragDuration,
          live = levelDetails ? levelDetails.live : false,
          adjustedbw;
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
      const bitrate = levels[i].bitrate,
            fetchDuration = bitrate * avgDuration / adjustedbw;

    logger.trace(`level/adjustedbw/bitrate/avgDuration/maxFetchDuration/fetchDuration: ${i}/${Math.round(adjustedbw)}/${bitrate}/${avgDuration}/${maxFetchDuration}/${fetchDuration}`);
      // if adjusted bw is greater than level bitrate AND
      if (adjustedbw > bitrate &&
      // fragment fetchDuration unknown OR live stream OR fragment fetchDuration less than max allowed fetch duration, then this level matches
      // we don't account for max Fetch Duration for live streams, this is to avoid switching down when near the edge of live sliding window ...
        (!fetchDuration || live || fetchDuration < maxFetchDuration) ) {
        // as we are looping from highest to lowest, this will return the best achievable quality level

        return i;
      }
    }
    // not enough time budget even with quality level 0 ... rebuffering might happen
    return -1;
  }

  set nextAutoLevel(nextLevel) {
    this._nextAutoLevel = nextLevel;
  }
}

export default AbrController;

