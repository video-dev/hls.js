import { Events } from '../events';
import { BufferHelper } from '../utils/buffer-helper';
import { findFragmentByPTS } from './fragment-finders';
import { alignMediaPlaylistByPDT } from '../utils/discontinuities';
import { addSliding } from './level-helper';
import { FragmentState } from './fragment-tracker';
import BaseStreamController, { State } from './base-stream-controller';
import { PlaylistLevelType } from '../types/loader';
import { Level } from '../types/level';
import type { FragmentTracker } from './fragment-tracker';
import type { NetworkComponentAPI } from '../types/component-api';
import type Hls from '../hls';
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
  protected levels: Array<Level> = [];

  private currentTrackId: number = -1;
  private tracksBuffered: Array<TimeRange[]> = [];
  private mainDetails: LevelDetails | null = null;

  constructor(hls: Hls, fragmentTracker: FragmentTracker) {
    super(hls, fragmentTracker, '[subtitle-stream-controller]');
    this._registerListeners();
  }

  protected onHandlerDestroying() {
    this._unregisterListeners();
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
  }

  startLoad() {
    this.stopLoad();
    this.state = State.IDLE;

    this.setInterval(TICK_INTERVAL);
    this.tick();
  }

  onManifestLoading() {
    this.mainDetails = null;
    this.fragmentTracker.removeAllFragments();
  }

  onLevelLoaded(event: Events.LEVEL_LOADED, data: LevelLoadedData) {
    this.mainDetails = data.details;
  }

  onSubtitleFragProcessed(
    event: Events.SUBTITLE_FRAG_PROCESSED,
    data: SubtitleFragProcessed
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
  }

  onBufferFlushing(event: Events.BUFFER_FLUSHING, data: BufferFlushingData) {
    const { startOffset, endOffset } = data;
    if (startOffset === 0 && endOffset !== Number.POSITIVE_INFINITY) {
      const { currentTrackId, levels } = this;
      if (
        !levels.length ||
        !levels[currentTrackId] ||
        !levels[currentTrackId].details
      ) {
        return;
      }
      const trackDetails = levels[currentTrackId].details as LevelDetails;
      const targetDuration = trackDetails.targetduration;
      const endOffsetSubtitles = endOffset - targetDuration;
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
        PlaylistLevelType.SUBTITLE
      );
    }
  }

  // If something goes wrong, proceed to next frag, if we were processing one.
  onError(event: Events.ERROR, data: ErrorData) {
    const frag = data.frag;
    // don't handle error not related to subtitle fragment
    if (!frag || frag.type !== PlaylistLevelType.SUBTITLE) {
      return;
    }

    if (this.fragCurrent?.loader) {
      this.fragCurrent.loader.abort();
    }

    this.state = State.IDLE;
  }

  // Got all new subtitle levels.
  onSubtitleTracksUpdated(
    event: Events.SUBTITLE_TRACKS_UPDATED,
    { subtitleTracks }: SubtitleTracksUpdatedData
  ) {
    this.tracksBuffered = [];
    this.levels = subtitleTracks.map(
      (mediaPlaylist) => new Level(mediaPlaylist)
    );
    this.fragmentTracker.removeAllFragments();
    this.fragPrevious = null;
    this.levels.forEach((level: Level) => {
      this.tracksBuffered[level.id] = [];
    });
    this.mediaBuffer = null;
  }

  onSubtitleTrackSwitch(
    event: Events.SUBTITLE_TRACK_SWITCH,
    data: TrackSwitchedData
  ) {
    this.currentTrackId = data.id;

    if (!this.levels.length || this.currentTrackId === -1) {
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
    data: TrackLoadedData
  ) {
    const { details: newDetails, id: trackId } = data;
    const { currentTrackId, levels } = this;
    if (!levels.length) {
      return;
    }
    const track: Level = levels[currentTrackId];
    if (trackId >= levels.length || trackId !== currentTrackId || !track) {
      return;
    }
    this.mediaBuffer = this.mediaBufferTimeRanges;
    if (newDetails.live || track.details?.live) {
      const mainDetails = this.mainDetails;
      if (newDetails.deltaUpdateFailed || !mainDetails) {
        return;
      }
      const mainSlidingStartFragment = mainDetails.fragments[0];
      if (!track.details) {
        if (newDetails.hasProgramDateTime && mainDetails.hasProgramDateTime) {
          alignMediaPlaylistByPDT(newDetails, mainDetails);
        } else if (mainSlidingStartFragment) {
          // line up live playlist with main so that fragments in range are loaded
          addSliding(newDetails, mainSlidingStartFragment.start);
        }
      } else {
        const sliding = this.alignPlaylists(newDetails, track.details);
        if (sliding === 0 && mainSlidingStartFragment) {
          // realign with main when there is no overlap with last refresh
          addSliding(newDetails, mainSlidingStartFragment.start);
        }
      }
    }
    track.details = newDetails;
    this.levelLastLoaded = trackId;

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
        0
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
      decryptData &&
      decryptData.key &&
      decryptData.iv &&
      decryptData.method === 'AES-128'
    ) {
      const startTime = performance.now();
      // decrypt the subtitles
      this.decrypter
        .webCryptoDecrypt(
          new Uint8Array(payload),
          decryptData.key.buffer,
          decryptData.iv.buffer
        )
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
      if (
        !levels.length ||
        !levels[currentTrackId] ||
        !levels[currentTrackId].details
      ) {
        return;
      }

      // Expand range of subs loaded by one target-duration in either direction to make up for misaligned playlists
      const trackDetails = levels[currentTrackId].details as LevelDetails;
      const targetDuration = trackDetails.targetduration;
      const { config, media } = this;
      const bufferedInfo = BufferHelper.bufferedInfo(
        this.mediaBufferTimeRanges,
        media.currentTime - targetDuration,
        config.maxBufferHole
      );
      const { end: targetBufferTime, len: bufferLen } = bufferedInfo;

      const maxBufLen = this.getMaxBufferLength() + targetDuration;

      if (bufferLen > maxBufLen) {
        return;
      }

      console.assert(
        trackDetails,
        'Subtitle track details are defined on idle subtitle stream controller tick'
      );
      const fragments = trackDetails.fragments;
      const fragLen = fragments.length;
      const end = trackDetails.edge;

      let foundFrag;
      const fragPrevious = this.fragPrevious;
      if (targetBufferTime < end) {
        const { maxFragLookUpTolerance } = config;
        foundFrag = findFragmentByPTS(
          fragPrevious,
          fragments,
          Math.max(
            fragments[0].start,
            targetBufferTime
          ),
          maxFragLookUpTolerance
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

      if (foundFrag?.encrypted) {
        this.loadKey(foundFrag, trackDetails);
      } else if (
        foundFrag &&
        this.fragmentTracker.getState(foundFrag) === FragmentState.NOT_LOADED
      ) {
        // only load if fragment is not loaded
        this.loadFragment(foundFrag, trackDetails, targetBufferTime);
      }
    }
  }

  protected loadFragment(
    frag: Fragment,
    levelDetails: LevelDetails,
    targetBufferTime: number
  ) {
    this.fragCurrent = frag;
    super.loadFragment(frag, levelDetails, targetBufferTime);
  }

  get mediaBufferTimeRanges(): TimeRange[] {
    return this.tracksBuffered[this.currentTrackId] || [];
  }
}
