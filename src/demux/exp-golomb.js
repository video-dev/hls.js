/**
 * Parser for exponential Golomb codes, a variable-bitwidth number encoding scheme used by h264.
*/

import {logger} from '../utils/logger';

class ExpGolomb {

  constructor(data) {
    this._data = data;
    // the number of bytes left to examine in this._data
    this.bytesAvailable = data.byteLength;
    // the current word being examined
    this._word = 0; // :uint
    // the number of bits left to examine in the current word
    this._bitsAvailable = 0; // :uint
  }

  // ():void
  _loadWord() {
    var
      data = this._data,
      bytesAvailable = this.bytesAvailable,
      position = data.byteLength - bytesAvailable,
      workingBytes = new Uint8Array(4),
      availableBytes = Math.min(4, bytesAvailable);
    if (availableBytes === 0) {
      throw new Error('no bytes available');
    }
    workingBytes.set(data.subarray(position, position + availableBytes));
    this._word = new DataView(workingBytes.buffer).getUint32(0);
    // track the amount of this._data that has been processed
    this._bitsAvailable = availableBytes * 8;
    this.bytesAvailable -= availableBytes;
  }

  // (count:int):void
  _skipBits(count) {
    var skipBytes; // :int
    if (this._bitsAvailable > count) {
      this._word <<= count;
      this._bitsAvailable -= count;
    } else {
      count -= this._bitsAvailable;
      skipBytes = count >> 3;
      count -= (skipBytes >> 3);
      this.bytesAvailable -= skipBytes;
      this._loadWord();
      this._word <<= count;
      this._bitsAvailable -= count;
    }
  }

  // (size:int):uint
  _readBits(size) {
    var
      bits = Math.min(this._bitsAvailable, size), // :uint
      valu = this._word >>> (32 - bits); // :uint
    if (size > 32) {
      logger.error('Cannot read more than 32 bits at a time');
    }
    this._bitsAvailable -= bits;
    if (this._bitsAvailable > 0) {
      this._word <<= bits;
    } else if (this.bytesAvailable > 0) {
      this._loadWord();
    }
    bits = size - bits;
    if (bits > 0 && this._bitsAvailable) {
      return valu << bits | this._readBits(bits);
    } else {
      return valu;
    }
  }

  // ():uint
  _skipLZ() {
    var leadingZeroCount; // :uint
    for (leadingZeroCount = 0; leadingZeroCount < this._bitsAvailable; ++leadingZeroCount) {
      if (0 !== (this._word & (0x80000000 >>> leadingZeroCount))) {
        // the first bit of working word is 1
        this._word <<= leadingZeroCount;
        this._bitsAvailable -= leadingZeroCount;
        return leadingZeroCount;
      }
    }
    // we exhausted word and still have not found a 1
    this._loadWord();
    return leadingZeroCount + this._skipLZ();
  }

  // ():void
  _skipUEG() {
    this._skipBits(1 + this._skipLZ());
  }

  // ():void
  _skipEG() {
    this._skipBits(1 + this._skipLZ());
  }

  // ():uint
  _readUEG() {
    var clz = this._skipLZ(); // :uint
    return this._readBits(clz + 1) - 1;
  }

  // ():int
  _readEG() {
    var valu = this._readUEG(); // :int
    if (0x01 & valu) {
      // the number is odd if the low order bit is set
      return (1 + valu) >>> 1; // add 1 to make it even, and divide by 2
    } else {
      return -1 * (valu >>> 1); // divide by two then make it negative
    }
  }

  // Some convenience functions
  // :Boolean
  _readBoolean() {
    return 1 === this._readBits(1);
  }

  // ():int
  readUByte() {
    return this._readBits(8);
  }

  // ():int
  readUShort() {
    return this._readBits(16);
  }
    // ():int
  readUInt() {
    return this._readBits(32);
  }

  /**
   * Advance the ExpGolomb decoder past a scaling list. The scaling
   * list is optionally transmitted as part of a sequence parameter
   * set and is not relevant to transmuxing.
   * @param count {number} the number of entries in this scaling list
   * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
   */
  _skipScalingList(count) {
    var
      lastScale = 8,
      nextScale = 8,
      j,
      deltaScale;
    for (j = 0; j < count; j++) {
      if (nextScale !== 0) {
        deltaScale = this._readEG();
        nextScale = (lastScale + deltaScale + 256) % 256;
      }
      lastScale = (nextScale === 0) ? lastScale : nextScale;
    }
  }

