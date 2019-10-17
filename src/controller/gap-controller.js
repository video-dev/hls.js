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
     * @member {boolean}
     * Flag set when a flag was detected and appeared to be sustained for more than the stall minimum duration.
     */
    this.stallReported = false;

    /**
     * @private
     * @member {number | null}
     * This keeps state of the time a stall was detected.
     * It will make sure we only report a stall as one when within the min stall threshold duration.
     */
    this.stallDetectedAtTime = null;

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
    if (media.ended || !media.buffered.length || media.readyState <= 2) {
      return false;
    } else if (media.seeking && !BufferHelper.isBuffered(media, currentPlayheadTime)) {
      return false;
    } else {
      return true;
    }
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

    // when we reach here, it means a stall was detected before, we check the diff to the min threshold
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
    logger.warn('Trying to fix stalled playhead on buffered time-range ...');

    const { config, fragmentTracker, media } = this;
    const playheadTime = media.currentTime;

    const partial = fragmentTracker.getPartialFragment(playheadTime);
    if (partial) {
      logger.log('Trying to skip buffer-hole caused by partial fragment');
      // Try to skip over the buffer hole caused by a partial fragment
      // This method isn't limited by the size of the gap between buffered ranges
      this._trySkipBufferHole(partial);
      return;
    }

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
      logger.warn(`Playback stalling at @${media.currentTime} due to low buffer`);
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
      logger.log(`adjust currentTime from ${currentTime} to ${targetTime}`);
      // playback stalled in buffered area ... let's nudge currentTime to try to overcome this
      media.currentTime = targetTime;

      hls.trigger(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_NUDGE_ON_STALL,
        fatal: false
      });
    } else {
      logger.error(`still stuck in high buffer @${currentTime} after ${config.nudgeMaxRetry}, raise fatal error`);
      hls.trigger(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        fatal: true
      });
    }
  }
}
