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
            Event.SUBTITLE_TRACK_LOADED
        );
        this.config = hls.config;
    }

    destroy() {
        EventHandler.prototype.destroy.call(this);
    }

    onSubtitleTracksUpdated(data) {
        logger.log('subtitle tracks updated');
        this.tracks = data.subtitleTracks;
    }

    onSubtitleTrackSwitch(data) {}

    onSubtitleTrackLoaded(data) {
        let theFraggle = data.details.fragments[0];
        if (theFraggle) {
            hls.trigger(Event.FRAG_LOADING, { frag: theFraggle });
        }
        return;
    }
}
export default SubtitleStreamController;
