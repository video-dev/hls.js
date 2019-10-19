import { BufferHelper } from '../utils/buffer-helper';
import { ErrorTypes, ErrorDetails } from '../errors';
import Event from '../events';
import { logger } from '../utils/logger';
import { isFiniteNumber } from '../polyfills/number-isFinite';

export const STALL_MINIMUM_DURATION_MS = 1000;
export const STALL_HANDLING_RETRY_PERIOD_MS = 1000;
export const JUMP_THRESHOLD_SECONDS = 0.5; // tolerance needed as some browsers stalls playback before reaching buffered range end
export const SKIP_BUFFER_HOLE_STEP_SECONDS = 0.1;

export default class GapController {
  constructor (config, media, fragmentTracker, hls) {
    this.config = config;
    this.media = media;
    this.fragmentTracker = fragmentTracker;
    this.hls = hls;

    /**
     * @private
     * @member {number | null}
     * This keeps state of handling stalls (once detected) to throttle the retry pace,
     * and thus will get updated on each retry.
     */
    this.stallHandledAtTime = null;

    /**
     * @private
     * @member {number | null}
     * This keeps state of the time a stall was detected.
     * It will make sure we only report a stall as one when within the min stall threshold duration.
     */
    this.stallDetectedAtTime = null;

    /**
     * @private
     * @member {boolean}
     * Flag set when a flag was detected and appeared to be sustained for more than the stall minimum duration.
     */
    this.stallReported = false;

    /**
     * @private
     * @member {number | null}
     */
    this.currentPlayheadTime = null;

    /**
     * @private
     * @member {boolean}
     */
    this.hasPlayed = false;

    /**
     * @private
     * @member {EventListener}
     */
    this.onMediaElWaiting = null;
  }

  destroy () {
    if (this.onMediaElWaiting) {
      this.media.removeEventListener('waiting', this.onMediaElWaiting);
    }
  }

  /**
   * Checks if the playhead is stuck within a gap, and if so, attempts to free it.
   * A gap is an unbuffered range between two buffered ranges (or the start and the first buffered range).
   *
   * @param {number} previousPlayheadTime Previously read playhead position
   */
  poll (previousPlayheadTime) {
    const media = this.media;
    if (!this.hasPlayed) {
      const mediaCurrentTime = media.currentTime;
      if (!isFiniteNumber(mediaCurrentTime) || media.buffered.length === 0) {
        return;
      }
      // Checking what the buffer reports as start time for the first fragment appended.
      // We skip the playhead to this position to overcome an apparent initial gap in the stream.
      const firstBufferedPosition = media.buffered.start(0);
      if ((firstBufferedPosition - mediaCurrentTime > 0) && !media.seeking) {
        logger.warn(`skipping over gap at startup (first segment buffered time-range starts partially later than assumed) from ${mediaCurrentTime} to ${firstBufferedPosition} seconds`);
        media.currentTime = firstBufferedPosition;
        return;
      }
    }

    // if we are paused and played before, don't bother at all
    if (this.hasPlayed && media.paused) {
      return;
    }

    // The playhead is moving, no-op
    if (this._checkPlayheadHasMoved(previousPlayheadTime)) {
      return;
    }

    // not moving ... check if we need to handle stall
    if (this.stallDetectedAtTime !== null || this._isMediaInPlayableState()) {
      this._handleStall();
    }
  }

  _checkPlayheadHasMoved (previousPlayheadTime) {
    const media = this.media;

    // read current playhead position
    const currentPlayheadTime = media.currentTime;
    // update internal store
    this.currentPlayheadTime = currentPlayheadTime;

    // not moved - return false here
    if (currentPlayheadTime === previousPlayheadTime) {
      return false;
    }

    // has moved ... - will return true from here
    // but need to (re-)init internal state

    this.hasPlayed = true;

    // lazy setup media event listeners if not done yet
    if (!this.onMediaElWaiting) {
      this.onMediaElWaiting = this._onMediaElWaiting.bind(this);
      this.media.addEventListener('waiting', this.onMediaElWaiting);
    }

    // we can return early here to be lazy on rewriting other member values
    if (this.stallDetectedAtTime === null) {
      return true;
    }

    logger.log(`playhead seemed stalled but is now moving again from ${previousPlayheadTime} to ${currentPlayheadTime}`);

    // reset all the stall flags
    this.stallHandledAtTime = null;
    this.stallDetectedAtTime = null;
    this.nudgeRetry = 0;

    // If it was reported stalled, let's log the recovery
    if (this.stallReported) {
      const now = window.performance.now();
      logger.warn(`playhead not stalled anymore @${currentPlayheadTime}, after ${(now - this.stallDetectedAtTime)} ms`);

      this.stallReported = false;
    }

    return true;
  }

