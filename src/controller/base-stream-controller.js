import Event from '../events';
import EventHandler from '../event-handler';

/**
 * BaseStreamController.
 *
 * @todo Temporary use BaseStreamController as name to avoid conflicts.
 *       Rename it StreamController once merged on origin/master.
 */
class BaseStreamController extends EventHandler
{
  constructor(type, hls, ...events) {
    super(hls, ...events);

    this._type = type;
  }

  set mediaBuffer(mediaBuffer) {
    if (this._mediaBuffer !== mediaBuffer) {
      this._mediaBuffer = mediaBuffer;

      this.hls.trigger(Event.MEDIA_BUFFER_UPDATED, {
        type : this.type,
        mediaBuffer : this._mediaBuffer
      });
    }
  }

  get mediaBuffer() {
    return this._mediaBuffer || null;
  }

  get type() {
    return this._type || null;
  }
}

export default BaseStreamController;
