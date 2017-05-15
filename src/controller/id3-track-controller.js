/*
 * id3 metadata track controller
*/

import Event from '../events';
import EventHandler from '../event-handler';

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
            const frames = this.parseID3Tag(samples[i].data);
            if (frames) {
                for (let j = 0; j < frames.length; j++) {
                    const cue = new Cue(startTime, endTime, '');
                    cue.value = frames[j];
                    this.id3Track.addCue(cue);
                }
            }
        }
    }

    parseID3Tag(data) {
        if (data.length < 10) {
            return undefined;
        }

        let offset = 0;
        let frames = [];

        while (offset < data.length) {
            /* http://id3.org/id3v2.3.0
      [0]     = 'I'
      [1]     = 'D'
      [2]     = '3'
      [3,4]   = {Version}
      [5]     = {Flags}
      [6-9]   = {ID3 Size}
      */
            const header = String.fromCharCode(
                data[offset++],
                data[offset++],
                data[offset++]
            );
            if (header === 'ID3') {
                //skip version and flags
                offset += 3;

                let size = 0;
                size = (data[offset++] & 0x7f) << 21;
                size |= (data[offset++] & 0x7f) << 14;
                size |= (data[offset++] & 0x7f) << 7;
                size |= data[offset++] & 0x7f;

                const decodedFrames = this.decodeID3Frames(
                    data.subarray(offset, offset + size)
                );
                frames = frames.concat(decodedFrames);

                offset += size;
            } else if (header === '3DI') {
                //footer is same size as header
                offset += 7;
            }
        }

        return frames;
    }

    decodeID3Frames(data) {
        let offset = 0;
        let frames = [];

        while (offset < data.length) {
            /*
      Frame ID       $xx xx xx xx (four characters)
      Size           $xx xx xx xx
      Flags          $xx xx
      */
            const type = String.fromCharCode(
                data[offset++],
                data[offset++],
                data[offset++],
                data[offset++]
            );

            let size = 0;
            size = data[offset++] << 24;
            size |= data[offset++] << 16;
            size |= data[offset++] << 8;
            size |= data[offset++];

            //skip flags
            offset += 2;

            const frame = this.decodeID3Frame({
                type,
                size,
                data: data.subarray(offset, offset + size)
            });
            if (frame) {
                frames.push(frame);
            }
            offset += size;
        }

        return frames;
    }

    decodeID3Frame(frame) {
        if (frame.type === 'PRIV') {
            return this.decodePrivFrame(frame);
        } else if (frame.type === 'TXXX') {
            return this.decodeTxxxFrame(frame);
        } else if (frame.type[0] === 'T') {
            return this.decodeTextFrame(frame);
        } else if (frame.type === 'WXXX') {
            return this.decodeWXXXFrame(frame);
        } else if (frame.type[0] === 'W') {
            return this.decodeURLLinkFrame(frame);
        }

        return undefined;
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
        const description = this.utf8ArrayToStr(frame.data.subarray(index));

        index += description.length + 1;
        const value = this.utf8ArrayToStr(frame.data.subarray(index));

        return { key: frame.type, info: description, data: value };
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

        const text = this.utf8ArrayToStr(frame.data.subarray(1));
        return { key: frame.type, data: text };
    }

    decodePrivFrame(frame) {
        /*
    Format: <text string>\0<binary data>
    */

        if (frame.size < 2) {
            return undefined;
        }

        const owner = this.utf8ArrayToStr(frame.data);
        const privateData = new Uint8Array(
            frame.data.subarray(owner.length + 1)
        );

        return { key: frame.type, info: owner, data: privateData.buffer };
    }

    decodeWXXXFrame(frame) {
        /*
    Format:
    [0]   = {Text Encoding}
    [1-?] = {Description}\0{URL}
    */
        if (frame.size < 2) {
            return undefined;
        }

        if (frame.data[0] !== 3) {
            //only support UTF-8
            return undefined;
        }

        let index = 1;
        const description = this.utf8ArrayToStr(frame.data.subarray(index));

        index += description.length + 1;
        const value = this.utf8ArrayToStr(frame.data.subarray(index));

        return { key: frame.type, info: description, data: value };
    }

    decodeURLLinkFrame(frame) {
        /*
    Format:
    [0-?]   = {URL}
    */
        const url = this.utf8ArrayToStr(frame.data);
        return { key: frame.type, data: url };
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
