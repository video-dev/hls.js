/**
 * ID3 parser
 */
import { logger } from '../utils/logger';
//import Hex from '../utils/hex';

class ID3 {
    constructor(data) {
        this._hasTimeStamp = false;
        this._length = 0;
        var offset = 0,
            byte1,
            byte2,
            byte3,
            byte4,
            tagSize,
            endPos,
            header,
            len;
        do {
            header = this.readUTF(data, offset, 3);
            offset += 3;
            // first check for ID3 header
            if (header === 'ID3') {
                // skip 24 bits
                offset += 3;
                // retrieve tag(s) length
                byte1 = data[offset++] & 0x7f;
                byte2 = data[offset++] & 0x7f;
                byte3 = data[offset++] & 0x7f;
                byte4 = data[offset++] & 0x7f;
                tagSize = (byte1 << 21) + (byte2 << 14) + (byte3 << 7) + byte4;
                endPos = offset + tagSize;
                //logger.log(`ID3 tag found, size/end: ${tagSize}/${endPos}`);

                // read ID3 tags
                this._parseID3Frames(data, offset, endPos);
                offset = endPos;
            } else if (header === '3DI') {
                // http://id3.org/id3v2.4.0-structure chapter 3.4.   ID3v2 footer
                offset += 7;
                logger.log(`3DI footer found, end: ${offset}`);
            } else {
                offset -= 3;
                len = offset;
                if (len) {
                    //logger.log(`ID3 len: ${len}`);
                    if (!this.hasTimeStamp) {
                        logger.warn('ID3 tag found, but no timestamp');
                    }
                    this._length = len;
                    this._payload = data.subarray(0, len);
                }
                return;
            }
        } while (true);
    }

