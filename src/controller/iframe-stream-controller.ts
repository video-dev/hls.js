import { State } from './base-stream-controller';
import { FragmentState } from './fragment-tracker';
import StreamController from './stream-controller';
import { Events } from '../events';
import { isMediaFragment } from '../loader/fragment';
import { LoadStats } from '../loader/load-stats';
import { PlaylistLevelType } from '../types/loader';
import { BufferHelper } from '../utils/buffer-helper';
import { timeRangesToString } from '../utils/time-ranges';
import type { Fragment, MediaFragment, Part } from '../loader/fragment';
import type { LevelDetails } from '../loader/level-details';
import type { FragLoadedData } from '../types/events';
import type { Level } from '../types/level';
import type { TimestampOffset } from '../utils/timescale-conversion';

export type LoadMediaAtOptions = { seekOnAppend: boolean };

export class IFrameStreamController extends StreamController {
  private currentOp?: [time: number, options: LoadMediaAtOptions];
  private nextOp?: [time: number, options: LoadMediaAtOptions];
  protected cached: MediaFragment[] = [];
  protected cachedSize = 0;
  // Cache loaded fragment payloads for replay. The image I-Frame controller
  // disables this and caches decoded image data instead.
  protected cacheFragmentData: boolean = true;
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
      // A load operation is active: queue this one (replacing any pending
      // operation) so it is picked up when the active fragment completes.
      this.nextOp = [adjustedTime, options];
    }
    // This operation supersedes any seek scheduled for end of stream
    this.hls.off(Events.BUFFERED_TO_END, this.onBufferedToEnd);
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
      // Clamp to the playlist end so the last frame can be rendered. Do not
      // clamp to `media.duration`: endOfStream() after each rendered frame
      // truncates duration to the buffered end, and clamping to it would
      // divert forward operations to a stale frame while the requested
      // fragment is still loading.
      const edge = this.getLevelDetails()?.edge;
      const end = edge !== undefined ? edge : media.duration;
      if (time >= end) {
        time = end - 0.01;
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

  // Retain fragment data up to `iframeCacheLimit` total bytes, evicting the
  // oldest entries, so that removed frames can be re-buffered without
  // additional requests
  protected cacheSet(frag: MediaFragment, data: Uint8Array<ArrayBuffer>) {
    if (!this.hls) {
      return;
    }
    frag.data = data;
    const cache = this.cached;
    cache.push(frag);
    this.cachedSize += data.buffer.byteLength;
    const iframeCacheLimit = this.hls.config.iframeCacheLimit;
    while (this.cachedSize > iframeCacheLimit && cache.length > 1) {
      const evicted = cache.shift()!;
      if (evicted.data) {
        this.cachedSize -= evicted.data.byteLength;
        evicted.data = undefined;
      } else {
        // Fragment was removed. Re-evaluate size.
        this.cached = cache.filter((frag) => !!frag.data);
        this.cachedSize = cache.reduce(
          (acc, { data }) => (data ? data.buffer.byteLength : 0),
          0,
        );
        break;
      }
    }
  }

  protected onHandlerDestroying() {
    this.cached.length = 0;
    this.cachedSize = 0;
    super.onHandlerDestroying();
  }

  // overrides
  protected _handleFragmentLoadProgress(data: FragLoadedData) {
    const frag = data.frag;
    const { part, payload } = data;
    if (
      this.cacheFragmentData &&
      !part &&
      payload?.byteLength &&
      !frag.data &&
      isMediaFragment(frag)
    ) {
      // Cache a pristine copy of the payload for replay after the buffer is
      // flushed (the remuxer rewrites I-Frame fragment data in place)
      this.cacheSet(frag, new Uint8Array(payload.slice(0)));
    }
    super._handleFragmentLoadProgress(data);
  }

  protected loadFragment(
    frag: MediaFragment,
    level: Level,
    targetBufferTime: number,
  ) {
    const fragState = this.fragmentTracker.getState(frag);
    if (
      (fragState === FragmentState.NOT_LOADED ||
        fragState === FragmentState.PARTIAL) &&
      this.canReplayCached(frag)
    ) {
      this.replayCachedFragment(frag);
      return;
    }
    super.loadFragment(frag, level, targetBufferTime);
  }

  // Replay is possible when fragment data is cached and decryption does not
  // depend on a key that has yet to be loaded (EME-managed key formats
  // append encrypted samples as-is)
  private canReplayCached(frag: MediaFragment): boolean {
    if (!this.cacheFragmentData || !frag.data?.byteLength) {
      return false;
    }
    const decryptdata = frag.decryptdata;
    return decryptdata?.keyFormat !== 'identity' || !!decryptdata.key;
  }

  private replayCachedFragment(frag: MediaFragment) {
    // The remuxer rewrites fragment data in place: transmux a copy
    const payload = frag.data!.slice().buffer;
    this.log(
      `Buffering cached ${frag.type} sn: ${frag.sn} of level ${frag.level} (${payload.byteLength} bytes)`,
    );
    this.fragCurrent = frag;
    this.startFragRequested = true;
    const stats = (frag.stats = new LoadStats());
    stats.loading.start =
      stats.loading.first =
      stats.loading.end =
        self.performance.now();
    stats.loaded = stats.total = payload.byteLength;
    stats.chunkCount = 1;
    this.state = State.FRAG_LOADING;
    const data: FragLoadedData = {
      frag,
      part: null,
      payload,
      networkDetails: null,
    };
    this._handleFragmentLoadProgress(data);
    // FRAG_LOADED registers the fragment with the fragment tracker
    this.hls.trigger(Events.FRAG_LOADED, data);
    this._handleFragmentLoadComplete(data);
  }

  protected fragBufferedComplete(frag: Fragment, part: Part | null) {
    super.fragBufferedComplete(frag, part);

    const { currentOp, nextOp } = this;
    this.currentOp = this.nextOp = undefined;
    this.state = State.STOPPED;
    if (currentOp?.[1].seekOnAppend) {
      if (!nextOp) {
        // The decoder only renders a single appended keyframe once it can
        // rule out more frames before the next composition deadline: the
        // media element completes a seek into a buffered range when a frame
        // follows the seek target, or end of stream marks the end of the
        // range. Remove buffered media beyond the target fragment (loading
        // an earlier fragment leaves a gap the decoder would otherwise wait
        // on indefinitely) so that end of stream applies to it, then seek.
        const media = this.media;
        const bufferedFrag = this.getBufferedAt(currentOp[0]);
        const flushFrom = (bufferedFrag || (frag as MediaFragment)).end;
        if (media) {
          const buffered = BufferHelper.getBuffered(media);
          const bufferedEnd = buffered.length
            ? buffered.end(buffered.length - 1)
            : 0;
          if (bufferedEnd - flushFrom > 0.01) {
            this.flushMainBuffer(flushFrom, Infinity);
          }
        }
        // Should end of stream complete after the seek below, re-run the
        // seek (see onBufferedToEnd).
        this.hls.once(Events.BUFFERED_TO_END, this.onBufferedToEnd);
        this.hls.trigger(Events.BUFFER_EOS, { type: 'video' });
      }
      if (!this.seekTo(currentOp[0])) {
        this.warn(
          `Could not seek to ${currentOp[0]} after fragment buffered (buffered: ${this.media ? timeRangesToString(BufferHelper.getBuffered(this.media)) : 'none'})`,
        );
      }
    }
    if (nextOp) {
      this.loadMediaAt.apply(this, nextOp);
    }
  }

  private onBufferedToEnd = () => {
    const media = this.media;
    if (media?.seeking) {
      // Re-run the pending seek now that the MediaSource has ended so the
      // decoder treats the gap after the target range as end of stream.
      // eslint-disable-next-line no-self-assign
      media.currentTime = media.currentTime;
    }
  };

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
  // Seeking is always initiated by this controller; ignore media seek events.
  protected onMediaSeeking = () => {};

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
