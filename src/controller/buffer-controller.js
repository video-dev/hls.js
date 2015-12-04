/*
 * Buffer Controller
 *
 * It's role is to handle the stream data and append it to a media for playback for example, using the MSE API
 *
*/

import Event from '../events';
import EventHandler from '../event-handler';

class BufferController extends EventHandler {

  constructor(hls) {
    super(hls, Event.BUFFER_APPENDING,
                Event.BUFFER_CODECS,
                Event.BUFFER_EOS,
                Event.BUFFER_FLUSHING,
                Event.BUFFER_FLUSHED,
                Event.BUFFER_EOS,
                Event.MEDIA_ATTACHING,
                Event.MEDIA_DETACHING);
  }

  destroy() {
    EventHandler.prototype.destroy.call(this);
  }

  finishAppending() {
    this.hls.trigger(Event.BUFFER_APPENDED);
  }

  // implement these in specific class
  onBufferCodecs() {}
  onBufferAppending() {}
  onMediaAttaching() {}
  onMediaDetaching() {}
  onBufferEOS() {}
}

export default BufferController;