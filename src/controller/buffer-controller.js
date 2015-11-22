/*
 * Buffer Controller
 *
 * It's role is to handle the stream data and append it to a media for playback for example, using the MSE API
 *
*/

import Event from '../events';

class BufferController {

  constructor(hls) {
    this.hls = hls;
    this.hls.on(Event.BUFFER_APPENDING, this.onBufferAppend.bind(this));
  }

  onBufferAppend(data) {
    this._append(data);
  }

  _append(data) {

  }

  finishAppending() {
    this.hls.trigger(Event.BUFFER_APPENDED);
  }
}

class MSEBufferController extends BufferController {

	constructor(hls) {

    super(hls);

    // Source Buffer listeners
    this.onsbue = this.onSBUpdateEnd.bind(this);
    this.onsbe  = this.onSBUpdateError.bind(this);

	}

  onSBUpdateError(event) {
    logger.error(`sourceBuffer error:${event}`);
    this.state = State.ERROR;
    this.hls.trigger(Event.ERROR, {type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.FRAG_APPENDING_ERROR, fatal: true, frag: this.fragCurrent});
  }

  onSBUpdateEnd() {
    this.finishAppending();
  }

}

export default MSEBufferController;