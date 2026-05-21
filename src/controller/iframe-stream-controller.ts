import { State } from './base-stream-controller';
import StreamController from './stream-controller';
import { PlaylistLevelType } from '../types/loader';
import { BufferHelper } from '../utils/buffer-helper';
import type { Fragment, MediaFragment, Part } from '../loader/fragment';
import type { LevelDetails } from '../loader/level-details';
import type { TimestampOffset } from '../utils/timescale-conversion';

export type LoadMediaAtOptions = { seekOnAppend: boolean };

export class IFrameStreamController extends StreamController {
  private currentOp?: [time: number, options: LoadMediaAtOptions];
  private nextOp?: [time: number, options: LoadMediaAtOptions];
  private gotNext: boolean = false;
  initDetails?: LevelDetails | null;

  setInitPts(initPTS: TimestampOffset[]) {
    this.initPTS = initPTS.slice();
  }

  loadMediaAt(time: number, options: LoadMediaAtOptions) {
    if (!this.hls) {
      return;
    }
    const { seekOnAppend } = options;
    const adjustedTime = time + this.timelineOffset;
    this.nextLoadPosition = this.lastCurrentTime = adjustedTime;
    this.startPosition = time;
    switch (this.state) {
      case State.STOPPED:
      case State.ENDED:
      case State.ERROR:
        this.state = State.IDLE;
    }
    if (this.state === State.IDLE) {
      this.hls.resumeBuffering();
      this.tick();
      this.currentOp = [adjustedTime, options];
    } else {
      const fragCurrent = this.fragCurrent;
      if (
        !fragCurrent ||
        (time >= fragCurrent.start && time < fragCurrent.end)
      ) {
        this.nextOp = [adjustedTime, options];
      }
    }
    const media = this.media;
    if (seekOnAppend && media) {
      const seeking = this.seekTo(adjustedTime);
      if (seeking) {
        this.currentOp = [adjustedTime, options];
        this.nextOp = undefined;
      }
    }
  }

  private seekTo(time: number): boolean {
    const media = this.media;
    if (media) {
      if (time > media.duration) {
        time = media.duration - 0.01;
      }
      const bufferInfo = BufferHelper.bufferInfo(media, time, 0);
      const hasEnough = bufferInfo.len > 0 && this.getBufferedAt(time);
      if (hasEnough) {
        media.currentTime = time;
        if (this.state === State.IDLE) {
          this.tick();
        }
        return true;
      }
    }
    return false;
  }

  protected getBufferedAt(time: number): MediaFragment | null {
    return this.fragmentTracker.getBufferedFrag(time, PlaylistLevelType.MAIN);
  }

  // overrides
  protected fragBufferedComplete(frag: Fragment, part: Part | null) {
    super.fragBufferedComplete(frag, part);

    const { currentOp, nextOp } = this;
    this.currentOp = this.nextOp = undefined;
    this.state = State.STOPPED;
    if (currentOp?.[1].seekOnAppend) {
      this.seekTo(currentOp[0]);
      if (!nextOp && !this.gotNext) {
        // repeat op to get next segment (Chrome may require two HEVC frame appends, or one with EoS, before rendering)
        this.gotNext = true;
        this.loadMediaAt.apply(this, currentOp);
      }
    }
    if (nextOp) {
      this.loadMediaAt.apply(this, nextOp);
    }
  }

  get playhead(): number {
    return this.nextLoadPosition;
  }

  startLoad() {
    if (!this.startFragRequested) {
      const hlsIFrames = this.hls;
      hlsIFrames.nextLoadLevel =
        hlsIFrames.startLevel === -1 ? 0 : hlsIFrames.firstAutoLevel;
    }
  }
  // public getLevelDetails
  protected seekToStartPos() {}
  protected setStartPosition() {}
  protected onMediaSeeking = () => {
    this.gotNext = false;
  };

  protected alignPlaylists(
    details: LevelDetails,
    previousDetails: LevelDetails | undefined,
    switchDetails: LevelDetails | undefined,
  ): number {
    const initDetails = this.initDetails;
    this.initDetails = null;
    return super.alignPlaylists(
      details,
      previousDetails,
      switchDetails || initDetails || undefined,
    );
  }

  getMainFwdBufferInfo() {
    const t = this.playhead;
    const bufferedFragAtPos = this.getBufferedAt(t);
    if (bufferedFragAtPos) {
      const len = bufferedFragAtPos.duration;
      return { len, start: t, end: t + len, bufferedIndex: -1 };
    }
    return { len: 0, start: t, end: t, bufferedIndex: -1 };
  }

  protected _streamEnded() {
    const t = this.playhead;
    const bufferedFragAtPos = this.fragmentTracker.getBufferedFrag(
      t,
      PlaylistLevelType.MAIN,
    );
    return !!bufferedFragAtPos?.endList;
  }
}
