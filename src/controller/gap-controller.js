import { BufferHelper } from '../utils/buffer-helper';
import { ErrorTypes, ErrorDetails } from '../errors';
import Event from '../events';
import { logger } from '../utils/logger';

export const STALL_MINIMUM_DURATION_MS = 250;
export const JUMP_THRESHOLD_SECONDS = 0.5; // tolerance needed as some browsers stalls playback before reaching buffered range end
export const SKIP_BUFFER_HOLE_STEP_SECONDS = 0.1;
export const SKIP_BUFFER_RANGE_START = 0.05;

export default class GapController {
  constructor (config, media, fragmentTracker, hls) {
    this.config = config;
    this.media = media;
    this.fragmentTracker = fragmentTracker;
    this.hls = hls;
    this.nudgeRetry = 0;
    this.stallReported = false;
    this.stalled = null;
    this.moved = false;
  }

  /**
   * Checks if the playhead is stuck within a gap, and if so, attempts to free it.
   * A gap is an unbuffered range between two buffered ranges (or the start and the first buffered range).
   *
   * @param {number} lastCurrentTime Previously read playhead position
   */
  poll (lastCurrentTime) {
    const { config, media, stalled } = this;
    const currentTime = media.currentTime;
    const tnow = self.performance.now();

    // The playhead is moving, no-op
    if (currentTime !== lastCurrentTime) {
      this.moved = true;
      if (stalled !== null) {
        // The playhead is now moving, but was previously stalled
        if (this.stallReported) {
          logger.warn(`playback not stuck anymore @${currentTime}, after ${Math.round(tnow - stalled)}ms`);
          this.stallReported = false;
        }
        this.stalled = null;
        this.nudgeRetry = 0;
      }
      return;
    }

    // The playhead should not be moving
    if (media.paused || media.ended || media.playbackRate === 0 || !media.buffered.length) {
      return;
    }

    // Waiting for seeking in a buffered range to complete
    const seeking = media.seeking;
    if (seeking && BufferHelper.isBuffered(media, currentTime)) {
      return;
    }

    const bufferInfo = BufferHelper.bufferInfo(media, currentTime, config.maxBufferHole);

    // There is no playable buffer (seeked, waiting for buffer)
    if (bufferInfo.len === 0 && !bufferInfo.nextStart) {
      return;
    }

    // The playhead isn't moving but it should be
    // Allow some slack time to for small stalls to resolve themselves
    if (!this.moved && this.stalled) {
      if (!seeking && (bufferInfo.nextStart || bufferInfo.start > currentTime)) {
        this._trySkipBufferHole(null);
      }
      return;
    }

    // Start tracking stall time
    if (!seeking && stalled === null) {
      this.stalled = tnow;
      return;
    }

    const stalledDuration = tnow - stalled;
    if (!seeking && stalledDuration >= STALL_MINIMUM_DURATION_MS) {
      // Report stalling after trying to fix
      this._reportStall(bufferInfo.len);
    }

    this._tryFixBufferStall(bufferInfo, stalledDuration);
  }

  /**
   * Detects and attempts to fix known buffer stalling issues.
   * @param bufferInfo - The properties of the current buffer.
   * @param stalledDurationMs - The amount of time Hls.js has been stalling for.
   * @private
   */
  _tryFixBufferStall (bufferInfo, stalledDurationMs) {
    const { config, fragmentTracker, media } = this;
    const currentTime = media.currentTime;

    const partial = fragmentTracker.getPartialFragment(currentTime);
    if (partial) {
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
      this.stalled = null;
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
      const startTime = media.buffered.start(i);
      if (currentTime >= lastEndTime && currentTime < startTime) {
        const targetTime = Math.max(startTime + SKIP_BUFFER_RANGE_START, media.currentTime + SKIP_BUFFER_HOLE_STEP_SECONDS);
        logger.warn(`skipping hole, adjusting currentTime from ${currentTime} to ${targetTime}`);
        this.moved = true;
        this.stalled = null;
        media.currentTime = targetTime;
        if (partial) {
          hls.trigger(Event.ERROR, {
            type: ErrorTypes.MEDIA_ERROR,
            details: ErrorDetails.BUFFER_SEEK_OVER_HOLE,
            fatal: false,
            reason: `fragment loaded with buffer holes, seeking from ${currentTime} to ${targetTime}`,
            frag: partial
          });
        }
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
      logger.log(`Nudging 'currentTime' from ${currentTime} to ${targetTime}`);
      media.currentTime = targetTime;

      hls.trigger(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_NUDGE_ON_STALL,
        fatal: false
      });
    } else {
      logger.error(`Playhead still not moving while enough data buffered @${currentTime} after ${config.nudgeMaxRetry} nudges`);
      hls.trigger(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        fatal: true
      });
    }
  }
}
