/*
 * level controller
 *
 */

 import Event                from '../events';
 import observer             from '../observer';
 import {logger}             from '../utils/logger';


 class LevelController {

  constructor(video) {
    this.video = video;
    this.onml = this.onManifestLoaded.bind(this);
    this.onfl = this.onFragmentLoaded.bind(this);
    observer.on(Event.MANIFEST_LOADED, this.onml);
    observer.on(Event.FRAGMENT_LOADED, this.onfl);
    //this.startLevel = startLevel;
  }

  destroy() {
    observer.removeListener(Event.MANIFEST_LOADED, this.onml);
    observer.removeListener(Event.FRAGMENT_LOADED, this.onfl);
    this.levels = null;
  }

  onManifestLoaded(event,data) {
    var levels = data.levels, bitrateStart, i;
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
        this.level = this._startLevel = i;
        logger.log('manifest loaded,' + levels.length + ' level(s) found, start bitrate:' + bitrateStart);
        return;
      }
    }
  }


  onFragmentLoaded(event,data) {
    var stats,rtt,loadtime,bw;
    stats = data.stats;
    rtt = stats.tfirst - stats.trequest;
    loadtime = stats.tend - stats.trequest;
    bw = stats.length*8/(1000*loadtime);
  }


  startLevel() {
    return this._startLevel;
  }

  bestLevel() {
    this.level = (this.level+1) % (this.levels.length-1);
    return this.level;
    //return Math.floor(Math.random()*this.levels.length);
    //return this.levels.length-1;
  }
}

export default LevelController;
