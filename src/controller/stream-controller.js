/*
 * Stream Controller
 */

import Event from '../events';
import EventHandler from '../event-handler';
import {logger} from '../utils/logger';

class StreamController extends EventHandler {


  set mediaBuffer(mediaBuffer) {
    if (this._mediaBuffer !== mediaBuffer) {
      this._mediaBuffer = mediaBuffer;

      this.hls.trigger(Event.MEDIA_BUFFER_UPDATED, {
        type : this.type,
        mediaBuffer : this.mediaBuffer
      });
    }
  }

  get mediaBuffer() {
    return this._mediaBuffer;
  }

}
export default StreamController;

