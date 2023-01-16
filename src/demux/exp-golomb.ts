/**
 * Parser for exponential Golomb codes, a variable-bitwidth number encoding scheme used by h264.
 */

import { logger } from '../utils/logger';

class ExpGolomb {
  private data: Uint8Array;
  public bytesAvailable: number;
  private word: number;
  private bitsAvailable: number;

  constructor(data: Uint8Array) {
    this.data = data;
    // the number of bytes left to examine in this.data
    this.bytesAvailable = data.byteLength;
    // the current word being examined
    this.word = 0; // :uint
    // the number of bits left to examine in the current word
    this.bitsAvailable = 0; // :uint
  }

  // ():void
  loadWord(): void {
    const data = this.data;
    const bytesAvailable = this.bytesAvailable;
    const position = data.byteLength - bytesAvailable;
    const workingBytes = new Uint8Array(4);
    const availableBytes = Math.min(4, bytesAvailable);
    if (availableBytes === 0) {
      throw new Error('no bytes available');
    }

    workingBytes.set(data.subarray(position, position + availableBytes));
    this.word = new DataView(workingBytes.buffer).getUint32(0);
    // track the amount of this.data that has been processed
    this.bitsAvailable = availableBytes * 8;
    this.bytesAvailable -= availableBytes;
  }

  // (count:int):void
  skipBits(count: number): void {
    let skipBytes; // :int
    count = Math.min(count, this.bytesAvailable * 8 + this.bitsAvailable);
    if (this.bitsAvailable > count) {
      this.word <<= count;
      this.bitsAvailable -= count;
    } else {
      count -= this.bitsAvailable;
      skipBytes = count >> 3;
      count -= skipBytes << 3;
      this.bytesAvailable -= skipBytes;
      this.loadWord();
      this.word <<= count;
      this.bitsAvailable -= count;
    }
  }

  // (size:int):uint
  readBits(size: number): number {
    let bits = Math.min(this.bitsAvailable, size); // :uint
    const valu = this.word >>> (32 - bits); // :uint
    if (size > 32) {
      logger.error('Cannot read more than 32 bits at a time');
    }

    this.bitsAvailable -= bits;
    if (this.bitsAvailable > 0) {
      this.word <<= bits;
    } else if (this.bytesAvailable > 0) {
      this.loadWord();
    } else {
      throw new Error('no bits available');
    }

    bits = size - bits;
    if (bits > 0 && this.bitsAvailable) {
      return (valu << bits) | this.readBits(bits);
    } else {
      return valu;
    }
  }

  // ():uint
  skipLZ(): number {
    let leadingZeroCount; // :uint
    for (
      leadingZeroCount = 0;
      leadingZeroCount < this.bitsAvailable;
      ++leadingZeroCount
    ) {
      if ((this.word & (0x80000000 >>> leadingZeroCount)) !== 0) {
        // the first bit of working word is 1
        this.word <<= leadingZeroCount;
        this.bitsAvailable -= leadingZeroCount;
        return leadingZeroCount;
      }
    }
    // we exhausted word and still have not found a 1
    this.loadWord();
    return leadingZeroCount + this.skipLZ();
  }

  // ():void
  skipUEG(): void {
    this.skipBits(1 + this.skipLZ());
  }

  // ():void
  skipEG(): void {
    this.skipBits(1 + this.skipLZ());
  }

  // ():uint
  readUEG(): number {
    const clz = this.skipLZ(); // :uint
    return this.readBits(clz + 1) - 1;
  }

  // ():int
  readEG(): number {
    const valu = this.readUEG(); // :int
    if (0x01 & valu) {
      // the number is odd if the low order bit is set
      return (1 + valu) >>> 1; // add 1 to make it even, and divide by 2
    } else {
      return -1 * (valu >>> 1); // divide by two then make it negative
    }
  }

  // Some convenience functions
  // :Boolean
  readBoolean(): boolean {
    return this.readBits(1) === 1;
  }

  // ():int
  readUByte(): number {
    return this.readBits(8);
  }

  // ():int
  readUShort(): number {
    return this.readBits(16);
  }

  // ():int
  readUInt(): number {
    return this.readBits(32);
  }

