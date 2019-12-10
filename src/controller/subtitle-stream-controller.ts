/**
 * @class SubtitleStreamController
 */

import Event from '../events';
import { logger } from '../utils/logger';
import Decrypter from '../crypt/decrypter';
import { BufferHelper } from '../utils/buffer-helper';
import { findFragmentByPDT, findFragmentByPTS } from './fragment-finders';
import { FragmentState } from './fragment-tracker';
import BaseStreamController, { State } from './base-stream-controller';
import FragmentLoader from '../loader/fragment-loader';
import { mergeSubtitlePlaylists } from './level-helper';
import {
  ErrorData,
  LevelUpdatedData,
  MediaAttachedData,
  SubtitleFragProcessed,
  SubtitleTracksUpdated,
  TrackLoadedData,
  TrackSwitchedData
} from '../types/events';
import { Level } from '../types/level';
import Fragment from '../loader/fragment';
import LevelDetails from '../loader/level-details';

const { performance } = self;

const TICK_INTERVAL = 500; // how often to tick in ms

interface TimeRange {
  start: number,
  end: number
}

export class SubtitleStreamController extends BaseStreamController {
  protected levels: Array<Level> = [];
  private currentTrackId: number = -1;
  private decrypter: Decrypter;
  private tracksBuffered: Array<TimeRange[]>;
  // lastAVStart stores the time in seconds for the start time of a level load
  private lastAVStart: number = 0;
  private readonly _onMediaSeeking: () => void;