  /**
   * Read a sequence parameter set and return some interesting video
   * properties. A sequence parameter set is the H264 metadata that
   * describes the properties of upcoming video frames.
   * @param data {Uint8Array} the bytes of a sequence parameter set
   * @return {object} an object with configuration parsed from the
   * sequence parameter set, including the dimensions of the
   * associated video frames.
   */
  readSPS() {
    var
      frameCropLeftOffset = 0,
      frameCropRightOffset = 0,
      frameCropTopOffset = 0,
      frameCropBottomOffset = 0,
      profileIdc,profileCompat,levelIdc,
      numRefFramesInPicOrderCntCycle, picWidthInMbsMinus1,
      picHeightInMapUnitsMinus1,
      frameMbsOnlyFlag,
      scalingListCount,
      i,
      readBits = this._readBits.bind(this),
      readUEG = this._readUEG.bind(this),
      readBoolean = this._readBoolean.bind(this),
      skipBits = this._skipBits.bind(this),
      skipEG = this._skipEG.bind(this),
      skipUEG = this._skipUEG.bind(this),
      skipScalingList = this._skipScalingList.bind(this);

    readBits(8);
    profileIdc = readBits(8); // profile_idc
    profileCompat = readBits(5); // constraint_set[0-4]_flag, u(5)
    skipBits(3); // reserved_zero_3bits u(3),
    levelIdc = readBits(8); //level_idc u(8)
    skipUEG(); // seq_parameter_set_id
    // some profiles have more optional data we don't need
    if (profileIdc === 100 ||
        profileIdc === 110 ||
        profileIdc === 122 ||
        profileIdc === 244 ||
        profileIdc === 44  ||
        profileIdc === 83  ||
        profileIdc === 86  ||
        profileIdc === 118 ||
        profileIdc === 128) {
      var chromaFormatIdc = readUEG();
      if (chromaFormatIdc === 3) {
        skipBits(1); // separate_colour_plane_flag
      }
      skipUEG(); // bit_depth_luma_minus8
      skipUEG(); // bit_depth_chroma_minus8
      skipBits(1); // qpprime_y_zero_transform_bypass_flag
      if (readBoolean()) { // seq_scaling_matrix_present_flag
        scalingListCount = (chromaFormatIdc !== 3) ? 8 : 12;
        for (i = 0; i < scalingListCount; i++) {
          if (readBoolean()) { // seq_scaling_list_present_flag[ i ]
            if (i < 6) {
              skipScalingList(16);
            } else {
              skipScalingList(64);
            }
          }
        }
      }
    }
    skipUEG(); // log2_max_frame_num_minus4
    var picOrderCntType = readUEG();
    if (picOrderCntType === 0) {
      readUEG(); //log2_max_pic_order_cnt_lsb_minus4
    } else if (picOrderCntType === 1) {
      skipBits(1); // delta_pic_order_always_zero_flag
      skipEG(); // offset_for_non_ref_pic
      skipEG(); // offset_for_top_to_bottom_field
      numRefFramesInPicOrderCntCycle = readUEG();
      for(i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
        skipEG(); // offset_for_ref_frame[ i ]
      }
    }
    skipUEG(); // max_num_ref_frames
    skipBits(1); // gaps_in_frame_num_value_allowed_flag
    picWidthInMbsMinus1 = readUEG();
    picHeightInMapUnitsMinus1 = readUEG();
    frameMbsOnlyFlag = readBits(1);
    if (frameMbsOnlyFlag === 0) {
      skipBits(1); // mb_adaptive_frame_field_flag
    }
    skipBits(1); // direct_8x8_inference_flag
    if (readBoolean()) { // frame_cropping_flag
      frameCropLeftOffset = readUEG();
      frameCropRightOffset = readUEG();
      frameCropTopOffset = readUEG();
      frameCropBottomOffset = readUEG();
    }
    let pixelRatio = [1,1];
    if (readBoolean()) {
      // vui_parameters_present_flag
      if (readBoolean()) {
        // aspect_ratio_info_present_flag
        const aspectRatioIdc = readBits(8);
        switch (aspectRatioIdc) {
          case 1: pixelRatio = [1,1]; break;
          case 2: pixelRatio = [12,11]; break;
          case 3: pixelRatio = [10,11]; break;
          case 4: pixelRatio = [16,11]; break;
          case 5: pixelRatio = [40,33]; break;
          case 6: pixelRatio = [24,11]; break;
          case 7: pixelRatio = [20,11]; break;
          case 8: pixelRatio = [32,11]; break;
          case 9: pixelRatio = [80,33]; break;
          case 10: pixelRatio = [18,11]; break;
          case 11: pixelRatio = [15,11]; break;
          case 12: pixelRatio = [64,33]; break;
          case 13: pixelRatio = [160,99]; break;
          case 14: pixelRatio = [4,3]; break;
          case 15: pixelRatio = [3,2]; break;
          case 16: pixelRatio = [2,1]; break;
          case 255: {
            pixelRatio = [readBits(8) << 8 | readBits(8), readBits(8) << 8 | readBits(8)];
            break;
          }
        }
      }
    }
    return {
      width: Math.ceil((((picWidthInMbsMinus1 + 1) * 16) - frameCropLeftOffset * 2 - frameCropRightOffset * 2)),
      height: ((2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16) - ((frameMbsOnlyFlag? 2 : 4) * (frameCropTopOffset + frameCropBottomOffset)),
      pixelRatio : pixelRatio
    };
  }

  readSliceType() {
    // skip NALu type
    this._readBits(8);
    // discard first_mb_in_slice
    this._readUEG();
    // return slice_type
    return this._readUEG();
  }
}

export default ExpGolomb;
