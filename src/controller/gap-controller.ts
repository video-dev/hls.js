import { State } from './base-stream-controller';
import { ErrorDetails, ErrorTypes } from '../errors';
import { Events } from '../events';
import { PlaylistLevelType } from '../types/loader';
import { BufferHelper } from '../utils/buffer-helper';
import { Logger } from '../utils/logger';
import type Hls from '../hls';
import type { FragmentTracker } from './fragment-tracker';
import type { Fragment } from '../loader/fragment';
import type { LevelDetails } from '../loader/level-details';
import type { BufferInfo } from '../utils/buffer-helper';

export const MAX_START_GAP_JUMP = 2.0;
export const SKIP_BUFFER_HOLE_STEP_SECONDS = 0.1;
export const SKIP_BUFFER_RANGE_START = 0.05;

export default class GapController extends Logger {
  private media: HTMLMediaElement | null = null;
  private fragmentTracker: FragmentTracker | null = null;
  private hls: Hls | null = null;
  private nudgeRetry: number = 0;
  private stallReported: boolean = false;
  private stalled: number | null = null;
  private moved: boolean = false;
  private seeking: boolean = false;
  public ended: number = 0;
  public waiting: number = 0;

  constructor(
    media: HTMLMediaElement,
    fragmentTracker: FragmentTracker,
    hls: Hls,
  ) {
    super('gap-controller', hls.logger);
    this.media = media;
    this.fragmentTracker = fragmentTracker;
    this.hls = hls;
  }

  public destroy() {
    this.media = this.hls = this.fragmentTracker = null;
  }

  /**
   * Checks if the playhead is stuck within a gap, and if so, attempts to free it.
   * A gap is an unbuffered range between two buffered ranges (or the start and the first buffered range).
   *
   * @param lastCurrentTime - Previously read playhead position
   */
  public poll(
    lastCurrentTime: number,
    activeFrag: Fragment | null,
    levelDetails: LevelDetails | undefined,
    state: string,
  ) {
    const { media, stalled } = this;

    if (!media) {
      return;
    }
    const { currentTime, seeking } = media;
    const seeked = this.seeking && !seeking;
    const beginSeek = !this.seeking && seeking;

    this.seeking = seeking;

    // The playhead is moving, no-op
    if (currentTime !== lastCurrentTime) {
      if (lastCurrentTime) {
        this.ended = 0;
      }
      this.moved = true;
      if (!seeking) {
        this.nudgeRetry = 0;
      }
      if (this.waiting === 0) {
        this.stallResolved(currentTime);
      }
      return;
    }

    // Clear stalled state when beginning or finishing seeking so that we don't report stalls coming out of a seek
    if (beginSeek || seeked) {
      if (seeked) {
        this.stallResolved(currentTime);
      }
      return;
    }

    // The playhead should not be moving
    if ((media.paused && !seeking) || media.ended || media.playbackRate === 0) {
      this.nudgeRetry = 0;
      this.stallResolved(currentTime);
      // Fire MEDIA_ENDED to workaround event not being dispatched by browser
      if (!this.ended && media.ended && this.hls) {
        this.ended = currentTime || 1;
        this.hls.trigger(Events.MEDIA_ENDED, {
          stalled: false,
        });
      }
      return;
    }

    if (!BufferHelper.getBuffered(media).length) {
      this.nudgeRetry = 0;
      return;
    }

    const bufferInfo = BufferHelper.bufferInfo(media, currentTime, 0);
    const nextStart = bufferInfo.nextStart || 0;
    const fragmentTracker = this.fragmentTracker;

    if (seeking && fragmentTracker) {
      // Waiting for seeking in a buffered range to complete
      const hasEnoughBuffer = bufferInfo.len > MAX_START_GAP_JUMP;
      // Next buffered range is too far ahead to jump to while still seeking
      const noBufferGap =
        !nextStart ||
        (activeFrag && activeFrag.start <= currentTime) ||
        (nextStart - currentTime > MAX_START_GAP_JUMP &&
          !fragmentTracker.getPartialFragment(currentTime));
      if (hasEnoughBuffer || noBufferGap) {
        return;
      }
      // Reset moved state when seeking to a point in or before a gap
      this.moved = false;
    }

    // Skip start gaps if we haven't played, but the last poll detected the start of a stall
    // The addition poll gives the browser a chance to jump the gap for us
    if (!this.moved && this.stalled !== null && fragmentTracker) {
      // There is no playable buffer (seeked, waiting for buffer)
      const isBuffered = bufferInfo.len > 0;
      if (!isBuffered && !nextStart) {
        return;
      }
      // Jump start gaps within jump threshold
      const startJump =
        Math.max(nextStart, bufferInfo.start || 0) - currentTime;

      // When joining a live stream with audio tracks, account for live playlist window sliding by allowing
      // a larger jump over start gaps caused by the audio-stream-controller buffering a start fragment
      // that begins over 1 target duration after the video start position.
      const isLive = !!levelDetails?.live;
      const maxStartGapJump = isLive
        ? levelDetails!.targetduration * 2
        : MAX_START_GAP_JUMP;
      const partialOrGap = fragmentTracker.getPartialFragment(currentTime);
      if (startJump > 0 && (startJump <= maxStartGapJump || partialOrGap)) {
        if (!media.paused) {
          this._trySkipBufferHole(partialOrGap);
        }
        return;
      }
    }

    // Start tracking stall time
    const config = this.hls?.config;
    if (!config) {
      return;
    }
    const detectStallWithCurrentTimeMs = config.detectStallWithCurrentTimeMs;
    const tnow = self.performance.now();
    const tWaiting = this.waiting;
    if (stalled === null) {
      // Use time of recent "waiting" event
      if (tWaiting > 0 && tnow - tWaiting < detectStallWithCurrentTimeMs) {
        this.stalled = tWaiting;
      } else {
        this.stalled = tnow;
      }
      return;
    }

    const stalledDuration = tnow - stalled;
    if (
      !seeking &&
      (stalledDuration >= detectStallWithCurrentTimeMs || tWaiting) &&
      this.hls
    ) {
      // Dispatch MEDIA_ENDED when media.ended/ended event is not signalled at end of stream
      if (
        state === State.ENDED &&
        !levelDetails?.live &&
        Math.abs(currentTime - (levelDetails?.edge || 0)) < 1
      ) {
        if (this.ended) {
          return;
        }
        this.ended = currentTime || 1;
        this.hls.trigger(Events.MEDIA_ENDED, {
          stalled: true,
        });
        return;
      }
      // Report stalling after trying to fix
      this._reportStall(bufferInfo);
      if (!this.media || !this.hls) {
        return;
      }
    }

    const bufferedWithHoles = BufferHelper.bufferInfo(
      media,
      currentTime,
      config.maxBufferHole,
    );
    this._tryFixBufferStall(bufferedWithHoles, stalledDuration);
  }

