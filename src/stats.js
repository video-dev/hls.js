 /*
 * Stats Handler
 *
 */

// import Event                from './events';
// import observer             from './observer';

 class StatsHandler {

  constructor(config) {
    this.config=config;
  }

  destroy() {
  }

  attachVideo(video) {
    this.video = video;

  }

  detachVideo() {
    this.video = null;
  }

  get stats() {
    return {tech : 'hls.js'};
  }
}

export default StatsHandler;
