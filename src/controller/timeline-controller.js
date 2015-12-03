/*
 * Timeline Controller
*/

import Event from '../events';
import {logger} from '../utils/logger';
import CEA708Interpreter from '../utils/cea-708-interpreter';

class TimelineController {

  constructor(hls) {
    this.hls = hls;
    this.userDataQueue = [];
    this.timer = setInterval(this.checkTracks.bind(this), 250);
    this.onmediaatt0 = this.onMediaAttaching.bind(this);
    this.onmediadet0 = this.onMediaDetaching.bind(this);
    this.onud = this.onFragParsingUserData.bind(this);
    this.index = 0;
    hls.on(Event.MEDIA_ATTACHING, this.onmediaatt0);
    hls.on(Event.MEDIA_DETACHING, this.onmediadet0);
    hls.on(Hls.Events.FRAG_PARSING_USERDATA, this.onud);
  }

  destroy() {
    if (this.timer) {
     clearInterval(this.timer);
    }
  }

  onMediaAttaching(event, data) {
    var media = this.media = data.media;
    this.cea708Interpreter = new CEA708Interpreter(this.media);
  }

  onMediaDetaching() {
  }

  onFragParsingUserData(event, data) {
    for (var i=0; i<data.samples.length; i++)
    {
      this.userDataQueue.push(data.samples[i]);
    }
  }

  checkTracks() {
    var v = this.hls.media;
    var u = this.userDataQueue;
    if (v && u && u.length) {
      while (v.currentTime >= u[this.index].pts)
      {
        this.cea708Interpreter.push(u[this.index++].bytes);
      }
    }
  }
}

export default TimelineController;