  _isMediaInPlayableState () {
    const currentPlayheadTime = this.currentPlayheadTime;
    const media = this.media;
    // the first case of unplayable media lies in it being in an "ended" state, or not being "ready",
    // the necessary data not being available, which can essentially be see from the buffered time-ranges,
    // but more clearly from the readyState property the browser exposes for the media element.
    if (media.ended || !media.buffered.length || media.readyState <= 2) {
      return false;
    // the other cases of unplayable are when the media is seeking, and the targetted time for this
    // is not yet in the buffered time-ranges, meaning that this position can not be decoded or played
    // in any forseeable latency (or maybe never depending on wether the data for this media time will ever be received/demuxed).
    } else if (media.seeking && !BufferHelper.isBuffered(media, currentPlayheadTime)) {
      return false;
    }
    // for all other cases we assume by inverse logic conditions that media is in a playable state
    return true;
  }

  _onMediaElWaiting () {
    const media = this.media;
    if (media.readyState < 2) {
      return;
    }

    if (BufferHelper.isBuffered(media, media.currentTime)) {
      this._handleStall();
    }
  }

  _handleStall () {
    const now = window.performance.now();
    const media = this.media;

    // limit the max frequency of stall handling i.e minimum retry period
    if (this.stallHandledAtTime !== null &&
      now - this.stallHandledAtTime < STALL_HANDLING_RETRY_PERIOD_MS) {
      return;
    }

    this.stallHandledAtTime = now;

    // The playhead isn't moving but it should be
    // Allow some slack time to for small stalls to resolve themselves
    const currentPlayheadTime = media.currentTime;
    const bufferInfo = BufferHelper.bufferInfo(media, currentPlayheadTime, this.config.maxBufferHole);

    logger.warn(`Stall detected at playhead position ${currentPlayheadTime}, buffered-time-ranges info: ${JSON.stringify(bufferInfo)}`);

    if (!this.stallDetectedAtTime) {
      logger.debug('Silently ignoring first detected stall within threshold duration. Storing local perf-timestamp: ' + now);
      this.stallDetectedAtTime = now;
      return;
    }

    // when we reach here, it means a stall was detected before,
    // we check the diff to the min threshold
    const stalledDurationMs = now - this.stallDetectedAtTime;
    if (stalledDurationMs >= STALL_MINIMUM_DURATION_MS) {
      logger.warn('Stall detected after min stall duration, reporting error');
      // Report stalling before trying to fix
      this._reportStall(bufferInfo.len);
    }

    this._tryFixBufferStall(bufferInfo, stalledDurationMs);
  }

  /**
   * Detects and attempts to fix known buffer stalling issues.
   * @param bufferInfo - The properties of the current buffer.
   * @param stalledDurationMs - The amount of time Hls.js has been stalling for.
   * @private
   */
  _tryFixBufferStall (bufferInfo, stalledDurationMs) {
    logger.warn(`Trying to fix stalled playhead on buffered time-range since ${stalledDurationMs} ms ...`);

    const { config, fragmentTracker, media } = this;
    const playheadTime = media.currentTime;

    const partial = fragmentTracker.getPartialFragment(playheadTime);
    if (partial) {
      logger.log('Trying to skip buffer-hole caused by partial fragment');
      // Try to skip over the buffer hole caused by a partial fragment
      // This method isn't limited by the size of the gap between buffered ranges
      this._trySkipBufferHole(partial);
      // we return here in this case, meaning
      // the branch below only executes when we don't handle a partial fragment
      return;
    }

    // if we haven't had to skip over a buffer hole of a partial fragment
    // we may just have to "nudge" the playlist as the browser decoding/rendering engine
    // needs to cross some sort of threshold covering all source-buffers content
    // to start playing properly.
    if (bufferInfo.len > JUMP_THRESHOLD_SECONDS &&
      stalledDurationMs > config.highBufferWatchdogPeriod * 1000) {
      logger.log('Trying to nudge playhead over buffer-hole');
      // Try to nudge currentTime over a buffer hole if we've been stalling for the configured amount of seconds
      // We only try to jump the hole if it's under the configured size
      // Reset stalled so to rearm watchdog timer
      this.stallDetectedAtTime = null;
      this._tryNudgeBuffer();
    }
  }

