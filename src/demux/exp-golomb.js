/**
 * Parser for exponential Golomb codes, a variable-bitwidth number encoding
 * scheme used by h264.
 */


class ExpGolomb {

  constructor(workingData) {
    this.workingData = workingData;
    // the number of bytes left to examine in this.workingData
    this.workingBytesAvailable = this.workingData.byteLength;
    // the current word being examined
    this.workingWord = 0; // :uint
    // the number of bits left to examine in the current word
    this.workingBitsAvailable = 0; // :uint
  }

  // ():void
  loadWord() {
    var
      position = this.workingData.byteLength - this.workingBytesAvailable,
      workingBytes = new Uint8Array(4),
      availableBytes = Math.min(4, this.workingBytesAvailable);

    if (availableBytes === 0) {
      throw new Error('no bytes available');
    }

    workingBytes.set(this.workingData.subarray(position,
                                          position + availableBytes));
    this.workingWord = new DataView(workingBytes.buffer).getUint32(0);

    // track the amount of this.workingData that has been processed
    this.workingBitsAvailable = availableBytes * 8;
    this.workingBytesAvailable -= availableBytes;
  }

  // (count:int):void
  skipBits(count) {
    var skipBytes; // :int
    if (this.workingBitsAvailable > count) {
      this.workingWord          <<= count;
      this.workingBitsAvailable -= count;
    } else {
      count -= this.workingBitsAvailable;
      skipBytes = count / 8;

      count -= (skipBytes * 8);
      this.workingBytesAvailable -= skipBytes;

      this.loadWord();

      this.workingWord <<= count;
      this.workingBitsAvailable -= count;
    }
  }

  // (size:int):uint
  readBits(size) {
    var
      bits = Math.min(this.workingBitsAvailable, size), // :uint
      valu = this.workingWord >>> (32 - bits); // :uint

    console.assert(size < 32, 'Cannot read more than 32 bits at a time');

    this.workingBitsAvailable -= bits;
    if (this.workingBitsAvailable > 0) {
      this.workingWord <<= bits;
    } else if (this.workingBytesAvailable > 0) {
      this.loadWord();
    }

    bits = size - bits;
    if (bits > 0) {
      return valu << bits | this.readBits(bits);
    } else {
      return valu;
    }
  }

  // ():uint
  skipLeadingZeros() {
    var leadingZeroCount; // :uint
    for (leadingZeroCount = 0 ; leadingZeroCount < this.workingBitsAvailable ; ++leadingZeroCount) {
      if (0 !== (this.workingWord & (0x80000000 >>> leadingZeroCount))) {
        // the first bit of working word is 1
        this.workingWord <<= leadingZeroCount;
        this.workingBitsAvailable -= leadingZeroCount;
        return leadingZeroCount;
      }
    }

    // we exhausted workingWord and still have not found a 1
    this.loadWord();
    return leadingZeroCount + this.skipLeadingZeros();
  }

  // ():void
  skipUnsignedExpGolomb() {
    this.skipBits(1 + this.skipLeadingZeros());
  }

  // ():void
  skipExpGolomb() {
    this.skipBits(1 + this.skipLeadingZeros());
  }

  // ():uint
  readUnsignedExpGolomb() {
    var clz = this.skipLeadingZeros(); // :uint
    return this.readBits(clz + 1) - 1;
  }

  // ():int
  readExpGolomb() {
    var valu = this.readUnsignedExpGolomb(); // :int
    if (0x01 & valu) {
      // the number is odd if the low order bit is set
      return (1 + valu) >>> 1; // add 1 to make it even, and divide by 2
    } else {
      return -1 * (valu >>> 1); // divide by two then make it negative
    }
  }

  // Some convenience functions
  // :Boolean
  readBoolean() {
    return 1 === this.readBits(1);
  }

  // ():int
  readUnsignedByte() {
    return this.readBits(8);
  }

