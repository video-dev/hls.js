/*
 * Buffer Controller
 *
 * It's role is to handle the stream data and append it to a media for playback for example, using the MSE API
 *
*/

import Event from '../events';
import {logger} from '../utils/logger';
import {ErrorTypes, ErrorDetails} from '../errors';

class BufferController {

  constructor(hls) {
    this.hls = hls;

    this.onEvent = this.onEvent.bind(this);
    this.handledEvents = [Event.BUFFER_APPENDING,
                        Event.BUFFER_CODECS,
                        Event.BUFFER_EOS,
                        Event.BUFFER_FLUSH,
                        Event.MEDIA_ATTACHING,
                        Event.MEDIA_DETACHING];

    this.registerListeners();
  }

  destroy() {
    this.unregisterListeners();
  }

  isEventHandler() {
    return typeof this.handledEvents === 'object' && typeof this.onEvent === 'function'
  }

  registerListeners() {
    if (this.isEventHandler()) {
      this.handledEvents.forEach(function(event) {
        this.hls.on(event, this.onEvent);
      }.bind(this));
    }
  }

  unregisterListeners() {
    if (this.isEventHandler()) {
      this.handledEvents.forEach(function(event) {
        this.hls.off(event, this.onEvent);
      }.bind(this));
    }
  }

  onEvent(event, data) {
    switch(event) {
    case Event.BUFFER_APPENDING:
      this.onBufferAppending(data);
      break;
    case Event.BUFFER_CODECS:
      this.onBufferCodecs(data);
      break;
    case Event.BUFFER_EOS:
      this.onBufferEOS(data);
      break;
    case Event.BUFFER_FLUSH:
      this.onBufferFlush(data);
      break;
    case Event.MEDIA_ATTACHING:
      this.onMediaAttaching(data);
      break;
    case Event.MEDIA_DETACHING:
      this.onMediaDetaching(data);
      break;
    }
  }

  finishAppending() {
    this.hls.trigger(Event.BUFFER_APPENDED);
  }

  // implement these in specific class
  onBufferCodecs(data) {}
  onBufferAppending(data) {}
  onBufferEOS() {}
  onMediaAttaching(data) {}
  onMediaDetaching() {}
}

class MSEBufferController extends BufferController {

	constructor(hls) {

    super(hls);

    // Source Buffer listeners
    this.onsbue = this.onSBUpdateEnd.bind(this);
    this.onsbe  = this.onSBUpdateError.bind(this);

    this.appendError = 0;
    this.segmentQueue = [];
	}

  onMediaAttaching(data) {
    var media = this.media = data.media;
    // setup the media source
    var ms = this.mediaSource = new MediaSource();
    //Media Source listeners
    this.onmso = this.onMediaSourceOpen.bind(this);
    this.onmse = this.onMediaSourceEnded.bind(this);
    this.onmsc = this.onMediaSourceClose.bind(this);
    ms.addEventListener('sourceopen', this.onmso);
    ms.addEventListener('sourceended', this.onmse);
    ms.addEventListener('sourceclose', this.onmsc);
    // link video and media Source
    media.src = URL.createObjectURL(ms);
    // FIXME: this was in code before but onverror was never set! can be removed or fixed?
    //media.addEventListener('error', this.onverror);
  }

  onMediaDetaching() {
    var media = this.media;
    if (media && media.ended) {
      logger.log('MSE detaching and video ended, reset startPosition');
      this.startPosition = this.lastCurrentTime = 0;
    }

    // Clean up all the SourceBuffers
    if (this.sourceBuffer) {
      for(var type in this.sourceBuffer) {
        var sb = this.sourceBuffer[type];
        try {
          this.mediaSource.removeSourceBuffer(sb);
          sb.removeEventListener('updateend', this.onsbue);
          sb.removeEventListener('error', this.onsbe);
        } catch(err) {
        }
      }
      this.sourceBuffer = null;
    }

    var ms = this.mediaSource;
    if (ms) {
      if (ms.readyState === 'open') {
        ms.endOfStream();
      }
      ms.removeEventListener('sourceopen', this.onmso);
      ms.removeEventListener('sourceended', this.onmse);
      ms.removeEventListener('sourceclose', this.onmsc);
      // unlink MediaSource from video tag
      this.mediaSource = null;
    }
    this.media = null;
    this.onmso = this.onmse = this.onmsc = null;
    this.hls.trigger(Event.MEDIA_DETACHED);
  }

  onMediaSourceOpen() {
    logger.log('media source opened');
    this.hls.trigger(Event.MEDIA_ATTACHED);

    // once received, don't listen anymore to sourceopen event
    this.mediaSource.removeEventListener('sourceopen', this.onmso);
  }

  onMediaSourceClose() {
    logger.log('media source closed');
  }

  onMediaSourceEnded() {
    logger.log('media source ended');
  }

  onSBUpdateError(event) {
    logger.error(`sourceBuffer error:${event}`);
    this.state = State.ERROR;
    this.hls.trigger(Event.ERROR, {type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.FRAG_APPENDING_ERROR, fatal: true, frag: this.fragCurrent});
  }

