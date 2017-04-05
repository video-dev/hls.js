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

        // Attempt to recreate Safari functionality by creating
        // WebKitDataCue objects when available and store the decoded
        // ID3 data in the value property of the cue
        let Cue = window.WebKitDataCue || window.VTTCue || window.TextTrackCue;

        for (let i = 0; i < samples.length; i++) {
            let id3Frame = this.parseID3Frame(samples[i].data);
            let frame = this.decodeID3Frame(id3Frame);
            if (frame) {
                let cue = new Cue(startTime, endTime, '');
                cue.value = frame;
                this.id3Track.addCue(cue);
            }
        }
    }

    parseID3Frame(data) {
        if (data.length < 21) {
            return undefined;
        }

        /* http://id3.org/id3v2.3.0
    [0]     = 'I'
    [1]     = 'D'
    [2]     = '3'
    [3,4]   = {Version}
    [5]     = {Flags}
    [6-9]   = {ID3 Size}
    [10-13] = {Frame ID}
    [14-17] = {Frame Size}
    [18,19] = {Frame Flags}
    */
        if (
            data[0] === 73 && // I
            data[1] === 68 && // D
            data[2] === 51
        ) {
            // 3

            let type = String.fromCharCode(
                data[10],
                data[11],
                data[12],
                data[13]
            );
            data = data.subarray(20);
            return { type, data };
        }
    }

    decodeID3Frame(frame) {
        if (frame.type === 'TXXX') {
            return this.decodeTxxxFrame(frame);
        } else if (frame.type === 'PRIV') {
            return this.decodePrivFrame(frame);
        } else if (frame.type[0] === 'T') {
            return this.decodeTextFrame(frame);
        } else {
            return undefined;
        }
    }

    decodeTxxxFrame(frame) {
        /*
    Format:
    [0]   = {Text Encoding}
    [1-?] = {Description}\0{Value}
    */

        if (frame.size < 2) {
            return undefined;
        }

        if (frame.data[0] !== 3) {
            //only support UTF-8
            return undefined;
        }

        let index = 1;
        let description = this.utf8ArrayToStr(frame.data.subarray(index));

        index += description.length + 1;
        let value = this.utf8ArrayToStr(frame.data.subarray(index));

        return { key: 'TXXX', description, data: value };
    }

    decodeTextFrame(frame) {
        /*
    Format:
    [0]   = {Text Encoding}
    [1-?] = {Value}
    */

        if (frame.size < 2) {
            return undefined;
        }

        if (frame.data[0] !== 3) {
            //only support UTF-8
            return undefined;
        }

        let data = frame.data.subarray(1);
        return { key: frame.type, data: this.utf8ArrayToStr(data) };
    }

    decodePrivFrame(frame) {
        /*
    Format: <text string>\0<binary data>
    */

        if (frame.size < 2) {
            return undefined;
        }

        let owner = this.utf8ArrayToStr(frame.data);
        let privateData = frame.data.subarray(owner.length + 1);

        return { key: 'PRIV', info: owner, data: privateData.buffer };
    }

    // http://stackoverflow.com/questions/8936984/uint8array-to-string-in-javascript/22373197
    // http://www.onicos.com/staff/iz/amuse/javascript/expert/utf.txt
    /* utf.js - UTF-8 <=> UTF-16 convertion
   *
   * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
   * Version: 1.0
   * LastModified: Dec 25 1999
   * This library is free.  You can redistribute it and/or modify it.
   */
    utf8ArrayToStr(array) {
        let char2;
        let char3;
        let out = '';
        let i = 0;
        let length = array.length;

        while (i < length) {
            let c = array[i++];
            switch (c >> 4) {
                case 0:
                    return out;
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                    // 0xxxxxxx
                    out += String.fromCharCode(c);
                    break;
                case 12:
                case 13:
                    // 110x xxxx   10xx xxxx
                    char2 = array[i++];
                    out += String.fromCharCode(
                        ((c & 0x1f) << 6) | (char2 & 0x3f)
                    );
                    break;
                case 14:
                    // 1110 xxxx  10xx xxxx  10xx xxxx
                    char2 = array[i++];
                    char3 = array[i++];
                    out += String.fromCharCode(
                        ((c & 0x0f) << 12) |
                            ((char2 & 0x3f) << 6) |
                            ((char3 & 0x3f) << 0)
                    );
                    break;
            }
        }

        return out;
    }
}

export default ID3TrackController;
