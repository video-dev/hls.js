/**
 * Parser for exponential Golomb codes, a variable-bitwidth number encoding
 * scheme used by h264.
 */
 (function() {
  'use strict';
  hls.ExpGolomb = function(workingData) {
  var
    // the number of bytes left to examine in workingData
    workingBytesAvailable = workingData.byteLength,

    // the current word being examined
    workingWord = 0, // :uint

    // the number of bits left to examine in the current word
    workingBitsAvailable = 0; // :uint;

  // ():uint
  function length() {
    return (8 * workingBytesAvailable);
  };

  // ():uint
  function bitsAvailable() {
    return (8 * workingBytesAvailable) + workingBitsAvailable;
  };

  // ():void
  function loadWord() {
    var
      position = workingData.byteLength - workingBytesAvailable,
      workingBytes = new Uint8Array(4),
      availableBytes = Math.min(4, workingBytesAvailable);

    if (availableBytes === 0) {
      throw new Error('no bytes available');
    }

    workingBytes.set(workingData.subarray(position,
                                          position + availableBytes));
    workingWord = new DataView(workingBytes.buffer).getUint32(0);

    // track the amount of workingData that has been processed
    workingBitsAvailable = availableBytes * 8;
    workingBytesAvailable -= availableBytes;
  };

  // (count:int):void
  function skipBits(count) {
    var skipBytes; // :int
    if (workingBitsAvailable > count) {
      workingWord          <<= count;
      workingBitsAvailable -= count;
    } else {
      count -= workingBitsAvailable;
      skipBytes = count / 8;

      count -= (skipBytes * 8);
      workingBytesAvailable -= skipBytes;

      loadWord();

      workingWord <<= count;
      workingBitsAvailable -= count;
    }
  };

  // (size:int):uint
  function readBits(size) {
    var
      bits = Math.min(workingBitsAvailable, size), // :uint
      valu = workingWord >>> (32 - bits); // :uint

    console.assert(size < 32, 'Cannot read more than 32 bits at a time');

    workingBitsAvailable -= bits;
    if (workingBitsAvailable > 0) {
      workingWord <<= bits;
    } else if (workingBytesAvailable > 0) {
      loadWord();
    }

    bits = size - bits;
    if (bits > 0) {
      return valu << bits | readBits(bits);
    } else {
      return valu;
    }
  };

  // ():uint
  function skipLeadingZeros() {
    var leadingZeroCount; // :uint
    for (leadingZeroCount = 0 ; leadingZeroCount < workingBitsAvailable ; ++leadingZeroCount) {
      if (0 !== (workingWord & (0x80000000 >>> leadingZeroCount))) {
        // the first bit of working word is 1
        workingWord <<= leadingZeroCount;
        workingBitsAvailable -= leadingZeroCount;
        return leadingZeroCount;
      }
    }

    // we exhausted workingWord and still have not found a 1
    loadWord();
    return leadingZeroCount + skipLeadingZeros();
  };

  // ():void
  function skipUnsignedExpGolomb() {
    skipBits(1 + skipLeadingZeros());
  };

  // ():void
  function skipExpGolomb() {
    skipBits(1 + skipLeadingZeros());
  };

  // ():uint
  function readUnsignedExpGolomb() {
    var clz = skipLeadingZeros(); // :uint
    return readBits(clz + 1) - 1;
  };

  // ():int
  function readExpGolomb() {
    var valu = readUnsignedExpGolomb(); // :int
    if (0x01 & valu) {
      // the number is odd if the low order bit is set
      return (1 + valu) >>> 1; // add 1 to make it even, and divide by 2
    } else {
      return -1 * (valu >>> 1); // divide by two then make it negative
    }
  };

  // Some convenience functions
  // :Boolean
  function readBoolean() {
    return 1 === readBits(1);
  };

  // ():int
  function readUnsignedByte() {
    return readBits(8);
  };

  /**
   * Advance the ExpGolomb decoder past a scaling list. The scaling
   * list is optionally transmitted as part of a sequence parameter
   * set and is not relevant to transmuxing.
   * @param count {number} the number of entries in this scaling list
   * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
   */
  function skipScalingList(count) {
    var
      lastScale = 8,
      nextScale = 8,
      j,
      deltaScale;

    for (j = 0; j < count; j++) {
      if (nextScale !== 0) {
        deltaScale = readExpGolomb();
        nextScale = (lastScale + deltaScale + 256) % 256;
      }

      lastScale = (nextScale === 0) ? lastScale : nextScale;
    }
  };

  /**
   * Read a sequence parameter set and return some interesting video
   * properties. A sequence parameter set is the H264 metadata that
   * describes the properties of upcoming video frames.
   * @param data {Uint8Array} the bytes of a sequence parameter set
   * @return {object} an object with configuration parsed from the
   * sequence parameter set, including the dimensions of the
   * associated video frames.
   */
  this.readSequenceParameterSet = function() {
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

    profileIdc = readUnsignedByte(); // profile_idc
    profileCompatibility = readBits(5); // constraint_set[0-5]_flag
    skipBits(3); //  u(1), reserved_zero_2bits u(2)
    levelIdc = readUnsignedByte(); // level_idc u(8)
    skipUnsignedExpGolomb(); // seq_parameter_set_id

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
      chromaFormatIdc = readUnsignedExpGolomb();
      if (chromaFormatIdc === 3) {
        skipBits(1); // separate_colour_plane_flag
      }
      skipUnsignedExpGolomb(); // bit_depth_luma_minus8
      skipUnsignedExpGolomb(); // bit_depth_chroma_minus8
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

    skipUnsignedExpGolomb(); // log2_max_frame_num_minus4
    picOrderCntType = readUnsignedExpGolomb();

    if (picOrderCntType === 0) {
      readUnsignedExpGolomb(); //log2_max_pic_order_cnt_lsb_minus4
    } else if (picOrderCntType === 1) {
      skipBits(1); // delta_pic_order_always_zero_flag
      skipExpGolomb(); // offset_for_non_ref_pic
      skipExpGolomb(); // offset_for_top_to_bottom_field
      numRefFramesInPicOrderCntCycle = readUnsignedExpGolomb();
      for(i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
        skipExpGolomb(); // offset_for_ref_frame[ i ]
      }
    }

    skipUnsignedExpGolomb(); // max_num_ref_frames
    skipBits(1); // gaps_in_frame_num_value_allowed_flag

    picWidthInMbsMinus1 = readUnsignedExpGolomb();
    picHeightInMapUnitsMinus1 = readUnsignedExpGolomb();

    frameMbsOnlyFlag = readBits(1);
    if (frameMbsOnlyFlag === 0) {
      skipBits(1); // mb_adaptive_frame_field_flag
    }

    skipBits(1); // direct_8x8_inference_flag
    if (readBoolean()) { // frame_cropping_flag
      frameCropLeftOffset = readUnsignedExpGolomb();
      frameCropRightOffset = readUnsignedExpGolomb();
      frameCropTopOffset = readUnsignedExpGolomb();
      frameCropBottomOffset = readUnsignedExpGolomb();
    }

    return {
      profileIdc: profileIdc,
      levelIdc: levelIdc,
      profileCompatibility: profileCompatibility,
      width: ((picWidthInMbsMinus1 + 1) * 16) - frameCropLeftOffset * 2 - frameCropRightOffset * 2,
      height: ((2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16) - (frameCropTopOffset * 2) - (frameCropBottomOffset * 2)
    };
  };
};
})(this);
