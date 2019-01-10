/**
 * @class SubtitleStreamController
 */

import Event from '../events';
import * as LevelHelper from './level-helper';
import { logger } from '../utils/logger';
import Decrypter from '../crypt/decrypter';
import TaskLoop from '../task-loop';
import { BufferHelper } from '../utils/buffer-helper';
import { findFragmentByPTS, findFragmentByPDT } from './fragment-finders';
import BinarySearch from '../utils/binary-search';
import { FragmentState } from './fragment-tracker';

const { performance } = window;

export const SubtitleStreamControllerState = {
  STOPPED: 'STOPPED',
  IDLE: 'IDLE',
  KEY_LOADING: 'KEY_LOADING',
  FRAG_LOADING: 'FRAG_LOADING'
};

const State = SubtitleStreamControllerState;

const TICK_INTERVAL = 500; // how often to tick in ms

export class SubtitleStreamController extends TaskLoop {
  constructor (hls, fragmentTracker) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.MEDIA_DETACHING,
      Event.ERROR,
      Event.KEY_LOADED,
      Event.FRAG_LOADED,
      Event.SUBTITLE_TRACKS_UPDATED,
      Event.SUBTITLE_TRACK_SWITCH,
      Event.SUBTITLE_TRACK_LOADED,
      Event.SUBTITLE_FRAG_PROCESSED);

    this.fragmentTracker = fragmentTracker;
    this.config = hls.config;
    this.state = State.STOPPED;
    this.tracks = [];
    this.tracksBuffered = [];
    this.currentTrackId = -1;
    this.decrypter = new Decrypter(hls, hls.config);
  }

  onHandlerDestroyed () {
    this.fragmentTracker = null;
    this.state = State.STOPPED;
    super.onHandlerDestroyed();
  }

  onSubtitleFragProcessed (data) {
    this.state = State.IDLE;

    if (!data.success) {
      return;
    }

    const buffered = this.tracksBuffered[this.currentTrackId];
    const frag = data.frag;

    this.fragPrevious = frag;

    if (!buffered) {
      return;
    }

    // Create/update a buffered array matching the interface used by BufferHelper.bufferedInfo
    // so we can re-use the logic used to detect how much have been buffered
    // FIXME: put this in a utility function or proper object for time-ranges manipulation?
    let timeRange;
    for (let i = 0; i < buffered.length; i++) {
      if (frag.start >= buffered[i].start && frag.start <= buffered[i].end) {
        timeRange = buffered[i];
        break;
      }
    }

    if (timeRange) {
      timeRange.end = frag.end || frag.start + frag.duration;
    } else {
      buffered.push({
        start: frag.start,
        end: frag.end || frag.start + frag.duration
      });
    }

    if (frag.startPTS) {
      logger.warn(`subtitle playlist adjust start by cue PTS [${frag.startPTS}, ${frag.endPTS}] of fragment ${frag.sn}`);
      let trackDetails = this.tracks[this.currentTrackId].details;
      LevelHelper.updateFragPTSDTS(trackDetails, frag, frag.startPTS, frag.endPTS, frag.startDTS, frag.endDTS);
    }
  }

  onMediaAttached (data) {
    this.media = data.media;
    this.state = State.IDLE;
  }

  onMediaDetaching () {
    this.media = null;
    this.state = State.STOPPED;
  }

  // If something goes wrong, procede to next frag, if we were processing one.
  onError (data) {
    let frag = data.frag;
    // don't handle error not related to subtitle fragment
    if (!frag || frag.type !== 'subtitle') {
      return;
    }
    this.state = State.IDLE;
  }

  // Got all new subtitle tracks.
  onSubtitleTracksUpdated (data) {
    logger.log('subtitle tracks updated');
    this.tracksBuffered = [];
    this.tracks = data.subtitleTracks;
    this.tracks.forEach((track) => {
      this.tracksBuffered[track.id] = [];
    });
  }

  onSubtitleTrackSwitch (data) {
    this.currentTrackId = data.id;
    if (!this.tracks || this.currentTrackId === -1) {
      this.clearInterval();
      return;
    }

    // Check if track has the necessary details to load fragments
    const currentTrack = this.tracks[this.currentTrackId];
    if (currentTrack && currentTrack.details) {
      this.setInterval(TICK_INTERVAL);
    }
  }

  // Got a new set of subtitle fragments.
  onSubtitleTrackLoaded (data) {
    const id = data.id;
    const newDetails = data.details;

    if (!this.tracks) {
      logger.warn('Can not update subtitle details, no tracks found');
      return;
    }

    if (this.tracks[id]) {
      logger.log('Updating subtitle track details');
      if (newDetails.live) { // update live playlist
        let curDetails = this.tracks[id].details;
        if (curDetails && newDetails.fragments.length > 0) {
          LevelHelper.mergeDetails(curDetails, newDetails); // re-load playlist, merge previous playlist
          if (!(newDetails.PTSKnown === false)) {
            let sliding = newDetails.fragments[0].start;
            logger.log(`live subtitle playlist sliding:${sliding.toFixed(3)}`);
          } else {
            logger.warn('live subtitle playlist - outdated PTS, unknown sliding');
          }
        }
      }
      this.tracks[id].details = newDetails;
    }

    this.setInterval(TICK_INTERVAL);
  }

  onKeyLoaded () {
    if (this.state === State.KEY_LOADING) {
      this.state = State.IDLE;
    }
  }

  onFragLoaded (data) {
    const fragCurrent = this.fragCurrent;
    const decryptData = data.frag.decryptdata;
    const fragLoaded = data.frag;
    const hls = this.hls;

    if (this.state === State.FRAG_LOADING &&
        fragCurrent &&
        data.frag.type === 'subtitle' &&
        fragCurrent.sn === data.frag.sn) {
      // check to see if the payload needs to be decrypted
      if (data.payload.byteLength > 0 && (decryptData && decryptData.key && decryptData.method === 'AES-128')) {
        let startTime = performance.now();

        // decrypt the subtitles
        this.decrypter.decrypt(data.payload, decryptData.key.buffer, decryptData.iv.buffer, function (decryptedData) {
          let endTime = performance.now();

          hls.trigger(Event.FRAG_DECRYPTED, { frag: fragLoaded, payload: decryptedData, stats: { tstart: startTime, tdecrypt: endTime } });
        });
      }
    }
  }

  doTick () {
    if (!this.media) {
      this.state = State.IDLE;
      return;
    }

    switch (this.state) {
    case State.IDLE:
      const tracks = this.tracks;
      const trackId = this.currentTrackId;

      if (!tracks || !tracks[trackId] || !tracks[trackId].details) {
        break;
      }

      const trackDetails = tracks[trackId].details;

      const config = this.config;
      const maxBufferHole = config.maxBufferHole;
      const maxConfigBuffer = Math.min(config.maxBufferLength, config.maxMaxBufferLength);
      // if PTSKnown, start is defined by cues range, increase lookup tolerance by averagetargetduration
      const maxFragLookUpTolerance = trackDetails.PTSKnown ? config.maxFragLookUpTolerance + trackDetails.averagetargetduration : config.maxFragLookUpTolerance;

      const bufferedInfo = BufferHelper.bufferedInfo(this._getBuffered(), this.media.currentTime, maxBufferHole);
      const bufferEnd = bufferedInfo.end;
      const bufferLen = bufferedInfo.len;

      const fragments = trackDetails.fragments;
      const fragLen = fragments.length;
      const end = fragments[fragLen - 1].start + fragments[fragLen - 1].duration;

      let foundFrag;
      if (bufferLen < maxConfigBuffer && bufferEnd < end) {
        foundFrag = findFragmentByPTS(this.fragPrevious, fragments, bufferEnd, maxFragLookUpTolerance);
      } else if (trackDetails.hasProgramDateTime && this.fragPrevious) {
        foundFrag = findFragmentByPDT(fragments, this.fragPrevious.endProgramDateTime, maxFragLookUpTolerance);
      }

      if (!foundFrag && trackDetails.PTSKnown === false && !trackDetails.hasProgramDateTime) {
        // playlist sliding failed (switch playlist/ init with delay/ playlist merge out of range), find fragment by sn or cc
        const targetSN = this.fragPrevious.sn + 1;
        if (targetSN >= trackDetails.startSN && targetSN <= trackDetails.endSN) {
          const fragNext = fragments[targetSN - trackDetails.startSN];
          if (this.fragPrevious.cc === fragNext.cc) {
            foundFrag = fragNext;
            logger.log(`live subtitle playlist / switching playlist, load frag with next SN: ${foundFrag.sn}`);
          }
        }
        // next frag SN not available (or not with same continuity counter)
        // look for a frag sharing the same CC
        if (!foundFrag) {
          foundFrag = BinarySearch.search(fragments, function (frag) {
            return this.fragPrevious.cc - frag.cc;
          }.bind(this));
          if (foundFrag) {
            logger.log(`live subtitle playlist / switching playlist, load frag with same CC: ${foundFrag.sn}`);
          }
        }
      }

      if (foundFrag && foundFrag.encrypted) {
        logger.log(`Loading key for ${foundFrag.sn}`);
        this.state = State.KEY_LOADING;
        this.hls.trigger(Event.KEY_LOADING, { frag: foundFrag });
      } else if (foundFrag && this.fragmentTracker.getState(foundFrag) === FragmentState.NOT_LOADED) {
        // only load if fragment is not loaded
        foundFrag.trackId = trackId; // Frags don't know their subtitle track ID, so let's just add that...
        this.fragCurrent = foundFrag;
        this.state = State.FRAG_LOADING;

        logger.debug(`subtitle load frag ${foundFrag.sn}`);
        this.hls.trigger(Event.FRAG_LOADING, { frag: foundFrag });
      }
    }
  }

  _getBuffered () {
    return this.tracksBuffered[this.currentTrackId] || [];
  }
}
