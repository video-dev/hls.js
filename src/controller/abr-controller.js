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

class AbrController extends EventHandler {

  constructor(hls) {
    super(hls, Event.FRAG_LOADING,
               Event.FRAG_LOAD_PROGRESS,
               Event.FRAG_LOADED,
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
    if (!this.timer) {
      this.timer = setInterval(this.onCheck, 100);
    }
    this.fragCurrent = data.frag;
  }

  onFragLoadProgress(data) {
    var stats = data.stats;
    // only update stats if first frag loading
    // if same frag is loaded multiple times, it might be in browser cache, and loaded quickly
    // and leading to wrong bw estimation
    if (stats.aborted === undefined && data.frag.loadCounter === 1) {
      this.lastfetchduration = (performance.now() - stats.trequest) / 1000;
      this.lastbw = (stats.loaded * 8) / this.lastfetchduration;
      //console.log(`fetchDuration:${this.lastfetchduration},bw:${(this.lastbw/1000).toFixed(0)}/${stats.aborted}`);
    }
  }

  abandonRulesCheck() {
    /*
      monitor fragment retrieval time...
      we compute expected time of arrival of the complete fragment.
      we compare it to expected time of buffer starvation
    */
    let hls = this.hls, v = hls.media,frag = this.fragCurrent;

    // if loader has been destroyed or loading has been aborted, stop timer and return
    if(!frag.loader || ( frag.loader.stats && frag.loader.stats.aborted)) {
      logger.warn(`frag loader destroy or aborted, disarm abandonRulesCheck`);
      this.clearTimer();
      return;
    }
    /* only monitor frag retrieval time if
    (video not paused OR first fragment being loaded(ready state === HAVE_NOTHING = 0)) AND autoswitching enabled AND not lowest level (=> means that we have several levels) */
    if (v && ((!v.paused && (v.playbackRate !== 0)) || !v.readyState) && frag.autoLevel && frag.level) {
      let requestDelay = performance.now() - frag.trequest,
          playbackRate = Math.abs(v.playbackRate);
      // monitor fragment load progress after half of expected fragment duration,to stabilize bitrate
      if (requestDelay > (500 * frag.duration / playbackRate)) {
        let loadRate = Math.max(1,frag.loaded * 1000 / requestDelay); // byte/s; at least 1 byte/s to avoid division by zero
        if (frag.expectedLen < frag.loaded) {
          frag.expectedLen = frag.loaded;
        }
        let pos = v.currentTime;
        let fragLoadedDelay = (frag.expectedLen - frag.loaded) / loadRate;
        let bufferStarvationDelay = (BufferHelper.bufferInfo(v,pos,hls.config.maxBufferHole).end - pos) / playbackRate;
        // consider emergency switch down only if we have less than 2 frag buffered AND
        // time to finish loading current fragment is bigger than buffer starvation delay
        // ie if we risk buffer starvation if bw does not increase quickly
        if ((bufferStarvationDelay < (2 * frag.duration / playbackRate)) && (fragLoadedDelay > bufferStarvationDelay)) {
          let fragLevelNextLoadedDelay, nextLoadLevel;
          // lets iterate through lower level and try to find the biggest one that could avoid rebuffering
          // we start from current level - 1 and we step down , until we find a matching level
          for (nextLoadLevel = frag.level - 1 ; nextLoadLevel >=0 ; nextLoadLevel--) {
            // compute time to load next fragment at lower level
            // 0.8 : consider only 80% of current bw to be conservative
            // 8 = bits per byte (bps/Bps)
            fragLevelNextLoadedDelay = frag.duration * hls.levels[nextLoadLevel].bitrate / (8 * 0.8 * loadRate);
            logger.log(`fragLoadedDelay/bufferStarvationDelay/fragLevelNextLoadedDelay[${nextLoadLevel}] :${fragLoadedDelay.toFixed(1)}/${bufferStarvationDelay.toFixed(1)}/${fragLevelNextLoadedDelay.toFixed(1)}`);
            if (fragLevelNextLoadedDelay < bufferStarvationDelay) {
              // we found a lower level that be rebuffering free with current estimated bw !
              break;
            }
          }
          // only emergency switch down if it takes less time to load new fragment at lowest level instead
          // of finishing loading current one ...
          if (fragLevelNextLoadedDelay < fragLoadedDelay) {
            // ensure nextLoadLevel is not negative
            nextLoadLevel = Math.max(0,nextLoadLevel);
            // force next load level in auto mode
            hls.nextLoadLevel = nextLoadLevel;
            // abort fragment loading ...
            logger.warn(`loading too slow, abort fragment loading and switch to level ${nextLoadLevel}`);
            //abort fragment loading
            frag.loader.abort();
            this.clearTimer();
            hls.trigger(Event.FRAG_LOAD_EMERGENCY_ABORTED, {frag: frag});
          }
        }
      }
    }
  }

  onFragLoaded(data) {
    // stop monitoring bw once frag loaded
    this.clearTimer();
    // store level id after successful fragment load
    this.lastLoadedFragLevel = data.frag.level;
    // reset forced auto level value so that next level will be selected
    this._nextAutoLevel = -1;
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
    let hls = this.hls;
    var maxAutoLevel;
    if (this._autoLevelCapping === -1 && hls.levels && hls.levels.length) {
      maxAutoLevel = hls.levels.length - 1;
    } else {
      maxAutoLevel = this._autoLevelCapping;
    }

    // in case next auto level has been forced, return it straight-away (but capped)
    if (this._nextAutoLevel !== -1) {
      return Math.min(this._nextAutoLevel,maxAutoLevel);
    }

    let v = hls.media,
        frag = this.fragCurrent,
        pos = v.currentTime,
        lastbw = this.lastbw,

    // playbackRate is the absolute value of the playback rate; if v.playbackRate is 0, we use 1 to load as
    // if we're playing back at the normal rate.
    playbackRate = ((v.playbackRate !== 0) ? Math.abs(v.playbackRate) : 1.0),

    // bufferStarvationDelay is the wall-clock time left until the playback buffer is exhausted.
    bufferStarvationDelay = (BufferHelper.bufferInfo(v, pos, hls.config.maxBufferHole).end - pos) / playbackRate,

    // targetMinBuffered is the wall-clock time of two segments' worth of media. We aim to maintain this
    // much buffered data (minimum) while choosing the next level.
    targetMinBuffered = 2 * frag.duration / playbackRate,

    // availableFetchTime is how much "free time" we have to load the next segment in order to preserve
    // the minimum amount of buffered data. This can be negative, meaning we're below our target minimum
    // buffered threshold.
    availableFetchTime = bufferStarvationDelay - targetMinBuffered;

    var i;

    logger.trace(`bufferStarvationDelay/targetMinBuffered/availableFetchTime: ${bufferStarvationDelay}/${targetMinBuffered}/${availableFetchTime}`);

    // If availableFetchTime is positive, we have a relatively easy choice to make -- find the highest level
    // that can (most likely) be fetched in availableFetchTime seconds.
    if (availableFetchTime > 0) {
      for (i = maxAutoLevel; i >= 0 ; i--) {
        let bitrate = hls.levels[i].bitrate,
            fetchTime = bitrate * frag.duration / lastbw;
        logger.trace(`level/bitrate/lastbw/fetchTime/return: ${i}/${bitrate}/${lastbw}/${fetchTime}/${fetchTime < availableFetchTime}`);
        if (fetchTime < availableFetchTime) {
          return i;
        }
      }
    }

    // If we get here, then availableFetchTime is either negative or so small that we couldn't expect to
    // fetch any of the levels in time. We don't necessarily have to switch down to zero, but should choose
    // a level that can be fetched faster than playback so we build our buffer back up to targetMinBuffered.
    for (i = maxAutoLevel; i >= 0 ; i--) {
      let bitrate = hls.levels[i].bitrate,
          fetchTime = bitrate * frag.duration / lastbw,

          // timeRecovered is the amount of buffered time that will be "recovered" assuming we're able to
          // fetch the segment in the expected time.
          timeRecovered = frag.duration - fetchTime;

      logger.trace(`level/bitrate/lastbw/fetchTime/timeRecovered/return: ${i}/${bitrate}/${lastbw}/${fetchTime}/${timeRecovered}/${availableFetchTime + timeRecovered > 0}`);
      if (availableFetchTime + timeRecovered > 0) {
        return i;
      }
    }

    // If we get here, we're struggling to find a level that can be reasonably loaded in time. We'll return
    // 0 as a last resort.
    logger.warn('Unable to find a segment we can reasonably expect to fetch in time; returning level 0.');
    return 0;
  }

  set nextAutoLevel(nextLevel) {
    this._nextAutoLevel = nextLevel;
  }
}

export default AbrController;