  /**
   * Advance the ExpGolomb decoder past a scaling list. The scaling
   * list is optionally transmitted as part of a sequence parameter
   * set and is not relevant to transmuxing.
   * @param count {number} the number of entries in this scaling list
   * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
   */
  skipScalingList(count) {
    var
      lastScale = 8,
      nextScale = 8,
      j,
      deltaScale;

    for (j = 0; j < count; j++) {
      if (nextScale !== 0) {
        deltaScale = this.readExpGolomb();
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
  readSequenceParameterSet() {
    var
      frameCropLeftOffset = 0,
      frameCropRightOffset = 0,
      frameCropTopOffset = 0,
      frameCropBottomOffset = 0,
      profileIdc, levelIdc, profileCompatibility,
      chromaFormatIdc, picOrderCntType,
      numRefFramesInPicOrderCntCycle, picWidthInMbsMinus1,
      picHeightInMapUnitsMinus1,
      frameMbsOnlyFlag,
      scalingListCount,
      i;

    profileIdc = this.readUnsignedByte(); // profile_idc
    profileCompatibility = this.readBits(5); // constraint_set[0-5]_flag
    this.skipBits(3); //  u(1), reserved_zero_2bits u(2)
    levelIdc = this.readUnsignedByte(); // level_idc u(8)
    this.skipUnsignedExpGolomb(); // seq_parameter_set_id

    // some profiles have more optional data we don't need
    if (profileIdc === 100 ||
        profileIdc === 110 ||
        profileIdc === 122 ||
        profileIdc === 244 ||
        profileIdc === 44 ||
        profileIdc === 83 ||
        profileIdc === 86 ||
        profileIdc === 118 ||
        profileIdc === 128) {
      chromaFormatIdc = this.readUnsignedExpGolomb();
      if (chromaFormatIdc === 3) {
        this.skipBits(1); // separate_colour_plane_flag
      }
      this.skipUnsignedExpGolomb(); // bit_depth_luma_minus8
      this.skipUnsignedExpGolomb(); // bit_depth_chroma_minus8
      this.skipBits(1); // qpprime_y_zero_transform_bypass_flag
      if (this.readBoolean()) { // seq_scaling_matrix_present_flag
        scalingListCount = (chromaFormatIdc !== 3) ? 8 : 12;
        for (i = 0; i < scalingListCount; i++) {
          if (this.readBoolean()) { // seq_scaling_list_present_flag[ i ]
            if (i < 6) {
              this.skipScalingList(16);
            } else {
              this.skipScalingList(64);
            }
          }
        }
      }
    }

    this.skipUnsignedExpGolomb(); // log2_max_frame_num_minus4
    picOrderCntType = this.readUnsignedExpGolomb();

    if (picOrderCntType === 0) {
      this.readUnsignedExpGolomb(); //log2_max_pic_order_cnt_lsb_minus4
    } else if (picOrderCntType === 1) {
      this.skipBits(1); // delta_pic_order_always_zero_flag
      this.skipExpGolomb(); // offset_for_non_ref_pic
      this.skipExpGolomb(); // offset_for_top_to_bottom_field
      numRefFramesInPicOrderCntCycle = this.readUnsignedExpGolomb();
      for(i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
        this.skipExpGolomb(); // offset_for_ref_frame[ i ]
      }
    }

    this.skipUnsignedExpGolomb(); // max_num_ref_frames
    this.skipBits(1); // gaps_in_frame_num_value_allowed_flag

    picWidthInMbsMinus1 = this.readUnsignedExpGolomb();
    picHeightInMapUnitsMinus1 = this.readUnsignedExpGolomb();

    frameMbsOnlyFlag = this.readBits(1);
    if (frameMbsOnlyFlag === 0) {
      this.skipBits(1); // mb_adaptive_frame_field_flag
    }

    this.skipBits(1); // direct_8x8_inference_flag
    if (this.readBoolean()) { // frame_cropping_flag
      frameCropLeftOffset = this.readUnsignedExpGolomb();
      frameCropRightOffset = this.readUnsignedExpGolomb();
      frameCropTopOffset = this.readUnsignedExpGolomb();
      frameCropBottomOffset = this.readUnsignedExpGolomb();
    }

    return {
      profileIdc: profileIdc,
      levelIdc: levelIdc,
      profileCompatibility: profileCompatibility,
      width: ((picWidthInMbsMinus1 + 1) * 16) - frameCropLeftOffset * 2 - frameCropRightOffset * 2,
      height: ((2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16) - (frameCropTopOffset * 2) - (frameCropBottomOffset * 2)
    };
  }
}

export default ExpGolomb;
