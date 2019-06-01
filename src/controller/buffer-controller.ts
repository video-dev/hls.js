/*
 * Buffer Controller
 */

import Events from '../events';
import EventHandler from '../event-handler';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';
import { getMediaSource } from '../utils/mediasource-helper';

import { TrackSet } from '../types/track';
import { Segment } from '../types/segment';
import { BufferControllerConfig } from '../config';

// Add extension properties to SourceBuffers from the DOM API.
type ExtendedSourceBuffer = SourceBuffer & {
  ended?: boolean
};

type SourceBufferName = 'video' | 'audio';
type SourceBuffers = Partial<Record<SourceBufferName, ExtendedSourceBuffer>>;

interface SourceBufferFlushRange {
  start: number;
  end: number;
  type: SourceBufferName
}

const MediaSource = getMediaSource();

class BufferController extends EventHandler {
  // the value that we have set mediasource.duration to
  // (the actual duration may be tweaked slighly by the browser)
  private _msDuration: number | null = null;
  // the value that we want to set mediaSource.duration to
  private _levelDuration: number | null = null;
  // the target duration of the current media playlist
  private _levelTargetDuration: number = 10;
  // current stream state: true - for live broadcast, false - for VoD content
  private _live: boolean | null = null;
  // cache the self generated object url to detect hijack of video tag
  private _objectUrl: string | null = null;

  // signals that the sourceBuffers need to be flushed
  private _needsFlush: boolean = false;

  // signals that mediaSource should have endOfStream called
  private _needsEos: boolean = false;

  private config: BufferControllerConfig;

  // this is optional because this property is removed from the class sometimes
  public audioTimestampOffset?: number;

  // The number of BUFFER_CODEC events received before any sourceBuffers are created
  public bufferCodecEventsExpected: number = 0;

  // A reference to the attached media element
  public media: HTMLMediaElement | null = null;

  // A reference to the active media source
  public mediaSource: MediaSource | null = null;

  // List of pending segments to be appended to source buffer
  public segments: Segment[] = [];

  public parent?: string;

  // A guard to see if we are currently appending to the source buffer
  public appending: boolean = false;

  // counters
  public appended: number = 0;
  public appendError: number = 0;
  public flushBufferCounter: number = 0;

  public tracks: TrackSet = {};
  public pendingTracks: TrackSet = {};
  public sourceBuffer: SourceBuffers = {};
  public flushRange: SourceBufferFlushRange[] = [];

  constructor (hls: any) {
    super(hls,
      Events.MEDIA_ATTACHING,
      Events.MEDIA_DETACHING,
      Events.MANIFEST_PARSED,
      Events.BUFFER_RESET,
      Events.BUFFER_APPENDING,
      Events.BUFFER_CODECS,
      Events.BUFFER_EOS,
      Events.BUFFER_FLUSHING,
      Events.LEVEL_PTS_UPDATED,
      Events.LEVEL_UPDATED);

    this.config = hls.config;
  }

  destroy () {
    EventHandler.prototype.destroy.call(this);
  }

  onLevelPtsUpdated (data: { type: SourceBufferName, start: number }) {
    let type = data.type;
    let audioTrack = this.tracks.audio;

    // Adjusting `SourceBuffer.timestampOffset` (desired point in the timeline where the next frames should be appended)
    // in Chrome browser when we detect MPEG audio container and time delta between level PTS and `SourceBuffer.timestampOffset`
    // is greater than 100ms (this is enough to handle seek for VOD or level change for LIVE videos). At the time of change we issue
    // `SourceBuffer.abort()` and adjusting `SourceBuffer.timestampOffset` if `SourceBuffer.updating` is false or awaiting `updateend`
    // event if SB is in updating state.
    // More info here: https://github.com/video-dev/hls.js/issues/332#issuecomment-257986486

    if (type === 'audio' && audioTrack && audioTrack.container === 'audio/mpeg') { // Chrome audio mp3 track
      let audioBuffer = this.sourceBuffer.audio;
      if (!audioBuffer) {
        throw Error('Level PTS Updated and source buffer for audio uninitalized');
      }

      let delta = Math.abs(audioBuffer.timestampOffset - data.start);

      // adjust timestamp offset if time delta is greater than 100ms
      if (delta > 0.1) {
        let updating = audioBuffer.updating;

        try {
          audioBuffer.abort();
        } catch (err) {
          logger.warn('can not abort audio buffer: ' + err);
        }

        if (!updating) {
          logger.warn('change mpeg audio timestamp offset from ' + audioBuffer.timestampOffset + ' to ' + data.start);
          audioBuffer.timestampOffset = data.start;
        } else {
          this.audioTimestampOffset = data.start;
        }
      }
    }
  }

