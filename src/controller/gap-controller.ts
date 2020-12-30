import type { BufferInfo } from '../utils/buffer-helper';
import { BufferHelper } from '../utils/buffer-helper';
import { ErrorTypes, ErrorDetails } from '../errors';
import { Events } from '../events';
import { logger } from '../utils/logger';
import type Hls from '../hls';
import type { HlsConfig } from '../config';
import type { FragmentTracker } from './fragment-tracker';
import Fragment from '../loader/fragment';

export const STALL_MINIMUM_DURATION_MS = 250;
export const MAX_START_GAP_JUMP = 2.0;
export const SKIP_BUFFER_HOLE_STEP_SECONDS = 0.1;
export const SKIP_BUFFER_RANGE_START = 0.05;

export default class GapController {
  private config: HlsConfig;
  private media: HTMLMediaElement;
  private fragmentTracker: FragmentTracker;
  private hls: Hls;
  private nudgeRetry: number = 0;
  private stallReported: boolean = false;
  private stalled: number | null = null;
  private moved: boolean = false;
  private seeking: boolean = false;

  constructor(config, media, fragmentTracker, hls) {
    this.config = config;
    this.media = media;
    this.fragmentTracker = fragmentTracker;
    this.hls = hls;
  }

  /**
   * Checks if the playhead is stuck within a gap, and if so, attempts to free it.
   * A gap is an unbuffered range between two buffered ranges (or the start and the first buffered range).
   *
   * @param {number} lastCurrentTime Previously read playhead position
   */
  public poll(lastCurrentTime: number) {
    const { config, media, stalled } = this;
    const { currentTime, seeking } = media;
    const seeked = this.seeking && !seeking;
    const beginSeek = !this.seeking && seeking;

    this.seeking = seeking;

    // The playhead is moving, no-op
    if (currentTime !== lastCurrentTime) {
      this.moved = true;
      if (stalled !== null) {
        // The playhead is now moving, but was previously stalled
        if (this.stallReported) {
          const stalledDuration = self.performance.now() - stalled;
          logger.warn(
            `playback not stuck anymore @${currentTime}, after ${Math.round(
              stalledDuration
            )}ms`
          );
          this.stallReported = false;
        }
        this.stalled = null;
        this.nudgeRetry = 0;
      }
      return;
    }

    // Clear stalled state when beginning or finishing seeking so that we don't report stalls coming out of a seek
    if (beginSeek || seeked) {
      this.stalled = null;
    }

    // The playhead should not be moving
    if (
      media.paused ||
      media.ended ||
      media.playbackRate === 0 ||
      !BufferHelper.getBuffered(media).length
    ) {
      return;
    }

    const bufferInfo = BufferHelper.bufferInfo(media, currentTime, 0);
    const isBuffered = bufferInfo.len > 0;
    const nextStart = bufferInfo.nextStart || 0;

    // There is no playable buffer (seeked, waiting for buffer)
    if (!isBuffered && !nextStart) {
      return;
    }

    if (seeking) {
      // Waiting for seeking in a buffered range to complete
      const hasEnoughBuffer = bufferInfo.len > MAX_START_GAP_JUMP;
      // Next buffered range is too far ahead to jump to while still seeking
      const noBufferGap =
        !nextStart ||
        (nextStart - currentTime > MAX_START_GAP_JUMP &&
          !this.fragmentTracker.getPartialFragment(currentTime));
      if (hasEnoughBuffer || noBufferGap) {
        return;
      }
      // Reset moved state when seeking to a point in or before a gap
      this.moved = false;
    }

    // Skip start gaps if we haven't played, but the last poll detected the start of a stall
    // The addition poll gives the browser a chance to jump the gap for us
    if (!this.moved && this.stalled !== null) {
      // Jump start gaps within jump threshold
      const startJump =
        Math.max(nextStart, bufferInfo.start || 0) - currentTime;

      // When joining a live stream with audio tracks, account for live playlist window sliding by allowing
      // a larger jump over start gaps caused by the audio-stream-controller buffering a start fragment
      // that begins over 1 target duration after the video start position.
      const level = this.hls.levels
        ? this.hls.levels[this.hls.currentLevel]
        : null;
      const isLive = level?.details?.live;
      const maxStartGapJump = isLive
        ? level!.details!.targetduration * 2
        : MAX_START_GAP_JUMP;
      if (startJump > 0 && startJump <= maxStartGapJump) {
        this._trySkipBufferHole(null);
        return;
      }
    }

    // Start tracking stall time
    const tnow = self.performance.now();
    if (stalled === null) {
      this.stalled = tnow;
      return;
    }

    const stalledDuration = tnow - stalled;
    if (!seeking && stalledDuration >= STALL_MINIMUM_DURATION_MS) {
      // Report stalling after trying to fix
      this._reportStall(bufferInfo.len);
    }

    const bufferedWithHoles = BufferHelper.bufferInfo(
      media,
      currentTime,
      config.maxBufferHole
    );
    this._tryFixBufferStall(bufferedWithHoles, stalledDuration);
  }

