import { Events } from '../events';
import { logger } from '../utils/logger';
import { BufferHelper } from '../utils/buffer-helper';
import { findFragmentByPDT, findFragmentByPTS } from './fragment-finders';
import type { FragmentTracker } from './fragment-tracker';
import { FragmentState } from './fragment-tracker';
import BaseStreamController, { State } from './base-stream-controller';
import FragmentLoader from '../loader/fragment-loader';
import { PlaylistLevelType } from '../types/loader';
import { Level } from '../types/level';
import type { NetworkComponentAPI } from '../types/component-api';
import type Hls from '../hls';
import type LevelDetails from '../loader/level-details';
import type Fragment from '../loader/fragment';
import type {
  ErrorData,
  FragLoadedData,
  MediaAttachedData,
  SubtitleFragProcessed,
  SubtitleTracksUpdatedData,
  TrackLoadedData,
  TrackSwitchedData,
} from '../types/events';

const TICK_INTERVAL = 500; // how often to tick in ms

interface TimeRange {
  start: number;
  end: number;
}

export class SubtitleStreamController
  extends BaseStreamController
  implements NetworkComponentAPI {
  protected levels: Array<Level> = [];

  private currentTrackId: number = -1;
  private tracksBuffered: Array<TimeRange[]>;

  constructor(hls: Hls, fragmentTracker: FragmentTracker) {
    super(hls, fragmentTracker, '[subtitle-stream-controller]');
    this.config = hls.config;
    this.fragCurrent = null;
    this.fragPrevious = null;
    this.media = null;
    this.mediaBuffer = null;
    this.state = State.STOPPED;
    this.tracksBuffered = [];
    this.fragmentLoader = new FragmentLoader(hls.config);

    this._registerListeners();
  }

  private _registerListeners() {
    const { hls } = this;
    hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.on(Events.ERROR, this.onError, this);
    hls.on(Events.SUBTITLE_TRACKS_UPDATED, this.onSubtitleTracksUpdated, this);
    hls.on(Events.SUBTITLE_TRACK_SWITCH, this.onSubtitleTrackSwitch, this);
    hls.on(Events.SUBTITLE_TRACK_LOADED, this.onSubtitleTrackLoaded, this);
    hls.on(Events.SUBTITLE_FRAG_PROCESSED, this.onSubtitleFragProcessed, this);
  }

  private _unregisterListeners() {
    const { hls } = this;
    hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.off(Events.ERROR, this.onError, this);
    hls.off(Events.SUBTITLE_TRACKS_UPDATED, this.onSubtitleTracksUpdated, this);
    hls.off(Events.SUBTITLE_TRACK_SWITCH, this.onSubtitleTrackSwitch, this);
    hls.off(Events.SUBTITLE_TRACK_LOADED, this.onSubtitleTrackLoaded, this);
    hls.off(Events.SUBTITLE_FRAG_PROCESSED, this.onSubtitleFragProcessed, this);
  }

  startLoad() {
    this.stopLoad();
    this.state = State.IDLE;

    // Check if we already have a track with necessary details to load fragments
    const currentTrack = this.levels[this.currentTrackId];
    if (currentTrack?.details) {
      this.setInterval(TICK_INTERVAL);
      this.tick();
    }
  }

  onHandlerDestroyed() {
    this.state = State.STOPPED;
    this._unregisterListeners();
    super.onHandlerDestroyed();
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
    // so we can re-use the logic used to detect how much have been buffered
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
  }

  onMediaAttached(event: Events.MEDIA_ATTACHED, { media }: MediaAttachedData) {
    this.media = media;
    this.state = State.IDLE;
  }

  onMediaDetaching() {
    if (!this.media) {
      return;
    }
    this.fragmentTracker.removeAllFragments();
    this.fragPrevious = null;
    this.currentTrackId = -1;
    this.levels.forEach((level: Level) => {
      this.tracksBuffered[level.id] = [];
    });
    this.media = null;
    this.mediaBuffer = null;
    this.state = State.STOPPED;
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
      this.setInterval(TICK_INTERVAL);
    } else {
      this.mediaBuffer = null;
    }
  }

  // Got a new set of subtitle fragments.
  onSubtitleTrackLoaded(
    event: Events.SUBTITLE_TRACK_LOADED,
    data: TrackLoadedData
  ) {
    const { id, details } = data;
    const { currentTrackId, levels } = this;
    if (!levels.length || !details) {
      return;
    }
    const currentTrack: Level = levels[currentTrackId];
    if (id >= levels.length || id !== currentTrackId || !currentTrack) {
      return;
    }
    this.mediaBuffer = this.mediaBufferTimeRanges;
    if (details.live || currentTrack.details?.live) {
      if (details.deltaUpdateFailed) {
        return;
      }
      // TODO: Subtitle Fragments should be assigned startPTS and endPTS once VTT/TTML is parsed
      //  otherwise this depends on DISCONTINUITY or PROGRAM-DATE-TIME tags to align playlists
      this.alignPlaylists(details, currentTrack.details);
    }
    currentTrack.details = details;
    this.levelLastLoaded = id;
    this.setInterval(TICK_INTERVAL);
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
      const { config, currentTrackId, fragmentTracker, media, levels } = this;
      if (
        !levels.length ||
        !levels[currentTrackId] ||
        !levels[currentTrackId].details
      ) {
        return;
      }

      const { maxBufferHole, maxFragLookUpTolerance } = config;
      const maxConfigBuffer = Math.min(
        config.maxBufferLength,
        config.maxMaxBufferLength
      );
      const bufferedInfo = BufferHelper.bufferedInfo(
        this.mediaBufferTimeRanges,
        media.currentTime,
        maxBufferHole
      );
      const { end: targetBufferTime, len: bufferLen } = bufferedInfo;

      if (bufferLen > maxConfigBuffer) {
        return;
      }

      const trackDetails = levels[currentTrackId].details as LevelDetails;
      console.assert(
        trackDetails,
        'Subtitle track details are defined on idle subtitle stream controller tick'
      );
      const fragments = trackDetails.fragments;
      const fragLen = fragments.length;
      const end =
        fragments[fragLen - 1].start + fragments[fragLen - 1].duration;

      let foundFrag;
      const fragPrevious = this.fragPrevious;
      if (targetBufferTime < end) {
        if (fragPrevious && trackDetails.hasProgramDateTime) {
          foundFrag = findFragmentByPDT(
            fragments,
            fragPrevious.endProgramDateTime,
            maxFragLookUpTolerance
          );
        }
        if (!foundFrag) {
          foundFrag = findFragmentByPTS(
            fragPrevious,
            fragments,
            targetBufferTime,
            maxFragLookUpTolerance
          );
        }
      } else {
        foundFrag = fragments[fragLen - 1];
      }

      if (foundFrag?.encrypted) {
        logger.log(`Loading key for ${foundFrag.sn}`);
        this.state = State.KEY_LOADING;
        this.hls.trigger(Events.KEY_LOADING, { frag: foundFrag });
      } else if (
        foundFrag &&
        fragmentTracker.getState(foundFrag) === FragmentState.NOT_LOADED
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

  stopLoad() {
    this.fragPrevious = null;
    super.stopLoad();
  }

  get mediaBufferTimeRanges() {
    return this.tracksBuffered[this.currentTrackId] || [];
  }
}
