/*
 * Buffer Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {logger} from '../utils/logger';
import {ErrorTypes, ErrorDetails} from '../errors';
import {getMediaSource} from '../helper/mediasource-helper';

const MediaSource = getMediaSource();

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
      Event.LEVEL_PTS_UPDATED,
      Event.LEVEL_UPDATED);

    this._hls = hls;
    // the value that we have set mediasource.duration to
    // (the actual duration may be tweaked slighly by the browser)
    this._msDuration = null;
    // the value that we want to set mediaSource.duration to
    this._levelDuration = null;

    // Source Buffer listeners
    this._onsbue = this._onSBUpdateEnd.bind(this);
    this._onsbe  = this._onSBUpdateError.bind(this);
    this._pendingTracks = {};
    this._tracks = {};
  }

  destroy() {
    EventHandler.prototype.destroy.call(this);
  }

  onLevelPtsUpdated(data) {
    let type = data.type;
    let audioTrack = this._tracks.audio;

    // Adjusting `SourceBuffer.timestampOffset` (desired point in the timeline where the next frames should be appended)
    // in Chrome browser when we detect MPEG audio container and time delta between level PTS and `SourceBuffer.timestampOffset`
    // is greater than 100ms (this is enough to handle seek for VOD or level change for LIVE videos). At the time of change we issue
    // `SourceBuffer.abort()` and adjusting `SourceBuffer.timestampOffset` if `SourceBuffer.updating` is false or awaiting `updateend`
    // event if SB is in updating state.
    // More info here: https://github.com/video-dev/hls.js/issues/332#issuecomment-257986486

    if (type === 'audio' && audioTrack && audioTrack.container === 'audio/mpeg') { // Chrome audio mp3 track
      let audioBuffer = this._sourceBuffer.audio;
      let delta = Math.abs(audioBuffer.timestampOffset - data.start);

      // adjust timestamp offset if time delta is greater than 100ms
      if (delta > 0.1) {
        let updating = audioBuffer.updating;

        try {
          audioBuffer.abort();
        } catch (err) {
          updating = true;
          logger.warn('can not abort audio buffer: ' + err);
        }

        if (!updating) {
          logger.warn('change mpeg audio timestamp offset from ' + audioBuffer.timestampOffset + ' to ' + data.start);
          audioBuffer.timestampOffset = data.start;
        } else {
          this._audioTimestampOffset = data.start;
        }
      }
    }
  }

  onManifestParsed(data) {
    let audioExpected = data.audio,
        videoExpected = data.video || (data.levels.length && data.audio),
        sourceBufferNb = 0;
    // in case of alt audio 2 BUFFER_CODECS events will be triggered, one per stream controller
    // sourcebuffers will be created all at once when the expected nb of tracks will be reached
    // in case alt audio is not used, only one BUFFER_CODEC event will be fired from main stream controller
    // it will contain the expected nb of source buffers, no need to compute it
    if (data.altAudio && (audioExpected || videoExpected)) {
      sourceBufferNb = (audioExpected ? 1 : 0) + (videoExpected ? 1 : 0);
      logger.log(`${sourceBufferNb} sourceBuffer(s) expected`);
    }
    this._sourceBufferNb = sourceBufferNb;
  }

  onMediaAttaching(data) {
    let media = this._media = data.media;
    if (media) {
      // setup the media source
      var ms = this._mediaSource = new MediaSource();
      //Media Source listeners
      this._onmso = this._onMediaSourceOpen.bind(this);
      this._onmse = this._onMediaSourceEnded.bind(this);
      this._onmsc = this._onMediaSourceClose.bind(this);
      ms.addEventListener('sourceopen', this._onmso);
      ms.addEventListener('sourceended', this._onmse);
      ms.addEventListener('sourceclose', this._onmsc);
      // link video and media Source
      media.src = URL.createObjectURL(ms);
    }
  }

  onMediaDetaching() {
    logger.log('media source detaching');
    var ms = this._mediaSource;
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
      ms.removeEventListener('sourceopen', this._onmso);
      ms.removeEventListener('sourceended', this._onmse);
      ms.removeEventListener('sourceclose', this._onmsc);

      // Detach properly the MediaSource from the HTMLMediaElement as
      // suggested in https://github.com/w3c/media-source/issues/53.
      if (this._media) {
        URL.revokeObjectURL(this._media.src);
        this._media.removeAttribute('src');
        this._media.load();
      }

      this._mediaSource = null;
      this._media = null;
      this._pendingTracks = {};
      this._tracks = {};
      this._sourceBuffer = {};
      this._flushRange = [];
      this._segments = [];
      this._appended = 0;
    }
    this._onmso = this._onmse = this._onmsc = null;
    this._hls.trigger(Event.MEDIA_DETACHED);
  }

  _onMediaSourceOpen() {
    logger.log('media source opened');
    this._hls.trigger(Event.MEDIA_ATTACHED, { media : this._media });
    let mediaSource = this._mediaSource;
    if (mediaSource) {
      // once received, don't listen anymore to sourceopen event
      mediaSource.removeEventListener('sourceopen', this._onmso);
    }
    this._checkPendingTracks();
  }

  _checkPendingTracks() {
    // if any buffer codecs pending, check if we have enough to create sourceBuffers
    let pendingTracks = this._pendingTracks,
        pendingTracksNb = Object.keys(pendingTracks).length;
    // if any pending tracks and (if nb of pending tracks gt or equal than expected nb or if unknown expected nb)
    if (pendingTracksNb && (
        this._sourceBufferNb <= pendingTracksNb ||
        this._sourceBufferNb === 0)) {
      // ok, let's create them now !
      this._createSourceBuffers(pendingTracks);
      this._pendingTracks = {};
      // append any pending segments now !
      this._doAppending();
    }
  }

  _onMediaSourceClose() {
    logger.log('media source closed');
  }

  _onMediaSourceEnded() {
    logger.log('media source ended');
  }


  _onSBUpdateEnd() {
    // update timestampOffset
    if (this._audioTimestampOffset) {
      let audioBuffer = this._sourceBuffer.audio;
      logger.warn('change mpeg audio timestamp offset from ' + audioBuffer.timestampOffset + ' to ' + this._audioTimestampOffset);
      audioBuffer.timestampOffset = this._audioTimestampOffset;
      delete this._audioTimestampOffset;
    }

    if (this._needsFlush) {
      this._doFlush();
    }

    if (this._needsEos) {
      this._checkEos();
    }
    this._appending = false;
    let parent = this._parent;
    // count nb of pending segments waiting for appending on this sourcebuffer
    let pending = this._segments.reduce( (counter, segment) => (segment.parent === parent) ? counter + 1 : counter , 0);
    this._hls.trigger(Event.BUFFER_APPENDED, { parent : parent, pending : pending });

    // don't append in flushing mode
    if (!this._needsFlush) {
      this._doAppending();
    }

    this._updateMediaElementDuration();
  }

  _onSBUpdateError(event) {
    logger.error('sourceBuffer error:', event);
    // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
    // this error might not always be fatal (it is fatal if decode error is set, in that case
    // it will be followed by a mediaElement error ...)
    this._hls.trigger(Event.ERROR, {type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.BUFFER_APPENDING_ERROR, fatal: false});
    // we don't need to do more than that, as accordin to the spec, updateend will be fired just after
  }

  onBufferReset() {
    var sourceBuffer = this._sourceBuffer;
    for(var type in sourceBuffer) {
      var sb = sourceBuffer[type];
      try {
        this._mediaSource.removeSourceBuffer(sb);
        sb.removeEventListener('updateend', this._onsbue);
        sb.removeEventListener('error', this._onsbe);
      } catch(err) {
      }
    }
    this._sourceBuffer = {};
    this._flushRange = [];
    this._segments = [];
    this._appended = 0;
  }

  onBufferCodecs(tracks) {
    // if source buffer(s) not created yet, appended buffer tracks in this._pendingTracks
    // if sourcebuffers already created, do nothing ...
    if (Object.keys(this._sourceBuffer).length === 0) {
      for (var trackName in tracks) { this._pendingTracks[trackName] = tracks[trackName]; }
      let mediaSource = this._mediaSource;
      if (mediaSource && mediaSource.readyState === 'open') {
        // try to create sourcebuffers if mediasource opened
        this._checkPendingTracks();
      }
    }
  }


  _createSourceBuffers(tracks) {
    var sourceBuffer = this._sourceBuffer,mediaSource = this._mediaSource;

    for (let trackName in tracks) {
      if(!sourceBuffer[trackName]) {
        let track = tracks[trackName];
        // use levelCodec as first priority
        let codec = track.levelCodec || track.codec;
        let mimeType = `${track.container};codecs=${codec}`;
        logger.log(`creating sourceBuffer(${mimeType})`);
        try {
          let sb = sourceBuffer[trackName] = mediaSource.addSourceBuffer(mimeType);
          sb.addEventListener('updateend', this._onsbue);
          sb.addEventListener('error', this._onsbe);
          this._tracks[trackName] = {codec: codec, container: track.container};
          track.buffer = sb;
        } catch(err) {
          logger.error(`error while trying to add sourceBuffer:${err.message}`);
          this._hls.trigger(Event.ERROR, {type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.BUFFER_ADD_CODEC_ERROR, fatal: false, err: err, mimeType : mimeType});
        }
      }
    }
    this._hls.trigger(Event.BUFFER_CREATED, { tracks : tracks } );
  }

  onBufferAppending(data) {
    if (!this._needsFlush) {
      if (!this._segments) {
        this._segments = [ data ];
      } else {
        this._segments.push(data);
      }
      this._doAppending();
    }
  }

  onBufferAppendFail(data) {
    logger.error('sourceBuffer error:',data.event);
    // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
    // this error might not always be fatal (it is fatal if decode error is set, in that case
    // it will be followed by a mediaElement error ...)
    this._hls.trigger(Event.ERROR, {type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.BUFFER_APPENDING_ERROR, fatal: false});
  }

  // on BUFFER_EOS mark matching sourcebuffer(s) as ended and trigger checkEos()
  onBufferEos(data) {
    var sb = this._sourceBuffer;
    let dataType = data.type;
    for(let type in sb) {
      if (!dataType || type === dataType) {
        if (!sb[type].ended) {
          sb[type].ended = true;
          logger.log(`${type} sourceBuffer now EOS`);
        }
      }
    }
    this._checkEos();
  }

 // if all source buffers are marked as ended, signal endOfStream() to MediaSource.
 _checkEos() {
    var sb = this._sourceBuffer, mediaSource = this._mediaSource;
    if (!mediaSource || mediaSource.readyState !== 'open') {
      this._needsEos = false;
      return;
    }
    for(let type in sb) {
      let sbobj = sb[type];
      if (!sbobj.ended) {
        return;
      }
      if(sbobj.updating) {
        this._needsEos = true;
        return;
      }
    }
    logger.log('all media data available, signal endOfStream() to MediaSource and stop loading fragment');
    //Notify the media element that it now has all of the media data
    try {
      mediaSource.endOfStream();
    } catch(e) {
      logger.warn('exception while calling mediaSource.endOfStream()');
    }
    this._needsEos = false;
 }


  onBufferFlushing(data) {
    this._flushRange.push({start: data.startOffset, end: data.endOffset, type : data.type});
    // attempt flush immediatly
    this._flushBufferCounter = 0;
    this._doFlush();
  }

  onLevelUpdated(event) {
    let details = event.details;
    if (details.fragments.length === 0) {
      return;
    }
    this._levelDuration = details.totalduration + details.fragments[0].start;
    this._updateMediaElementDuration();
  }

  // https://github.com/video-dev/hls.js/issues/355
  _updateMediaElementDuration() {
    let media = this._media,
        mediaSource = this._mediaSource,
        sourceBuffer = this._sourceBuffer,
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
    let duration = media.duration;
    // levelDuration was the last value we set.
    // not using mediaSource.duration as the browser may tweak this value
    // only update mediasource duration if its value increase, this is to avoid
    // flushing already buffered portion when switching between quality level
    if ((levelDuration > this._msDuration && levelDuration > duration) || (duration === Infinity || isNaN(duration) )) {
      logger.log(`Updating mediasource duration to ${levelDuration.toFixed(3)}`);
      this._msDuration = mediaSource.duration = levelDuration;
    }
  }

  _doFlush() {
    // loop through all buffer ranges to flush
    while(this._flushRange.length) {
      var range = this._flushRange[0];
      // flushBuffer will abort any buffer append in progress and flush Audio/Video Buffer
      if (this._flushBuffer(range.start, range.end, range.type)) {
        // range flushed, remove from flush array
        this._flushRange.shift();
        this._flushBufferCounter = 0;
      } else {
        this._needsFlush = true;
        // avoid looping, wait for SB update end to retrigger a flush
        return;
      }
    }
    if (this._flushRange.length === 0) {
      // everything flushed
      this._needsFlush = false;

      // let's recompute this._appended, which is used to avoid flush looping
      var appended = 0;
      var sourceBuffer = this._sourceBuffer;
      try {
        for (var type in sourceBuffer) {
          appended += sourceBuffer[type].buffered.length;
        }
      } catch(error) {
        // error could be thrown while accessing buffered, in case sourcebuffer has already been removed from MediaSource
        // this is harmess at this stage, catch this to avoid reporting an internal exception
        logger.error('error while accessing sourceBuffer.buffered');
      }
      this._appended = appended;
      this._hls.trigger(Event.BUFFER_FLUSHED);
    }
  }

  _doAppending() {
    var hls = this._hls, sourceBuffer = this._sourceBuffer, segments = this._segments;
    if (Object.keys(sourceBuffer).length) {
      if (this._media.error) {
        this._segments = [];
        logger.error('trying to append although a media error occured, flush segment and abort');
        return;
      }
      if (this._appending) {
        //logger.log(`sb appending in progress`);
        return;
      }
      if (segments && segments.length) {
        let segment = segments.shift();
        try {
          let type = segment.type, sb = sourceBuffer[type];
          if(sb) {
            if(!sb.updating) {
              // reset sourceBuffer ended flag before appending segment
              sb.ended = false;
              //logger.log(`appending ${segment.content} ${type} SB, size:${segment.data.length}, ${segment.parent}`);
              this._parent = segment.parent;
              sb.appendBuffer(segment.data);
              this._appendError = 0;
              this._appended++;
              this._appending = true;
            } else {
              segments.unshift(segment);
            }
          } else {
            // in case we don't have any source buffer matching with this segment type,
            // it means that Mediasource fails to create sourcebuffer
            // discard this segment, and trigger update end
            this._onSBUpdateEnd();
          }
        } catch(err) {
          // in case any error occured while appending, put back segment in segments table
          logger.error(`error while trying to append buffer:${err.message}`);
          segments.unshift(segment);
          var event = {type: ErrorTypes.MEDIA_ERROR, parent : segment.parent};
          if(err.code !== 22) {
            if (this._appendError) {
              this._appendError++;
            } else {
              this._appendError = 1;
            }
            event.details = ErrorDetails.BUFFER_APPEND_ERROR;
            /* with UHD content, we could get loop of quota exceeded error until
              browser is able to evict some data from sourcebuffer. retrying help recovering this
            */
            if (this._appendError > hls.config.appendErrorMaxRetry) {
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
            this._segments = [];
            event.details = ErrorDetails.BUFFER_FULL_ERROR;
            event.fatal = false;
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
  _flushBuffer(startOffset, endOffset, typeIn) {
    var sb, i, bufStart, bufEnd, flushStart, flushEnd, sourceBuffer = this._sourceBuffer;
    if (Object.keys(sourceBuffer).length) {
      logger.log(`flushBuffer,pos/start/end: ${this._media.currentTime.toFixed(3)}/${startOffset}/${endOffset}`);
      // safeguard to avoid infinite looping : don't try to flush more than the nb of appended segments
      if (this._flushBufferCounter < this._appended) {
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
            try {
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
                  this._flushBufferCounter++;
                  logger.log(`flush ${type} [${flushStart},${flushEnd}], of [${bufStart},${bufEnd}], pos:${this._media.currentTime}`);
                  sb.remove(flushStart, flushEnd);
                  return false;
                }
              }
            } catch(e) {
              logger.warn('exception while accessing sourcebuffer, it might have been removed from MediaSource');
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