  /**
   * Detects and attempts to fix known buffer stalling issues.
   * @param bufferInfo - The properties of the current buffer.
   * @param stalledDurationMs - The amount of time Hls.js has been stalling for.
   * @private
   */
  private _tryFixBufferStall(
    bufferInfo: BufferInfo,
    stalledDurationMs: number
  ) {
    const { config, fragmentTracker, media } = this;
    const currentTime = media.currentTime;

    const partial = fragmentTracker.getPartialFragment(currentTime);
    if (partial) {
      // Try to skip over the buffer hole caused by a partial fragment
      // This method isn't limited by the size of the gap between buffered ranges
      const targetTime = this._trySkipBufferHole(partial);
      // we return here in this case, meaning
      // the branch below only executes when we don't handle a partial fragment
      if (targetTime) {
        return;
      }
    }

    // if we haven't had to skip over a buffer hole of a partial fragment
    // we may just have to "nudge" the playlist as the browser decoding/rendering engine
    // needs to cross some sort of threshold covering all source-buffers content
    // to start playing properly.
    if (
      bufferInfo.len > config.maxBufferHole &&
      stalledDurationMs > config.highBufferWatchdogPeriod * 1000
    ) {
      logger.warn('Trying to nudge playhead over buffer-hole');
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
  private _reportStall(bufferLen) {
    const { hls, media, stallReported } = this;
    if (!stallReported) {
      // Report stalled error once
      this.stallReported = true;
      logger.warn(
        `Playback stalling at @${media.currentTime} due to low buffer (buffer=${bufferLen})`
      );
      hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        fatal: false,
        buffer: bufferLen,
      });
    }
  }

  /**
   * Attempts to fix buffer stalls by jumping over known gaps caused by partial fragments
   * @param partial - The partial fragment found at the current time (where playback is stalling).
   * @private
   */
  private _trySkipBufferHole(partial: Fragment | null): number {
    const { config, hls, media } = this;
    const currentTime = media.currentTime;
    let lastEndTime = 0;
    // Check if currentTime is between unbuffered regions of partial fragments
    const buffered = BufferHelper.getBuffered(media);
    for (let i = 0; i < buffered.length; i++) {
      const startTime = buffered.start(i);
      if (
        currentTime + config.maxBufferHole >= lastEndTime &&
        currentTime < startTime
      ) {
        const targetTime = Math.max(
          startTime + SKIP_BUFFER_RANGE_START,
          media.currentTime + SKIP_BUFFER_HOLE_STEP_SECONDS
        );
        logger.warn(
          `skipping hole, adjusting currentTime from ${currentTime} to ${targetTime}`
        );
        this.moved = true;
        this.stalled = null;
        media.currentTime = targetTime;
        if (partial) {
          hls.trigger(Events.ERROR, {
            type: ErrorTypes.MEDIA_ERROR,
            details: ErrorDetails.BUFFER_SEEK_OVER_HOLE,
            fatal: false,
            reason: `fragment loaded with buffer holes, seeking from ${currentTime} to ${targetTime}`,
            frag: partial,
          });
        }
        return targetTime;
      }
      lastEndTime = buffered.end(i);
    }
    return 0;
  }

  /**
   * Attempts to fix buffer stalls by advancing the mediaElement's current time by a small amount.
   * @private
   */
  private _tryNudgeBuffer() {
    const { config, hls, media } = this;
    const currentTime = media.currentTime;
    const nudgeRetry = (this.nudgeRetry || 0) + 1;
    this.nudgeRetry = nudgeRetry;

    if (nudgeRetry < config.nudgeMaxRetry) {
      const targetTime = currentTime + nudgeRetry * config.nudgeOffset;
      // playback stalled in buffered area ... let's nudge currentTime to try to overcome this
      logger.warn(`Nudging 'currentTime' from ${currentTime} to ${targetTime}`);
      media.currentTime = targetTime;
      hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_NUDGE_ON_STALL,
        fatal: false,
      });
    } else {
      logger.error(
        `Playhead still not moving while enough data buffered @${currentTime} after ${config.nudgeMaxRetry} nudges`
      );
      hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        fatal: true,
      });
    }
  }
}
