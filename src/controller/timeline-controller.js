/*
 * Timeline Controller
*/

import Event from '../events';
import EventHandler from '../event-handler';
import Cea608Parser from '../utils/cea-608-parser';

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
            this.cea608Parser = new Cea608Parser(
                0,
                { newCue: this.newCue.bind(this) },
                null
            );
        }
    }

    newCue(startTime, endTime, captionScreen) {
        var row;
        var cue;
        var indenting;
        var indent;
        var text;
        var VTTCue = window.VTTCue || window.TextTrackCue;

        this.createTextTrack();

        for (var r = 0; r < captionScreen.rows.length; r++) {
            row = captionScreen.rows[r];
            indenting = true;
            indent = 0;
            text = '';

            if (!row.isEmpty()) {
                for (var c = 0; c < row.chars.length; c++) {
                    if (row.chars[c].uchar.match(/\s/) && indenting) {
                        indent++;
                    } else {
                        text += row.chars[c].uchar;
                        indenting = false;
                    }
                }
                cue = new VTTCue(startTime, endTime, text.trim());
                cue.line = r + (navigator.userAgent.match(/Firefox\//) ? 3 : 0);
                cue.align = 'left';
                cue.position =
                    100 * (indent / 32) +
                    (navigator.userAgent.match(/Firefox\//) ? 50 : 0);
                this.textTrack.addCue(cue);
            }
        }
    }

    clearCurrentCues() {
        while (this.textTrack.cues.length > 0) {
            this.textTrack.removeCue(this.textTrack.cues[0]);
        }
    }

    createTextTrack() {
        if (this.media && !this.textTrack) {
            this.textTrack = this.media.addTextTrack(
                'captions',
                'English',
                'en'
            );
            this.textTrack.mode = 'showing';
        }
    }

    destroy() {
        EventHandler.prototype.destroy.call(this);
    }

    onMediaAttaching(data) {
        this.media = data.media;
    }

    onMediaDetaching() {}

    onManifestLoading() {
        this.lastPts = Number.NEGATIVE_INFINITY;
    }

    onFragLoaded(data) {
        var pts = data.frag.start;

        // if this is a frag for a previously loaded timerange, remove all captions
        // TODO: consider just removing captions for the timerange
        if (pts <= this.lastPts) {
            this.clearCurrentCues();
        }

        this.lastPts = pts;
    }

    onFragParsingUserdata(data) {
        // push all of the CEA-708 messages into the interpreter
        // immediately. It will create the proper timestamps based on our PTS value
        for (var i = 0; i < data.samples.length; i++) {
            var ccdatas = this.extractCea608Data(data.samples[i].bytes);
            this.cea608Parser.addData(data.samples[i].pts, ccdatas);
        }
    }

    extractCea608Data(byteArray) {
        var count = byteArray[0] & 31;
        var position = 2;
        var tmpByte, ccbyte1, ccbyte2, ccValid, ccType;
        var actualCCBytes = [];

        for (var j = 0; j < count; j++) {
            tmpByte = byteArray[position++];
            ccbyte1 = 0x7f & byteArray[position++];
            ccbyte2 = 0x7f & byteArray[position++];
            ccValid = (4 & tmpByte) === 0 ? false : true;
            ccType = 3 & tmpByte;

            if (ccbyte1 === 0 && ccbyte2 === 0) {
                continue;
            }

            if (ccValid) {
                if (ccType === 0) {
                    // || ccType === 1
                    actualCCBytes.push(ccbyte1);
                    actualCCBytes.push(ccbyte2);
                }
            }
        }
        return actualCCBytes;
    }
}

export default TimelineController;
