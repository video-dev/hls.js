import { Events } from '../events';
import { Bufferable, BufferHelper } from '../utils/buffer-helper';
import { findFragmentByPTS } from './fragment-finders';
import { alignMediaPlaylistByPDT } from '../utils/discontinuities';
import { addSliding } from '../utils/level-helper';
import { FragmentState } from './fragment-tracker';
import BaseStreamController, { State } from './base-stream-controller';
import { PlaylistLevelType } from '../types/loader';
import { Level } from '../types/level';
import { subtitleOptionsIdentical } from '../utils/media-option-attributes';
import { ErrorDetails, ErrorTypes } from '../errors';
import type { NetworkComponentAPI } from '../types/component-api';
import type Hls from '../hls';
import type { FragmentTracker } from './fragment-tracker';
import type KeyLoader from '../loader/key-loader';
import type { LevelDetails } from '../loader/level-details';
import type { Fragment } from '../loader/fragment';
import type {
  ErrorData,
  FragLoadedData,
  SubtitleFragProcessed,
  SubtitleTracksUpdatedData,
  TrackLoadedData,
  TrackSwitchedData,
  BufferFlushingData,
  LevelLoadedData,
  FragBufferedData,
} from '../types/events';

const TICK_INTERVAL = 500; // how often to tick in ms

interface TimeRange {
  start: number;
  end: number;
}

