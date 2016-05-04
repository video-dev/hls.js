/*
 * Timeline Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import CEA708Interpreter from '../utils/cea-708-interpreter';
import {logger} from '../utils/logger';

class TimelineController extends EventHandler {

  constructor(hls) {
    super(hls, Event.MEDIA_ATTACHING,
                Event.MEDIA_DETACHING,
                Event.FRAG_PARSING_USERDATA,
                Event.MANIFEST_LOADING,
                Event.FRAG_LOADED);

    this.hls = hls;
    this.config = hls.config;

    if (this.config.cea708Enabled) {
      let cea708config = {
        maxDisplayTime: this.config.cea708MaxDisplayTime,
        minDisplayTime: this.config.cea708MinDisplayTime,
        allowedOverlapTime: this.config.cea708AllowedOverlapTime
      };

      logger.log('CEA-708 caption interpreter enabled with config:', JSON.stringify(cea708config));

      this.cea708Interpreter = new CEA708Interpreter(cea708config);
    }
  }

  destroy() {
    EventHandler.prototype.destroy.call(this);
  }

  onMediaAttaching(data) {
    var media = this.media = data.media;

    if (this.cea708Interpreter) {
      this.cea708Interpreter.attach(media);
    }
  }

  onMediaDetaching() {
    if (this.cea708Interpreter) {
      this.cea708Interpreter.detach();
    }
  }

  onManifestLoading() {
    this.lastPts = Number.POSITIVE_INFINITY;
  }

  onFragLoaded(data) {
    var pts = data.frag.start; //Number.POSITIVE_INFINITY;

    // if this is a frag for a previously loaded timerange, remove all captions
    // TODO: consider just removing captions for the timerange
    if (pts <= this.lastPts) {
      if (this.cea708Interpreter) {
        this.cea708Interpreter.clear();
      }
    }

    this.lastPts = pts;
  }

  onFragParsingUserdata(data) {
    // push all of the CEA-708 messages into the interpreter
    // immediately. It will create the proper timestamps based on our PTS value
    for (let i = 0; i < data.samples.length; i++) {
      let pts = data.samples[i].pts;
      let bytes = data.samples[i].bytes;

      if (this.cea708Interpreter) {
        this.cea708Interpreter.push(pts, bytes);
      }
    }
  }
}

export default TimelineController;