  constructor (hls, fragmentTracker) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.MEDIA_DETACHING,
      Event.ERROR,
      Event.KEY_LOADED,
      Event.SUBTITLE_TRACKS_UPDATED,
      Event.SUBTITLE_TRACK_SWITCH,
      Event.SUBTITLE_TRACK_LOADED,
      Event.SUBTITLE_FRAG_PROCESSED,
      Event.LEVEL_UPDATED);

    this.config = hls.config;
    this.decrypter = new Decrypter(hls, hls.config);
    this.fragCurrent = null;
    this.fragmentTracker = fragmentTracker;
    this.fragPrevious = null;
    this.media = null;
    this.state = State.STOPPED;
    this.tracksBuffered = [];
    this.fragmentLoader = new FragmentLoader(hls.config);
    this._onMediaSeeking = this.onMediaSeeking.bind(this);
  }

  onHandlerDestroyed () {
    delete this.fragmentTracker;
    this.state = State.STOPPED;
    super.onHandlerDestroyed();
  }

  onSubtitleFragProcessed (data: SubtitleFragProcessed) {
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
        end: fragEnd
      };
      buffered.push(timeRange);
    }
  }

  onMediaAttached ({ media }: MediaAttachedData) {
    this.media = media;
    media.addEventListener('seeking', this._onMediaSeeking);
    this.state = State.IDLE;
  }

  onMediaDetaching () {
    if (!this.media) {
      return;
    }
    this.media.removeEventListener('seeking', this._onMediaSeeking);
    this.fragmentTracker.removeAllFragments();
    this.currentTrackId = -1;
    this.levels.forEach((level: Level) => {
      this.tracksBuffered[level.id] = [];
    });
    this.media = null;
    this.state = State.STOPPED;
  }

  // If something goes wrong, proceed to next frag, if we were processing one.
  onError (data: ErrorData) {
    const frag = data.frag;
    // don't handle error not related to subtitle fragment
    if (!frag || frag.type !== 'subtitle') {
      return;
    }
    this.state = State.IDLE;
  }

  // Got all new subtitle levels.
  onSubtitleTracksUpdated ({ subtitleTracks }: SubtitleTracksUpdated) {
    logger.log('subtitle levels updated');
    this.tracksBuffered = [];
    this.levels = subtitleTracks.map(mediaPlaylist => new Level(mediaPlaylist));
    this.levels.forEach((level: Level) => {
      this.tracksBuffered[level.id] = [];
    });
  }

  onSubtitleTrackSwitch (data: TrackSwitchedData) {
    this.currentTrackId = data.id;

    if (!this.levels.length || this.currentTrackId === -1) {
      this.clearInterval();
      return;
    }

    // Check if track has the necessary details to load fragments
    const currentTrack = this.levels[this.currentTrackId];
    if (currentTrack && currentTrack.details) {
      this.setInterval(TICK_INTERVAL);
    }
  }

  // Got a new set of subtitle fragments.
  onSubtitleTrackLoaded (data: TrackLoadedData) {
    const { id, details } = data;
    const { currentTrackId, levels } = this;
    if (!levels.length || !details) {
      return;
    }
    const currentTrack: Level = levels[currentTrackId];
    if (id >= levels.length || id !== currentTrackId || !currentTrack) {
      return;
    }

    if (details.live && currentTrack.details) {
      mergeSubtitlePlaylists(currentTrack.details, details, this.lastAVStart);
    }
    currentTrack.details = details;
    this.setInterval(TICK_INTERVAL);
  }

  onKeyLoaded () {
    if (this.state === State.KEY_LOADING) {
      this.state = State.IDLE;
    }
  }

  _handleFragmentLoadComplete (frag: Fragment, payload: ArrayBuffer | Uint8Array) {
    const decryptData = frag.decryptdata;
    const hls = this.hls;

    if (this._fragLoadAborted(frag)) {
      return;
    }
    // check to see if the payload needs to be decrypted
    if (payload && payload.byteLength > 0 && decryptData && decryptData.key && decryptData.iv && decryptData.method === 'AES-128') {
      const startTime = performance.now();
      // decrypt the subtitles
      this.decrypter.webCryptoDecrypt(new Uint8Array(payload), decryptData.key.buffer, decryptData.iv.buffer).then((decryptedData) => {
        const endTime = performance.now();
        hls.trigger(Event.FRAG_DECRYPTED, {
          frag,
          payload: decryptedData,
          stats: {
            tstart: startTime,
            tdecrypt: endTime
          }
        });
      });
    }
  }

  onLevelUpdated ({ details }: LevelUpdatedData) {
    const frags = details.fragments;
    this.lastAVStart = frags.length ? frags[0].start : 0;
  }

  doTick () {
    if (!this.media) {
      this.state = State.IDLE;
      return;
    }

    if (this.state === State.IDLE) {
      const { config, currentTrackId, fragmentTracker, media, levels } = this;
      if (!levels.length || !levels[currentTrackId] || !levels[currentTrackId].details) {
        return;
      }

      const { maxBufferHole, maxFragLookUpTolerance } = config;
      const maxConfigBuffer = Math.min(config.maxBufferLength, config.maxMaxBufferLength);
      const bufferedInfo = BufferHelper.bufferedInfo(this._getBuffered(), media.currentTime, maxBufferHole);
      const { end: bufferEnd, len: bufferLen } = bufferedInfo;

      if (bufferLen > maxConfigBuffer) {
        return;
      }

      const trackDetails = levels[currentTrackId].details as LevelDetails;
      console.assert(trackDetails, 'Subtitle track details are defined on idle subtitle stream controller tick');
      const fragments = trackDetails.fragments;
      const fragLen = fragments.length;
      const end = fragments[fragLen - 1].start + fragments[fragLen - 1].duration;

      let foundFrag;
      const fragPrevious = this.fragPrevious;
      if (bufferEnd < end) {
        if (fragPrevious && trackDetails.hasProgramDateTime) {
          foundFrag = findFragmentByPDT(fragments, fragPrevious.endProgramDateTime, maxFragLookUpTolerance);
        }
        if (!foundFrag) {
          foundFrag = findFragmentByPTS(fragPrevious, fragments, bufferEnd, maxFragLookUpTolerance);
        }
      } else {
        foundFrag = fragments[fragLen - 1];
      }

      if (foundFrag && foundFrag.encrypted) {
        logger.log(`Loading key for ${foundFrag.sn}`);
        this.state = State.KEY_LOADING;
        this.hls.trigger(Event.KEY_LOADING, { frag: foundFrag });
      } else if (foundFrag && fragmentTracker.getState(foundFrag) === FragmentState.NOT_LOADED) {
        // only load if fragment is not loaded
        this.fragCurrent = foundFrag;
        this._loadFragForPlayback(foundFrag);
      }
    }
  }

  stopLoad () {
    this.lastAVStart = 0;
    super.stopLoad();
  }

  _getBuffered () {
    return this.tracksBuffered[this.currentTrackId] || [];
  }

  onMediaSeeking () {
    this.fragPrevious = null;
  }
}
