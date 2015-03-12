/*
 * level controller
 *
 */

 import Event                from '../events';
 import observer             from '../observer';
 import {logger}             from '../utils/logger';


 class LevelController {

  constructor(video,playlistLoader) {
    this.video = video;
    this.playlistLoader = playlistLoader;
    this.onml = this.onManifestLoaded.bind(this);
    this.onfl = this.onFragmentLoaded.bind(this);
    this.onll = this.onLevelLoaded.bind(this);
    this.ontick = this.tick.bind(this);
    observer.on(Event.MANIFEST_LOADED, this.onml);
    observer.on(Event.FRAGMENT_LOADED, this.onfl);
    observer.on(Event.LEVEL_LOADED, this.onll);

    //this.startLevel = startLevel;
  }

  destroy() {
    observer.removeListener(Event.MANIFEST_LOADED, this.onml);
    observer.removeListener(Event.FRAGMENT_LOADED, this.onfl);
    observer.removeListener(Event.LEVEL_LOADED, this.onll);
    if(this.timer) {
     clearInterval(this.timer);
    }
  }

  onManifestLoaded(event,data) {
    var levels = [],bitrateStart,i,bitrateSet={};
    // remove failover level for now to simplify the logic
    data.levels.forEach(level => {
      if(!bitrateSet.hasOwnProperty(level.bitrate)) {
        levels.push(level);
        bitrateSet[level.bitrate] = true;
      }
    });
    // start bitrate is the first bitrate of the manifest
    bitrateStart = levels[0].bitrate;
    // sort level on bitrate
    levels.sort(function (a, b) {
      return a.bitrate-b.bitrate;
    });
    this.levels = levels;
    // find index of start level in sorted levels
    for(i=0; i < levels.length ; i++) {
      if(levels[i].bitrate === bitrateStart) {
        this._startLevel = i;
        logger.log('manifest loaded,' + levels.length + ' level(s) found, start bitrate:' + bitrateStart);
        break;
      }
    }
    observer.trigger(Event.MANIFEST_PARSED,
                    { levels : this.levels,
                      startLevel : i});
    return;
  }

  get level() {
    return this._level;
  }

  set level(newLevel) {
    if(this._level !== newLevel) {
      // check if level idx is valid
      if(newLevel >= 0 && newLevel < this.levels.length) {
        // stopping live reloading timer if any
        if(this.timer) {
         clearInterval(this.timer);
        }
        this._level = newLevel;
        logger.log('switching to level ' + newLevel);
        observer.trigger(Event.LEVEL_SWITCH, { level : newLevel});
         // check if we need to load playlist for this new level
        if(this.levels[newLevel].loading === undefined) {
          // level not retrieved yet, we need to load it
          observer.trigger(Event.LEVEL_LOADING, { level : newLevel});
          this.playlistLoader.load(this.levels[newLevel].url,newLevel);
          this.levels[newLevel].loading = true;
        }
      } else {
        // invalid level id given, trigger error
        observer.trigger(Event.LEVEL_ERROR, { level : newLevel, event: 'invalid level idx'});
      }
    }
  }

  onFragmentLoaded(event,data) {
    var stats,rtt,loadtime;
    stats = data.stats;
    rtt = stats.tfirst - stats.trequest;
    loadtime = stats.tend - stats.trequest;
    this.lastbw = stats.length*8000/loadtime;
  }


  onLevelLoaded(event,data) {
    // check if current playlist is a live playlist
    if(data.level.endList === false && !this.timer) {
      // if live playlist we will have to reload it periodically
      // set reload period to playlist target duration
      this.timer = setInterval(this.ontick, 1000*data.level.targetduration);
    }
  }

  tick() {
    logger.log('on tick');
    observer.trigger(Event.LEVEL_LOADING, { level : this._level});
    this.playlistLoader.load(this.levels[this._level].url,this._level);
  }

  startLevel() {
    return this._startLevel;
    //return this.levels.length-1;
    //return 0;
  }

  bestLevel() {
    // if(this._level == 0) {
    //   return this.levels.length-1;
    // } else {
    //   return 0;
    // }
    var lastbw = this.lastbw,adjustedbw,i;
    // follow algorithm captured from stagefright :
    // https://android.googlesource.com/platform/frameworks/av/+/master/media/libstagefright/httplive/LiveSession.cpp
    // Pick the highest bandwidth stream below or equal to estimated bandwidth.
    for(i =0; i < this.levels.length ; i++) {
    // consider only 80% of the available bandwidth, but if we are switching up,
    // be even more conservative (70%) to avoid overestimating and immediately
    // switching back.
      if(i <= this._level) {
        adjustedbw = 0.8*lastbw;
      } else {
        adjustedbw = 0.7*lastbw;
      }
      if(adjustedbw < this.levels[i].bitrate) {
        return Math.max(0,i-1);
      }
    }
    return i-1;
  }
}

export default LevelController;
