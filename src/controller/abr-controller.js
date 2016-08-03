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
    const stats = data.stats;
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
    const hls = this.hls, v = hls.media,frag = this.fragCurrent;

    // if loader has been destroyed or loading has been aborted, stop timer and return
    if(!frag.loader || ( frag.loader.stats && frag.loader.stats.aborted)) {
      logger.warn(`frag loader destroy or aborted, disarm abandonRulesCheck`);
      this.clearTimer();
      return;
    }
    /* only monitor frag retrieval time if
    (video not paused OR first fragment being loaded(ready state === HAVE_NOTHING = 0)) AND autoswitching enabled AND not lowest level (=> means that we have several levels) */
    if (v && ((!v.paused && (v.playbackRate !== 0)) || !v.readyState) && frag.autoLevel && frag.level) {
      const requestDelay = performance.now() - frag.trequest,
            playbackRate = Math.abs(v.playbackRate);
      // monitor fragment load progress after half of expected fragment duration,to stabilize bitrate
      if (requestDelay > (500 * frag.duration / playbackRate)) {
        const loadRate = Math.max(1,frag.loaded * 1000 / requestDelay); // byte/s; at least 1 byte/s to avoid division by zero
        if (frag.expectedLen < frag.loaded) {
          frag.expectedLen = frag.loaded;
        }
        const pos = v.currentTime,
              fragLoadedDelay = (frag.expectedLen - frag.loaded) / loadRate,
              bufferStarvationDelay = (BufferHelper.bufferInfo(v,pos,hls.config.maxBufferHole).end - pos) / playbackRate;
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
    const hls = this.hls;
    let maxAutoLevel;
    if (this._autoLevelCapping === -1 && hls.levels && hls.levels.length) {
      maxAutoLevel = hls.levels.length - 1;
    } else {
      maxAutoLevel = this._autoLevelCapping;
    }

    // in case next auto level has been forced, return it straight-away (but capped)
    if (this._nextAutoLevel !== -1) {
      return Math.min(this._nextAutoLevel, maxAutoLevel);
    }

    const v = hls.media,
        currentLevel = this.fragCurrent.level,
        avgDuration = ((hls.levels && hls.levels.length && (currentLevel >= 0) && (currentLevel < hls.levels.length)) ? hls.levels[currentLevel].details.averagetargetduration : this.fragCurrent.duration),
        pos = (v ? v.currentTime : 0),

        // 0.8 : consider only 80% of current bw to be conservative
        lastbw = this.lastbw * 0.8,

        // playbackRate is the absolute value of the playback rate; if v.playbackRate is 0, we use 1 to load as
        // if we're playing back at the normal rate.
        playbackRate = ((v && (v.playbackRate !== 0)) ? Math.abs(v.playbackRate) : 1.0),

        // bufferStarvationDelay is the wall-clock time left until the playback buffer is exhausted.
        bufferStarvationDelay = (BufferHelper.bufferInfo(v, pos, hls.config.maxBufferHole).end - pos) / playbackRate,

        // targetMinBuffered is the wall-clock time of two segments' worth of media. We aim to maintain this
        // much buffered data (minimum) while choosing the next level.
        targetMinBuffered = 2 * avgDuration / playbackRate;

    logger.trace(`avgDuration/bufferStarvationDelay/targetMinBuffered: ${avgDuration}/${bufferStarvationDelay}/${targetMinBuffered}`);

    // First, look to see if we can load any levels that maintain `targetMinBuffered` seconds of buffered data.
    if (bufferStarvationDelay > targetMinBuffered) {
      for (let i = maxAutoLevel; i >= 0 ; i--) {
        const bitrate = hls.levels[i].bitrate,
              fetchTime = bitrate * avgDuration / lastbw;
        logger.trace(`level/bitrate/lastbw/fetchTime/return: ${i}/${bitrate}/${lastbw}/${fetchTime}/${bufferStarvationDelay + avgDuration - fetchTime >= targetMinBuffered}`);
        if (bufferStarvationDelay + avgDuration - fetchTime >= targetMinBuffered) {
          return i;
        }
      }
    }

    // If we get here, then no level allows us to achieve `targetMinBuffered` seconds of buffered data. So now
    // we look for a level that simply lets us increase the amount of buffered data, hoping to (eventually)
    // achieve `targetMinBuffered` seconds.
    for (let i = maxAutoLevel; i >= 0 ; i--) {
      const bitrate = hls.levels[i].bitrate,
            fetchTime = bitrate * avgDuration / lastbw;
      logger.trace(`level/bitrate/lastbw/fetchTime/return: ${i}/${bitrate}/${lastbw}/${fetchTime}/${fetchTime < avgDuration}`);
      if (fetchTime < avgDuration) {
        return i;
      }
    }

    // If we get here, we're going to starve the buffer; let's take `maxStarvationDelay` into account and try to
    // choose a quality level that will buffer for <= `maxStarvationDelay`.
    const maxStarvationDelay = hls.config.maxStarvationDelay || (avgDuration / 3.0);
    logger.trace(`maxStarvationDelay=${maxStarvationDelay}`);
    for (let i = maxAutoLevel; i >= 0 ; i--) {
      const bitrate = hls.levels[i].bitrate,
            fetchTime = bitrate * avgDuration / lastbw,
            starvationDelay = fetchTime - bufferStarvationDelay;
      logger.trace(`level/bitrate/lastbw/fetchTime/starvationDelay/return: ${i}/${bitrate}/${lastbw}/${fetchTime}/${starvationDelay}/${starvationDelay < maxStarvationDelay}`);
      if (starvationDelay < maxStarvationDelay) {
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

