/*
 * Subtitle Stream Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { logger } from '../utils/logger';

class SubtitleStreamController extends EventHandler {
    constructor(hls) {
        super(
            hls,
            Event.SUBTITLE_TRACKS_UPDATED,
            Event.SUBTITLE_TRACK_SWITCH,
            Event.SUBTITLE_TRACK_LOADED,
            Event.SUBTITLE_FRAG_PROCESSED
        );
        this.config = hls.config;
        this.vttFragSNsProcessed = {};
        this.vttFragQueues = undefined;
        (this.currentlyProcessing = null), (this.currentTrackId = -1);
    }

    destroy() {
        EventHandler.prototype.destroy.call(this);
    }

    clearVttFragQueues() {
        this.vttFragQueues = {};
        this.tracks.forEach(track => {
            this.vttFragSNsProcessed[track.id] = [];
            this.vttFragQueues[track.id] = [];
        });
    }

    nextFrag() {
        if (
            this.currentlyProcessing === null &&
            this.currentTrackId > -1 &&
            this.vttFragQueues[this.currentTrackId].length
        ) {
            let frag = (this.currentlyProcessing = this.vttFragQueues[
                this.currentTrackId
            ].shift());
            hls.trigger(Event.FRAG_LOADING, { frag });
        }
    }

    onSubtitleFragProcessed(data) {
        if (data.success) {
            this.vttFragSNsProcessed[data.frag.trackId].push(data.frag.sn);
        }
        this.currentlyProcessing = null;
        this.nextFrag();
    }

    onSubtitleTracksUpdated(data) {
        logger.log('subtitle tracks updated');
        this.tracks = data.subtitleTracks;
        this.vttFragSNsProcessed = {};
        this.clearVttFragQueues();
    }

    onSubtitleTrackSwitch(data) {
        this.currentTrackId = data.id;
        this.clearVttFragQueues();
    }

    onSubtitleTrackLoaded(data) {
        let processedFragSNs = this.vttFragSNsProcessed[data.id],
            fragQueue = this.vttFragQueues[data.id],
            currentFragSN = !!this.currentlyProcessing
                ? this.currentlyProcessing.sn
                : -1;

        let alreadyProcessed = function(frag) {
            return processedFragSNs.indexOf(frag.sn) > -1;
        };

        let alreadyInQueue = function(frag) {
            return fragQueue.some(fragInQueue => {
                return fragInQueue.sn === frag.sn;
            });
        };

        data.details.fragments.forEach(frag => {
            if (
                !(
                    alreadyProcessed(frag) ||
                    frag.sn === currentFragSN ||
                    alreadyInQueue(frag)
                )
            ) {
                frag.trackId = data.id;
                fragQueue.push(frag);
            }
        });

        this.nextFrag();
    }
}
export default SubtitleStreamController;