  /**
   * Triggers a BUFFER_STALLED_ERROR event, but only once per stall period.
   * @param bufferLen - The playhead distance from the end of the current buffer segment.
   * @private
   */
  _reportStall (bufferLen) {
    const { hls, media, stallReported } = this;
    if (!stallReported) {
      // Report stalled error once
      this.stallReported = true;
      logger.warn(`Media element playhead stalling at ${media.currentTime} secs; but should be playing`);
      hls.trigger(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        fatal: false,
        buffer: bufferLen
      });
    }
  }

  /**
   * Attempts to fix buffer stalls by jumping over known gaps caused by partial fragments
   * @param partial - The partial fragment found at the current time (where playback is stalling).
   * @private
   */
  _trySkipBufferHole (partial) {
    const { hls, media } = this;
    const currentTime = media.currentTime;
    let lastEndTime = 0;
    // Check if currentTime is between unbuffered regions of partial fragments
    for (let i = 0; i < media.buffered.length; i++) {
      let startTime = media.buffered.start(i);
      if (currentTime >= lastEndTime && currentTime < startTime) {
        media.currentTime = Math.max(startTime, media.currentTime + SKIP_BUFFER_HOLE_STEP_SECONDS);
        logger.warn(`skipping hole, adjusting currentTime from ${currentTime} to ${media.currentTime}`);
        this.stallDetectedAtTime = null;
        hls.trigger(Event.ERROR, {
          type: ErrorTypes.MEDIA_ERROR,
          details: ErrorDetails.BUFFER_SEEK_OVER_HOLE,
          fatal: false,
          reason: `fragment loaded with buffer holes, seeking from ${currentTime} to ${media.currentTime}`,
          frag: partial
        });
        return;
      }
      lastEndTime = media.buffered.end(i);
    }
  }

  /**
   * Attempts to fix buffer stalls by advancing the mediaElement's current time by a small amount.
   * @private
   */
  _tryNudgeBuffer () {
    const { config, hls, media } = this;
    const currentTime = media.currentTime;
    const nudgeRetry = (this.nudgeRetry || 0) + 1;
    this.nudgeRetry = nudgeRetry;

    if (nudgeRetry < config.nudgeMaxRetry) {
      const targetTime = currentTime + nudgeRetry * config.nudgeOffset;
      // playback stalled in buffered area ... let's nudge currentTime to try to overcome this
      logger.log(`Adjusting media-element 'currentTime' from ${currentTime} to ${targetTime}`);
      media.currentTime = targetTime;

      if (nudgeRetry === config.nudgeMaxRetry - 1) {
        logger.warn('Lastly: Attempting to un-stall playback state by over-calling media-element play() (this should not be necessary, ouch ...)');
        if (config.enforceAutoPlayByMutingAudioOnly) {
          logger.warn('Muting media audio now! Needed to allow non-UI-event scheduled play() call (this is a workaround to audio-only autoplay issues on Chrome)');
          media.muted = true;
        }
        media.play();
      }

      hls.trigger(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_NUDGE_ON_STALL,
        fatal: false
      });
    } else {
      logger.error(`Playhead still not moving while enough data buffered @${currentTime} after ${config.nudgeMaxRetry} tries to fix. Raising fatal error now`);
      hls.trigger(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        fatal: true
      });
    }
  }
}
