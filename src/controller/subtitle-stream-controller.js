/*
 * Subtitle Stream Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {logger} from '../utils/logger';

class SubtitleStreamController extends EventHandler {

  constructor(hls) {
    super(hls,
      Event.ERROR,
      Event.SUBTITLE_TRACKS_UPDATED,
      Event.SUBTITLE_TRACK_SWITCH,
      Event.SUBTITLE_TRACK_LOADED,
      Event.SUBTITLE_FRAG_PROCESSED);
    this.config = hls.config;
    this.vttFragSNsProcessed = {};
    this.vttFragQueues = undefined;
    this.currentlyProcessing = null;
    this.currentTrackId = -1;
  }

  destroy() {
    EventHandler.prototype.destroy.call(this);
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
      this.hls.trigger(Event.FRAG_LOADING, {frag});
    }
  }

  // When fragment has finished processing, add sn to list of completed if successful.
  onSubtitleFragProcessed(data) {
    if(data.success) {
      this.vttFragSNsProcessed[data.frag.trackId].push(data.frag.sn);
    }
    this.currentlyProcessing = null;
    this.nextFrag();
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
  onSubtitleTrackLoaded(data) {
    const processedFragSNs = this.vttFragSNsProcessed[data.id],
        fragQueue = this.vttFragQueues[data.id],
        currentFragSN = !!this.currentlyProcessing ? this.currentlyProcessing.sn : -1;

    const alreadyProcessed = function(frag) {
      return processedFragSNs.indexOf(frag.sn) > -1;
    };

    const alreadyInQueue = function(frag) {
      return fragQueue.some(fragInQueue => {return fragInQueue.sn === frag.sn;});
    };

    // Add all fragments that haven't been, aren't currently being and aren't waiting to be processed, to queue.
    data.details.fragments.forEach(frag => {
      if(!(alreadyProcessed(frag) || frag.sn === currentFragSN || alreadyInQueue(frag))) {
        // Frags don't know their subtitle track ID, so let's just add that...
        frag.trackId = data.id;
        fragQueue.push(frag);
      }
    });

    this.nextFrag();
  }
}
export default SubtitleStreamController;

