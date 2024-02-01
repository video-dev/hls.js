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
  exitOnNull: boolean = false,
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
          ((c & 0x0f) << 12) | ((char2 & 0x3f) << 6) | ((char3 & 0x3f) << 0),
        );
        break;
      default:
    }
  }
  return out;
};

let decoder: TextDecoder;

function getTextDecoder() {
  // On Play Station 4, TextDecoder is defined but partially implemented.
  // Manual decoding option is preferable
  if (navigator.userAgent.includes('PlayStation 4')) {
    return;
  }

  if (!decoder && typeof self.TextDecoder !== 'undefined') {
    decoder = new self.TextDecoder('utf-8');
  }

  return decoder;
}