  onManifestParsed (data: { altAudio: boolean }) {
    // in case of alt audio 2 BUFFER_CODECS events will be triggered, one per stream controller
    // sourcebuffers will be created all at once when the expected nb of tracks will be reached
    // in case alt audio is not used, only one BUFFER_CODEC event will be fired from main stream controller
    // it will contain the expected nb of source buffers, no need to compute it
    this.bufferCodecEventsExpected = data.altAudio ? 2 : 1;
    logger.log(`${this.bufferCodecEventsExpected} bufferCodec event(s) expected`);
  }

  onMediaAttaching (data: { media: HTMLMediaElement }) {
    let media = this.media = data.media;
    if (media) {
      // setup the media source
      let ms = this.mediaSource = new MediaSource();
      // Media Source listeners
      ms.addEventListener('sourceopen', this._onMediaSourceOpen);
      ms.addEventListener('sourceended', this._onMediaSourceEnded);
      ms.addEventListener('sourceclose', this._onMediaSourceClose);
      // link video and media Source
      media.src = window.URL.createObjectURL(ms);
      // cache the locally generated object url
      this._objectUrl = media.src;
    }
  }

  onMediaDetaching () {
    logger.log('media source detaching');
    let ms = this.mediaSource;
    if (ms) {
      if (ms.readyState === 'open') {
        try {
          // endOfStream could trigger exception if any sourcebuffer is in updating state
          // we don't really care about checking sourcebuffer state here,
          // as we are anyway detaching the MediaSource
          // let's just avoid this exception to propagate
          ms.endOfStream();
        } catch (err) {
          logger.warn(`onMediaDetaching:${err.message} while calling endOfStream`);
        }
      }
      ms.removeEventListener('sourceopen', this._onMediaSourceOpen);
      ms.removeEventListener('sourceended', this._onMediaSourceEnded);
      ms.removeEventListener('sourceclose', this._onMediaSourceClose);

      // Detach properly the MediaSource from the HTMLMediaElement as
      // suggested in https://github.com/w3c/media-source/issues/53.
      if (this.media) {
        if (this._objectUrl) {
          window.URL.revokeObjectURL(this._objectUrl);
        }

        // clean up video tag src only if it's our own url. some external libraries might
        // hijack the video tag and change its 'src' without destroying the Hls instance first
        if (this.media.src === this._objectUrl) {
          this.media.removeAttribute('src');
          this.media.load();
        } else {
          logger.warn('media.src was changed by a third party - skip cleanup');
        }
      }

      this.mediaSource = null;
      this.media = null;
      this._objectUrl = null;
      this.pendingTracks = {};
      this.tracks = {};
      this.sourceBuffer = {};
      this.flushRange = [];
      this.segments = [];
      this.appended = 0;
    }

    this.hls.trigger(Events.MEDIA_DETACHED);
  }

  checkPendingTracks () {
    let { bufferCodecEventsExpected, pendingTracks } = this;

    // Check if we've received all of the expected bufferCodec events. When none remain, create all the sourceBuffers at once.
    // This is important because the MSE spec allows implementations to throw QuotaExceededErrors if creating new sourceBuffers after
    // data has been appended to existing ones.
    // 2 tracks is the max (one for audio, one for video). If we've reach this max go ahead and create the buffers.
    const pendingTracksCount = Object.keys(pendingTracks).length;
    if ((pendingTracksCount && !bufferCodecEventsExpected) || pendingTracksCount === 2) {
      // ok, let's create them now !
      this.createSourceBuffers(pendingTracks);
      this.pendingTracks = {};
      // append any pending segments now !
      this.doAppending();
    }
  }

