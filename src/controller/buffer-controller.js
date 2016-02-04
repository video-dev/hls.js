/*
 * Buffer Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';

class BufferController extends EventHandler {
    constructor(hls) {
        super(
            hls,
            Event.MEDIA_ATTACHING,
            Event.MEDIA_DETACHING,
            Event.BUFFER_RESET,
            Event.BUFFER_APPENDING,
            Event.BUFFER_CODECS,
            Event.BUFFER_EOS,
            Event.BUFFER_FLUSHING
        );

        // Source Buffer listeners
        this.onsbue = this.onSBUpdateEnd.bind(this);
        this.onsbe = this.onSBUpdateError.bind(this);
    }

    destroy() {
        EventHandler.prototype.destroy.call(this);
    }

    onMediaAttaching(data) {
        var media = (this.media = data.media);
        // setup the media source
        var ms = (this.mediaSource = new MediaSource());
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

    onMediaDetaching() {
        var media = this.media;
        var ms = this.mediaSource;
        if (ms) {
            if (ms.readyState === 'open') {
                try {
                    // endOfStream could trigger exception if any sourcebuffer is in updating state
                    // we don't really care about checking sourcebuffer state here,
                    // as we are anyway detaching the MediaSource
                    // let's just avoid this exception to propagate
                    ms.endOfStream();
                } catch (err) {
                    logger.warn(
                        `onMediaDetaching:${
                            err.message
                        } while calling endOfStream`
                    );
                }
            }
            ms.removeEventListener('sourceopen', this.onmso);
            ms.removeEventListener('sourceended', this.onmse);
            ms.removeEventListener('sourceclose', this.onmsc);
            // unlink MediaSource from video tag
            this.media.src = '';
            this.mediaSource = null;
            this.media = null;
            this.loadedmetadata = false;
        }
        this.onmso = this.onmse = this.onmsc = null;
        this.hls.trigger(Event.MEDIA_DETACHED);
    }

    onMediaSourceOpen() {
        logger.log('media source opened');
        this.hls.trigger(Event.MEDIA_ATTACHED, { media: this.media });
        // once received, don't listen anymore to sourceopen event
        this.mediaSource.removeEventListener('sourceopen', this.onmso);
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
            this.onBufferEos();
        }

        this.hls.trigger(Event.BUFFER_APPENDED);

        this.doAppending();
    }

    onSBUpdateError(event) {
        logger.error(`sourceBuffer error:${event}`);
        // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
        // this error might not always be fatal (it is fatal if decode error is set, in that case
        // it will be followed by a mediaElement error ...)
        this.hls.trigger(Event.ERROR, {
            type: ErrorTypes.MEDIA_ERROR,
            details: ErrorDetails.BUFFER_APPENDING_ERROR,
            fatal: false
        });
        // we don't need to do more than that, as accordin to the spec, updateend will be fired just after
    }

    onBufferReset() {
        logger.log('onBufferReset');
        var sourceBuffer = this.sourceBuffer;
        if (sourceBuffer) {
            for (var type in sourceBuffer) {
                var sb = sourceBuffer[type];
                try {
                    this.mediaSource.removeSourceBuffer(sb);
                    sb.removeEventListener('updateend', this.onsbue);
                    sb.removeEventListener('error', this.onsbe);
                } catch (err) {}
            }
            this.sourceBuffer = null;
        }
        this.flushRange = [];
        this.appended = 0;
    }

    onBufferCodecs(data) {
        var sb,
            audioCodec = data.levelAudioCodec,
            videoCodec = data.levelVideoCodec;
        logger.log(
            `playlist_level/init_segment codecs: video => ${videoCodec}/${
                data.videoCodec
            }; audio => ${audioCodec}/${data.audioCodec}`
        );
        // if playlist does not specify codecs, use codecs found while parsing fragment
        // if no codec found while parsing fragment, also set codec to undefined to avoid creating sourceBuffer
        if (audioCodec === undefined || data.audioCodec === undefined) {
            audioCodec = data.audioCodec;
        }

        if (videoCodec === undefined || data.videoCodec === undefined) {
            videoCodec = data.videoCodec;
        }
        // in case several audio codecs might be used, force HE-AAC for audio (some browsers don't support audio codec switch)
        //don't do it for mono streams ...
        var ua = navigator.userAgent.toLowerCase();
        if (
            this.audiocodecswitch &&
            data.audioChannelCount !== 1 &&
            ua.indexOf('android') === -1 &&
            ua.indexOf('firefox') === -1
        ) {
            audioCodec = 'mp4a.40.5';
        }
        if (!this.sourceBuffer) {
            var sourceBuffer = {},
                mediaSource = this.mediaSource;
            logger.log(
                `selected A/V codecs for sourceBuffers:${audioCodec},${videoCodec}`
            );
            // create source Buffer and link them to MediaSource
            if (audioCodec) {
                sb = sourceBuffer.audio = mediaSource.addSourceBuffer(
                    `audio/mp4;codecs=${audioCodec}`
                );
                sb.addEventListener('updateend', this.onsbue);
                sb.addEventListener('error', this.onsbe);
            }
            if (videoCodec) {
                sb = sourceBuffer.video = mediaSource.addSourceBuffer(
                    `video/mp4;codecs=${videoCodec}`
                );
                sb.addEventListener('updateend', this.onsbue);
                sb.addEventListener('error', this.onsbe);
            }
            this.sourceBuffer = sourceBuffer;
        }
        if (audioCodec) {
            hls.trigger(Event.BUFFER_APPENDING, {
                type: 'audio',
                data: data.audioMoov
            });
        }
        if (videoCodec) {
            hls.trigger(Event.BUFFER_APPENDING, {
                type: 'video',
                data: data.videoMoov
            });
        }
    }

    onBufferAppending(data) {
        if (!this.mp4segments) {
            this.mp4segments = [data];
        } else {
            this.mp4segments.push(data);
        }
        this.doAppending();
    }

    onBufferAppendFail(data) {
        logger.error(`sourceBuffer error:${data.event}`);
        this.state = State.ERROR;
        // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
        // this error might not always be fatal (it is fatal if decode error is set, in that case
        // it will be followed by a mediaElement error ...)
        this.hls.trigger(Event.ERROR, {
            type: ErrorTypes.MEDIA_ERROR,
            details: ErrorDetails.BUFFER_APPENDING_ERROR,
            fatal: false,
            frag: this.fragCurrent
        });
    }

    onBufferEos() {
        var sb = this.sourceBuffer,
            mediaSource = this.mediaSource;
        if (!mediaSource || mediaSource.readyState !== 'open') {
            return;
        }
        if (
            !(
                (sb.audio && sb.audio.updating) ||
                (sb.video && sb.video.updating)
            )
        ) {
            logger.log(
                'all media data available, signal endOfStream() to MediaSource and stop loading fragment'
            );
            //Notify the media element that it now has all of the media data
            mediaSource.endOfStream();
            this._needsEos = false;
        } else {
            this._needsEos = true;
        }
    }

    onBufferFlushing(data) {
        this.flushRange.push({ start: data.startOffset, end: data.endOffset });
        // attempt flush immediatly
        this.flushBufferCounter = 0;
        this.doFlush();
    }

    doFlush() {
        // loop through all buffer ranges to flush
        while (this.flushRange.length) {
            var range = this.flushRange[0];
            // flushBuffer will abort any buffer append in progress and flush Audio/Video Buffer
            if (this.flushBuffer(range.start, range.end)) {
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
            if (sourceBuffer) {
                var sb = sourceBuffer.audio;
                if (sb) {
                    appended += sb.buffered.length;
                }
                sb = sourceBuffer.video;
                if (sb) {
                    appended += sb.buffered.length;
                }
            }
            this.appended = appended;
            this.hls.trigger(Event.BUFFER_FLUSHED);
        }
    }

    doAppending() {
        var hls = this.hls,
            sourceBuffer = this.sourceBuffer,
            mp4segments = this.mp4segments;
        if (sourceBuffer) {
            if (this.media.error) {
                logger.error(
                    'trying to append although a media error occured, switch to ERROR state'
                );
                this.state = State.ERROR;
                return;
            } else if (
                (sourceBuffer.audio && sourceBuffer.audio.updating) ||
                (sourceBuffer.video && sourceBuffer.video.updating)
            ) {
                // if MP4 segment appending in progress nothing to do
                //logger.log('sb append in progress');
                // check if any MP4 segments left to append
            } else if (mp4segments.length) {
                var segment = mp4segments.shift();
                try {
                    //logger.log(`appending ${segment.type} SB, size:${segment.data.length});
                    sourceBuffer[segment.type].appendBuffer(segment.data);
                    this.appendError = 0;
                    this.appended++;
                } catch (err) {
                    // in case any error occured while appending, put back segment in mp4segments table
                    logger.error(
                        `error while trying to append buffer:${err.message}`
                    );
                    mp4segments.unshift(segment);
                    var event = { type: ErrorTypes.MEDIA_ERROR };
                    if (err.code !== 22) {
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
                        if (
                            this.appendError > this.config.appendErrorMaxRetry
                        ) {
                            logger.log(
                                `fail ${
                                    this.config.appendErrorMaxRetry
                                } times to append segment in sourceBuffer`
                            );
                            event.fatal = true;
                            hls.trigger(Event.ERROR, event);
                            this.state = State.ERROR;
                            return;
                        } else {
                            event.fatal = false;
                            hls.trigger(Event.ERROR, event);
                        }
                    } else {
                        // QuotaExceededError: http://www.w3.org/TR/html5/infrastructure.html#quotaexceedederror
                        // let's stop appending any segments, and report BUFFER_FULL error
                        mp4segments = [];
                        event.details = ErrorDetails.BUFFER_FULL;
                        hls.trigger(Event.ERROR, event);
                    }
                }
            }
        } else {
            // sourceBuffer undefined, switch back to IDLE state
            this.state = State.IDLE;
        }
    }

    /*
    flush specified buffered range,
    return true once range has been flushed.
    as sourceBuffer.remove() is asynchronous, flushBuffer will be retriggered on sourceBuffer update end
  */
    flushBuffer(startOffset, endOffset) {
        var sb, i, bufStart, bufEnd, flushStart, flushEnd;
        //logger.log('flushBuffer,pos/start/end: ' + this.media.currentTime + '/' + startOffset + '/' + endOffset);
        // safeguard to avoid infinite looping : don't try to flush more than the nb of appended segments
        if (this.flushBufferCounter < this.appended && this.sourceBuffer) {
            for (var type in this.sourceBuffer) {
                sb = this.sourceBuffer[type];
                if (!sb.updating) {
                    for (i = 0; i < sb.buffered.length; i++) {
                        bufStart = sb.buffered.start(i);
                        bufEnd = sb.buffered.end(i);
                        // workaround firefox not able to properly flush multiple buffered range.
                        if (
                            navigator.userAgent
                                .toLowerCase()
                                .indexOf('firefox') !== -1 &&
                            endOffset === Number.POSITIVE_INFINITY
                        ) {
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
                        if (Math.min(flushEnd, bufEnd) - flushStart > 0.5) {
                            this.flushBufferCounter++;
                            logger.log(
                                `flush ${type} [${flushStart},${flushEnd}], of [${bufStart},${bufEnd}], pos:${
                                    this.media.currentTime
                                }`
                            );
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
        // everything flushed !
        return true;
    }
}

export default BufferController;
