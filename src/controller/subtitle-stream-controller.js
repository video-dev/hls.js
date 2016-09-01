/*
 * Subtitle Stream Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import {logger} from '../utils/logger';


class SubtitleStreamController extends EventHandler {

  constructor(hls) {
    super(hls,
      Event.SUBTITLE_TRACKS_UPDATED,
      Event.SUBTITLE_TRACK_SWITCH,
      Event.SUBTITLE_TRACK_LOADED,
      Event.SUBTITLE_FRAG_PROCESSED);
    this.config = hls.config;
    this.vttFragSNsProcessed = {};
    this.vttFragQueues = {};
    this.currentlyProcessing = null,
    this.currentTrackId = -1;
  }

  destroy() {
    EventHandler.prototype.destroy.call(this);
  }

  nextFrag() {
    if(this.currentlyProcessing === null && this.currentTrackId > -1 && this.vttFragQueues[this.currentTrackId].length) {
      this.currentlyProcessing = {sn: this.vttFragQueues[this.currentTrackId][0].sn, id: this.currentTrackId};
      hls.trigger(Event.FRAG_LOADING, {frag: this.vttFragQueues[this.currentTrackId].shift()});
    }
  }

  onSubtitleFragProcessed(data) {
    if(data.success) {
      this.vttFragSNsProcessed[this.currentlyProcessing.id].push(this.currentlyProcessing.sn);
    }
    this.currentlyProcessing = null;
    this.nextFrag();
  }



  onSubtitleTracksUpdated(data) {
    logger.log('subtitle tracks updated');
    this.tracks = data.subtitleTracks;
    this.vttFragSNsProcessed = {};
    this.vttFragQueues = {};
    this.tracks.forEach(track => {
      this.vttFragSNsProcessed[track.id] = [];
      this.vttFragQueues[track.id] = [];
    });
  }

  onSubtitleTrackSwitch(data) {
  }

  onSubtitleTrackLoaded(data) {
    let processedFragSNs = this.vttFragSNsProcessed[data.id],
        fragQueue = this.vttFragQueues[data.id],
        currentFragSN = !!this.currentlyProcessing ? this.currentlyProcessing.sn : -1;

    let alreadyProcessed = function(frag) {
      return processedFragSNs.indexOf(frag.sn) > -1;
    }

    let alreadyInQueue = function(frag) {
      return fragQueue.some(fragInQueue => {return fragInQueue.sn === frag.sn});
    }

    data.details.fragments.forEach(frag => {
      if(!(alreadyProcessed(frag) || frag.sn === currentFragSN || alreadyInQueue(frag))) {
        fragQueue.push(frag);
      }
    });

    this.nextFrag();
  }
}
export default SubtitleStreamController;

