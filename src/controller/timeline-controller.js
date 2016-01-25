/*
 * Timeline Controller
*/

import Event from '../events';
import {logger} from '../utils/logger';
import CEA708Interpreter from '../utils/cea-708-interpreter';

class TimelineController {

  constructor(hls) {
    this.hls = hls;
    this.config = hls.config;

    if (this.config.enableCEA708Captions)
    {
      this.onmediaatt0 = this.onMediaAttaching.bind(this);
      this.onmediadet0 = this.onMediaDetaching.bind(this);
      this.onud = this.onFragParsingUserData.bind(this);
      this.onfl = this.onFragLoaded.bind(this);
      this.onml = this.onManifestLoading.bind(this);
      hls.on(Event.MEDIA_ATTACHING, this.onmediaatt0);
      hls.on(Event.MEDIA_DETACHING, this.onmediadet0);
      hls.on(Hls.Events.FRAG_PARSING_USERDATA, this.onud);
      hls.on(Event.MANIFEST_LOADING, this.onml);
      hls.on(Event.FRAG_LOADED, this.onfl);

      this.cea708Interpreter = new CEA708Interpreter();
    }
  }

  destroy() {
  }

  onMediaAttaching(event, data) {
    var media = this.media = data.media;
    this.cea708Interpreter.attach(media);
  }

  onMediaDetaching() {
    this.cea708Interpreter.detatch()
  }

  onManifestLoading()
  {
    this.lastPts = Number.POSITIVE_INFINITY;
  }

  onFragLoaded(event, data)
  {
    var pts = data.frag.start; //Number.POSITIVE_INFINITY;

    // if this is a frag for a previously loaded timerange, remove all captions
    // TODO: consider just removing captions for the timerange
    if (pts < this.lastPts)
    {
      this.cea708Interpreter.clear();
    }

    this.lastPts = pts;
  }

  onFragParsingUserData(event, data) {
    // push all of the CEA-708 messages into the interpreter
    // immediately. It will create the proper timestamps based on our PTS value
    for (var i=0; i<data.samples.length; i++)
    {
      this.cea708Interpreter.push(data.samples[i].pts, data.samples[i].bytes);
    }
  }
}

export default TimelineController;