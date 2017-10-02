/*
 * Subtitle Stream Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {logger} from '../utils/logger';
import Decrypter from '../crypt/decrypter';

const State = {
  STOPPED : 'STOPPED',
  IDLE : 'IDLE',
  KEY_LOADING : 'KEY_LOADING',
  FRAG_LOADING : 'FRAG_LOADING'
};

class SubtitleStreamController extends EventHandler {

  constructor(hls) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.ERROR,
      Event.KEY_LOADED,
      Event.FRAG_LOADED,
      Event.SUBTITLE_TRACKS_UPDATED,
      Event.SUBTITLE_TRACK_SWITCH,
      Event.SUBTITLE_TRACK_LOADED,
      Event.SUBTITLE_FRAG_PROCESSED);
    this.config = hls.config;
    this.vttFragSNsProcessed = {};
    this.vttFragQueues = undefined;
    this.currentlyProcessing = null;
    this.state = State.STOPPED;
    this.currentTrackId = -1;
    this.ticks = 0;
    this.decrypter = new Decrypter(hls.observer, hls.config);
  }

  destroy() {
    EventHandler.prototype.destroy.call(this);
    this.state = State.STOPPED;
  }

  // Remove all queued items and create a new, empty queue for each track.
  clearVttFragQueues() {
    this.vttFragQueues = {};
    this.tracks.forEach(track => {
      this.vttFragQueues[track.id] = [];
    });
  }

  // If no frag is being processed and queue isn't empty, initiate processing of next frag in line.
  nextFrag() {
    if(this.currentlyProcessing === null && this.currentTrackId > -1 && this.vttFragQueues[this.currentTrackId].length) {
      let frag = this.currentlyProcessing = this.vttFragQueues[this.currentTrackId].shift();
      this.fragCurrent = frag;
      this.hls.trigger(Event.FRAG_LOADING, {frag: frag});
      this.state = State.FRAG_LOADING;
    }
  }

  // When fragment has finished processing, add sn to list of completed if successful.
  onSubtitleFragProcessed(data) {
    if(data.success) {
      this.vttFragSNsProcessed[data.frag.trackId].push(data.frag.sn);
    }
    this.currentlyProcessing = null;
    this.state = State.IDLE;
    this.nextFrag();
  }

  onMediaAttached() {
    this.state = State.IDLE;
  }

  // If something goes wrong, procede to next frag, if we were processing one.
  onError(data) {
    let frag = data.frag;
    // don't handle frag error not related to subtitle fragment
    if (frag && frag.type !== 'subtitle') {
      return;
    }
    if(this.currentlyProcessing) {
      this.currentlyProcessing = null;
      this.nextFrag();
    }
  }

  tick() {
    this.ticks++;
    if (this.ticks === 1) {
      this.doTick();
      if (this.ticks > 1) {
        setTimeout(() => { this.tick(); }, 1);
      }
      this.ticks = 0;
    }
  }

  doTick() {
    switch(this.state) {
      case State.IDLE:
        const tracks = this.tracks;
        let trackId = this.currentTrackId;

        const processedFragSNs = this.vttFragSNsProcessed[trackId],
            fragQueue = this.vttFragQueues[trackId],
            currentFragSN = !!this.currentlyProcessing ? this.currentlyProcessing.sn : -1;

        const alreadyProcessed = function(frag) {
          return processedFragSNs.indexOf(frag.sn) > -1;
        };

        const alreadyInQueue = function(frag) {
          return fragQueue.some(fragInQueue => {return fragInQueue.sn === frag.sn;});
        };

        // exit if tracks don't exist
        if (!tracks) {
          break;
        }
        var trackDetails;

        if (trackId < tracks.length) {
          trackDetails = tracks[trackId].details;
        }

        if (typeof trackDetails === 'undefined') {
          break;
        }

        // Add all fragments that haven't been, aren't currently being and aren't waiting to be processed, to queue.
        trackDetails.fragments.forEach(frag => {
          if(!(alreadyProcessed(frag) || frag.sn === currentFragSN || alreadyInQueue(frag))) {
            // Load key if subtitles are encrypted
            if ((frag.decryptdata && frag.decryptdata.uri != null) && (frag.decryptdata.key == null)) {
              logger.log(`Loading key for ${frag.sn}`);
              this.state = State.KEY_LOADING;
              this.hls.trigger(Event.KEY_LOADING, {frag: frag});
            } else {
              // Frags don't know their subtitle track ID, so let's just add that...
              frag.trackId = trackId;
              fragQueue.push(frag);
              this.nextFrag();
            }
          }
        });
      }
  }

  // Got all new subtitle tracks.
  onSubtitleTracksUpdated(data) {
    logger.log('subtitle tracks updated');
    this.tracks = data.subtitleTracks;
    this.clearVttFragQueues();
    this.vttFragSNsProcessed = {};
    this.tracks.forEach(track => {
      this.vttFragSNsProcessed[track.id] = [];
    });
  }

  onSubtitleTrackSwitch(data) {
    this.currentTrackId = data.id;
    this.clearVttFragQueues();
  }

  // Got a new set of subtitle fragments.
  onSubtitleTrackLoaded() {
    this.tick();
  }

  onKeyLoaded() {
    if (this.state === State.KEY_LOADING) {
      this.state = State.IDLE;
      this.tick();
    }
  }

  onFragLoaded(data) {
    var fragCurrent = this.fragCurrent,
        decryptData = data.frag.decryptdata;
    let fragLoaded = data.frag,
        hls = this.hls;
    if (this.state === State.FRAG_LOADING &&
        fragCurrent &&
        data.frag.type === 'subtitle' &&
        fragCurrent.sn === data.frag.sn) {
          // check to see if the payload needs to be decrypted
          if ((data.payload.byteLength > 0) && (decryptData != null) && (decryptData.key != null) && (decryptData.method === 'AES-128')) {
            var startTime;
            try {
              startTime = performance.now();
            } catch (error) {
              startTime = Date.now();
            }
            // decrypt the subtitles
            this.decrypter.decrypt(data.payload, decryptData.key.buffer, decryptData.iv.buffer, function(decryptedData) {
              var endTime;
              try {
                endTime = performance.now();
              } catch (error) {
                endTime = Date.now();
              }
              hls.trigger(Event.FRAG_DECRYPTED, { frag: fragLoaded, payload : decryptedData, stats: { tstart: startTime, tdecrypt: endTime } });
            });
          }
        }
  }
}
export default SubtitleStreamController;
