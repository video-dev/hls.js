/*
 * level controller
 *
 */

 import Event                from '../events';
 import observer             from '../observer';
// import {logger}             from '../utils/logger';


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
    this.levels = data.levels;
  }


  onFragmentLoaded(event,data) {
    var stats,rtt,loadtime,bw;
    stats = data.stats;
    rtt = stats.tfirst - stats.trequest;
    loadtime = stats.tend - stats.trequest;
    bw = stats.length*8/(1000*loadtime);
  }


  startLevel() {
    //return 0;
    return this.levels.length-1;
  }

  bestLevel() {
    //return Math.floor(Math.random()*this.levels.length);
    return this.levels.length-1;
  }
}

export default LevelController;