  private _onMediaSourceOpen = () => {
    logger.log('media source opened');
    this.hls.trigger(Events.MEDIA_ATTACHED, { media: this.media });
    let mediaSource = this.mediaSource;
    if (mediaSource) {
      // once received, don't listen anymore to sourceopen event
      mediaSource.removeEventListener('sourceopen', this._onMediaSourceOpen);
    }
    this.checkPendingTracks();
  }

  private _onMediaSourceClose = () => {
    logger.log('media source closed');
  }

  private _onMediaSourceEnded = () => {
    logger.log('media source ended');
  }

  private _onSBUpdateEnd = () => {
    // update timestampOffset
    if (this.audioTimestampOffset && this.sourceBuffer.audio) {
      let audioBuffer = this.sourceBuffer.audio;

      logger.warn(`change mpeg audio timestamp offset from ${audioBuffer.timestampOffset} to ${this.audioTimestampOffset}`);
      audioBuffer.timestampOffset = this.audioTimestampOffset;
      delete this.audioTimestampOffset;
    }

    if (this._needsFlush) {
      this.doFlush();
    }

    if (this._needsEos) {
      this.checkEos();
    }

    this.appending = false;
    let parent = this.parent;
    // count nb of pending segments waiting for appending on this sourcebuffer
    let pending = this.segments.reduce((counter, segment) => (segment.parent === parent) ? counter + 1 : counter, 0);

    // this.sourceBuffer is better to use than media.buffered as it is closer to the PTS data from the fragments
    const timeRanges: Partial<Record<SourceBufferName, TimeRanges>> = {};
    const sbSet = this.sourceBuffer;
    for (let streamType in sbSet) {
      const sb = sbSet[streamType as SourceBufferName];
      if (!sb) {
        throw Error(`handling source buffer update end error: source buffer for ${streamType} uninitilized and unable to update buffered TimeRanges.`);
      }
      timeRanges[streamType as SourceBufferName] = sb.buffered;
    }

    this.hls.trigger(Events.BUFFER_APPENDED, { parent, pending, timeRanges });
    // don't append in flushing mode
    if (!this._needsFlush) {
      this.doAppending();
    }

    this.updateMediaElementDuration();

    // appending goes first
    if (pending === 0) {
      this.flushLiveBackBuffer();
    }
  }

  private _onSBUpdateError = (event: Event) => {
    logger.error('sourceBuffer error:', event);
    // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
    // this error might not always be fatal (it is fatal if decode error is set, in that case
    // it will be followed by a mediaElement error ...)
    this.hls.trigger(Events.ERROR, { type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.BUFFER_APPENDING_ERROR, fatal: false });
    // we don't need to do more than that, as accordin to the spec, updateend will be fired just after
  }

  onBufferReset () {
    const sourceBuffer = this.sourceBuffer;
    for (let type in sourceBuffer) {
      const sb = sourceBuffer[type];
      try {
        if (sb) {
          if (this.mediaSource) {
            this.mediaSource.removeSourceBuffer(sb);
          }
          sb.removeEventListener('updateend', this._onSBUpdateEnd);
          sb.removeEventListener('error', this._onSBUpdateError);
        }
      } catch (err) {
      }
    }
    this.sourceBuffer = {};
    this.flushRange = [];
    this.segments = [];
    this.appended = 0;
  }