  private stallResolved(currentTime: number) {
    const stalled = this.stalled;
    if (stalled && this.hls) {
      this.stalled = null;
      // The playhead is now moving, but was previously stalled
      if (this.stallReported) {
        const stalledDuration = self.performance.now() - stalled;
        this.warn(
          `playback not stuck anymore @${currentTime}, after ${Math.round(
            stalledDuration,
          )}ms`,
        );
        this.stallReported = false;
        this.waiting = 0;
        this.hls.trigger(Events.STALL_RESOLVED, {});
      }
    }
  }

  /**
   * Detects and attempts to fix known buffer stalling issues.
   * @param bufferInfo - The properties of the current buffer.
   * @param stalledDurationMs - The amount of time Hls.js has been stalling for.
   * @private
   */
  private _tryFixBufferStall(
    bufferInfo: BufferInfo,
    stalledDurationMs: number,
  ) {
    const { fragmentTracker, media } = this;
    const config = this.hls?.config;
    if (!media || !fragmentTracker || !config) {
      return;
    }

    const currentTime = media.currentTime;

    const partial = fragmentTracker.getPartialFragment(currentTime);
    if (partial) {
      // Try to skip over the buffer hole caused by a partial fragment
      // This method isn't limited by the size of the gap between buffered ranges
      const targetTime = this._trySkipBufferHole(partial);
      // we return here in this case, meaning
      // the branch below only executes when we haven't seeked to a new position
      if (targetTime || !this.media) {
        return;
      }
    }

    // if we haven't had to skip over a buffer hole of a partial fragment
    // we may just have to "nudge" the playlist as the browser decoding/rendering engine
    // needs to cross some sort of threshold covering all source-buffers content
    // to start playing properly.
    const bufferedRanges = bufferInfo.buffered;
    if (
      ((bufferedRanges &&
        bufferedRanges.length > 1 &&
        bufferInfo.len > config.maxBufferHole) ||
        (bufferInfo.nextStart &&
          bufferInfo.nextStart - currentTime < config.maxBufferHole)) &&
      stalledDurationMs > config.highBufferWatchdogPeriod * 1000
    ) {
      this.warn('Trying to nudge playhead over buffer-hole');
      // Try to nudge currentTime over a buffer hole if we've been stalling for the configured amount of seconds
      // We only try to jump the hole if it's under the configured size
      this._tryNudgeBuffer(bufferInfo);
    }
  }

