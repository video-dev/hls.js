type RawFrame = { type: string; size: number; data: Uint8Array };

// breaking up those two types in order to clarify what is happening in the decoding path.
type DecodedFrame<T> = { key: string; data: T; info?: any };
export type Frame = DecodedFrame<ArrayBuffer | string>;

/**
 * Returns true if an ID3 header can be found at offset in data
 * @param data - The data to search
 * @param offset - The offset at which to start searching
 */
export const isHeader = (data: Uint8Array, offset: number): boolean => {
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
    // look for 'ID3' identifier
    if (
      data[offset] === 0x49 &&
      data[offset + 1] === 0x44 &&
      data[offset + 2] === 0x33
    ) {
      // check version is within range
      if (data[offset + 3] < 0xff && data[offset + 4] < 0xff) {
        // check size is within range
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
};

/**
 * Returns true if an ID3 footer can be found at offset in data
 * @param data - The data to search
 * @param offset - The offset at which to start searching
 */
export const isFooter = (data: Uint8Array, offset: number): boolean => {
  /*
   * The footer is a copy of the header, but with a different identifier
   */
  if (offset + 10 <= data.length) {
    // look for '3DI' identifier
    if (
      data[offset] === 0x33 &&
      data[offset + 1] === 0x44 &&
      data[offset + 2] === 0x49
    ) {
      // check version is within range
      if (data[offset + 3] < 0xff && data[offset + 4] < 0xff) {
        // check size is within range
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
};

/**
 * Returns any adjacent ID3 tags found in data starting at offset, as one block of data
 * @param data - The data to search in
 * @param offset - The offset at which to start searching
 * @returns the block of data containing any ID3 tags found
 * or *undefined* if no header is found at the starting offset
 */
export const getID3Data = (
  data: Uint8Array,
  offset: number
): Uint8Array | undefined => {
  const front = offset;
  let length = 0;

  while (isHeader(data, offset)) {
    // ID3 header is 10 bytes
    length += 10;

    const size = readSize(data, offset + 6);
    length += size;

    if (isFooter(data, offset + 10)) {
      // ID3 footer is 10 bytes
      length += 10;
    }

    offset += length;
  }

  if (length > 0) {
    return data.subarray(front, front + length);
  }

  return undefined;
};

const readSize = (data: Uint8Array, offset: number): number => {
  let size = 0;
  size = (data[offset] & 0x7f) << 21;
  size |= (data[offset + 1] & 0x7f) << 14;
  size |= (data[offset + 2] & 0x7f) << 7;
  size |= data[offset + 3] & 0x7f;
  return size;
};

export const canParse = (data: Uint8Array, offset: number): boolean => {
  return (
    isHeader(data, offset) &&
    readSize(data, offset + 6) + 10 <= data.length - offset
  );
};

/**
 * Searches for the Elementary Stream timestamp found in the ID3 data chunk
 * @param data - Block of data containing one or more ID3 tags
 */
export const getTimeStamp = (data: Uint8Array): number | undefined => {
  const frames: Frame[] = getID3Frames(data);

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    if (isTimeStampFrame(frame)) {
      return readTimeStamp(frame as DecodedFrame<ArrayBuffer>);
    }
  }

  return undefined;
};

/**
 * Returns true if the ID3 frame is an Elementary Stream timestamp frame
 */
export const isTimeStampFrame = (frame: Frame): boolean => {
  return (
    frame &&
    frame.key === 'PRIV' &&
    frame.info === 'com.apple.streaming.transportStreamTimestamp'
  );
};

const getFrameData = (data: Uint8Array): RawFrame => {
  /*
  Frame ID       $xx xx xx xx (four characters)
  Size           $xx xx xx xx
  Flags          $xx xx
  */
  const type: string = String.fromCharCode(data[0], data[1], data[2], data[3]);
  const size: number = readSize(data, 4);

  // skip frame id, size, and flags
  const offset = 10;

  return { type, size, data: data.subarray(offset, offset + size) };
};

/**
 * Returns an array of ID3 frames found in all the ID3 tags in the id3Data
 * @param id3Data - The ID3 data containing one or more ID3 tags
 */
export const getID3Frames = (id3Data: Uint8Array): Frame[] => {
  let offset = 0;
  const frames: Frame[] = [];

  while (isHeader(id3Data, offset)) {
    const size = readSize(id3Data, offset + 6);
    // skip past ID3 header
    offset += 10;
    const end = offset + size;
    // loop through frames in the ID3 tag
    while (offset + 8 < end) {
      const frameData: RawFrame = getFrameData(id3Data.subarray(offset));
      const frame: Frame | undefined = decodeFrame(frameData);
      if (frame) {
        frames.push(frame);
      }

      // skip frame header and frame data
      offset += frameData.size + 10;
    }

    if (isFooter(id3Data, offset)) {
      offset += 10;
    }
  }

  return frames;
};

export const decodeFrame = (frame: RawFrame): Frame | undefined => {
  if (frame.type === 'PRIV') {
    return decodePrivFrame(frame);
  } else if (frame.type[0] === 'W') {
    return decodeURLFrame(frame);
  }

  return decodeTextFrame(frame);
};

const decodePrivFrame = (
  frame: RawFrame
): DecodedFrame<ArrayBuffer> | undefined => {
  /*
  Format: <text string>\0<binary data>
  */
  if (frame.size < 2) {
    return undefined;
  }

  const owner = utf8ArrayToStr(frame.data, true);
  const privateData = new Uint8Array(frame.data.subarray(owner.length + 1));

  return { key: frame.type, info: owner, data: privateData.buffer };
};

const decodeTextFrame = (frame: RawFrame): DecodedFrame<string> | undefined => {
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
    const description = utf8ArrayToStr(frame.data.subarray(index), true);

    index += description.length + 1;
    const value = utf8ArrayToStr(frame.data.subarray(index));

    return { key: frame.type, info: description, data: value };
  }
  /*
  Format:
  [0]   = {Text Encoding}
  [1-?] = {Value}
  */
  const text = utf8ArrayToStr(frame.data.subarray(1));
  return { key: frame.type, data: text };
};

const decodeURLFrame = (frame: RawFrame): DecodedFrame<string> | undefined => {
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
    const description: string = utf8ArrayToStr(
      frame.data.subarray(index),
      true
    );

    index += description.length + 1;
    const value: string = utf8ArrayToStr(frame.data.subarray(index));

    return { key: frame.type, info: description, data: value };
  }
  /*
  Format:
  [0-?] = {URL}
  */
  const url: string = utf8ArrayToStr(frame.data);
  return { key: frame.type, data: url };
};

const readTimeStamp = (
  timeStampFrame: DecodedFrame<ArrayBuffer>
): number | undefined => {
  if (timeStampFrame.data.byteLength === 8) {
    const data = new Uint8Array(timeStampFrame.data);
    // timestamp is 33 bit expressed as a big-endian eight-octet number,
    // with the upper 31 bits set to zero.
    const pts33Bit = data[3] & 0x1;
    let timestamp =
      (data[4] << 23) + (data[5] << 15) + (data[6] << 7) + data[7];
    timestamp /= 45;

    if (pts33Bit) {
      timestamp += 47721858.84;
    } // 2^32 / 90

    return Math.round(timestamp);
  }

  return undefined;
};

// http://stackoverflow.com/questions/8936984/uint8array-to-string-in-javascript/22373197
// http://www.onicos.com/staff/iz/amuse/javascript/expert/utf.txt
/* utf.js - UTF-8 <=> UTF-16 convertion
 *
 * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
 * Version: 1.0
 * LastModified: Dec 25 1999
 * This library is free.  You can redistribute it and/or modify it.
 */
export const utf8ArrayToStr = (
  array: Uint8Array,
  exitOnNull: boolean = false
): string => {
  const decoder = getTextDecoder();
  if (decoder) {
    const decoded = decoder.decode(array);

    if (exitOnNull) {
      // grab up to the first null
      const idx = decoded.indexOf('\0');
      return idx !== -1 ? decoded.substring(0, idx) : decoded;
    }

    // remove any null characters
    return decoded.replace(/\0/g, '');
  }

  const len = array.length;
  let c;
  let char2;
  let char3;
  let out = '';
  let i = 0;
  while (i < len) {
    c = array[i++];
    if (c === 0x00 && exitOnNull) {
      return out;
    } else if (c === 0x00 || c === 0x03) {
      // If the character is 3 (END_OF_TEXT) or 0 (NULL) then skip it
      continue;
    }
    switch (c >> 4) {
      case 0:
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
        out += String.fromCharCode(((c & 0x1f) << 6) | (char2 & 0x3f));
        break;
      case 14:
        // 1110 xxxx  10xx xxxx  10xx xxxx
        char2 = array[i++];
        char3 = array[i++];
        out += String.fromCharCode(
          ((c & 0x0f) << 12) | ((char2 & 0x3f) << 6) | ((char3 & 0x3f) << 0)
        );
        break;
      default:
    }
  }
  return out;
};

export const testables = {
  decodeTextFrame: decodeTextFrame,
};

let decoder: TextDecoder;

function getTextDecoder() {
  if (!decoder && typeof self.TextDecoder !== 'undefined') {
    decoder = new self.TextDecoder('utf-8');
  }

  return decoder;
}