  onBufferCodecs (tracks: TrackSet) {
    // if source buffer(s) not created yet, appended buffer tracks in this.pendingTracks
    // if sourcebuffers already created, do nothing ...
    if (Object.keys(this.sourceBuffer).length) {
      return;
    }

    Object.keys(tracks).forEach(trackName => {
      this.pendingTracks[trackName] = tracks[trackName];
    });

    this.bufferCodecEventsExpected = Math.max(this.bufferCodecEventsExpected - 1, 0);
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      this.checkPendingTracks();
    }
  }

  createSourceBuffers (tracks: TrackSet) {
    const { sourceBuffer, mediaSource } = this;
    if (!mediaSource) {
      throw Error('createSourceBuffers called when mediaSource was null');
    }

    for (let trackName in tracks) {
      if (!sourceBuffer[trackName]) {
        let track = tracks[trackName as keyof TrackSet];
        if (!track) {
          throw Error(`source buffer exists for track ${trackName}, however track does not`);
        }
        // use levelCodec as first priority
        let codec = track.levelCodec || track.codec;
        let mimeType = `${track.container};codecs=${codec}`;
        logger.log(`creating sourceBuffer(${mimeType})`);
        try {
          let sb = sourceBuffer[trackName] = mediaSource.addSourceBuffer(mimeType);
          sb.addEventListener('updateend', this._onSBUpdateEnd);
          sb.addEventListener('error', this._onSBUpdateError);
          this.tracks[trackName] = {
            buffer: sb,
            codec: codec,
            container: track.container,
            levelCodec: track.levelCodec
          };
        } catch (err) {
          logger.error(`error while trying to add sourceBuffer:${err.message}`);
          this.hls.trigger(Events.ERROR, { type: ErrorTypes.MEDIA_ERROR, details: ErrorDetails.BUFFER_ADD_CODEC_ERROR, fatal: false, err: err, mimeType: mimeType });
        }
      }
    }
    this.hls.trigger(Events.BUFFER_CREATED, { tracks: this.tracks });
  }

  onBufferAppending (data: Segment) {
    if (!this._needsFlush) {
      if (!this.segments) {
        this.segments = [ data ];
      } else {
        this.segments.push(data);
      }

      this.doAppending();
    }
  }

  // on BUFFER_EOS mark matching sourcebuffer(s) as ended and trigger checkEos()
  // an undefined data.type will mark all buffers as EOS.
  onBufferEos (data: { type?: SourceBufferName }) {
    for (const type in this.sourceBuffer) {
      if (!data.type || data.type === type) {
        const sb = this.sourceBuffer[type as SourceBufferName];
        if (sb && !sb.ended) {
          sb.ended = true;
          logger.log(`${type} sourceBuffer now EOS`);
        }
      }
    }

    this.checkEos();
  }

  // if all source buffers are marked as ended, signal endOfStream() to MediaSource.
  checkEos () {
    const { sourceBuffer, mediaSource } = this;
    if (!mediaSource || mediaSource.readyState !== 'open') {
      this._needsEos = false;
      return;
    }

    for (let type in sourceBuffer) {
      const sb = sourceBuffer[type as SourceBufferName];
      if (!sb) continue;

      if (!sb.ended) {
        return;
      }

      if (sb.updating) {
        this._needsEos = true;
        return;
      }
    }

    logger.log('all media data are available, signal endOfStream() to MediaSource and stop loading fragment');
    // Notify the media element that it now has all of the media data
    try {
      mediaSource.endOfStream();
    } catch (e) {
      logger.warn('exception while calling mediaSource.endOfStream()');
    }
    this._needsEos = false;
  }

  onBufferFlushing (data: { startOffset: number, endOffset: number, type?: SourceBufferName }) {
    if (data.type) {
      this.flushRange.push({ start: data.startOffset, end: data.endOffset, type: data.type });
    } else {
      this.flushRange.push({ start: data.startOffset, end: data.endOffset, type: 'video' });
      this.flushRange.push({ start: data.startOffset, end: data.endOffset, type: 'audio' });
    }

    // attempt flush immediately
    this.flushBufferCounter = 0;
    this.doFlush();
  }

  flushLiveBackBuffer () {
    if (!this.media) {
      throw Error('flushLiveBackBuffer called without attaching media');
    }

    // clear back buffer for live only
    if (!this._live) {
      return;
    }

    const liveBackBufferLength = this.config.liveBackBufferLength;
    if (!isFinite(liveBackBufferLength) || liveBackBufferLength < 0) {
      return;
    }

    const currentTime = this.media.currentTime;
    const sourceBuffer = this.sourceBuffer;
    const bufferTypes = Object.keys(sourceBuffer);
    const targetBackBufferPosition = currentTime - Math.max(liveBackBufferLength, this._levelTargetDuration);

    for (let index = bufferTypes.length - 1; index >= 0; index--) {
      const bufferType = bufferTypes[index];
      const sb = sourceBuffer[bufferType as SourceBufferName];
      if (sb) {
        const buffered = sb.buffered;
        // when target buffer start exceeds actual buffer start
        if (buffered.length > 0 && targetBackBufferPosition > buffered.start(0)) {
          // remove buffer up until current time minus minimum back buffer length (removing buffer too close to current
          // time will lead to playback freezing)
          // credits for level target duration - https://github.com/videojs/http-streaming/blob/3132933b6aa99ddefab29c10447624efd6fd6e52/src/segment-loader.js#L91
          this.removeBufferRange(bufferType, sb, 0, targetBackBufferPosition);
        }
      }
    }
  }

  onLevelUpdated ({ details }: { details: { totalduration: number, targetduration?: number, averagetargetduration?: number, live: boolean, fragments: any[] } }) {
    if (details.fragments.length > 0) {
      this._levelDuration = details.totalduration + details.fragments[0].start;
      this._levelTargetDuration = details.averagetargetduration || details.targetduration || 10;
      this._live = details.live;
      this.updateMediaElementDuration();
    }
  }

  /**
   * Update Media Source duration to current level duration or override to Infinity if configuration parameter
   * 'liveDurationInfinity` is set to `true`
   * More details: https://github.com/video-dev/hls.js/issues/355
   */
  updateMediaElementDuration () {
    let { config } = this;
    let duration: number;

    if (this._levelDuration === null ||
      !this.media ||
      !this.mediaSource ||
      !this.sourceBuffer ||
      this.media.readyState === 0 ||
      this.mediaSource.readyState !== 'open') {
      return;
    }

    for (let type in this.sourceBuffer) {
      const sb = this.sourceBuffer[type];
      if (sb && sb.updating === true) {
        // can't set duration whilst a buffer is updating
        return;
      }
    }

    duration = this.media.duration;
    // initialise to the value that the media source is reporting
    if (this._msDuration === null) {
      this._msDuration = this.mediaSource.duration;
    }

    if (this._live === true && config.liveDurationInfinity === true) {
      // Override duration to Infinity
      logger.log('Media Source duration is set to Infinity');
      this._msDuration = this.mediaSource.duration = Infinity;
    } else if ((this._levelDuration > this._msDuration && this._levelDuration > duration) || !Number.isFinite(duration)) {
      // levelDuration was the last value we set.
      // not using mediaSource.duration as the browser may tweak this value
      // only update Media Source duration if its value increase, this is to avoid
      // flushing already buffered portion when switching between quality level
      logger.log(`Updating Media Source duration to ${this._levelDuration.toFixed(3)}`);
      this._msDuration = this.mediaSource.duration = this._levelDuration;
    }
  }

  doFlush () {
    // loop through all buffer ranges to flush
    while (this.flushRange.length) {
      let range = this.flushRange[0];
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
      let appended = 0;
      let sourceBuffer = this.sourceBuffer;
      try {
        for (let type in sourceBuffer) {
          const sb = sourceBuffer[type];
          if (sb) {
            appended += sb.buffered.length;
          }
        }
      } catch (error) {
        // error could be thrown while accessing buffered, in case sourcebuffer has already been removed from MediaSource
        // this is harmess at this stage, catch this to avoid reporting an internal exception
        logger.error('error while accessing sourceBuffer.buffered');
      }
      this.appended = appended;
      this.hls.trigger(Events.BUFFER_FLUSHED);
    }
  }

  doAppending () {
    let { config, hls, segments, sourceBuffer } = this;
    if (!Object.keys(sourceBuffer).length) {
      // early exit if no source buffers have been initialized yet
      return;
    }

    if (!this.media || this.media.error) {
      this.segments = [];
      logger.error('trying to append although a media error occured, flush segment and abort');
      return;
    }

    if (this.appending) {
      // logger.log(`sb appending in progress`);
      return;
    }

    const segment = segments.shift();
    if (!segment) { // handle undefined shift
      return;
    }

    try {
      const sb = sourceBuffer[segment.type];
      if (!sb) {
        // in case we don't have any source buffer matching with this segment type,
        // it means that Mediasource fails to create sourcebuffer
        // discard this segment, and trigger update end
        this._onSBUpdateEnd();
        return;
      }

      if (sb.updating) {
        // if we are still updating the source buffer from the last segment, place this back at the front of the queue
        segments.unshift(segment);
        return;
      }

      // reset sourceBuffer ended flag before appending segment
      sb.ended = false;
      // logger.log(`appending ${segment.content} ${type} SB, size:${segment.data.length}, ${segment.parent}`);
      this.parent = segment.parent;
      sb.appendBuffer(segment.data);
      this.appendError = 0;
      this.appended++;
      this.appending = true;
    } catch (err) {
      // in case any error occured while appending, put back segment in segments table
      logger.error(`error while trying to append buffer:${err.message}`);
      segments.unshift(segment);
      let event = { type: ErrorTypes.MEDIA_ERROR, parent: segment.parent, details: '', fatal: false };
      if (err.code === 22) {
        // QuotaExceededError: http://www.w3.org/TR/html5/infrastructure.html#quotaexceedederror
        // let's stop appending any segments, and report BUFFER_FULL_ERROR error
        this.segments = [];
        event.details = ErrorDetails.BUFFER_FULL_ERROR;
      } else {
        this.appendError++;
        event.details = ErrorDetails.BUFFER_APPEND_ERROR;
        /* with UHD content, we could get loop of quota exceeded error until
          browser is able to evict some data from sourcebuffer. retrying help recovering this
        */
        if (this.appendError > config.appendErrorMaxRetry) {
          logger.log(`fail ${config.appendErrorMaxRetry} times to append segment in sourceBuffer`);
          this.segments = [];
          event.fatal = true;
        }
      }
      hls.trigger(Events.ERROR, event);
    }
  }

  /*
    flush specified buffered range,
    return true once range has been flushed.
    as sourceBuffer.remove() is asynchronous, flushBuffer will be retriggered on sourceBuffer update end
  */
  flushBuffer (startOffset: number, endOffset: number, sbType: SourceBufferName): boolean {
    const sourceBuffer = this.sourceBuffer;
    // exit if no sourceBuffers are initialized
    if (!Object.keys(sourceBuffer).length) {
      return true;
    }

    let currentTime: string = 'null';
    if (this.media) {
      currentTime = this.media.currentTime.toFixed(3);
    }
    logger.log(`flushBuffer,pos/start/end: ${currentTime}/${startOffset}/${endOffset}`);

    // safeguard to avoid infinite looping : don't try to flush more than the nb of appended segments
    if (this.flushBufferCounter >= this.appended) {
      logger.warn('abort flushing too many retries');
      return true;
    }

    const sb = sourceBuffer[sbType];
    // we are going to flush buffer, mark source buffer as 'not ended'
    if (sb) {
      sb.ended = false;
      if (!sb.updating) {
        if (this.removeBufferRange(sbType, sb, startOffset, endOffset)) {
          this.flushBufferCounter++;
          return false;
        }
      } else {
        logger.warn('cannot flush, sb updating in progress');
        return false;
      }
    }

    logger.log('buffer flushed');
    // everything flushed !
    return true;
  }

  /**
   * Removes first buffered range from provided source buffer that lies within given start and end offsets.
   *
   * @param {string} type Type of the source buffer, logging purposes only.
   * @param {SourceBuffer} sb Target SourceBuffer instance.
   * @param {number} startOffset
   * @param {number} endOffset
   *
   * @returns {boolean} True when source buffer remove requested.
   */
  removeBufferRange (type: string, sb: ExtendedSourceBuffer, startOffset: number, endOffset: number): boolean {
    try {
      for (let i = 0; i < sb.buffered.length; i++) {
        let bufStart = sb.buffered.start(i);
        let bufEnd = sb.buffered.end(i);
        let removeStart = Math.max(bufStart, startOffset);
        let removeEnd = Math.min(bufEnd, endOffset);

        /* sometimes sourcebuffer.remove() does not flush
          the exact expected time range.
          to avoid rounding issues/infinite loop,
          only flush buffer range of length greater than 500ms.
        */
        if (Math.min(removeEnd, bufEnd) - removeStart > 0.5) {
          let currentTime: string = 'null';
          if (this.media) {
            currentTime = this.media.currentTime.toString();
          }

          logger.log(`sb remove ${type} [${removeStart},${removeEnd}], of [${bufStart},${bufEnd}], pos:${currentTime}`);
          sb.remove(removeStart, removeEnd);
          return true;
        }
      }
    } catch (error) {
      logger.warn('removeBufferRange failed', error);
    }

    return false;
  }
}

export default BufferController;
