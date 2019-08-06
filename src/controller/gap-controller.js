import { BufferHelper } from '../utils/buffer-helper';
import { ErrorTypes, ErrorDetails } from '../errors';
import Event from '../events';
import { logger } from '../utils/logger';

const STALL_DEBOUNCE_INTERVAL_MS = 1000;
const JUMP_THRESHOLD_SECONDS = 0.5; // tolerance needed as some browsers stalls playback before reaching buffered range end

export default class GapController {
  constructor (config, media, fragmentTracker, hls) {
    this.config = config;
    this.media = media;
    this.fragmentTracker = fragmentTracker;
    this.hls = hls;

    /**
     * @private @member {boolean}
     */
    this.stallReported = false;

    /**
     * @private @member {number | null}
     */
    this.stalledAtTime = null;
    /**
     * @private @member {boolean}
     */
    this.hasPlayed = false;

    /**
     * @private @member {EventListener}
     */
    this._onMediaStalled = this._handleStall.bind(this);

    this.media.addEventListener('waiting', this._onMediaStalled);
    this.media.addEventListener('stalled', this._onMediaStalled);
  }

  destroy () {
    this.media.removeEventListener('waiting', this._onMediaStalled);
    this.media.removeEventListener('stalled', this._onMediaStalled);
  }

  /**
   * Checks if the playhead is stuck within a gap, and if so, attempts to free it.
   * A gap is an unbuffered range between two buffered ranges (or the start and the first buffered range).
   *
   * @param {number} previousPlayheadTime Previously read playhead position
   */
  poll (previousPlayheadTime) {
    const media = this.media;

    if (this.hasPlayed && media.paused) {
      return;
    }

    const currentPlayheadTime = media.currentTime;
    // The playhead is now moving, but was previously stalled
    if (this.stalledAtTime !== null && currentPlayheadTime !== previousPlayheadTime) {
      // If it was reported stalled, let's report the recovery
      if (this.stallReported) {
        const now = window.performance.now();
        const currentPlayheadTime = this.media.currentTime;
        logger.warn(`playback not stuck anymore @${currentPlayheadTime}, after ${Math.round(now - this.stalledAtTime)}ms`);
        this.stallReported = false;
      }
      this.stalledAtTime = null;
      this.nudgeRetry = 0;
      this.hasPlayed = true;
      return;
    }

    if (media.ended || !media.buffered.length || media.readyState <= 2) {
      return;
    }

    if (media.seeking && !BufferHelper.isBuffered(media, currentPlayheadTime)) {
      return;
    }

    this._handleStall();
  }

  _handleStall () {
    const now = window.performance.now();
    const media = this.media;
    // The playhead isn't moving but it should be
    // Allow some slack time to for small stalls to resolve themselves
    const stalledDurationMs = now - this.stalledAtTime;
    const currentPlayheadTime = media.currentTime;
    const bufferInfo = BufferHelper.mediaBufferInfo(media, currentPlayheadTime, this.config.maxBufferHole);

    logger.warn(`Stall detected at playhead position ${currentPlayheadTime}, buffered-time-ranges info: ${JSON.stringify(bufferInfo)}`);

    if (!this.stalledAtTime) {
      logger.warn('Silently ignoring first detected stall within grace period, storing timestamp: ' + now);
      this.stalledAtTime = now;
      return;
    } else if (stalledDurationMs >= STALL_DEBOUNCE_INTERVAL_MS) {
      logger.warn('Stall detected after grace period, reporting error');
      // Report stalling after trying to fix
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
    }

    if (bufferInfo.len > JUMP_THRESHOLD_SECONDS &&
      stalledDurationMs > config.highBufferWatchdogPeriod * 1000) {
      logger.log('Trying to nudge playhead over buffer-hole');
      // Try to nudge currentTime over a buffer hole if we've been stalling for the configured amount of seconds
      // We only try to jump the hole if it's under the configured size
      // Reset stalled so to rearm watchdog timer
      this.stalledAtTime = null;
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
        media.currentTime = Math.max(startTime, media.currentTime + 0.1);
        logger.warn(`skipping hole, adjusting currentTime from ${currentTime} to ${media.currentTime}`);
        this.stalledAtTime = null;
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
