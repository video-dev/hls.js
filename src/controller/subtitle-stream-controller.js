/*
 * Subtitle Stream Controller
*/

import Event from '../events';
import { logger } from '../utils/logger';
import Decrypter from '../crypt/decrypter';
import TaskLoop from '../task-loop';
import { BufferHelper } from '../utils/buffer-helper';
import BinarySearch from '../utils/binary-search';

const State = {
  STOPPED: 'STOPPED',
  IDLE: 'IDLE',
  KEY_LOADING: 'KEY_LOADING',
  FRAG_LOADING: 'FRAG_LOADING'
};

class SubtitleStreamController extends TaskLoop {
  constructor (hls) {
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

    this.config = hls.config;
    this.state = State.STOPPED;
    this.tracksBuffered = [];
    this.currentTrackId = -1;
    this.decrypter = new Decrypter(hls.observer, hls.config);
  }

  onHandlerDestroyed () {
    this.state = State.STOPPED;
  }

  getBuffered () {
    const buffered = this.tracksBuffered[this.currentTrackId];
    if (buffered) {
      return buffered;
    }
    return [];
  }

  onSubtitleFragProcessed (data) {
    const buffered = this.tracksBuffered[this.currentTrackId];
    const frag = data.frag;
    if (data.success) {
      this.fragPrevious = frag;
      if (buffered) {
        // Create/Update a buffered array matching the interface used by BufferHelper.bufferedInfo
        // so we can re-use the logic used to detect how much have been buffered
        let timeRange;
        for (let i = 0; i < buffered.length; i++) {
          if (frag.start >= buffered[i].start && frag.start <= buffered[i].end) {
            timeRange = buffered[i];
            break;
          }
        }

        if (timeRange) {
          timeRange.end = frag.start + frag.duration;
        } else {
          buffered.push({
            start: frag.start,
            end: frag.start + frag.duration
          });
        }
      }
    }
    this.state = State.IDLE;
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

  doTick () {
    switch (this.state) {
    case State.IDLE:
      const tracks = this.tracks;
      const trackId = this.currentTrackId;
      if (!tracks || trackId === -1) {
        break;
      }
      let trackDetails;
      if (trackId < tracks.length) {
        trackDetails = tracks[trackId].details;
      }
      if (!trackDetails) {
        break;
      }
      if (!this.media) {
        break;
      }

      const config = this.config;
      const maxBufferHole = config.maxBufferHole;
      const maxConfigBuffer = Math.min(config.maxBufferLength, config.maxMaxBufferLength);
      const maxFragLookUpTolerance = config.maxFragLookUpTolerance;

      const bufferedInfo = BufferHelper.bufferedInfo(this.getBuffered(), this.media.currentTime, maxBufferHole);
      const bufferEnd = bufferedInfo.end;
      const bufferLen = bufferedInfo.len;

      const fragments = trackDetails.fragments;
      const fragLen = fragments.length;
      const end = fragments[fragLen - 1].start + fragments[fragLen - 1].duration;

      if (bufferLen < maxConfigBuffer && bufferEnd < end) {
        const fragNext = this.fragPrevious ? fragments[this.fragPrevious.sn - fragments[0].sn + 1] : undefined;

        let fragmentWithinToleranceTest = (candidate) => {
          // offset should be within fragment boundary - maxFragLookUpTolerance
          // this is to cope with situations like
          // bufferEnd = 9.991
          // frag[Ø] : [0,10]
          // frag[1] : [10,20]
          // bufferEnd is within frag[0] range ... although what we are expecting is to return frag[1] here
          //              frag start               frag start+duration
          //                  |-----------------------------|
          //              <--->                         <--->
          //  ...--------><-----------------------------><---------....
          // previous frag         matching fragment         next frag
          //  return -1             return 0                 return 1
          // logger.log(`level/sn/start/end/bufEnd:${level}/${candidate.sn}/${candidate.start}/${(candidate.start+candidate.duration)}/${bufferEnd}`);
          // Set the lookup tolerance to be small enough to detect the current segment - ensures we don't skip over very small segments
          let candidateLookupTolerance = Math.min(maxFragLookUpTolerance, candidate.duration);
          if ((candidate.start + candidate.duration - candidateLookupTolerance) <= bufferEnd) {
            return 1;
          } else if (candidate.start - candidateLookupTolerance > bufferEnd && candidate.start) {
            // if maxFragLookUpTolerance will have negative value then don't return -1 for first element
            return -1;
          }
          return 0;
        };

        let foundFrag;
        if (fragNext && !fragmentWithinToleranceTest(fragNext)) {
          foundFrag = fragNext;
        } else {
          foundFrag = BinarySearch.search(fragments, fragmentWithinToleranceTest);
        }

        if (foundFrag && foundFrag.encrypted) {
          logger.log(`Loading key for ${foundFrag.sn}`);
          this.state = State.KEY_LOADING;
          this.hls.trigger(Event.KEY_LOADING, { frag: foundFrag });
        } else if (foundFrag) {
          foundFrag.trackId = trackId; // Frags don't know their subtitle track ID, so let's just add that...
          this.fragCurrent = foundFrag;
          this.state = State.FRAG_LOADING;
          this.hls.trigger(Event.FRAG_LOADING, { frag: foundFrag });
        }
      }
    }
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
    let details = currentTrack.details;
    if (currentTrack && currentTrack.details) {
      this.setInterval(500);
    }
  }

  // Got a new set of subtitle fragments.
  onSubtitleTrackLoaded () {
    this.setInterval(500);
  }

  onKeyLoaded () {
    if (this.state === State.KEY_LOADING) {
      this.state = State.IDLE;
    }
  }

  onFragLoaded (data) {
    let fragCurrent = this.fragCurrent,
      decryptData = data.frag.decryptdata;
    let fragLoaded = data.frag,
      hls = this.hls;
    if (this.state === State.FRAG_LOADING &&
        fragCurrent &&
        data.frag.type === 'subtitle' &&
        fragCurrent.sn === data.frag.sn) {
      // check to see if the payload needs to be decrypted
      if ((data.payload.byteLength > 0) && (decryptData != null) && (decryptData.key != null) && (decryptData.method === 'AES-128')) {
        let startTime;
        try {
          startTime = performance.now();
        } catch (error) {
          startTime = Date.now();
        }
        // decrypt the subtitles
        this.decrypter.decrypt(data.payload, decryptData.key.buffer, decryptData.iv.buffer, function (decryptedData) {
          let endTime;
          try {
            endTime = performance.now();
          } catch (error) {
            endTime = Date.now();
          }
          hls.trigger(Event.FRAG_DECRYPTED, { frag: fragLoaded, payload: decryptedData, stats: { tstart: startTime, tdecrypt: endTime } });
        });
      }
    }
  }
}
export default SubtitleStreamController;