  /**
   * Triggers a BUFFER_STALLED_ERROR event, but only once per stall period.
   * @param bufferLen - The playhead distance from the end of the current buffer segment.
   * @private
   */
  private _reportStall(bufferInfo: BufferInfo) {
    const { hls, media, stallReported, stalled } = this;
    if (!stallReported && stalled !== null && media && hls) {
      // Report stalled error once
      this.stallReported = true;
      const error = new Error(
        `Playback stalling at @${
          media.currentTime
        } due to low buffer (${JSON.stringify(bufferInfo)})`,
      );
      this.warn(error.message);
      hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        fatal: false,
        error,
        buffer: bufferInfo.len,
        bufferInfo,
        stalled: { start: stalled },
      });
    }
  }

  /**
   * Attempts to fix buffer stalls by jumping over known gaps caused by partial fragments
   * @param partial - The partial fragment found at the current time (where playback is stalling).
   * @private
   */
  private _trySkipBufferHole(partial: Fragment | null): number {
    const { fragmentTracker, media } = this;
    const config = this.hls?.config;
    if (!media || !fragmentTracker || !config) {
      return 0;
    }

    // Check if currentTime is between unbuffered regions of partial fragments
    const currentTime = media.currentTime;
    const bufferInfo = BufferHelper.bufferInfo(media, currentTime, 0);
    const startTime =
      currentTime < bufferInfo.start ? bufferInfo.start : bufferInfo.nextStart;
    if (startTime) {
      const bufferStarved = bufferInfo.len <= config.maxBufferHole;
      const waiting =
        bufferInfo.len > 0 && bufferInfo.len < 1 && media.readyState < 3;
      const gapLength = startTime - currentTime;
      if (gapLength > 0 && (bufferStarved || waiting)) {
        // Only allow large gaps to be skipped if it is a start gap, or all fragments in skip range are partial
        if (gapLength > config.maxBufferHole) {
          let startGap = false;
          if (currentTime === 0) {
            const startFrag = fragmentTracker.getAppendedFrag(
              0,
              PlaylistLevelType.MAIN,
            );
            if (startFrag && startTime < startFrag.end) {
              startGap = true;
            }
          }
          if (!startGap) {
            const startProvisioned =
              partial ||
              fragmentTracker.getAppendedFrag(
                currentTime,
                PlaylistLevelType.MAIN,
              );
            if (startProvisioned) {
              let moreToLoad = false;
              let pos = startProvisioned.end;
              while (pos < startTime) {
                const provisioned = fragmentTracker.getPartialFragment(pos);
                if (provisioned) {
                  pos += provisioned.duration;
                } else {
                  moreToLoad = true;
                  break;
                }
              }
              if (moreToLoad) {
                return 0;
              }
            }
          }
        }
        const targetTime = Math.max(
          startTime + SKIP_BUFFER_RANGE_START,
          currentTime + SKIP_BUFFER_HOLE_STEP_SECONDS,
        );
        this.warn(
          `skipping hole, adjusting currentTime from ${currentTime} to ${targetTime}`,
        );
        this.moved = true;
        media.currentTime = targetTime;
        if (partial && !partial.gap && this.hls) {
          const error = new Error(
            `fragment loaded with buffer holes, seeking from ${currentTime} to ${targetTime}`,
          );
          this.hls.trigger(Events.ERROR, {
            type: ErrorTypes.MEDIA_ERROR,
            details: ErrorDetails.BUFFER_SEEK_OVER_HOLE,
            fatal: false,
            error,
            reason: error.message,
            frag: partial,
            buffer: bufferInfo.len,
            bufferInfo,
          });
        }
        return targetTime;
      }
    }
    return 0;
  }

  /**
   * Attempts to fix buffer stalls by advancing the mediaElement's current time by a small amount.
   * @private
   */
  private _tryNudgeBuffer(bufferInfo: BufferInfo) {
    const { hls, media, nudgeRetry } = this;
    const config = hls?.config;
    if (!media || !config) {
      return 0;
    }
    const currentTime = media.currentTime;
    this.nudgeRetry++;

    if (nudgeRetry < config.nudgeMaxRetry) {
      const targetTime = currentTime + (nudgeRetry + 1) * config.nudgeOffset;
      // playback stalled in buffered area ... let's nudge currentTime to try to overcome this
      const error = new Error(
        `Nudging 'currentTime' from ${currentTime} to ${targetTime}`,
      );
      this.warn(error.message);
      media.currentTime = targetTime;
      hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_NUDGE_ON_STALL,
        error,
        fatal: false,
        buffer: bufferInfo.len,
        bufferInfo,
      });
    } else {
      const error = new Error(
        `Playhead still not moving while enough data buffered @${currentTime} after ${config.nudgeMaxRetry} nudges`,
      );
      this.error(error.message);
      hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        error,
        fatal: true,
        buffer: bufferInfo.len,
        bufferInfo,
      });
    }
  }
}