    static isID3Header(data, offset) {
        /*
    * http://id3.org/id3v2.3.0
    * [0]     = 'I'
    * [1]     = 'D'
    * [2]     = '3'
    * [3,4]   = {Version}
    * [5]     = {Flags}
    * [6-9]   = {ID3 Size}
    *
    * An ID3v2 tag can be detected with the following pattern:
    *  $49 44 33 yy yy xx zz zz zz zz
    * Where yy is less than $FF, xx is the 'flags' byte and zz is less than $80
    */
        if (offset + 10 <= data.length) {
            //look for 'ID3' identifier
            if (
                data[offset] === 0x49 &&
                data[offset + 1] === 0x44 &&
                data[offset + 2] === 0x33
            ) {
                //check version is within range
                if (data[offset + 3] < 0xff && data[offset + 4] < 0xff) {
                    //check size is within range
                    if (
                        data[offset + 6] < 0x80 &&
                        data[offset + 7] < 0x80 &&
                        data[offset + 8] < 0x80 &&
                        data[offset + 9] < 0x80
                    ) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    static isID3Footer(data, offset) {
        /*
    * The footer is a copy of the header, but with a different identifier
    */
        if (offset + 10 <= data.length) {
            //look for '3DI' identifier
            if (
                data[offset] === 0x33 &&
                data[offset + 1] === 0x44 &&
                data[offset + 2] === 0x49
            ) {
                //check version is within range
                if (data[offset + 3] < 0xff && data[offset + 4] < 0xff) {
                    //check size is within range
                    if (
                        data[offset + 6] < 0x80 &&
                        data[offset + 7] < 0x80 &&
                        data[offset + 8] < 0x80 &&
                        data[offset + 9] < 0x80
                    ) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    static getID3Data(data, offset) {
        let tags = [];
        const front = offset;
        let length = 0;

        while (ID3.isID3Header(data, offset)) {
            //ID3 header is 10 bytes
            length += 10;

            const size = ID3._readSize(data, offset + 6);
            length += size;

            if (ID3.isID3Footer(data, offset + 10)) {
                //ID3 footer is 10 bytes
                length += 10;
            }

            offset += length;
        }

        if (length > 0) {
            return data.subarray(front, front + length);
        }

        return undefined;
    }

    static _readSize(data, offset) {
        let size = 0;
        size = (data[offset] & 0x7f) << 21;
        size |= (data[offset + 1] & 0x7f) << 14;
        size |= (data[offset + 2] & 0x7f) << 7;
        size |= data[offset + 3] & 0x7f;
        return size;
    }

    static getTimeStamp(data) {
        const frames = ID3.decodeID3Data(data);
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            if (ID3.isTimeStampFrame(frame)) {
                return ID3._readTimeStamp(frame);
            }
        }

        /*
    let offset = 0;

    while (ID3.isID3Header(data, offset)) {
      const size = ID3._readSize(data, offset + 6);
      //size of timestamp frame is 63 bytes (including frame header)
      if (size >= 63) {
        //skip past ID3 header
        offset += 10;
        //loop through frames in the ID3 tag
        while (offset + 8 < size) {
          const frameData = ID3._getFrameData(data.subarray(offset));
          if (frameData.type === 'PRIV' && frameData.size === 53) {
            const frame = ID3._decodePrivFrame(frameData);
            if (frame.data.byteLength === 8 && frame.info === 'com.apple.streaming.transportStreamTimestamp') {
              return ID3._readTimeStamp(frame);
            }
          }

          //skip frame header and frame data
          offset += frameData.size + 10;
        }
      }

      if (ID3.isID3Footer(data, offset)) {
        offset += 10;
      }
    }*/

        return undefined;
    }

    static isTimeStampFrame(frame) {
        return (
            frame &&
            frame.key === 'PRIV' &&
            frame.info === 'com.apple.streaming.transportStreamTimestamp'
        );
    }

    static _getFrameData(data) {
        /*
    Frame ID       $xx xx xx xx (four characters)
    Size           $xx xx xx xx
    Flags          $xx xx
    */
        const type = String.fromCharCode(data[0], data[1], data[2], data[3]);
        const size = ID3._readSize(data, 4);

        //skip frame id, size, and flags
        let offset = 10;

        return { type, size, data: data.subarray(offset, offset + size) };
    }

    static decodeID3Data(data) {
        let offset = 0;
        const frames = [];

        while (ID3.isID3Header(data, offset)) {
            const size = ID3._readSize(data, offset + 6);
            //skip past ID3 header
            offset += 10;
            const end = offset + size;
            //loop through frames in the ID3 tag
            while (offset + 8 < end) {
                const frameData = ID3._getFrameData(data.subarray(offset));
                const frame = ID3._decodeFrame(frameData);
                if (frame) {
                    frames.push(frame);
                }
                //skip frame header and frame data
                offset += frameData.size + 10;
            }

            if (ID3.isID3Footer(data, offset)) {
                offset += 10;
            }
        }

        return frames;
    }

    static _decodeFrame(frame) {
        if (frame.type === 'PRIV') {
            return ID3._decodePrivFrame(frame);
        } else if (frame.type[0] === 'T') {
            return ID3._decodeTextFrame(frame);
        } else if (frame.type[0] === 'W') {
            return ID3._decodeURLFrame(frame);
        }

        return undefined;
    }

    static _readTimeStamp(timeStampFrame) {
        if (timeStampFrame.data.byteLength === 8) {
            const data = new Uint8Array(timeStampFrame.data);
            // timestamp is 33 bit expressed as a big-endian eight-octet number,
            // with the upper 31 bits set to zero.
            const pts33Bit = data[3] & 0x1;
            let timestamp =
                (data[4] << 23) + (data[5] << 15) + (data[6] << 7) + data[7];
            timestamp /= 45;

            if (pts33Bit) {
                timestamp += 47721858.84; // 2^32 / 90
            }

            return Math.round(timestamp);
        }

        return undefined;
    }

    static _decodePrivFrame(frame) {
        /*
    Format: <text string>\0<binary data>
    */
        if (frame.size < 2) {
            return undefined;
        }

        const owner = ID3._utf8ArrayToStr(frame.data);
        const privateData = new Uint8Array(
            frame.data.subarray(owner.length + 1)
        );

        return { key: frame.type, info: owner, data: privateData.buffer };
    }

    static _decodeTextFrame(frame) {
        if (frame.size < 2) {
            return undefined;
        }

        if (frame.type === 'TXXX') {
            /*
      Format:
      [0]   = {Text Encoding}
      [1-?] = {Description}\0{Value}
      */
            let index = 1;
            const description = ID3._utf8ArrayToStr(frame.data.subarray(index));

            index += description.length + 1;
            const value = ID3._utf8ArrayToStr(frame.data.subarray(index));

            return { key: frame.type, info: description, data: value };
        } else {
            /*
      Format:
      [0]   = {Text Encoding}
      [1-?] = {Value}
      */
            const text = ID3._utf8ArrayToStr(frame.data.subarray(1));
            return { key: frame.type, data: text };
        }
    }

    static _decodeURLFrame(frame) {
        if (frame.type === 'WXXX') {
            /*
      Format:
      [0]   = {Text Encoding}
      [1-?] = {Description}\0{URL}
      */
            if (frame.size < 2) {
                return undefined;
            }

            let index = 1;
            const description = ID3._utf8ArrayToStr(frame.data.subarray(index));

            index += description.length + 1;
            const value = ID3._utf8ArrayToStr(frame.data.subarray(index));

            return { key: frame.type, info: description, data: value };
        } else {
            /*
      Format:
      [0-?] = {URL}
      */
            const url = ID3._utf8ArrayToStr(frame.data);
            return { key: frame.type, data: url };
        }
    }

    readUTF(data, start, len) {
        var result = '',
            offset = start,
            end = start + len;
        do {
            result += String.fromCharCode(data[offset++]);
        } while (offset < end);
        return result;
    }

    _parseID3Frames(data, offset, endPos) {
        var tagId, tagLen, tagStart, tagFlags, timestamp;
        while (offset + 8 <= endPos) {
            tagId = this.readUTF(data, offset, 4);
            offset += 4;

            tagLen =
                ((data[offset++] << (24 + data[offset++])) <<
                    (16 + data[offset++])) <<
                (8 + data[offset++]);

            tagFlags = data[offset++] << (8 + data[offset++]);

            tagStart = offset;
            //logger.log("ID3 tag id:" + tagId);
            switch (tagId) {
                case 'PRIV':
                    //logger.log('parse frame:' + Hex.hexDump(data.subarray(offset,endPos)));
                    // owner should be "com.apple.streaming.transportStreamTimestamp"
                    if (
                        this.readUTF(data, offset, 44) ===
                        'com.apple.streaming.transportStreamTimestamp'
                    ) {
                        offset += 44;
                        // smelling even better ! we found the right descriptor
                        // skip null character (string end) + 3 first bytes
                        offset += 4;

                        // timestamp is 33 bit expressed as a big-endian eight-octet number, with the upper 31 bits set to zero.
                        var pts33Bit = data[offset++] & 0x1;
                        this._hasTimeStamp = true;

                        timestamp =
                            ((data[offset++] << 23) +
                                (data[offset++] << 15) +
                                (data[offset++] << 7) +
                                data[offset++]) /
                            45;

                        if (pts33Bit) {
                            timestamp += 47721858.84; // 2^32 / 90
                        }
                        timestamp = Math.round(timestamp);
                        logger.trace(`ID3 timestamp found: ${timestamp}`);
                        this._timeStamp = timestamp;
                    }
                    break;
                default:
                    break;
            }
        }
    }

    get hasTimeStamp() {
        return this._hasTimeStamp;
    }

    get timeStamp() {
        return this._timeStamp;
    }

    get length() {
        return this._length;
    }

    get payload() {
        return this._payload;
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
    static _utf8ArrayToStr(array) {
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

export default ID3;