export class SubtitleStreamController
  extends BaseStreamController
  implements NetworkComponentAPI
{
  private currentTrackId: number = -1;
  private tracksBuffered: Array<TimeRange[]> = [];
  private mainDetails: LevelDetails | null = null;

  constructor(
    hls: Hls,
    fragmentTracker: FragmentTracker,
    keyLoader: KeyLoader,
  ) {
    super(
      hls,
      fragmentTracker,
      keyLoader,
      '[subtitle-stream-controller]',
      PlaylistLevelType.SUBTITLE,
    );
    this._registerListeners();
  }

  protected onHandlerDestroying() {
    this._unregisterListeners();
    super.onHandlerDestroying();
    this.mainDetails = null;
  }

  private _registerListeners() {
    const { hls } = this;
    hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.on(Events.ERROR, this.onError, this);
    hls.on(Events.SUBTITLE_TRACKS_UPDATED, this.onSubtitleTracksUpdated, this);
    hls.on(Events.SUBTITLE_TRACK_SWITCH, this.onSubtitleTrackSwitch, this);
    hls.on(Events.SUBTITLE_TRACK_LOADED, this.onSubtitleTrackLoaded, this);
    hls.on(Events.SUBTITLE_FRAG_PROCESSED, this.onSubtitleFragProcessed, this);
    hls.on(Events.BUFFER_FLUSHING, this.onBufferFlushing, this);
    hls.on(Events.FRAG_BUFFERED, this.onFragBuffered, this);
  }

  private _unregisterListeners() {
    const { hls } = this;
    hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.off(Events.ERROR, this.onError, this);
    hls.off(Events.SUBTITLE_TRACKS_UPDATED, this.onSubtitleTracksUpdated, this);
    hls.off(Events.SUBTITLE_TRACK_SWITCH, this.onSubtitleTrackSwitch, this);
    hls.off(Events.SUBTITLE_TRACK_LOADED, this.onSubtitleTrackLoaded, this);
    hls.off(Events.SUBTITLE_FRAG_PROCESSED, this.onSubtitleFragProcessed, this);
    hls.off(Events.BUFFER_FLUSHING, this.onBufferFlushing, this);
    hls.off(Events.FRAG_BUFFERED, this.onFragBuffered, this);
  }

  startLoad(startPosition: number) {
    this.stopLoad();
    this.state = State.IDLE;

    this.setInterval(TICK_INTERVAL);

    this.nextLoadPosition =
      this.startPosition =
      this.lastCurrentTime =
        startPosition;

    this.tick();
  }

  onManifestLoading() {
    this.mainDetails = null;
    this.fragmentTracker.removeAllFragments();
  }

  onMediaDetaching(): void {
    this.tracksBuffered = [];
    super.onMediaDetaching();
  }

  onLevelLoaded(event: Events.LEVEL_LOADED, data: LevelLoadedData) {
    this.mainDetails = data.details;
  }

  onSubtitleFragProcessed(
    event: Events.SUBTITLE_FRAG_PROCESSED,
    data: SubtitleFragProcessed,
  ) {
    const { frag, success } = data;
    this.fragPrevious = frag;
    this.state = State.IDLE;
    if (!success) {
      return;
    }

    const buffered = this.tracksBuffered[this.currentTrackId];
    if (!buffered) {
      return;
    }

    // Create/update a buffered array matching the interface used by BufferHelper.bufferedInfo
    // so we can re-use the logic used to detect how much has been buffered
    let timeRange: TimeRange | undefined;
    const fragStart = frag.start;
    for (let i = 0; i < buffered.length; i++) {
      if (fragStart >= buffered[i].start && fragStart <= buffered[i].end) {
        timeRange = buffered[i];
        break;
      }
    }

    const fragEnd = frag.start + frag.duration;
    if (timeRange) {
      timeRange.end = fragEnd;
    } else {
      timeRange = {
        start: fragStart,
        end: fragEnd,
      };
      buffered.push(timeRange);
    }
    this.fragmentTracker.fragBuffered(frag);
    this.fragBufferedComplete(frag, null);
  }

  onBufferFlushing(event: Events.BUFFER_FLUSHING, data: BufferFlushingData) {
    const { startOffset, endOffset } = data;
    if (startOffset === 0 && endOffset !== Number.POSITIVE_INFINITY) {
      const endOffsetSubtitles = endOffset - 1;
      if (endOffsetSubtitles <= 0) {
        return;
      }
      data.endOffsetSubtitles = Math.max(0, endOffsetSubtitles);
      this.tracksBuffered.forEach((buffered) => {
        for (let i = 0; i < buffered.length; ) {
          if (buffered[i].end <= endOffsetSubtitles) {
            buffered.shift();
            continue;
          } else if (buffered[i].start < endOffsetSubtitles) {
            buffered[i].start = endOffsetSubtitles;
          } else {
            break;
          }
          i++;
        }
      });
      this.fragmentTracker.removeFragmentsInRange(
        startOffset,
        endOffsetSubtitles,
        PlaylistLevelType.SUBTITLE,
      );
    }
  }

  onFragBuffered(event: Events.FRAG_BUFFERED, data: FragBufferedData) {
    if (!this.loadedmetadata && data.frag.type === PlaylistLevelType.MAIN) {
      if (this.media?.buffered.length) {
        this.loadedmetadata = true;
      }
    }
  }

  // If something goes wrong, proceed to next frag, if we were processing one.
  onError(event: Events.ERROR, data: ErrorData) {
    const frag = data.frag;

    if (frag?.type === PlaylistLevelType.SUBTITLE) {
      if (this.fragCurrent) {
        this.fragCurrent.abortRequests();
      }
      if (this.state !== State.STOPPED) {
        this.state = State.IDLE;
      }
    }
  }

  // Got all new subtitle levels.
  onSubtitleTracksUpdated(
    event: Events.SUBTITLE_TRACKS_UPDATED,
    { subtitleTracks }: SubtitleTracksUpdatedData,
  ) {
    if (this.levels && subtitleOptionsIdentical(this.levels, subtitleTracks)) {
      this.levels = subtitleTracks.map(
        (mediaPlaylist) => new Level(mediaPlaylist),
      );
      return;
    }
    this.tracksBuffered = [];
    this.levels = subtitleTracks.map((mediaPlaylist) => {
      const level = new Level(mediaPlaylist);
      this.tracksBuffered[level.id] = [];
      return level;
    });
    this.fragmentTracker.removeFragmentsInRange(
      0,
      Number.POSITIVE_INFINITY,
      PlaylistLevelType.SUBTITLE,
    );
    this.fragPrevious = null;
    this.mediaBuffer = null;
  }

  onSubtitleTrackSwitch(
    event: Events.SUBTITLE_TRACK_SWITCH,
    data: TrackSwitchedData,
  ) {
    this.currentTrackId = data.id;

    if (!this.levels?.length || this.currentTrackId === -1) {
      this.clearInterval();
      return;
    }

    // Check if track has the necessary details to load fragments
    const currentTrack = this.levels[this.currentTrackId];
    if (currentTrack?.details) {
      this.mediaBuffer = this.mediaBufferTimeRanges;
    } else {
      this.mediaBuffer = null;
    }
    if (currentTrack) {
      this.setInterval(TICK_INTERVAL);
    }
  }

  // Got a new set of subtitle fragments.
  onSubtitleTrackLoaded(
    event: Events.SUBTITLE_TRACK_LOADED,
    data: TrackLoadedData,
  ) {
    const { currentTrackId, levels } = this;
    const { details: newDetails, id: trackId } = data;
    if (!levels) {
      this.warn(`Subtitle tracks were reset while loading level ${trackId}`);
      return;
    }
    const track: Level = levels[currentTrackId];
    if (trackId >= levels.length || trackId !== currentTrackId || !track) {
      return;
    }
    this.log(
      `Subtitle track ${trackId} loaded [${newDetails.startSN},${
        newDetails.endSN
      }]${
        newDetails.lastPartSn
          ? `[part-${newDetails.lastPartSn}-${newDetails.lastPartIndex}]`
          : ''
      },duration:${newDetails.totalduration}`,
    );
    this.mediaBuffer = this.mediaBufferTimeRanges;
    let sliding = 0;
    if (newDetails.live || track.details?.live) {
      const mainDetails = this.mainDetails;
      if (newDetails.deltaUpdateFailed || !mainDetails) {
        return;
      }
      const mainSlidingStartFragment = mainDetails.fragments[0];
      if (!track.details) {
        if (newDetails.hasProgramDateTime && mainDetails.hasProgramDateTime) {
          alignMediaPlaylistByPDT(newDetails, mainDetails);
          sliding = newDetails.fragments[0].start;
        } else if (mainSlidingStartFragment) {
          // line up live playlist with main so that fragments in range are loaded
          sliding = mainSlidingStartFragment.start;
          addSliding(newDetails, sliding);
        }
      } else {
        sliding = this.alignPlaylists(
          newDetails,
          track.details,
          this.levelLastLoaded?.details,
        );
        if (sliding === 0 && mainSlidingStartFragment) {
          // realign with main when there is no overlap with last refresh
          sliding = mainSlidingStartFragment.start;
          addSliding(newDetails, sliding);
        }
      }
    }
    track.details = newDetails;
    this.levelLastLoaded = track;

    if (!this.startFragRequested && (this.mainDetails || !newDetails.live)) {
      this.setStartPosition(this.mainDetails || newDetails, sliding);
    }

    // trigger handler right now
    this.tick();

    // If playlist is misaligned because of bad PDT or drift, delete details to resync with main on reload
    if (
      newDetails.live &&
      !this.fragCurrent &&
      this.media &&
      this.state === State.IDLE
    ) {
      const foundFrag = findFragmentByPTS(
        null,
        newDetails.fragments,
        this.media.currentTime,
        0,
      );
      if (!foundFrag) {
        this.warn('Subtitle playlist not aligned with playback');
        track.details = undefined;
      }
    }
  }

  _handleFragmentLoadComplete(fragLoadedData: FragLoadedData) {
    const { frag, payload } = fragLoadedData;
    const decryptData = frag.decryptdata;
    const hls = this.hls;

    if (this.fragContextChanged(frag)) {
      return;
    }
    // check to see if the payload needs to be decrypted
    if (
      payload &&
      payload.byteLength > 0 &&
      decryptData?.key &&
      decryptData.iv &&
      decryptData.method === 'AES-128'
    ) {
      const startTime = performance.now();
      // decrypt the subtitles
      this.decrypter
        .decrypt(
          new Uint8Array(payload),
          decryptData.key.buffer,
          decryptData.iv.buffer,
        )
        .catch((err) => {
          hls.trigger(Events.ERROR, {
            type: ErrorTypes.MEDIA_ERROR,
            details: ErrorDetails.FRAG_DECRYPT_ERROR,
            fatal: false,
            error: err,
            reason: err.message,
            frag,
          });
          throw err;
        })
        .then((decryptedData) => {
          const endTime = performance.now();
          hls.trigger(Events.FRAG_DECRYPTED, {
            frag,
            payload: decryptedData,
            stats: {
              tstart: startTime,
              tdecrypt: endTime,
            },
          });
        })
        .catch((err) => {
          this.warn(`${err.name}: ${err.message}`);
          this.state = State.IDLE;
        });
    }
  }

  doTick() {
    if (!this.media) {
      this.state = State.IDLE;
      return;
    }

    if (this.state === State.IDLE) {
      const { currentTrackId, levels } = this;
      const track = levels?.[currentTrackId];
      if (!track || !levels.length || !track.details) {
        return;
      }
      const { config } = this;
      const currentTime = this.getLoadPosition();
      const bufferedInfo = BufferHelper.bufferedInfo(
        this.tracksBuffered[this.currentTrackId] || [],
        currentTime,
        config.maxBufferHole,
      );
      const { end: targetBufferTime, len: bufferLen } = bufferedInfo;

      const mainBufferInfo = this.getFwdBufferInfo(
        this.media,
        PlaylistLevelType.MAIN,
      );
      const trackDetails = track.details as LevelDetails;
      const maxBufLen =
        this.getMaxBufferLength(mainBufferInfo?.len) +
        trackDetails.levelTargetDuration;

      if (bufferLen > maxBufLen) {
        return;
      }
      const fragments = trackDetails.fragments;
      const fragLen = fragments.length;
      const end = trackDetails.edge;

      let foundFrag: Fragment | null = null;
      const fragPrevious = this.fragPrevious;
      if (targetBufferTime < end) {
        const tolerance = config.maxFragLookUpTolerance;
        const lookupTolerance =
          targetBufferTime > end - tolerance ? 0 : tolerance;
        foundFrag = findFragmentByPTS(
          fragPrevious,
          fragments,
          Math.max(fragments[0].start, targetBufferTime),
          lookupTolerance,
        );
        if (
          !foundFrag &&
          fragPrevious &&
          fragPrevious.start < fragments[0].start
        ) {
          foundFrag = fragments[0];
        }
      } else {
        foundFrag = fragments[fragLen - 1];
      }
      if (!foundFrag) {
        return;
      }
      foundFrag = this.mapToInitFragWhenRequired(foundFrag) as Fragment;
      if (foundFrag.sn !== 'initSegment') {
        // Load earlier fragment in same discontinuity to make up for misaligned playlists and cues that extend beyond end of segment
        const curSNIdx = foundFrag.sn - trackDetails.startSN;
        const prevFrag = fragments[curSNIdx - 1];
        if (
          prevFrag &&
          prevFrag.cc === foundFrag.cc &&
          this.fragmentTracker.getState(prevFrag) === FragmentState.NOT_LOADED
        ) {
          foundFrag = prevFrag;
        }
      }
      if (
        this.fragmentTracker.getState(foundFrag) === FragmentState.NOT_LOADED
      ) {
        // only load if fragment is not loaded
        this.loadFragment(foundFrag, track, targetBufferTime);
      }
    }
  }

  protected getMaxBufferLength(mainBufferLength?: number): number {
    const maxConfigBuffer = super.getMaxBufferLength();
    if (!mainBufferLength) {
      return maxConfigBuffer;
    }
    return Math.max(maxConfigBuffer, mainBufferLength);
  }

  protected loadFragment(
    frag: Fragment,
    level: Level,
    targetBufferTime: number,
  ) {
    this.fragCurrent = frag;
    if (frag.sn === 'initSegment') {
      this._loadInitSegment(frag, level);
    } else {
      this.startFragRequested = true;
      super.loadFragment(frag, level, targetBufferTime);
    }
  }

  get mediaBufferTimeRanges(): Bufferable {
    return new BufferableInstance(
      this.tracksBuffered[this.currentTrackId] || [],
    );
  }
}

class BufferableInstance implements Bufferable {
  public readonly buffered: TimeRanges;

  constructor(timeranges: TimeRange[]) {
    const getRange = (
      name: 'start' | 'end',
      index: number,
      length: number,
    ): number => {
      index = index >>> 0;
      if (index > length - 1) {
        throw new DOMException(
          `Failed to execute '${name}' on 'TimeRanges': The index provided (${index}) is greater than the maximum bound (${length})`,
        );
      }
      return timeranges[index][name];
    };
    this.buffered = {
      get length() {
        return timeranges.length;
      },
      end(index: number): number {
        return getRange('end', index, timeranges.length);
      },
      start(index: number): number {
        return getRange('start', index, timeranges.length);
      },
    };
  }
}
