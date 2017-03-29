/*
 * id3 metadata track controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { logger } from '../utils/logger';

function base64Encode(data) {
    return btoa(String.fromCharCode.apply(null, data));
}

class ID3TrackController extends EventHandler {
    constructor(hls) {
        super(
            hls,
            Event.MEDIA_ATTACHED,
            Event.MEDIA_DETACHING,
            Event.FRAG_PARSING_METADATA
        );
        this.id3Track = undefined;
        this.media = undefined;
    }

    destroy() {
        EventHandler.prototype.destroy.call(this);
    }

    // Add ID3 metatadata text track.
    onMediaAttached(data) {
        this.media = data.media;
        if (!this.media) {
            return;
        }

        this.id3Track = this.media.addTextTrack('metadata', 'id3');
        this.id3Track.mode = 'hidden';
    }

    onMediaDetaching() {
        this.media = undefined;
    }

    onFragParsingMetadata(data) {
        const fragment = data.frag;
        const samples = data.samples;
        const startTime = fragment.start;
        let endTime = fragment.start + fragment.duration;
        // Give a slight bump to the endTime if it's equal to startTime to avoid a SyntaxError in IE
        if (startTime === endTime) {
            endTime += 0.0001;
        }

        for (let i = 0; i < samples.length; i++) {
            // base64 encode id3 data to store in VTTCue text property
            let text = base64Encode(samples[i].data);
            this.id3Track.addCue(new VTTCue(startTime, endTime, text));
        }
    }
}

export default ID3TrackController;