  /**
   * Advance the ExpGolomb decoder past a scaling list. The scaling
   * list is optionally transmitted as part of a sequence parameter
   * set and is not relevant to transmuxing.
   * @param count the number of entries in this scaling list
   * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
   */
  skipScalingList(count: number): void {
    let lastScale = 8;
    let nextScale = 8;
    let deltaScale;
    for (let j = 0; j < count; j++) {
      if (nextScale !== 0) {
        deltaScale = this.readEG();
        nextScale = (lastScale + deltaScale + 256) % 256;
      }
      lastScale = nextScale === 0 ? lastScale : nextScale;
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
  readSPS(): {
    width: number;
    height: number;
    pixelRatio: [number, number];
  } {
    let frameCropLeftOffset = 0;
    let frameCropRightOffset = 0;
    let frameCropTopOffset = 0;
    let frameCropBottomOffset = 0;
    let numRefFramesInPicOrderCntCycle;
    let scalingListCount;
    let i;
    const readUByte = this.readUByte.bind(this);
    const readBits = this.readBits.bind(this);
    const readUEG = this.readUEG.bind(this);
    const readBoolean = this.readBoolean.bind(this);
    const skipBits = this.skipBits.bind(this);
    const skipEG = this.skipEG.bind(this);
    const skipUEG = this.skipUEG.bind(this);
    const skipScalingList = this.skipScalingList.bind(this);

    readUByte();
    const profileIdc = readUByte(); // profile_idc
    readBits(5); // profileCompat constraint_set[0-4]_flag, u(5)
    skipBits(3); // reserved_zero_3bits u(3),
    readUByte(); // level_idc u(8)
    skipUEG(); // seq_parameter_set_id
    // some profiles have more optional data we don't need
    if (
      profileIdc === 100 ||
      profileIdc === 110 ||
      profileIdc === 122 ||
      profileIdc === 244 ||
      profileIdc === 44 ||
      profileIdc === 83 ||
      profileIdc === 86 ||
      profileIdc === 118 ||
      profileIdc === 128
    ) {
      const chromaFormatIdc = readUEG();
      if (chromaFormatIdc === 3) {
        skipBits(1);
      } // separate_colour_plane_flag

      skipUEG(); // bit_depth_luma_minus8
      skipUEG(); // bit_depth_chroma_minus8
      skipBits(1); // qpprime_y_zero_transform_bypass_flag
      if (readBoolean()) {
        // seq_scaling_matrix_present_flag
        scalingListCount = chromaFormatIdc !== 3 ? 8 : 12;
        for (i = 0; i < scalingListCount; i++) {
          if (readBoolean()) {
            // seq_scaling_list_present_flag[ i ]
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
    const picOrderCntType = readUEG();
    if (picOrderCntType === 0) {
      readUEG(); // log2_max_pic_order_cnt_lsb_minus4
    } else if (picOrderCntType === 1) {
      skipBits(1); // delta_pic_order_always_zero_flag
      skipEG(); // offset_for_non_ref_pic
      skipEG(); // offset_for_top_to_bottom_field
      numRefFramesInPicOrderCntCycle = readUEG();
      for (i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
        skipEG();
      } // offset_for_ref_frame[ i ]
    }
    skipUEG(); // max_num_ref_frames
    skipBits(1); // gaps_in_frame_num_value_allowed_flag
    const picWidthInMbsMinus1 = readUEG();
    const picHeightInMapUnitsMinus1 = readUEG();
    const frameMbsOnlyFlag = readBits(1);
    if (frameMbsOnlyFlag === 0) {
      skipBits(1);
    } // mb_adaptive_frame_field_flag

    skipBits(1); // direct_8x8_inference_flag
    if (readBoolean()) {
      // frame_cropping_flag
      frameCropLeftOffset = readUEG();
      frameCropRightOffset = readUEG();
      frameCropTopOffset = readUEG();
      frameCropBottomOffset = readUEG();
    }
    let pixelRatio: [number, number] = [1, 1];
    if (readBoolean()) {
      // vui_parameters_present_flag
      if (readBoolean()) {
        // aspect_ratio_info_present_flag
        const aspectRatioIdc = readUByte();
        switch (aspectRatioIdc) {
          case 1:
            pixelRatio = [1, 1];
            break;
          case 2:
            pixelRatio = [12, 11];
            break;
          case 3:
            pixelRatio = [10, 11];
            break;
          case 4:
            pixelRatio = [16, 11];
            break;
          case 5:
            pixelRatio = [40, 33];
            break;
          case 6:
            pixelRatio = [24, 11];
            break;
          case 7:
            pixelRatio = [20, 11];
            break;
          case 8:
            pixelRatio = [32, 11];
            break;
          case 9:
            pixelRatio = [80, 33];
            break;
          case 10:
            pixelRatio = [18, 11];
            break;
          case 11:
            pixelRatio = [15, 11];
            break;
          case 12:
            pixelRatio = [64, 33];
            break;
          case 13:
            pixelRatio = [160, 99];
            break;
          case 14:
            pixelRatio = [4, 3];
            break;
          case 15:
            pixelRatio = [3, 2];
            break;
          case 16:
            pixelRatio = [2, 1];
            break;
          case 255: {
            pixelRatio = [
              (readUByte() << 8) | readUByte(),
              (readUByte() << 8) | readUByte(),
            ];
            break;
          }
        }
      }
    }
    return {
      width: Math.ceil(
        (picWidthInMbsMinus1 + 1) * 16 -
          frameCropLeftOffset * 2 -
          frameCropRightOffset * 2
      ),
      height:
        (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16 -
        (frameMbsOnlyFlag ? 2 : 4) *
          (frameCropTopOffset + frameCropBottomOffset),
      pixelRatio: pixelRatio,
    };
  }

  readSliceType() {
    // skip NALu type
    this.readUByte();
    // discard first_mb_in_slice
    this.readUEG();
    // return slice_type
    return this.readUEG();
  }
}

export default ExpGolomb;
