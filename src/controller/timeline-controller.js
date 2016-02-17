/*
 * Timeline Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
//import Cea608Parser from '../utils/cea-608-parser';

class TimelineController extends EventHandler {
    constructor(hls) {
        super(
            hls,
            Event.MEDIA_ATTACHING,
            Event.MEDIA_DETACHING,
            Event.FRAG_PARSING_USERDATA,
            Event.MANIFEST_LOADING,
            Event.FRAG_LOADED
        );

        this.hls = hls;
        this.config = hls.config;

        if (this.config.enableCEA708Captions) {
            //this.cea608Parser = new Cea608Parser();
        }
    }

    destroy() {
        EventHandler.prototype.destroy.call(this);
    }

    onMediaAttaching() {}

    onMediaDetaching() {}

    onManifestLoading() {
        this.lastPts = Number.POSITIVE_INFINITY;
    }

    onFragLoaded(data) {
        var pts = data.frag.start; //Number.POSITIVE_INFINITY;

        // if this is a frag for a previously loaded timerange, remove all captions
        // TODO: consider just removing captions for the timerange
        if (pts <= this.lastPts) {
            //this.cea608Parser.clear();
        }

        this.lastPts = pts;
    }

    onFragParsingUserdata(data) {
        // push all of the CEA-708 messages into the interpreter
        // immediately. It will create the proper timestamps based on our PTS value
        for (var i = 0; i < data.samples.length; i++) {
            //this.cea608Parser.addData(data.samples[i].pts, data.samples[i].bytes);
        }
    }
}

export default TimelineController;
