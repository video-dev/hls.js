/*
 * Buffer Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {logger} from '../utils/logger';
import {ErrorTypes, ErrorDetails} from '../errors';


class BufferController extends EventHandler {

  constructor(hls) {
    super(hls,
      Event.MEDIA_ATTACHING,
      Event.MEDIA_DETACHING,
      Event.MANIFEST_PARSED,
      Event.BUFFER_RESET,
      Event.BUFFER_APPENDING,
      Event.BUFFER_CODECS,
      Event.BUFFER_EOS,
      Event.BUFFER_FLUSHING,
      Event.LEVEL_UPDATED);

    // the value that we have set mediasource.duration to
    // (the actual duration may be tweaked slighly by the browser)
    this._msDuration = null;
    // the value that we want to set mediaSource.duration to
    this._levelDuration = null;

    // Source Buffer listeners
    this.onsbue = this.onSBUpdateEnd.bind(this);
    this.onsbe  = this.onSBUpdateError.bind(this);
    this.pendingTracks = {};
  }

  destroy() {
    EventHandler.prototype.destroy.call(this);
  }

  onManifestParsed(data) {
    let audioExpected = data.audio,
        videoExpected = data.video,
        sourceBufferNb = 0;
    // in case of alt audio 2 BUFFER_CODECS events will be triggered, one per stream controller
    // sourcebuffers will be created all at once when the expected nb of tracks will be reached
    // in case alt audio is not used, only one BUFFER_CODEC event will be fired from main stream controller
    // it will contain the expected nb of source buffers, no need to compute it
    if (data.altAudio && (audioExpected || videoExpected)) {
      sourceBufferNb = (audioExpected ? 1 : 0) + (videoExpected ? 1 : 0);
      logger.log(`${sourceBufferNb} sourceBuffer(s) expected`);
    }
    this.sourceBufferNb = sourceBufferNb;
  }

  onMediaAttaching(data) {
    let media = this.media = data.media;
    if (media) {
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
    }
  }

  onMediaDetaching() {
    logger.log('media source detaching');
    var ms = this.mediaSource;
    if (ms) {
      if (ms.readyState === 'open') {
        try {
          // endOfStream could trigger exception if any sourcebuffer is in updating state
          // we don't really care about checking sourcebuffer state here,
          // as we are anyway detaching the MediaSource
          // let's just avoid this exception to propagate
          ms.endOfStream();
        } catch(err) {
          logger.warn(`onMediaDetaching:${err.message} while calling endOfStream`);
        }
      }
      ms.removeEventListener('sourceopen', this.onmso);
      ms.removeEventListener('sourceended', this.onmse);
      ms.removeEventListener('sourceclose', this.onmsc);

      // Detach properly the MediaSource from the HTMLMediaElement as
      // suggested in https://github.com/w3c/media-source/issues/53.
      if (this.media) {
        this.media.removeAttribute('src');
        this.media.load();
      }

      this.mediaSource = null;
      this.media = null;
      this.pendingTracks = {};
      this.sourceBuffer = {};
      this.flushRange = [];
      this.segments = [];
      this.appended = 0;
    }
    this.onmso = this.onmse = this.onmsc = null;
    this.hls.trigger(Event.MEDIA_DETACHED);
  }

  onMediaSourceOpen() {
    logger.log('media source opened');
    this.hls.trigger(Event.MEDIA_ATTACHED, { media : this.media });
    let mediaSource = this.mediaSource;
    if (mediaSource) {
      // once received, don't listen anymore to sourceopen event
      mediaSource.removeEventListener('sourceopen', this.onmso);
    }
    this.checkPendingTracks();
  }

  checkPendingTracks() {
    // if any buffer codecs pending, check if we have enough to create sourceBuffers
    let pendingTracks = this.pendingTracks,
        pendingTracksNb = Object.keys(pendingTracks).length;
    // if any pending tracks and (if nb of pending tracks gt or equal than expected nb or if unknown expected nb)
    if (pendingTracksNb && (
        this.sourceBufferNb <= pendingTracksNb ||
        this.sourceBufferNb === 0)) {
      // ok, let's create them now !
      this.createSourceBuffers(pendingTracks);
      this.pendingTracks = {};
      // append any pending segments now !
      this.doAppending();
    }
  }

  onMediaSourceClose() {
    logger.log('media source closed');
  }

  onMediaSourceEnded() {
    logger.log('media source ended');
  }


  onSBUpdateEnd() {

    if (this._needsFlush) {
      this.doFlush();
    }

    if (this._needsEos) {
      this.checkEos();
    }
    this.appending = false;
    this.hls.trigger(Event.BUFFER_APPENDED, { parent : this.parent});

    // don't append in flushing mode
    if (!this._needsFlush) {
      this.doAppending();
    }

    this.updateMediaElementDuration();
  }

  onSBUpdateError(event) {
    logger.error(`sourceBuffer error:${event}`);
    // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
    // this error might not always be fatal (it is fatal if decode error is set, in that case
    // it will be followed by a mediaElement error ...)
    this.hls.trigger(Event.ERROR, {type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.BUFFER_APPENDING_ERROR, fatal: false});
    // we don't need to do more than that, as accordin to the spec, updateend will be fired just after
  }

  onBufferReset() {
    var sourceBuffer = this.sourceBuffer;
    for(var type in sourceBuffer) {
      var sb = sourceBuffer[type];
      try {
        this.mediaSource.removeSourceBuffer(sb);
        sb.removeEventListener('updateend', this.onsbue);
        sb.removeEventListener('error', this.onsbe);
      } catch(err) {
      }
    }
    this.sourceBuffer = {};
    this.flushRange = [];
    this.segments = [];
    this.appended = 0;
  }

  onBufferCodecs(tracks) {
    // if source buffer(s) not created yet, appended buffer tracks in this.pendingTracks
    // if sourcebuffers already created, do nothing ...
    if (Object.keys(this.sourceBuffer).length === 0) {
      for (var trackName in tracks) { this.pendingTracks[trackName] = tracks[trackName]; }
      let mediaSource = this.mediaSource;
      if (mediaSource && mediaSource.readyState === 'open') {
        // try to create sourcebuffers if mediasource opened
        this.checkPendingTracks();
      }
    }
  }


  createSourceBuffers(tracks) {
    var sourceBuffer = this.sourceBuffer,mediaSource = this.mediaSource;

    for (let trackName in tracks) {
      if(!sourceBuffer[trackName]) {
        let track = tracks[trackName];
        // use levelCodec as first priority
        let codec = track.levelCodec || track.codec;
        let mimeType = `${track.container};codecs=${codec}`;
        logger.log(`creating sourceBuffer(${mimeType})`);
        try {
          let sb = sourceBuffer[trackName] = mediaSource.addSourceBuffer(mimeType);
          sb.addEventListener('updateend', this.onsbue);
          sb.addEventListener('error', this.onsbe);
          track.buffer = sb;
        } catch(err) {
          logger.error(`error while trying to add sourceBuffer:${err.message}`);
          this.hls.trigger(Event.ERROR, {type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.BUFFER_ADD_CODEC_ERROR, fatal: false, err: err, mimeType : mimeType});
        }
      }
    }
    this.hls.trigger(Event.BUFFER_CREATED, { tracks : tracks } );
  }

  onBufferAppending(data) {
    if (!this._needsFlush) {
      if (!this.segments) {
        this.segments = [ data ];
      } else {
        this.segments.push(data);
      }
      this.doAppending();
    }
  }

  onBufferAppendFail(data) {
    logger.error(`sourceBuffer error:${data.event}`);
    // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
    // this error might not always be fatal (it is fatal if decode error is set, in that case
    // it will be followed by a mediaElement error ...)
    this.hls.trigger(Event.ERROR, {type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.BUFFER_APPENDING_ERROR, fatal: false, frag: this.fragCurrent});
  }

  // on BUFFER_EOS mark matching sourcebuffer(s) as ended and trigger checkEos()
  onBufferEos(data) {
    var sb = this.sourceBuffer;
    let dataType = data.type;
    for(let type in sb) {
      if (!dataType || type === dataType) {
        if (!sb[type].ended) {
          sb[type].ended = true;
          logger.log(`${type} sourceBuffer now EOS`);
        }
      }
    }
    this.checkEos();
  }

 // if all source buffers are marked as ended, signal endOfStream() to MediaSource.
 checkEos() {
    var sb = this.sourceBuffer, mediaSource = this.mediaSource;
    if (!mediaSource || mediaSource.readyState !== 'open') {
      this._needsEos = false;
      return;
    }
    for(let type in sb) {
      if (!sb[type].ended) {
        return;
      }
      if(sb[type].updating) {
        this._needsEos = true;
        return;
      }
    }
    logger.log('all media data available, signal endOfStream() to MediaSource and stop loading fragment');
    //Notify the media element that it now has all of the media data
    mediaSource.endOfStream();
    this._needsEos = false;
 }


  onBufferFlushing(data) {
    this.flushRange.push({start: data.startOffset, end: data.endOffset, type : data.type});
    // attempt flush immediatly
    this.flushBufferCounter = 0;
    this.doFlush();
  }

  onLevelUpdated(event) {
    let details = event.details;
    if (details.fragments.length === 0) {
      return;
    }
    this._levelDuration = details.totalduration + details.fragments[0].start;
    this.updateMediaElementDuration();
  }

  // https://github.com/dailymotion/hls.js/issues/355
  updateMediaElementDuration() {
    let media = this.media,
        mediaSource = this.mediaSource,
        sourceBuffer = this.sourceBuffer,
        levelDuration = this._levelDuration;
    if (levelDuration === null || !media || !mediaSource || !sourceBuffer || media.readyState === 0 || mediaSource.readyState !== 'open') {
      return;
    }
    for (let type in sourceBuffer) {
      if (sourceBuffer[type].updating) {
        // can't set duration whilst a buffer is updating
        return;
      }
    }
    if (this._msDuration === null) {
      // initialise to the value that the media source is reporting
      this._msDuration = mediaSource.duration;
    }
    // levelDuration was the last value we set.
    // not using mediaSource.duration as the browser may tweak this value
    // only update mediasource duration if its value increase, this is to avoid
    // flushing already buffered portion when switching between quality level
    if (levelDuration > this._msDuration && levelDuration > media.duration) {
      logger.log(`Updating mediasource duration to ${levelDuration.toFixed(3)}`);
      this._msDuration = mediaSource.duration = levelDuration;
    }
  }

  doFlush() {
    // loop through all buffer ranges to flush
    while(this.flushRange.length) {
      var range = this.flushRange[0];
      // flushBuffer will abort any buffer append in progress and flush Audio/Video Buffer
      if (this.flushBuffer(range.start, range.end, range.type)) {
        // range flushed, remove from flush array
        this.flushRange.shift();
        this.flushBufferCounter = 0;
      } else {
        this._needsFlush = true;
        // avoid looping, wait for SB update end to retrigger a flush
        return;
      }
    }
    if (this.flushRange.length === 0) {
      // everything flushed
      this._needsFlush = false;

      // let's recompute this.appended, which is used to avoid flush looping
      var appended = 0;
      var sourceBuffer = this.sourceBuffer;
      for (var type in sourceBuffer) {
        appended += sourceBuffer[type].buffered.length;
      }
      this.appended = appended;
      this.hls.trigger(Event.BUFFER_FLUSHED);
    }
  }

  doAppending() {
    var hls = this.hls, sourceBuffer = this.sourceBuffer, segments = this.segments;
    if (Object.keys(sourceBuffer).length) {
      if (this.media.error) {
        this.segments = [];
        logger.error('trying to append although a media error occured, flush segment and abort');
        return;
      }
      if (this.appending) {
        //logger.log(`sb appending in progress`);
        return;
      }
      if (segments && segments.length) {
        var segment = segments.shift();
        try {
          let type = segment.type;
          if(sourceBuffer[type]) {
            // reset sourceBuffer ended flag before appending segment
            sourceBuffer[type].ended = false;
            //logger.log(`appending ${segment.content} ${segment.type} SB, size:${segment.data.length}, ${segment.parent}`);
            this.parent = segment.parent;
            sourceBuffer[type].appendBuffer(segment.data);
            this.appendError = 0;
            this.appended++;
            this.appending = true;
          } else {
            // in case we don't have any source buffer matching with this segment type,
            // it means that Mediasource fails to create sourcebuffer
            // discard this segment, and trigger update end
            this.onSBUpdateEnd();
          }
        } catch(err) {
          // in case any error occured while appending, put back segment in segments table
          logger.error(`error while trying to append buffer:${err.message}`);
          segments.unshift(segment);
          var event = {type: ErrorTypes.MEDIA_ERROR};
          if(err.code !== 22) {
            if (this.appendError) {
              this.appendError++;
            } else {
              this.appendError = 1;
            }
            event.details = ErrorDetails.BUFFER_APPEND_ERROR;
            event.frag = this.fragCurrent;
            /* with UHD content, we could get loop of quota exceeded error until
              browser is able to evict some data from sourcebuffer. retrying help recovering this
            */
            if (this.appendError > hls.config.appendErrorMaxRetry) {
              logger.log(`fail ${hls.config.appendErrorMaxRetry} times to append segment in sourceBuffer`);
              segments = [];
              event.fatal = true;
              hls.trigger(Event.ERROR, event);
              return;
            } else {
              event.fatal = false;
              hls.trigger(Event.ERROR, event);
            }
          } else {
            // QuotaExceededError: http://www.w3.org/TR/html5/infrastructure.html#quotaexceedederror
            // let's stop appending any segments, and report BUFFER_FULL_ERROR error
            this.segments = [];
            event.details = ErrorDetails.BUFFER_FULL_ERROR;
            hls.trigger(Event.ERROR,event);
            return;
          }
        }
      }
    }
  }

  /*
    flush specified buffered range,
    return true once range has been flushed.
    as sourceBuffer.remove() is asynchronous, flushBuffer will be retriggered on sourceBuffer update end
  */
  flushBuffer(startOffset, endOffset, typeIn) {
    var sb, i, bufStart, bufEnd, flushStart, flushEnd, sourceBuffer = this.sourceBuffer;
    if (Object.keys(sourceBuffer).length) {
      logger.log('flushBuffer,pos/start/end: ' + this.media.currentTime + '/' + startOffset + '/' + endOffset);
      // safeguard to avoid infinite looping : don't try to flush more than the nb of appended segments
      if (this.flushBufferCounter < this.appended) {
        for (var type in sourceBuffer) {
          // check if sourcebuffer type is defined (typeIn): if yes, let's only flush this one
          // if no, let's flush all sourcebuffers
          if (typeIn && type !== typeIn) {
            continue;
          }
          sb = sourceBuffer[type];
          // we are going to flush buffer, mark source buffer as 'not ended'
          sb.ended = false;
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
              if (Math.min(flushEnd,bufEnd) - flushStart > 0.5 ) {
                this.flushBufferCounter++;
                logger.log(`flush ${type} [${flushStart},${flushEnd}], of [${bufStart},${bufEnd}], pos:${this.media.currentTime}`);
                sb.remove(flushStart, flushEnd);
                return false;
              }
            }
          } else {
            //logger.log('abort ' + type + ' append in progress');
            // this will abort any appending in progress
            //sb.abort();
            logger.warn('cannot flush, sb updating in progress');
            return false;
          }
        }
      } else {
        logger.warn('abort flushing too many retries');
      }
      logger.log('buffer flushed');
    }
    // everything flushed !
    return true;
  }
}

export default BufferController;