  onSBUpdateEnd() {
    // first try to append more segments if there are
    this.dequeueSegments();
    // now trigger next steps
    this.finishAppending();
  }

  onBufferCodecs(data) {
    var audioCodec = data.audioCodec;
    var videoCodec = data.videoCodec;
    var sb;
    if (!this.sourceBuffer) {
      this.sourceBuffer = {};
      logger.log(`selected A/V codecs for sourceBuffers:${audioCodec},${videoCodec}`);
      // create source Buffer and link them to MediaSource
      if (audioCodec) {
        sb = this.sourceBuffer.audio = this.mediaSource.addSourceBuffer(`video/mp4;codecs=${audioCodec}`);
        sb.addEventListener('updateend', this.onsbue);
        sb.addEventListener('error', this.onsbe);
      }
      if (videoCodec) {
        sb = this.sourceBuffer.video = this.mediaSource.addSourceBuffer(`video/mp4;codecs=${videoCodec}`);
        sb.addEventListener('updateend', this.onsbue);
        sb.addEventListener('error', this.onsbe);
      }
    }

    // try to dequeue some segments if we can now
    this.dequeueSegments();
  }

  onBufferAppending(data) {
    var segment = data.segment;
    this.segmentQueue.push(segment);
    this.dequeueSegments();
  }

  dequeueSegments() {
    if (!this.sourceBuffer) {
      return;
    }
    for(var segment = this.segmentQueue.shift(); !!segment; segment = this.segmentQueue.shift()) {
      // if segment appending in progress nothing to do
      if ((this.sourceBuffer.audio && this.sourceBuffer.audio.updating) ||
         (this.sourceBuffer.video && this.sourceBuffer.video.updating)) {
        this.segmentQueue.unshift(segment);
        break;
      }
      this.tryAppending(segment);
    }
  }

  tryAppending(segment) {
    try {
      logger.log(`appending ${segment.type} SB, size:${segment.data.length}`);
      this.sourceBuffer[segment.type].appendBuffer(segment.data);
      this.appendError = 0;
    } catch(err) {
      logger.log('error while appending: ' + err.message);
      if (this.appendError) {
        this.appendError++;
      } else {
        this.appendError = 1;
      }
      var event = {type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.FRAG_APPENDING_ERROR, segment: segment};
      /* with UHD content, we could get loop of quota exceeded error until
        browser is able to evict some data from sourcebuffer. retrying help recovering this
      */
      if (this.appendError > this.hls.config.appendErrorMaxRetry) {
        logger.log(`fail ${this.config.appendErrorMaxRetry} times to append segment in sourceBuffer`);
        event.fatal = true;
        hls.trigger(Event.BUFFER_APPEND_FAIL, event);
        return;
      } else {
        event.fatal = false;
        hls.trigger(Event.BUFFER_APPEND_FAIL, event);
      }
    }
  }

  onBufferEOS() {
    var mediaSource = this.mediaSource;
    if (mediaSource && mediaSource.readyState === 'open') {
      logger.log('all media data available, signal endOfStream() to MediaSource');
      //Notify the media element that it now has all of the media data
      mediaSource.endOfStream();
    }
  }

  /*
    abort any buffer append in progress, and flush all buffered data
    return true once everything has been flushed.
    sourceBuffer.abort() and sourceBuffer.remove() are asynchronous operations
    the idea is to call this function from tick() timer and call it again until all resources have been cleaned
    the timer is rearmed upon sourceBuffer updateend() event, so this should be optimal
  */
  onBufferFlush(data) {
    var startOffset = data.startOffset;
    var endOffset = data.endOffset;
    var sb, i, bufStart, bufEnd, flushStart, flushEnd;
    //logger.log('flushBuffer,pos/start/end: ' + this.media.currentTime + '/' + startOffset + '/' + endOffset);

    if (this.sourceBuffer) {

      for (var type in this.sourceBuffer) {
        sb = this.sourceBuffer[type];
        if (!sb.updating) {
          for (i = 0; i < sb.buffered.length; i++) {
            bufStart = sb.buffered.start(i);
            bufEnd = sb.buffered.end(i);
            // workaround firefox not able to properly flush multiple buffered range.
            if (navigator.userAgent.toLowerCase().indexOf('firefox') !== -1 && endOffset === Number.POSITIVE_INFINITY) {
              flushStart = startOffset;
              flushEnd = endOffset;
            } else {
              flushStart = Math.max(bufStart, startOffset);
              flushEnd = Math.min(bufEnd, endOffset);
            }
            /* sometimes sourcebuffer.remove() does not flush
               the exact expected time range.
               to avoid rounding issues/infinite loop,
               only flush buffer range of length greater than 500ms.
            */
            if (flushEnd - flushStart > 0.5) {
              logger.log(`flush ${type} [${flushStart},${flushEnd}], of [${bufStart},${bufEnd}], pos:${this.media.currentTime}`);
              sb.remove(flushStart, flushEnd);
            }
          }
        }
      }
    }
  }
}

export default MSEBufferController;