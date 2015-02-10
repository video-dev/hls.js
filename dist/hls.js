!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.hls=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/Users/g.dupontavice/workdir/github/mse-hls/src/demux/exp-golomb.js":[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

/**
 * Parser for exponential Golomb codes, a variable-bitwidth number encoding
 * scheme used by h264.
 */


var ExpGolomb = (function () {
  function ExpGolomb(workingData) {
    this.workingData = workingData;
    // the number of bytes left to examine in this.workingData
    this.workingBytesAvailable = this.workingData.byteLength;
    // the current word being examined
    this.workingWord = 0; // :uint
    // the number of bits left to examine in the current word
    this.workingBitsAvailable = 0; // :uint
  }

  _prototypeProperties(ExpGolomb, null, {
    loadWord: {

      // ():void
      value: function loadWord() {
        var position = this.workingData.byteLength - this.workingBytesAvailable,
            workingBytes = new Uint8Array(4),
            availableBytes = Math.min(4, this.workingBytesAvailable);

        if (availableBytes === 0) {
          throw new Error("no bytes available");
        }

        workingBytes.set(this.workingData.subarray(position, position + availableBytes));
        this.workingWord = new DataView(workingBytes.buffer).getUint32(0);

        // track the amount of this.workingData that has been processed
        this.workingBitsAvailable = availableBytes * 8;
        this.workingBytesAvailable -= availableBytes;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    skipBits: {

      // (count:int):void
      value: function skipBits(count) {
        var skipBytes; // :int
        if (this.workingBitsAvailable > count) {
          this.workingWord <<= count;
          this.workingBitsAvailable -= count;
        } else {
          count -= this.workingBitsAvailable;
          skipBytes = count / 8;

          count -= skipBytes * 8;
          this.workingBytesAvailable -= skipBytes;

          this.loadWord();

          this.workingWord <<= count;
          this.workingBitsAvailable -= count;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readBits: {

      // (size:int):uint
      value: function readBits(size) {
        var bits = Math.min(this.workingBitsAvailable, size),
            // :uint
        valu = this.workingWord >>> 32 - bits; // :uint

        console.assert(size < 32, "Cannot read more than 32 bits at a time");

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
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    skipLeadingZeros: {

      // ():uint
      value: function skipLeadingZeros() {
        var leadingZeroCount; // :uint
        for (leadingZeroCount = 0; leadingZeroCount < this.workingBitsAvailable; ++leadingZeroCount) {
          if (0 !== (this.workingWord & 2147483648 >>> leadingZeroCount)) {
            // the first bit of working word is 1
            this.workingWord <<= leadingZeroCount;
            this.workingBitsAvailable -= leadingZeroCount;
            return leadingZeroCount;
          }
        }

        // we exhausted workingWord and still have not found a 1
        this.loadWord();
        return leadingZeroCount + this.skipLeadingZeros();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    skipUnsignedExpGolomb: {

      // ():void
      value: function skipUnsignedExpGolomb() {
        this.skipBits(1 + this.skipLeadingZeros());
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    skipExpGolomb: {

      // ():void
      value: function skipExpGolomb() {
        this.skipBits(1 + this.skipLeadingZeros());
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readUnsignedExpGolomb: {

      // ():uint
      value: function readUnsignedExpGolomb() {
        var clz = this.skipLeadingZeros(); // :uint
        return this.readBits(clz + 1) - 1;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readExpGolomb: {

      // ():int
      value: function readExpGolomb() {
        var valu = this.readUnsignedExpGolomb(); // :int
        if (1 & valu) {
          // the number is odd if the low order bit is set
          return 1 + valu >>> 1; // add 1 to make it even, and divide by 2
        } else {
          return -1 * (valu >>> 1); // divide by two then make it negative
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readBoolean: {

      // Some convenience functions
      // :Boolean
      value: function readBoolean() {
        return 1 === this.readBits(1);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readUnsignedByte: {

      // ():int
      value: function readUnsignedByte() {
        return this.readBits(8);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    skipScalingList: {

      /**
       * Advance the ExpGolomb decoder past a scaling list. The scaling
       * list is optionally transmitted as part of a sequence parameter
       * set and is not relevant to transmuxing.
       * @param count {number} the number of entries in this scaling list
       * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
       */
      value: function skipScalingList(count) {
        var lastScale = 8,
            nextScale = 8,
            j,
            deltaScale;

        for (j = 0; j < count; j++) {
          if (nextScale !== 0) {
            deltaScale = this.readExpGolomb();
            nextScale = (lastScale + deltaScale + 256) % 256;
          }

          lastScale = nextScale === 0 ? lastScale : nextScale;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    readSequenceParameterSet: {

      /**
       * Read a sequence parameter set and return some interesting video
       * properties. A sequence parameter set is the H264 metadata that
       * describes the properties of upcoming video frames.
       * @param data {Uint8Array} the bytes of a sequence parameter set
       * @return {object} an object with configuration parsed from the
       * sequence parameter set, including the dimensions of the
       * associated video frames.
       */
      value: function readSequenceParameterSet() {
        var frameCropLeftOffset = 0,
            frameCropRightOffset = 0,
            frameCropTopOffset = 0,
            frameCropBottomOffset = 0,
            profileIdc,
            levelIdc,
            profileCompatibility,
            chromaFormatIdc,
            picOrderCntType,
            numRefFramesInPicOrderCntCycle,
            picWidthInMbsMinus1,
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
        if (profileIdc === 100 || profileIdc === 110 || profileIdc === 122 || profileIdc === 244 || profileIdc === 44 || profileIdc === 83 || profileIdc === 86 || profileIdc === 118 || profileIdc === 128) {
          chromaFormatIdc = this.readUnsignedExpGolomb();
          if (chromaFormatIdc === 3) {
            this.skipBits(1); // separate_colour_plane_flag
          }
          this.skipUnsignedExpGolomb(); // bit_depth_luma_minus8
          this.skipUnsignedExpGolomb(); // bit_depth_chroma_minus8
          this.skipBits(1); // qpprime_y_zero_transform_bypass_flag
          if (this.readBoolean()) {
            // seq_scaling_matrix_present_flag
            scalingListCount = chromaFormatIdc !== 3 ? 8 : 12;
            for (i = 0; i < scalingListCount; i++) {
              if (this.readBoolean()) {
                // seq_scaling_list_present_flag[ i ]
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
          for (i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
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
        if (this.readBoolean()) {
          // frame_cropping_flag
          frameCropLeftOffset = this.readUnsignedExpGolomb();
          frameCropRightOffset = this.readUnsignedExpGolomb();
          frameCropTopOffset = this.readUnsignedExpGolomb();
          frameCropBottomOffset = this.readUnsignedExpGolomb();
        }

        return {
          profileIdc: profileIdc,
          levelIdc: levelIdc,
          profileCompatibility: profileCompatibility,
          width: (picWidthInMbsMinus1 + 1) * 16 - frameCropLeftOffset * 2 - frameCropRightOffset * 2,
          height: (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16 - frameCropTopOffset * 2 - frameCropBottomOffset * 2
        };
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return ExpGolomb;
})();

module.exports = ExpGolomb;

},{}],"/Users/g.dupontavice/workdir/github/mse-hls/src/demux/tsdemuxer.js":[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _get = function get(object, property, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    return desc.value;
  } else {
    var getter = desc.get;
    if (getter === undefined) {
      return undefined;
    }
    return getter.call(receiver);
  }
};

var _inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) subClass.__proto__ = superClass;
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

/**
 * A stream-based mp2ts to mp4 converter. This utility is used to
 * deliver mp4s to a SourceBuffer on platforms that support native
 * Media Source Extensions.
 */

var ExpGolomb = _interopRequire(require("./exp-golomb"));

var Stream = _interopRequire(require("../utils/stream"));

var MP4 = _interopRequire(require("../remux/mp4-generator"));

var MP2T_PACKET_LENGTH = 188; // bytes
var H264_STREAM_TYPE = 27;
var ADTS_STREAM_TYPE = 15;
var PAT_PID = 0;

/**
 * Splits an incoming stream of binary data into MPEG-2 Transport
 * Stream packets.
 */
var TransportPacketStream = (function (Stream) {
  function TransportPacketStream() {
    _get(Object.getPrototypeOf(TransportPacketStream.prototype), "constructor", this).call(this);
    this.buffer = new Uint8Array(MP2T_PACKET_LENGTH);
    this.end = 0;
  }

  _inherits(TransportPacketStream, Stream);

  _prototypeProperties(TransportPacketStream, null, {
    push: {
      value: function push(bytes) {
        var remaining, i;

        // clear out any partial packets in the buffer
        if (this.end > 0) {
          remaining = MP2T_PACKET_LENGTH - this.end;
          this.buffer.set(bytes.subarray(0, remaining), this.end);

          // we still didn't write out a complete packet
          if (bytes.byteLength < remaining) {
            this.end += bytes.byteLength;
            return;
          }

          bytes = bytes.subarray(remaining);
          this.end = 0;
          _get(Object.getPrototypeOf(TransportPacketStream.prototype), "trigger", this).call(this, "data", buffer);
        }

        // if less than a single packet is available, buffer it up for later
        if (bytes.byteLength < MP2T_PACKET_LENGTH) {
          this.buffer.set(bytes.subarray(i), this.end);
          this.end += bytes.byteLength;
          return;
        }
        // parse out all the completed packets
        i = 0;
        do {
          this.trigger("data", bytes.subarray(i, i + MP2T_PACKET_LENGTH));
          i += MP2T_PACKET_LENGTH;
          remaining = bytes.byteLength - i;
        } while (i < bytes.byteLength && remaining >= MP2T_PACKET_LENGTH);
        // buffer any partial packets left over
        if (remaining > 0) {
          this.buffer.set(bytes.subarray(i));
          this.end = remaining;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return TransportPacketStream;
})(Stream);

;

/**
 * Accepts an MP2T TransportPacketStream and emits data events with parsed
 * forms of the individual transport stream packets.
 */
var TransportParseStream = (function (Stream) {
  function TransportParseStream() {
    _get(Object.getPrototypeOf(TransportParseStream.prototype), "constructor", this).call(this);
    this.programMapTable = {};
  }

  _inherits(TransportParseStream, Stream);

  _prototypeProperties(TransportParseStream, null, {
    parsePsi: {
      value: function parsePsi(payload, psi) {
        var offset = 0;
        // PSI packets may be split into multiple sections and those
        // sections may be split into multiple packets. If a PSI
        // section starts in this packet, the payload_unit_start_indicator
        // will be true and the first byte of the payload will indicate
        // the offset from the current position to the start of the
        // section.
        if (psi.payloadUnitStartIndicator) {
          offset += payload[offset] + 1;
        }

        if (psi.type === "pat") {
          this.parsePat(payload.subarray(offset), psi);
        } else {
          this.parsePmt(payload.subarray(offset), psi);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    parsePat: {
      value: function parsePat(payload, pat) {
        pat.section_number = payload[7];
        pat.last_section_number = payload[8];

        // skip the PSI header and parse the first PMT entry
        pat.pmtPid = this.pmtPid = (payload[10] & 31) << 8 | payload[11];
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    parsePmt: {

      /**
       * Parse out the relevant fields of a Program Map Table (PMT).
       * @param payload {Uint8Array} the PMT-specific portion of an MP2T
       * packet. The first byte in this array should be the table_id
       * field.
       * @param pmt {object} the object that should be decorated with
       * fields parsed from the PMT.
       */
      value: function parsePmt(payload, pmt) {
        var sectionLength, tableEnd, programInfoLength, offset;

        // PMTs can be sent ahead of the time when they should actually
        // take effect. We don't believe this should ever be the case
        // for HLS but we'll ignore "forward" PMT declarations if we see
        // them. Future PMT declarations have the current_next_indicator
        // set to zero.
        if (!(payload[5] & 1)) {
          return;
        }

        // overwrite any existing program map table
        this.programMapTable = {};

        // the mapping table ends at the end of the current section
        sectionLength = (payload[1] & 15) << 8 | payload[2];
        tableEnd = 3 + sectionLength - 4;

        // to determine where the table is, we have to figure out how
        // long the program info descriptors are
        programInfoLength = (payload[10] & 15) << 8 | payload[11];

        // advance the offset to the first entry in the mapping table
        offset = 12 + programInfoLength;
        while (offset < tableEnd) {
          // add an entry that maps the elementary_pid to the stream_type
          this.programMapTable[(payload[offset + 1] & 31) << 8 | payload[offset + 2]] = payload[offset];

          // move to the next table entry
          // skip past the elementary stream descriptors, if present
          offset += ((payload[offset + 3] & 15) << 8 | payload[offset + 4]) + 5;
        }

        // record the map on the packet as well
        pmt.programMapTable = this.programMapTable;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    parsePes: {
      value: function parsePes(payload, pes) {
        var ptsDtsFlags;

        if (!pes.payloadUnitStartIndicator) {
          pes.data = payload;
          return;
        }

        // find out if this packets starts a new keyframe
        pes.dataAlignmentIndicator = (payload[6] & 4) !== 0;
        // PES packets may be annotated with a PTS value, or a PTS value
        // and a DTS value. Determine what combination of values is
        // available to work with.
        ptsDtsFlags = payload[7];

        // PTS and DTS are normally stored as a 33-bit number.  Javascript
        // performs all bitwise operations on 32-bit integers but it's
        // convenient to convert from 90ns to 1ms time scale anyway. So
        // what we are going to do instead is drop the least significant
        // bit (in effect, dividing by two) then we can divide by 45 (45 *
        // 2 = 90) to get ms.
        if (ptsDtsFlags & 192) {
          // the PTS and DTS are not written out directly. For information
          // on how they are encoded, see
          // http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
          pes.pts = (payload[9] & 14) << 28 | (payload[10] & 255) << 21 | (payload[11] & 254) << 13 | (payload[12] & 255) << 6 | (payload[13] & 254) >>> 2;
          pes.pts /= 45;
          pes.dts = pes.pts;
          if (ptsDtsFlags & 64) {
            pes.dts = (payload[14] & 14) << 28 | (payload[15] & 255) << 21 | (payload[16] & 254) << 13 | (payload[17] & 255) << 6 | (payload[18] & 254) >>> 2;
            pes.dts /= 45;
          }
        }

        // the data section starts immediately after the PES header.
        // pes_header_data_length specifies the number of header bytes
        // that follow the last byte of the field.
        pes.data = payload.subarray(9 + payload[8]);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    push: {

      /**
       * Deliver a new MP2T packet to the stream.
       */
      value: function push(packet) {
        var result = {},
            offset = 4;
        // make sure packet is aligned on a sync byte
        if (packet[0] !== 71) {
          return this.trigger("error", "mis-aligned packet");
        }
        result.payloadUnitStartIndicator = !!(packet[1] & 64);

        // pid is a 13-bit field starting at the last bit of packet[1]
        result.pid = packet[1] & 31;
        result.pid <<= 8;
        result.pid |= packet[2];

        // if an adaption field is present, its length is specified by the
        // fifth byte of the TS packet header. The adaptation field is
        // used to add stuffing to PES packets that don't fill a complete
        // TS packet, and to specify some forms of timing and control data
        // that we do not currently use.
        if ((packet[3] & 48) >>> 4 > 1) {
          offset += packet[offset] + 1;
        }

        // parse the rest of the packet based on the type
        if (result.pid === PAT_PID) {
          result.type = "pat";
          this.parsePsi(packet.subarray(offset), result);
        } else if (result.pid === this.pmtPid) {
          result.type = "pmt";
          this.parsePsi(packet.subarray(offset), result);
        } else {
          result.streamType = this.programMapTable[result.pid];
          if (result.streamType == undefined) {
            return;
          } else {
            result.type = "pes";
            this.parsePes(packet.subarray(offset), result);
          }
        }

        this.trigger("data", result);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return TransportParseStream;
})(Stream);

;

/**
 * Reconsistutes program elementary stream (PES) packets from parsed
 * transport stream packets. That is, if you pipe an
 * mp2t.TransportParseStream into a mp2t.ElementaryStream, the output
 * events will be events which capture the bytes for individual PES
 * packets plus relevant metadata that has been extracted from the
 * container.
 */
var ElementaryStream = (function (Stream) {
  function ElementaryStream() {
    _get(Object.getPrototypeOf(ElementaryStream.prototype), "constructor", this).call(this);
    this.audio = { data: [], size: 0 };
    this.video = { data: [], size: 0 };
  }

  _inherits(ElementaryStream, Stream);

  _prototypeProperties(ElementaryStream, null, {
    flushStream: {
      value: function flushStream(stream, type) {
        var event = {
          type: type,
          data: new Uint8Array(stream.size) },
            i = 0,
            fragment;

        // do nothing if there is no buffered data
        if (!stream.data.length) {
          return;
        }
        event.trackId = stream.data[0].pid;
        event.pts = stream.data[0].pts;
        event.dts = stream.data[0].dts;
        //if(type == 'audio') {
        //console.log("PES audio size/PTS:" + stream.size + "/" + event.pts);
        //}
        // reassemble the packet
        while (stream.data.length) {
          fragment = stream.data.shift();

          event.data.set(fragment.data, i);
          i += fragment.data.byteLength;
        }
        stream.size = 0;
        this.trigger("data", event);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    push: {
      value: function push(data) {
        switch (data.type) {
          case "pat":
            // we have to wait for the PMT to arrive as well before we
            // have any meaningful metadata
            break;
          case "pmt":
            var event = {
              type: "metadata",
              tracks: []
            },
                programMapTable = data.programMapTable,
                k,
                track;

            // translate streams to tracks
            for (k in programMapTable) {
              if (programMapTable.hasOwnProperty(k)) {
                track = {};
                track.id = +k;
                if (programMapTable[k] === H264_STREAM_TYPE) {
                  track.codec = "avc";
                  track.type = "video";
                } else if (programMapTable[k] === ADTS_STREAM_TYPE) {
                  track.codec = "adts";
                  track.type = "audio";
                }
                event.tracks.push(track);
              }
            }
            this.trigger("data", event);
            break;
          case "pes":
            var stream, streamType;

            if (data.streamType === H264_STREAM_TYPE) {
              stream = this.video;
              streamType = "video";
            } else {
              stream = this.audio;
              streamType = "audio";
            }

            // if a new packet is starting, we can flush the completed
            // packet
            if (data.payloadUnitStartIndicator) {
              this.flushStream(stream, streamType);
            }
            // buffer this fragment until we are sure we've received the
            // complete payload
            stream.data.push(data);
            stream.size += data.data.byteLength;
            break;
          default:
            break;
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    end: {
      /**
       * Flush any remaining input. Video PES packets may be of variable
       * length. Normally, the start of a new video packet can trigger the
       * finalization of the previous packet. That is not possible if no
       * more video is forthcoming, however. In that case, some other
       * mechanism (like the end of the file) has to be employed. When it is
       * clear that no additional data is forthcoming, calling this method
       * will flush the buffered packets.
       */
      value: function end() {
        this.flushStream(this.video, "video");
        this.flushStream(this.audio, "audio");
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return ElementaryStream;
})(Stream);

;
/*
 * Accepts a ElementaryStream and emits data events with parsed
 * AAC Audio Frames of the individual packets.
 */
var AacStream = (function (Stream) {
  function AacStream() {
    _get(Object.getPrototypeOf(AacStream.prototype), "constructor", this).call(this);
    this.adtsSampleingRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000];
  }

  _inherits(AacStream, Stream);

  _prototypeProperties(AacStream, null, {
    getAudioSpecificConfig: {
      value: function getAudioSpecificConfig(data) {
        var adtsProtectionAbsent, // :Boolean
        adtsObjectType, // :int
        adtsSampleingIndex, // :int
        adtsChanelConfig, // :int
        adtsFrameSize, // :int
        adtsSampleCount, // :int
        adtsDuration; // :int

        // byte 1
        adtsProtectionAbsent = !!(data[1] & 1);

        // byte 2
        adtsObjectType = ((data[2] & 192) >>> 6) + 1;
        adtsSampleingIndex = (data[2] & 60) >>> 2;
        adtsChanelConfig = (data[2] & 1) << 2;

        // byte 3
        adtsChanelConfig |= (data[3] & 192) >>> 6;
        adtsFrameSize = (data[3] & 3) << 11;

        // byte 4
        adtsFrameSize |= data[4] << 3;

        // byte 5
        adtsFrameSize |= (data[5] & 224) >>> 5;
        adtsFrameSize -= adtsProtectionAbsent ? 7 : 9;

        // byte 6
        adtsSampleCount = ((data[6] & 3) + 1) * 1024;
        adtsDuration = adtsSampleCount * 1000 / this.adtsSampleingRates[adtsSampleingIndex];


        this.audioSpecificConfig = new Uint8Array(2);

        // audioObjectType = profile => profile, the MPEG-4 Audio Object Type minus 1
        this.audioSpecificConfig[0] = adtsObjectType << 3;

        // samplingFrequencyIndex
        this.audioSpecificConfig[0] |= (adtsSampleingIndex & 14) >> 1;
        this.audioSpecificConfig[1] |= (adtsSampleingIndex & 1) << 7;

        // channelConfiguration
        this.audioSpecificConfig[1] |= adtsChanelConfig << 3;

        this.stereo = 2 === adtsChanelConfig;
        this.audiosamplerate = this.adtsSampleingRates[adtsSampleingIndex];
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    push: {
      value: function push(packet) {
        if (packet.type == "audio" && packet.data != undefined) {
          var aacFrame,
              // :Frame = null;
          next_pts = packet.pts,
              data = packet.data;

          // byte 0
          if (255 !== data[0]) {
            console.assert(false, "Error no ATDS header found");
          }

          if (this.audioSpecificConfig == undefined) {
            this.getAudioSpecificConfig(data);
          }

          aacFrame = {};
          aacFrame.pts = next_pts;
          aacFrame.dts = next_pts;
          aacFrame.bytes = new Uint8Array();

          // AAC is always 10
          aacFrame.audiocodecid = 10;
          aacFrame.stereo = this.stereo;
          aacFrame.audiosamplerate = this.audiosamplerate;
          // Is AAC always 16 bit?
          aacFrame.audiosamplesize = 16;
          aacFrame.bytes = packet.data.subarray(7, packet.data.length);
          packet.frame = aacFrame;

          this.trigger("data", packet);
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return AacStream;
})(Stream);

;

/**
 * Accepts a NAL unit byte stream and unpacks the embedded NAL units.
 */
var NalByteStream = (function (Stream) {
  function NalByteStream() {
    _get(Object.getPrototypeOf(NalByteStream.prototype), "constructor", this).call(this);
    this.i = 6;
    this.syncPoint = 1;
    this.buffer = null;
  }

  _inherits(NalByteStream, Stream);

  _prototypeProperties(NalByteStream, null, {
    push: {
      value: function push(data) {
        var swapBuffer;

        if (!this.buffer) {
          this.buffer = data.data;
        } else {
          swapBuffer = new Uint8Array(this.buffer.byteLength + data.data.byteLength);
          swapBuffer.set(this.buffer);
          swapBuffer.set(data.data, this.buffer.byteLength);
          this.buffer = swapBuffer;
        }

        // Rec. ITU-T H.264, Annex B
        // scan for NAL unit boundaries

        // a match looks like this:
        // 0 0 1 .. NAL .. 0 0 1
        // ^ sync point        ^ i
        // or this:
        // 0 0 1 .. NAL .. 0 0 0
        // ^ sync point        ^ i
        while (this.i < this.buffer.byteLength) {
          switch (this.buffer[this.i]) {
            case 0:
              // skip past non-sync sequences
              if (this.buffer[this.i - 1] !== 0) {
                this.i += 2;
                break;
              } else if (this.buffer[this.i - 2] !== 0) {
                this.i++;
                break;
              }

              // deliver the NAL unit
              this.trigger("data", this.buffer.subarray(this.syncPoint + 3, this.i - 2));

              // drop trailing zeroes
              do {
                this.i++;
              } while (this.buffer[this.i] !== 1);
              this.syncPoint = this.i - 2;
              this.i += 3;
              break;
            case 1:
              // skip past non-sync sequences
              if (this.buffer[this.i - 1] !== 0 || this.buffer[this.i - 2] !== 0) {
                this.i += 3;
                break;
              }

              // deliver the NAL unit
              this.trigger("data", this.buffer.subarray(this.syncPoint + 3, this.i - 2));
              this.syncPoint = this.i - 2;
              this.i += 3;
              break;
            default:
              this.i += 3;
              break;
          }
        }
        // filter out the NAL units that were delivered
        this.buffer = this.buffer.subarray(this.syncPoint);
        this.i -= this.syncPoint;
        this.syncPoint = 0;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    end: {
      value: function end() {
        // deliver the last buffered NAL unit
        if (this.buffer.byteLength > 3) {
          this.trigger("data", this.buffer.subarray(this.syncPoint + 3));
        }
        this.buffer = null;
        this.i = 6;
        this.syncPoint = 1;
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return NalByteStream;
})(Stream);

;
/**
 * Accepts input from a ElementaryStream and produces H.264 NAL unit data
 * events.
 */
var H264Stream = (function (Stream) {
  function H264Stream() {
    _get(Object.getPrototypeOf(H264Stream.prototype), "constructor", this).call(this);
    this.nalByteStream = new NalByteStream();
    this.nalByteStream.parent = this;
    this.nalByteStream.on("data", function (data) {
      var event = {
        trackId: this.parent.trackId,
        pts: this.parent.currentPts,
        dts: this.parent.currentDts,
        data: data
      };
      switch (data[0] & 31) {
        case 5:
          event.nalUnitType = "slice_layer_without_partitioning_rbsp_idr";
          break;
        case 7:
          event.nalUnitType = "seq_parameter_set_rbsp";
          var expGolombDecoder = new ExpGolomb(data.subarray(1));
          event.config = expGolombDecoder.readSequenceParameterSet();
          break;
        case 8:
          event.nalUnitType = "pic_parameter_set_rbsp";
          break;
        case 9:
          event.nalUnitType = "access_unit_delimiter_rbsp";
          break;

        default:
          break;
      }
      this.parent.trigger("data", event);
    });
  }

  _inherits(H264Stream, Stream);

  _prototypeProperties(H264Stream, null, {
    push: {
      value: function push(packet) {
        if (packet.type !== "video") {
          return;
        }
        this.trackId = packet.trackId;
        this.currentPts = packet.pts;
        this.currentDts = packet.dts;
        this.nalByteStream.push(packet);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    end: {
      value: function end() {
        this.nalByteStream.end();
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return H264Stream;
})(Stream);

;

/**
 * Constructs a single-track, ISO BMFF media segment from H264 data
 * events. The output of this stream can be fed to a SourceBuffer
 * configured with a suitable initialization segment.
 * @param track {object} track metadata configuration
 */
var VideoSegmentStream = (function (Stream) {
  function VideoSegmentStream(track) {
    _get(Object.getPrototypeOf(VideoSegmentStream.prototype), "constructor", this).call(this);
    this.sequenceNumber = 0;
    this.totalduration = 0;
    this.nalUnits = [];
    this.nalUnitsLength = 0;
    this.track = track;
  }

  _inherits(VideoSegmentStream, Stream);

  _prototypeProperties(VideoSegmentStream, null, {
    push: {
      value: function push(data) {
        // buffer video until end() is called
        this.nalUnits.push(data);
        this.nalUnitsLength += data.data.byteLength;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    end: {
      value: function end() {
        var startUnit, currentNal, moof, mdat, boxes, i, data, view, sample, startdts;

        // concatenate the video data and construct the mdat
        // first, we have to build the index from byte locations to
        // samples (that is, frames) in the video data
        data = new Uint8Array(this.nalUnitsLength + 4 * this.nalUnits.length);
        view = new DataView(data.buffer);
        this.track.samples = [];
        sample = {
          size: 0,
          flags: {
            isLeading: 0,
            dependsOn: 1,
            isDependedOn: 0,
            hasRedundancy: 0,
            isNonSyncSample: 1,
            degradationPriority: 0
          }
        };
        i = 0;
        startdts = this.nalUnits[0].dts;
        while (this.nalUnits.length) {
          currentNal = this.nalUnits[0];
          // flush the sample we've been building when a new sample is started
          if (currentNal.nalUnitType === "access_unit_delimiter_rbsp") {
            if (startUnit) {
              // convert the duration to 90kHZ timescale to match the
              // timescales specified in the init segment
              sample.duration = (currentNal.dts - startUnit.dts) * 90;
              this.track.samples.push(sample);
            }
            sample = {
              size: 0,
              flags: {
                isLeading: 0,
                dependsOn: 1,
                isDependedOn: 0,
                hasRedundancy: 0,
                isNonSyncSample: 1,
                degradationPriority: 0 },
              compositionTimeOffset: currentNal.pts - currentNal.dts
            };
            startUnit = currentNal;
          }
          if (currentNal.nalUnitType === "slice_layer_without_partitioning_rbsp_idr") {
            // the current sample is a key frame
            sample.flags.dependsOn = 2;
            sample.flags.isNonSyncSample = 0;
          }
          sample.size += 4; // space for the NAL length
          sample.size += currentNal.data.byteLength;

          view.setUint32(i, currentNal.data.byteLength);
          i += 4;
          data.set(currentNal.data, i);
          i += currentNal.data.byteLength;

          this.nalUnits.shift();
        }
        // record the last sample
        if (this.track.samples.length) {
          sample.duration = this.track.samples[this.track.samples.length - 1].duration;
        }
        this.track.samples.push(sample);
        this.nalUnitsLength = 0;
        mdat = MP4.mdat(data);
        moof = MP4.moof(this.sequenceNumber, this.totalduration, [this.track]);
        this.totalduration += (currentNal.dts - startdts) * 90;
        // it would be great to allocate this array up front instead of
        // throwing away hundreds of media segment fragments
        boxes = new Uint8Array(moof.byteLength + mdat.byteLength);

        // bump the sequence number for next time
        this.sequenceNumber++;

        boxes.set(moof);
        boxes.set(mdat, moof.byteLength);

        this.trigger("data", boxes);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return VideoSegmentStream;
})(Stream);

/**
 * Constructs a single-track, ISO BMFF media segment from AAC data
 * events. The output of this stream can be fed to a SourceBuffer
 * configured with a suitable initialization segment.
 * @param track {object} track metadata configuration
 */
var AudioSegmentStream = (function (Stream) {
  function AudioSegmentStream(track) {
    _get(Object.getPrototypeOf(AudioSegmentStream.prototype), "constructor", this).call(this);
    this.sequenceNumber = 0;
    this.totalduration = 0;
    this.aacUnits = [];
    this.aacUnitsLength = 0;
    this.track = track;
  }

  _inherits(AudioSegmentStream, Stream);

  _prototypeProperties(AudioSegmentStream, null, {
    push: {
      value: function push(data) {
        //remove ADTS header
        data.data = data.data.subarray(7);
        // buffer audio until end() is called
        this.aacUnits.push(data);
        this.aacUnitsLength += data.data.byteLength;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    end: {
      value: function end() {
        var data, view, i, currentUnit, startUnit, lastUnit, mdat, moof, boxes;
        // // concatenate the audio data and construct the mdat
        // // first, we have to build the index from byte locations to
        // // samples (that is, frames) in the audio data
        //data = new Uint8Array(aacUnitsLength + (4 * aacUnits.length));
        data = new Uint8Array(this.aacUnitsLength);
        view = new DataView(data.buffer);
        this.track.samples = [];
        var sample = {
          size: this.aacUnits[0].data.byteLength,
          flags: {
            isLeading: 0,
            dependsOn: 1,
            isDependedOn: 0,
            hasRedundancy: 0,
            degradationPriority: 0
          },
          compositionTimeOffset: 0
        };
        i = 0;
        startUnit = this.aacUnits[0];
        lastUnit = null;
        while (this.aacUnits.length) {
          currentUnit = this.aacUnits[0];
          if (lastUnit != null) {
            //flush previous sample, update its duration beforehand
            sample.duration = (currentUnit.dts - lastUnit.dts) * 90;
            this.track.samples.push(sample);
            sample = {
              size: currentUnit.data.byteLength,
              flags: {
                isLeading: 0,
                dependsOn: 1,
                isDependedOn: 0,
                hasRedundancy: 0,
                degradationPriority: 0
              },
              compositionTimeOffset: 0
            };
          }
          //view.setUint32(i, currentUnit.data.byteLength);
          //i += 4;
          data.set(currentUnit.data, i);
          i += currentUnit.data.byteLength;
          this.aacUnits.shift();
          lastUnit = currentUnit;
        }
        // record the last sample
        if (this.track.samples.length) {
          sample.duration = this.track.samples[this.track.samples.length - 1].duration;
          this.track.samples.push(sample);
        }
        this.aacUnitsLength = 0;
        mdat = MP4.mdat(data);
        moof = MP4.moof(this.sequenceNumber, this.totalduration, [this.track]);
        this.totalduration += (currentUnit.dts - startUnit.dts) * 90;
        // it would be great to allocate this array up front instead of
        // throwing away hundreds of media segment fragments
        boxes = new Uint8Array(moof.byteLength + mdat.byteLength);

        // bump the sequence number for next time
        this.sequenceNumber++;
        boxes.set(moof);
        boxes.set(mdat, moof.byteLength);

        this.trigger("data", boxes);
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return AudioSegmentStream;
})(Stream);

/**
 * A Stream that expects MP2T binary data as input and produces
 * corresponding media segments, suitable for use with Media Source
 * Extension (MSE) implementations that support the ISO BMFF byte
 * stream format, like Chrome.
 * @see test/muxer/mse-demo.html for sample usage of a Transmuxer with
 * MSE
 */


var packetStream, parseStream, elementaryStream, aacStream, h264Stream, audioSegmentStream, videoSegmentStream, configAudio, configVideo, trackVideo, trackAudio, pps, sps, self;

var TSDemuxer = (function (Stream) {
  function TSDemuxer() {
    _get(Object.getPrototypeOf(TSDemuxer.prototype), "constructor", this).call(this);

    // set up the parsing pipeline
    packetStream = new TransportPacketStream();
    parseStream = new TransportParseStream();
    elementaryStream = new ElementaryStream();
    aacStream = new AacStream();
    h264Stream = new H264Stream();

    packetStream.pipe(parseStream);
    parseStream.pipe(elementaryStream);
    elementaryStream.pipe(aacStream);
    elementaryStream.pipe(h264Stream);
    self = this;


    // handle incoming data events
    aacStream.on("data", function (data) {
      if (!configAudio) {
        configAudio = data;
      }
    });

    h264Stream.on("data", function (data) {
      // record the track config
      if (data.nalUnitType === "seq_parameter_set_rbsp" && !configVideo) {
        configVideo = data.config;

        trackVideo.width = configVideo.width;
        trackVideo.height = configVideo.height;
        trackVideo.sps = [data.data];
        trackVideo.profileIdc = configVideo.profileIdc;
        trackVideo.levelIdc = configVideo.levelIdc;
        trackVideo.profileCompatibility = configVideo.profileCompatibility;

        // generate an init segment once all the metadata is available
        if (pps) {
          this.trigger("data", {
            data: MP4.initSegment([trackVideo, trackAudio])
          });
        }
      }
      if (data.nalUnitType === "pic_parameter_set_rbsp" && !pps) {
        pps = data.data;
        trackVideo.pps = [data.data];

        if (configVideo) {
          self.trigger("data", {
            data: MP4.initSegment([trackVideo, trackAudio])
          });
        }
      }
    });
    // hook up the video segment stream once track metadata is delivered
    elementaryStream.on("data", function (data) {
      var i,
          triggerData = function (segment) {
        self.trigger("data", {
          data: segment
        });
      };
      if (data.type === "metadata") {
        i = data.tracks.length;
        while (i--) {
          if (data.tracks[i].type === "video") {
            trackVideo = data.tracks[i];
            if (!videoSegmentStream) {
              videoSegmentStream = new VideoSegmentStream(trackVideo);
              h264Stream.pipe(videoSegmentStream);
              videoSegmentStream.on("data", triggerData);
            }
            break;
          } else {
            if (data.tracks[i].type === "audio") {
              trackAudio = data.tracks[i];
              if (!audioSegmentStream) {
                audioSegmentStream = new AudioSegmentStream(trackAudio);
                aacStream.pipe(audioSegmentStream);
                audioSegmentStream.on("data", triggerData);
              }
            }
          }
        }
      }
    });
  }

  _inherits(TSDemuxer, Stream);

  _prototypeProperties(TSDemuxer, null, {
    push: {

      // feed incoming data to the front of the parsing pipeline
      value: function push(data) {
        packetStream.push(data);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    end: {
      // flush any buffered data
      value: function end() {
        elementaryStream.end();
        h264Stream.end();
        videoSegmentStream.end();
        audioSegmentStream.end();
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return TSDemuxer;
})(Stream);

module.exports = TSDemuxer;

},{"../remux/mp4-generator":"/Users/g.dupontavice/workdir/github/mse-hls/src/remux/mp4-generator.js","../utils/stream":"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/stream.js","./exp-golomb":"/Users/g.dupontavice/workdir/github/mse-hls/src/demux/exp-golomb.js"}],"/Users/g.dupontavice/workdir/github/mse-hls/src/index.js":[function(require,module,exports){
/**
 * HLS engine
 */
"use strict";

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

var TSDemuxer = _interopRequire(require("./demux/tsdemuxer"));

var FragmentLoader = _interopRequire(require("./loader/fragment-loader"));

var PlaylistLoader = _interopRequire(require("./loader/playlist-loader"));

var logger = require("./utils/logger").logger;
var enableLogs = require("./utils/logger").enableLogs;
var Stream = _interopRequire(require("./utils/stream"));

//import MP4Inspect         from '/remux/mp4-inspector';

var init, attachView, attachSource;
var stream;
var mediaSource, video, url;
var playlistLoader, fragmentLoader;
var buffer, demuxer;
var mp4segments;

init = function () {
  mediaSource = new MediaSource();
  stream = new Stream();
  playlistLoader = new PlaylistLoader();
  fragmentLoader = new FragmentLoader();
  // setup the media source
  mediaSource.addEventListener("sourceopen", onMediaSourceOpen);
  mediaSource.addEventListener("sourceended", function () {
    logger.log("media source ended");
  });

  mediaSource.addEventListener("sourceclose", function () {
    logger.log("media source closed");
  });
};

attachView = function (view) {
  video = view;
  video.src = URL.createObjectURL(mediaSource);
  video.addEventListener("loadstart", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("progress", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("suspend", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("abort", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("error", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("emptied", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("stalled", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("loadedmetadata", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("loadeddata", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("canplay", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("canplaythrough", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("playing", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("waiting", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("seeking", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("seeked", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("durationchange", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("timeupdate", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("play", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("pause", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("ratechange", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("resize", function (evt) {
    logEvt(evt);
  });
  video.addEventListener("volumechange", function (evt) {
    logEvt(evt);
  });
};

attachSource = function (url) {
  url = url;
  playlistLoader.load(url);
};

function onMediaSourceOpen() {
  buffer = mediaSource.addSourceBuffer("video/mp4;codecs=avc1.4d400d,mp4a.40.5");
  demuxer = new TSDemuxer();
  mp4segments = [];

  buffer.addEventListener("updateend", function () {
    appendSegments();
  });

  buffer.addEventListener("error", function (event) {
    logger.log(" buffer append error:" + event);
  });

  var fragments;
  var fragmentIndex;
  playlistLoader.on("data", function (data) {
    fragments = data;
    fragmentIndex = 0;
    fragmentLoader.load(fragments[fragmentIndex++]);
  });

  playlistLoader.on("stats", function (stats) {
    var rtt, loadtime, bw;
    rtt = stats.tfirst - stats.trequest;
    loadtime = stats.tend - stats.trequest;
    logger.log("playlist loaded,RTT(ms)/load(ms)/nb frag:" + rtt + "/" + loadtime + "/" + stats.length);
  });


  fragmentLoader.on("data", function (data) {
    demuxer.push(new Uint8Array(data));
    demuxer.end();
    appendSegments();
    if (fragmentIndex < fragments.length) {
      fragmentLoader.load(fragments[fragmentIndex++]);
    } else {
      logger.log("last fragment loaded");
    }
  });

  fragmentLoader.on("stats", function (stats) {
    var rtt, loadtime, bw;
    rtt = stats.tfirst - stats.trequest;
    loadtime = stats.tend - stats.trequest;
    bw = stats.length * 8 / (1000 * loadtime);
    logger.log("frag loaded, RTT(ms)/load(ms)/bitrate:" + rtt + "/" + loadtime + "/" + bw.toFixed(3) + " Mb/s");
  });

  // transmux the MPEG-TS data to ISO-BMFF segments
  demuxer.on("data", function (segment) {
    //logger.log(JSON.stringify(MP4Inspect.mp4toJSON(segment.data)),null,4);
    mp4segments.push(segment);
  });
}

function appendSegments() {
  if (!buffer.updating && mp4segments.length) {
    buffer.appendBuffer(mp4segments.shift().data);
  }
}

function logEvt(evt) {
  var data = "";
  switch (evt.type) {
    case "durationchange":
      data = event.target.duration;
      break;
    case "resize":
      data = "videoWidth:" + evt.target.videoWidth + "/videoHeight:" + evt.target.videoHeight;
      break;
    case "loadedmetadata":
      data = "duration:" + evt.target.duration + "/videoWidth:" + evt.target.videoWidth + "/videoHeight:" + evt.target.videoHeight;
      break;
    case "loadeddata":
    case "canplay":
    case "canplaythrough":
    case "timeupdate":
    case "seeking":
    case "seeked":
    case "pause":
    case "play":
    case "stalled":
      data = "currentTime:" + evt.target.currentTime;
      break;
    default:
      break;
  }
  logger.log(evt.type + ":" + data);
}



var hls = {
  init: init,
  debug: enableLogs,
  attachView: attachView,
  attachSource: attachSource
};

module.exports = hls;

},{"./demux/tsdemuxer":"/Users/g.dupontavice/workdir/github/mse-hls/src/demux/tsdemuxer.js","./loader/fragment-loader":"/Users/g.dupontavice/workdir/github/mse-hls/src/loader/fragment-loader.js","./loader/playlist-loader":"/Users/g.dupontavice/workdir/github/mse-hls/src/loader/playlist-loader.js","./utils/logger":"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/logger.js","./utils/stream":"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/stream.js"}],"/Users/g.dupontavice/workdir/github/mse-hls/src/loader/fragment-loader.js":[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _get = function get(object, property, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    return desc.value;
  } else {
    var getter = desc.get;
    if (getter === undefined) {
      return undefined;
    }
    return getter.call(receiver);
  }
};

var _inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) subClass.__proto__ = superClass;
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

/*
 * fragment loader
 *
 */

//import {enableLogs}    from '../utils/logger';
var Stream = _interopRequire(require("../utils/stream"));

var FragmentLoader = (function (Stream) {
  function FragmentLoader() {
    _get(Object.getPrototypeOf(FragmentLoader.prototype), "constructor", this).call(this);
  }

  _inherits(FragmentLoader, Stream);

  _prototypeProperties(FragmentLoader, null, {
    load: {
      value: function load(url) {
        this.url = url;
        this.trequest = Date.now();
        this.tfirst = null;
        var xhr = new XMLHttpRequest();
        xhr.onload = this.loadsuccess;
        xhr.onerror = this.loaderror;
        xhr.onprogress = this.loadprogress;
        xhr.responseType = "arraybuffer";
        xhr.parent = this;
        xhr.open("GET", url, true);
        xhr.send();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadsuccess: {
      value: function loadsuccess(event) {
        this.parent.trigger("stats", { trequest: this.parent.trequest, tfirst: this.parent.tfirst, tend: Date.now(), length: event.currentTarget.response.byteLength, url: this.url });
        this.parent.trigger("data", event.currentTarget.response);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loaderror: {
      value: function loaderror(event) {
        console.log("error loading " + this.parent.url);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadprogress: {
      value: function loadprogress(event) {
        if (this.parent.tfirst === null) {
          this.parent.tfirst = Date.now();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return FragmentLoader;
})(Stream);

module.exports = FragmentLoader;

},{"../utils/stream":"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/stream.js"}],"/Users/g.dupontavice/workdir/github/mse-hls/src/loader/playlist-loader.js":[function(require,module,exports){
"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var _get = function get(object, property, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    return desc.value;
  } else {
    var getter = desc.get;
    if (getter === undefined) {
      return undefined;
    }
    return getter.call(receiver);
  }
};

var _inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) subClass.__proto__ = superClass;
};

var _interopRequire = function (obj) {
  return obj && (obj["default"] || obj);
};

/*
 * playlist loader
 *
 */

var Stream = _interopRequire(require("../utils/stream"));




// relative URL resolver
var resolveURL = (function () {
  var doc = document,
      old_base = doc.getElementsByTagName("base")[0],
      old_href = old_base && old_base.href,
      doc_head = doc.head || doc.getElementsByTagName("head")[0],
      our_base = old_base || doc.createElement("base"),
      resolver = doc.createElement("a"),
      resolved_url;

  return function (base_url, url) {
    old_base || doc_head.appendChild(our_base);
    our_base.href = base_url;
    resolver.href = url;
    resolved_url = resolver.href; // browser magic at work here

    old_base ? old_base.href = old_href : doc_head.removeChild(our_base);

    return resolved_url;
  };
})();


var PlaylistLoader = (function (Stream) {
  function PlaylistLoader() {
    _get(Object.getPrototypeOf(PlaylistLoader.prototype), "constructor", this).call(this);
  }

  _inherits(PlaylistLoader, Stream);

  _prototypeProperties(PlaylistLoader, null, {
    load: {
      value: function load(url) {
        this.url = url;
        this.trequest = Date.now();
        this.tfirst = null;
        var xhr = new XMLHttpRequest();
        xhr.onload = this.loadsuccess;
        xhr.onerror = this.loaderror;
        xhr.onprogress = this.loadprogress;
        xhr.parent = this;
        xhr.open("GET", url, true);
        xhr.send();
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadsuccess: {
      value: function loadsuccess(event) {
        var fragments = this.responseText.split(/\r?\n/).filter(RegExp.prototype.test.bind(/\.ts$/)).map(resolveURL.bind(null, this.parent.url));
        console.log("found " + fragments.length + " fragments");
        this.parent.trigger("stats", { trequest: this.parent.trequest, tfirst: this.parent.tfirst, tend: Date.now(), length: fragments.length, url: this.parent.url });
        this.parent.trigger("data", fragments);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loaderror: {
      value: function loaderror(event) {
        console.log("error loading " + self.url);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    loadprogress: {
      value: function loadprogress(event) {
        if (this.parent.tfirst === null) {
          this.parent.tfirst = Date.now();
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return PlaylistLoader;
})(Stream);

module.exports = PlaylistLoader;

},{"../utils/stream":"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/stream.js"}],"/Users/g.dupontavice/workdir/github/mse-hls/src/remux/mp4-generator.js":[function(require,module,exports){
"use strict";

/**
 * generate MP4 Box
 */
(function () {
  "use strict";

  var box, dinf, ftyp, mdat, mfhd, minf, moof, moov, mvex, mvhd, trak, tkhd, mdia, mdhd, hdlr, sdtp, stbl, stsd, styp, traf, trex, trun, avc1, mp4a, esds, types, MAJOR_BRAND, MINOR_VERSION, AVC1_BRAND, VIDEO_HDLR, AUDIO_HDLR, HDLR_TYPES, VMHD, SMHD, MEDIAHEADER_TYPES, DREF, STCO, STSC, STSZ, STTS, ESDS, STSD;

  // pre-calculate constants
  (function () {
    var i;
    types = {
      avc1: [], // codingname
      avcC: [],
      btrt: [],
      dinf: [],
      dref: [],
      esds: [],
      ftyp: [],
      hdlr: [],
      mdat: [],
      mdhd: [],
      mdia: [],
      mfhd: [],
      minf: [],
      moof: [],
      moov: [],
      mp4a: [],
      mvex: [],
      mvhd: [],
      sdtp: [],
      stbl: [],
      stco: [],
      stsc: [],
      stsd: [],
      stsz: [],
      stts: [],
      styp: [],
      tfdt: [],
      tfhd: [],
      traf: [],
      trak: [],
      trun: [],
      trex: [],
      tkhd: [],
      vmhd: []
    };

    for (i in types) {
      if (types.hasOwnProperty(i)) {
        types[i] = [i.charCodeAt(0), i.charCodeAt(1), i.charCodeAt(2), i.charCodeAt(3)];
      }
    }

    MAJOR_BRAND = new Uint8Array(["i".charCodeAt(0), "s".charCodeAt(0), "o".charCodeAt(0), "m".charCodeAt(0)]);
    AVC1_BRAND = new Uint8Array(["a".charCodeAt(0), "v".charCodeAt(0), "c".charCodeAt(0), "1".charCodeAt(0)]);
    MINOR_VERSION = new Uint8Array([0, 0, 0, 1]);
    VIDEO_HDLR = new Uint8Array([0, // version 0
    0, 0, 0, // flags
    0, 0, 0, 0, // pre_defined
    118, 105, 100, 101, // handler_type: 'vide'
    0, 0, 0, 0, // reserved
    0, 0, 0, 0, // reserved
    0, 0, 0, 0, // reserved
    86, 105, 100, 101, 111, 72, 97, 110, 100, 108, 101, 114, 0 // name: 'VideoHandler'
    ]);
    AUDIO_HDLR = new Uint8Array([0, // version 0
    0, 0, 0, // flags
    0, 0, 0, 0, // pre_defined
    115, 111, 117, 110, // handler_type: 'soun'
    0, 0, 0, 0, // reserved
    0, 0, 0, 0, // reserved
    0, 0, 0, 0, // reserved
    83, 111, 117, 110, 100, 72, 97, 110, 100, 108, 101, 114, 0 // name: 'SoundHandler'
    ]);
    HDLR_TYPES = {
      video: VIDEO_HDLR,
      audio: AUDIO_HDLR
    };
    DREF = new Uint8Array([0, // version 0
    0, 0, 0, // flags
    0, 0, 0, 1, // entry_count
    0, 0, 0, 12, // entry_size
    117, 114, 108, 32, // 'url' type
    0, // version 0
    0, 0, 1 // entry_flags
    ]);
    STCO = new Uint8Array([0, // version
    0, 0, 0, // flags
    0, 0, 0, 0 // entry_count
    ]);
    STSC = STCO;
    STSZ = new Uint8Array([0, // version
    0, 0, 0, // flags
    0, 0, 0, 0, // sample_size
    0, 0, 0, 0]);
    STTS = STCO;
    VMHD = new Uint8Array([0, // version
    0, 0, 1, // flags
    0, 0, // graphicsmode
    0, 0, 0, 0, 0, 0 // opcolor
    ]);
    SMHD = new Uint8Array([0, // version
    0, 0, 0, // flags
    0, 0, // balance
    0, 0 // reserved
    ]);

    STSD = new Uint8Array([0, // version 0
    0, 0, 0, // flags
    0, 0, 0, 1]); // entry_count

    MEDIAHEADER_TYPES = {
      video: VMHD,
      audio: SMHD
    };
  })();

  box = function (type) {
    var payload = Array.prototype.slice.call(arguments, 1),
        size = 0,
        i = payload.length,
        result,
        view;

    // calculate the total size we need to allocate
    while (i--) {
      size += payload[i].byteLength;
    }
    result = new Uint8Array(size + 8);
    view = new DataView(result.buffer, result.byteOffset, result.byteLength);
    view.setUint32(0, result.byteLength);
    result.set(type, 4);

    // copy the payload into the result
    for (i = 0, size = 8; i < payload.length; i++) {
      result.set(payload[i], size);
      size += payload[i].byteLength;
    }
    return result;
  };

  dinf = function () {
    return box(types.dinf, box(types.dref, DREF));
  };

  ftyp = function () {
    return box(types.ftyp, MAJOR_BRAND, MINOR_VERSION, MAJOR_BRAND, AVC1_BRAND);
  };

  hdlr = function (type) {
    return box(types.hdlr, HDLR_TYPES[type]);
  };
  mdat = function (data) {
    return box(types.mdat, data);
  };
  mdhd = function (duration) {
    return box(types.mdhd, new Uint8Array([0, // version 0
    0, 0, 0, // flags
    0, 0, 0, 2, // creation_time
    0, 0, 0, 3, // modification_time
    0, 1, 95, 144, // timescale, 90,000 "ticks" per second

    (duration & 4278190080) >> 24, (duration & 16711680) >> 16, (duration & 65280) >> 8, duration & 255, // duration
    85, 196, // 'und' language (undetermined)
    0, 0]));
  };
  mdia = function (track) {
    return box(types.mdia, mdhd(track.duration), hdlr(track.type), minf(track));
  };
  mfhd = function (sequenceNumber) {
    return box(types.mfhd, new Uint8Array([0, 0, 0, 0, // flags
    (sequenceNumber & 4278190080) >> 24, (sequenceNumber & 16711680) >> 16, (sequenceNumber & 65280) >> 8, sequenceNumber & 255]));
  };
  minf = function (track) {
    return box(types.minf, box(types.vmhd, MEDIAHEADER_TYPES[track.type]), dinf(), stbl(track));
  };
  moof = function (sequenceNumber, baseMediaDecodeTime, tracks) {
    var trackFragments = [],
        i = tracks.length;
    // build traf boxes for each track fragment
    while (i--) {
      trackFragments[i] = traf(tracks[i], baseMediaDecodeTime);
    }
    return box.apply(null, [types.moof, mfhd(sequenceNumber)].concat(trackFragments));
  };
  /**
   * @param tracks... (optional) {array} the tracks associated with this movie
   */
  moov = function (tracks) {
    var i = tracks.length,
        boxes = [];

    while (i--) {
      boxes[i] = trak(tracks[i]);
    }

    return box.apply(null, [types.moov, mvhd(1)].concat(boxes).concat(mvex(tracks)));
  };
  mvex = function (tracks) {
    var i = tracks.length,
        boxes = [];

    while (i--) {
      boxes[i] = trex(tracks[i]);
    }
    return box.apply(null, [types.mvex].concat(boxes));
  };
  mvhd = function (duration) {
    var bytes = new Uint8Array([0, // version 0
    0, 0, 0, // flags
    0, 0, 0, 1, // creation_time
    0, 0, 0, 2, // modification_time
    0, 1, 95, 144, // timescale, 90,000 "ticks" per second
    (duration & 4278190080) >> 24, (duration & 16711680) >> 16, (duration & 65280) >> 8, duration & 255, // duration
    0, 1, 0, 0, // 1.0 rate
    1, 0, // 1.0 volume
    0, 0, // reserved
    0, 0, 0, 0, // reserved
    0, 0, 0, 0, // reserved
    0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64, 0, 0, 0, // transformation: unity matrix
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // pre_defined
    255, 255, 255, 255 // next_track_ID
    ]);
    return box(types.mvhd, bytes);
  };

  sdtp = function (track) {
    var samples = track.samples || [],
        bytes = new Uint8Array(4 + samples.length),
        sample,
        i;

    // leave the full box header (4 bytes) all zero

    // write the sample table
    for (i = 0; i < samples.length; i++) {
      sample = samples[i];
      bytes[i + 4] = sample.flags.dependsOn << 4 | sample.flags.isDependedOn << 2 | sample.flags.hasRedundancy;
    }

    return box(types.sdtp, bytes);
  };

  stbl = function (track) {
    return box(types.stbl, stsd(track), box(types.stts, STTS), box(types.stsc, STSC), box(types.stsz, STSZ), box(types.stco, STCO));
  };

  avc1 = function (track) {
    var sequenceParameterSets = [],
        pictureParameterSets = [],
        i;
    // assemble the SPSs
    for (i = 0; i < track.sps.length; i++) {
      sequenceParameterSets.push((track.sps[i].byteLength & 65280) >>> 8);
      sequenceParameterSets.push(track.sps[i].byteLength & 255); // sequenceParameterSetLength
      sequenceParameterSets = sequenceParameterSets.concat(Array.prototype.slice.call(track.sps[i])); // SPS
    }

    // assemble the PPSs
    for (i = 0; i < track.pps.length; i++) {
      pictureParameterSets.push((track.pps[i].byteLength & 65280) >>> 8);
      pictureParameterSets.push(track.pps[i].byteLength & 255);
      pictureParameterSets = pictureParameterSets.concat(Array.prototype.slice.call(track.pps[i]));
    }

    return box(types.avc1, new Uint8Array([0, 0, 0, // reserved
    0, 0, 0, // reserved
    0, 1, // data_reference_index
    0, 0, // pre_defined
    0, 0, // reserved
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // pre_defined
    (track.width & 65280) >> 8, track.width & 255, // width
    (track.height & 65280) >> 8, track.height & 255, // height
    0, 72, 0, 0, // horizresolution
    0, 72, 0, 0, // vertresolution
    0, 0, 0, 0, // reserved
    0, 1, // frame_count
    19, 118, 105, 100, 101, 111, 106, 115, 45, 99, 111, 110, 116, 114, 105, 98, 45, 104, 108, 115, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // compressorname
    0, 24, // depth = 24
    17, 17]), // pre_defined = -1
    box(types.avcC, new Uint8Array([1, // configurationVersion
    track.profileIdc, // AVCProfileIndication
    track.profileCompatibility, // profile_compatibility
    track.levelIdc, // AVCLevelIndication
    255 // lengthSizeMinusOne, hard-coded to 4 bytes
    ].concat([track.sps.length // numOfSequenceParameterSets
    ]).concat(sequenceParameterSets).concat([track.pps.length // numOfPictureParameterSets
    ]).concat(pictureParameterSets))), // "PPS"
    box(types.btrt, new Uint8Array([0, 28, 156, 128, // bufferSizeDB
    0, 45, 198, 192, // maxBitrate
    0, 45, 198, 192])) // avgBitrate
    );
  };

  esds = function (track) {
    var audio_profile, sampling_freq, channel_config, audioSpecificConfig;
    /* refer to http://wiki.multimedia.cx/index.php?title=MPEG-4_Audio#Audio_Specific_Config
      Audio Profile
      0: Null
      1: AAC Main
      2: AAC LC (Low Complexity)
      3: AAC SSR (Scalable Sample Rate)
      4: AAC LTP (Long Term Prediction)
      5: SBR (Spectral Band Replication)
      6: AAC Scalable
    */
    audio_profile = 2;
    /* sampling freq
      0: 96000 Hz
      1: 88200 Hz
      2: 64000 Hz
      3: 48000 Hz
      4: 44100 Hz
      5: 32000 Hz
      6: 24000 Hz
      7: 22050 Hz
      8: 16000 Hz
      9: 12000 Hz
      10: 11025 Hz
      11: 8000 Hz
      12: 7350 Hz
      13: Reserved
      14: Reserved
      15: frequency is written explictly
    */
    sampling_freq = 3;

    /* Channel Configurations
      These are the channel configurations:
      0: Defined in AOT Specifc Config
      1: 1 channel: front-center
      2: 2 channels: front-left, front-right
    */
    channel_config = 2;
    //audioSpecificConfig = (audio_profile << 11) + (sampling_freq << 7) + (channel_config << 3);
    audioSpecificConfig = 4880;


    return new Uint8Array([0, // version 0
    0, 0, 0, // flags

    3, // descriptor_type
    25, // length
    0, 1, //es_id
    0, // stream_priority

    4, // descriptor_type
    17, // length
    64, //codec : mpeg4_audio
    21, // stream_type
    0, 0, 0, // buffer_size
    0, 0, 0, 0, // maxBitrate
    0, 0, 0, 0, // avgBitrate

    5, // descriptor_type
    2, // length
    (audioSpecificConfig & 65280) >> 8, audioSpecificConfig & 255
    //0x12,0x10 //audio_profile(5 bits/sampling freq 4 bits/channel config 4bits/frameLength 1bit/dependsOnCoreCoder 1 bit/extensionFlag 1 bit)
    ]);
  };

  mp4a = function (track) {
    return box(types.mp4a, new Uint8Array([0, 0, 0, // reserved
    0, 0, 0, // reserved
    0, 1, // data_reference_index
    0, 0, 0, 0, 0, 0, 0, 0, // reserved
    0, 2, // channelcount:2 channels
    0, 16, // sampleSize:16bits
    0, 0, 0, 0, // reserved2
    187, 128, 0, 0]), // Rate=48000
    box(types.esds, esds(track)));
  };

  stsd = function (track) {
    if (track.type === "audio") {
      return box(types.stsd, STSD, mp4a(track));
    } else {
      return box(types.stsd, STSD, avc1(track));
    }
  };

  styp = function () {
    return box(types.styp, MAJOR_BRAND, MINOR_VERSION, MAJOR_BRAND);
  };

  tkhd = function (track) {
    return box(types.tkhd, new Uint8Array([0, // version 0
    0, 0, 7, // flags
    0, 0, 0, 0, // creation_time
    0, 0, 0, 0, // modification_time
    (track.id & 4278190080) >> 24, (track.id & 16711680) >> 16, (track.id & 65280) >> 8, track.id & 255, // track_ID
    0, 0, 0, 0, // reserved
    (track.duration & 4278190080) >> 24, (track.duration & 16711680) >> 16, (track.duration & 65280) >> 8, track.duration & 255, // duration
    0, 0, 0, 0, 0, 0, 0, 0, // reserved
    0, 0, // layer
    0, 0, // alternate_group
    0, 0, // non-audio track volume
    0, 0, // reserved
    0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64, 0, 0, 0, // transformation: unity matrix
    (track.width & 65280) >> 8, track.width & 255, 0, 0, // width
    (track.height & 65280) >> 8, track.height & 255, 0, 0 // height
    ]));
  };

  traf = function (track, baseMediaDecodeTime) {
    var sampleDependencyTable = sdtp(track);
    return box(types.traf, box(types.tfhd, new Uint8Array([0, // version 0
    0, 0, 0, // flags
    (track.id & 4278190080) >> 24, (track.id & 16711680) >> 16, (track.id & 65280) >> 8, track.id & 255])), box(types.tfdt, new Uint8Array([0, // version 0
    0, 0, 0, // flags
    (baseMediaDecodeTime & 4278190080) >> 24, (baseMediaDecodeTime & 16711680) >> 16, (baseMediaDecodeTime & 65280) >> 8, baseMediaDecodeTime & 255])), trun(track, sampleDependencyTable.length + 16 + // tfhd
    16 + // tfdt
    8 + // traf header
    16 + // mfhd
    8 + // moof header
    8), // mdat header
    sampleDependencyTable);
  };

  /**
   * Generate a track box.
   * @param track {object} a track definition
   * @return {Uint8Array} the track box
   */
  trak = function (track) {
    track.duration = track.duration || 4294967295;
    return box(types.trak, tkhd(track), mdia(track));
  };

  trex = function (track) {
    return box(types.trex, new Uint8Array([0, // version 0
    0, 0, 0, // flags
    (track.id & 4278190080) >> 24, (track.id & 16711680) >> 16, (track.id & 65280) >> 8, track.id & 255, // track_ID
    0, 0, 0, 1, // default_sample_description_index
    0, 0, 0, 0, // default_sample_duration
    0, 0, 0, 0, // default_sample_size
    0, 1, 0, 1 // default_sample_flags
    ]));
  };

  trun = function (track, offset) {
    var bytes, samples, sample, i;

    samples = track.samples || [];
    offset += 8 + 12 + 16 * samples.length;

    bytes = [0, // version 0
    0, 15, 1, // flags
    (samples.length & 4278190080) >>> 24, (samples.length & 16711680) >>> 16, (samples.length & 65280) >>> 8, samples.length & 255, // sample_count
    (offset & 4278190080) >>> 24, (offset & 16711680) >>> 16, (offset & 65280) >>> 8, offset & 255 // data_offset
    ];

    for (i = 0; i < samples.length; i++) {
      sample = samples[i];
      bytes = bytes.concat([(sample.duration & 4278190080) >>> 24, (sample.duration & 16711680) >>> 16, (sample.duration & 65280) >>> 8, sample.duration & 255, // sample_duration
      (sample.size & 4278190080) >>> 24, (sample.size & 16711680) >>> 16, (sample.size & 65280) >>> 8, sample.size & 255, // sample_size
      sample.flags.isLeading << 2 | sample.flags.dependsOn, sample.flags.isDependedOn << 6 | sample.flags.hasRedundancy << 4 | sample.flags.paddingValue << 1 | sample.flags.isNonSyncSample, sample.flags.degradationPriority & 240 << 8, sample.flags.degradationPriority & 15, // sample_flags
      (sample.compositionTimeOffset & 4278190080) >>> 24, (sample.compositionTimeOffset & 16711680) >>> 16, (sample.compositionTimeOffset & 65280) >>> 8, sample.compositionTimeOffset & 255 // sample_composition_time_offset
      ]);
    }
    return box(types.trun, new Uint8Array(bytes));
  };

  var MP4 = {
    mdat: mdat,
    moof: moof,
    moov: moov,
    initSegment: function (tracks) {
      var fileType = ftyp(),
          movie = moov(tracks),
          result;

      result = new Uint8Array(fileType.byteLength + movie.byteLength);
      result.set(fileType);
      result.set(movie, fileType.byteLength);
      return result;
    }
  };

  module.exports = MP4;
})();
// sample_count
// sequence_number
// track_ID
// baseMediaDecodeTime

},{}],"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/logger.js":[function(require,module,exports){
"use strict";

function noop() {}
var fakeLogger = {
  log: noop,
  warn: noop,
  info: noop,
  error: noop
};
var exportedLogger = fakeLogger;

var enableLogs = exports.enableLogs = function (debug) {
  if (debug === true || typeof debug === "object") {
    exportedLogger.log = debug.log ? debug.log.bind(debug) : console.log.bind(console);
    exportedLogger.info = debug.info ? debug.info.bind(debug) : console.info.bind(console);
    exportedLogger.error = debug.error ? debug.error.bind(debug) : console.error.bind(console);
    exportedLogger.warn = debug.warn ? debug.warn.bind(debug) : console.warn.bind(console);

    // Some browsers don't allow to use bind on console object anyway
    // fallback to default if needed
    try {
      exportedLogger.log();
    } catch (e) {
      exportedLogger.log = noop;
      exportedLogger.info = noop;
      exportedLogger.error = noop;
      exportedLogger.warn = noop;
    }
  } else {
    exportedLogger = fakeLogger;
  }
};
var logger = exports.logger = exportedLogger;

},{}],"/Users/g.dupontavice/workdir/github/mse-hls/src/utils/stream.js":[function(require,module,exports){
/**
 * A lightweight readable stream implemention that handles event dispatching.
 * Objects that inherit from streams should call init in their constructors.
 */

"use strict";

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

var Stream = (function () {
  function Stream() {
    this.listeners = {};
  }

  _prototypeProperties(Stream, null, {
    on: {
      /**
       * Add a listener for a specified event type.
       * @param type {string} the event name
       * @param listener {function} the callback to be invoked when an event of
       * the specified type occurs
       */
      value: function on(type, listener) {
        if (!this.listeners[type]) {
          this.listeners[type] = [];
        }
        this.listeners[type].push(listener);
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    off: {
      /**
       * Remove a listener for a specified event type.
       * @param type {string} the event name
       * @param listener {function} a function previously registered for this
       * type of event through `on`
       */
      value: function off(type, listener) {
        var index;
        if (!this.listeners[type]) {
          return false;
        }
        index = this.listeners[type].indexOf(listener);
        this.listeners[type].splice(index, 1);
        return index > -1;
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    trigger: {
      /**
       * Trigger an event of the specified type on this stream. Any additional
       * arguments to this function are passed as parameters to event listeners.
       * @param type {string} the event name
       */
      value: function trigger(type) {
        var callbacks, i, length, args;
        callbacks = this.listeners[type];
        if (!callbacks) {
          return;
        }
        // Slicing the arguments on every invocation of this method
        // can add a significant amount of overhead. Avoid the
        // intermediate object creation for the common case of a
        // single callback argument
        if (arguments.length === 2) {
          length = callbacks.length;
          for (i = 0; i < length; ++i) {
            callbacks[i].call(this, arguments[1]);
          }
        } else {
          args = Array.prototype.slice.call(arguments, 1);
          length = callbacks.length;
          for (i = 0; i < length; ++i) {
            callbacks[i].apply(this, args);
          }
        }
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    dispose: {
      /**
       * Destroys the stream and cleans up.
       */
      value: function dispose() {
        this.listeners = {};
      },
      writable: true,
      enumerable: true,
      configurable: true
    },
    pipe: {


      /**
       * Forwards all `data` events on this stream to the destination stream. The
       * destination stream should provide a method `push` to receive the data
       * events as they arrive.
       * @param destination {stream} the stream that will receive all `data` events
       * @see http://nodejs.org/api/stream.html#stream_readable_pipe_destination_options
       */
      value: function pipe(destination) {
        this.on("data", function (data) {
          destination.push(data);
        });
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  return Stream;
})();

module.exports = Stream;

},{}]},{},["/Users/g.dupontavice/workdir/github/mse-hls/src/index.js"])("/Users/g.dupontavice/workdir/github/mse-hls/src/index.js")
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9tc2UtaGxzL3NyYy9kZW11eC9leHAtZ29sb21iLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvbXNlLWhscy9zcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvbXNlLWhscy9zcmMvaW5kZXguanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9tc2UtaGxzL3NyYy9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyLmpzIiwiL1VzZXJzL2cuZHVwb250YXZpY2Uvd29ya2Rpci9naXRodWIvbXNlLWhscy9zcmMvbG9hZGVyL3BsYXlsaXN0LWxvYWRlci5qcyIsIi9Vc2Vycy9nLmR1cG9udGF2aWNlL3dvcmtkaXIvZ2l0aHViL21zZS1obHMvc3JjL3JlbXV4L21wNC1nZW5lcmF0b3IuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9tc2UtaGxzL3NyYy91dGlscy9sb2dnZXIuanMiLCIvVXNlcnMvZy5kdXBvbnRhdmljZS93b3JrZGlyL2dpdGh1Yi9tc2UtaGxzL3NyYy91dGlscy9zdHJlYW0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7O0lDTU0sU0FBUztBQUVGLFdBRlAsU0FBUyxDQUVELFdBQVcsRUFBRTtBQUN2QixRQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQzs7QUFFL0IsUUFBSSxDQUFDLHFCQUFxQixHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDOztBQUV6RCxRQUFJLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQzs7QUFFckIsUUFBSSxDQUFDLG9CQUFvQixHQUFHLENBQUMsQ0FBQztHQUMv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UixVQUFJLEVBQUUsRUFBRTtBQUNSLFVBQUksRUFBRSxFQUFFO0FBQ1IsVUFBSSxFQUFFLEVBQUU7QUFDUixVQUFJLEVBQUUsRUFBRTtBQUNSLFVBQUksRUFBRSxFQUFFO0FBQ1IsVUFBSSxFQUFFLEVBQUU7QUFDUixVQUFJLEVBQUUsRUFBRTtBQUNSLFVBQUksRUFBRSxFQUFFO0FBQ1IsVUFBSSxFQUFFLEVBQUU7QUFDUixVQUFJLEVBQUUsRUFBRTtBQUNSLFVBQUksRUFBRSxFQUFFO0FBQ1IsVUFBSSxFQUFFLEVBQUU7QUFDUixVQUFJLEVBQUUsRUFBRTtBQUNSLFVBQUksRUFBRSxFQUFFO0FBQ1IsVUFBSSxFQUFFLEVBQUU7QUFDUixVQUFJLEVBQUUsRUFBRTtBQUNSLFVBQUksRUFBRSxFQUFFO0FBQ1IsVUFBSSxFQUFFLEVBQUU7QUFDUixVQUFJLEVBQUUsRUFBRTtBQUNSLFVBQUksRUFBRSxFQUFFO0FBQ1IsVUFBSSxFQUFFLEVBQUU7QUFDUixVQUFJLEVBQUUsRUFBRTtBQUNSLFVBQUksRUFBRSxFQUFFO0FBQ1IsVUFBSSxFQUFFLEVBQUU7QUFDUixVQUFJLEVBQUUsRUFBRTtBQUNSLFVBQUksRUFBRSxFQUFFO0FBQ1IsVUFBSSxFQUFFLEVBQUU7QUFDUixVQUFJLEVBQUUsRUFBRTtLQUNULENBQUM7O0FBRUYsU0FBSyxDQUFDLElBQUksS0FBSyxFQUFFO0FBQ2YsVUFBSSxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQzNCLGFBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUNULENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQ2YsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFDZixDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUNmLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQ2hCLENBQUM7T0FDSDtLQUNGOztBQUVELGVBQVcsR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUMzQixHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FB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VixLQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLEtBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsS0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLEVBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsS0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsT0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSTtLQUN2QixDQUFDLENBQUM7QUFDTCxXQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0dBQy9CLENBQUM7O0FBRUYsTUFBSSxHQUFHLFVBQVMsS0FBSyxFQUFFO0FBQ3JCLFFBQ0UsT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLElBQUksRUFBRTtRQUM3QixL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QUFDVixLQUFJLEVBQUUsQ0FBSTtBQUNWLEtBQUksRUFBRSxDQUFJO0FBQ1YsS0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsS0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEtBQU0sQ0FBQSxJQUFLLENBQUMsRUFDM0IsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFJO0FBQ2xCLEtBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxLQUFNLENBQUEsSUFBSyxDQUFDLEVBQzVCLEtBQUssQ0FBQyxNQUFNLEdBQUcsR0FBSTtBQUNuQixLQUFJLEVBQUUsRUFBSSxFQUFFLENBQUksRUFBRSxDQUFJO0FBQ3RCLEtBQUksRUFBRSxFQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUk7QUFDdEIsS0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUN0QixLQUFJLEVBQUUsQ0FBSTtBQUNWLE1BQUksRUFDSixHQUFJLEVBQUUsR0FBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQ3RCLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLEVBQUksRUFDdEIsRUFBSSxFQUFFLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUN0QixHQUFJLEVBQUUsR0FBSSxFQUFFLEVBQUksRUFBRSxFQUFJLEVBQ3RCLEdBQUksRUFBRSxHQUFJLEVBQUUsR0FBSSxFQUFFLENBQUksRUFDdEIsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSSxFQUN0QixDQUFJLEVBQUUsQ0FBSSxFQUFFLENBQUksRUFBRSxDQUFJLEVBQ3RCLENBQUksRUFBRSxDQUFJLEVBQUUsQ0FBSTtBQUNoQixLQUFJLEVBQUUsRUFBSTtBQUNWLE1BQUksRUFBRSxFQUFJLENBQUMsQ0FBQztBQUNWLE9BQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksVUFBVSxDQUFDLENB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QyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNoRCxnQkFBTSxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFDMUIsZUFBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUU7QUFDM0IscUJBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1dBQ2hDO1NBQ0Y7T0FDRjs7Ozs7QUFJQSxXQUFPOzs7O2FBQUEsbUJBQUc7QUFDVCxZQUFJLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQztPQUNyQjs7Ozs7QUFVQSxRQUFJOzs7Ozs7Ozs7O2FBQUEsY0FBQyxXQUFXLEVBQUU7QUFDakIsWUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsVUFBUyxJQUFJLEVBQUU7QUFDN0IscUJBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDeEIsQ0FBQyxDQUFDO09BQ0o7Ozs7Ozs7U0E5RUksTUFBTTs7O2lCQWlGRSxNQUFNIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogUGFyc2VyIGZvciBleHBvbmVudGlhbCBHb2xvbWIgY29kZXMsIGEgdmFyaWFibGUtYml0d2lkdGggbnVtYmVyIGVuY29kaW5nXG4gKiBzY2hlbWUgdXNlZCBieSBoMjY0LlxuICovXG5cblxuY2xhc3MgRXhwR29sb21iIHtcblxuICBjb25zdHJ1Y3Rvcih3b3JraW5nRGF0YSkge1xuICAgIHRoaXMud29ya2luZ0RhdGEgPSB3b3JraW5nRGF0YTtcbiAgICAvLyB0aGUgbnVtYmVyIG9mIGJ5dGVzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGlzLndvcmtpbmdEYXRhXG4gICAgdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUgPSB0aGlzLndvcmtpbmdEYXRhLmJ5dGVMZW5ndGg7XG4gICAgLy8gdGhlIGN1cnJlbnQgd29yZCBiZWluZyBleGFtaW5lZFxuICAgIHRoaXMud29ya2luZ1dvcmQgPSAwOyAvLyA6dWludFxuICAgIC8vIHRoZSBudW1iZXIgb2YgYml0cyBsZWZ0IHRvIGV4YW1pbmUgaW4gdGhlIGN1cnJlbnQgd29yZFxuICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPSAwOyAvLyA6dWludFxuICB9XG5cbiAgLy8gKCk6dm9pZFxuICBsb2FkV29yZCgpIHtcbiAgICB2YXJcbiAgICAgIHBvc2l0aW9uID0gdGhpcy53b3JraW5nRGF0YS5ieXRlTGVuZ3RoIC0gdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUsXG4gICAgICB3b3JraW5nQnl0ZXMgPSBuZXcgVWludDhBcnJheSg0KSxcbiAgICAgIGF2YWlsYWJsZUJ5dGVzID0gTWF0aC5taW4oNCwgdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUpO1xuXG4gICAgaWYgKGF2YWlsYWJsZUJ5dGVzID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vIGJ5dGVzIGF2YWlsYWJsZScpO1xuICAgIH1cblxuICAgIHdvcmtpbmdCeXRlcy5zZXQodGhpcy53b3JraW5nRGF0YS5zdWJhcnJheShwb3NpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uICsgYXZhaWxhYmxlQnl0ZXMpKTtcbiAgICB0aGlzLndvcmtpbmdXb3JkID0gbmV3IERhdGFWaWV3KHdvcmtpbmdCeXRlcy5idWZmZXIpLmdldFVpbnQzMigwKTtcblxuICAgIC8vIHRyYWNrIHRoZSBhbW91bnQgb2YgdGhpcy53b3JraW5nRGF0YSB0aGF0IGhhcyBiZWVuIHByb2Nlc3NlZFxuICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgPSBhdmFpbGFibGVCeXRlcyAqIDg7XG4gICAgdGhpcy53b3JraW5nQnl0ZXNBdmFpbGFibGUgLT0gYXZhaWxhYmxlQnl0ZXM7XG4gIH07XG5cbiAgLy8gKGNvdW50OmludCk6dm9pZFxuICBza2lwQml0cyhjb3VudCkge1xuICAgIHZhciBza2lwQnl0ZXM7IC8vIDppbnRcbiAgICBpZiAodGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA+IGNvdW50KSB7XG4gICAgICB0aGlzLndvcmtpbmdXb3JkICAgICAgICAgIDw8PSBjb3VudDtcbiAgICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgLT0gY291bnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvdW50IC09IHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGU7XG4gICAgICBza2lwQnl0ZXMgPSBjb3VudCAvIDg7XG5cbiAgICAgIGNvdW50IC09IChza2lwQnl0ZXMgKiA4KTtcbiAgICAgIHRoaXMud29ya2luZ0J5dGVzQXZhaWxhYmxlIC09IHNraXBCeXRlcztcblxuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuXG4gICAgICB0aGlzLndvcmtpbmdXb3JkIDw8PSBjb3VudDtcbiAgICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgLT0gY291bnQ7XG4gICAgfVxuICB9O1xuXG4gIC8vIChzaXplOmludCk6dWludFxuICByZWFkQml0cyhzaXplKSB7XG4gICAgdmFyXG4gICAgICBiaXRzID0gTWF0aC5taW4odGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSwgc2l6ZSksIC8vIDp1aW50XG4gICAgICB2YWx1ID0gdGhpcy53b3JraW5nV29yZCA+Pj4gKDMyIC0gYml0cyk7IC8vIDp1aW50XG5cbiAgICBjb25zb2xlLmFzc2VydChzaXplIDwgMzIsICdDYW5ub3QgcmVhZCBtb3JlIHRoYW4gMzIgYml0cyBhdCBhIHRpbWUnKTtcblxuICAgIHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgLT0gYml0cztcbiAgICBpZiAodGhpcy53b3JraW5nQml0c0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMud29ya2luZ1dvcmQgPDw9IGJpdHM7XG4gICAgfSBlbHNlIGlmICh0aGlzLndvcmtpbmdCeXRlc0F2YWlsYWJsZSA+IDApIHtcbiAgICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICB9XG5cbiAgICBiaXRzID0gc2l6ZSAtIGJpdHM7XG4gICAgaWYgKGJpdHMgPiAwKSB7XG4gICAgICByZXR1cm4gdmFsdSA8PCBiaXRzIHwgdGhpcy5yZWFkQml0cyhiaXRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHZhbHU7XG4gICAgfVxuICB9O1xuXG4gIC8vICgpOnVpbnRcbiAgc2tpcExlYWRpbmdaZXJvcygpIHtcbiAgICB2YXIgbGVhZGluZ1plcm9Db3VudDsgLy8gOnVpbnRcbiAgICBmb3IgKGxlYWRpbmdaZXJvQ291bnQgPSAwIDsgbGVhZGluZ1plcm9Db3VudCA8IHRoaXMud29ya2luZ0JpdHNBdmFpbGFibGUgOyArK2xlYWRpbmdaZXJvQ291bnQpIHtcbiAgICAgIGlmICgwICE9PSAodGhpcy53b3JraW5nV29yZCAmICgweDgwMDAwMDAwID4+PiBsZWFkaW5nWmVyb0NvdW50KSkpIHtcbiAgICAgICAgLy8gdGhlIGZpcnN0IGJpdCBvZiB3b3JraW5nIHdvcmQgaXMgMVxuICAgICAgICB0aGlzLndvcmtpbmdXb3JkIDw8PSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICB0aGlzLndvcmtpbmdCaXRzQXZhaWxhYmxlIC09IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHdlIGV4aGF1c3RlZCB3b3JraW5nV29yZCBhbmQgc3RpbGwgaGF2ZSBub3QgZm91bmQgYSAxXG4gICAgdGhpcy5sb2FkV29yZCgpO1xuICAgIHJldHVybiBsZWFkaW5nWmVyb0NvdW50ICsgdGhpcy5za2lwTGVhZGluZ1plcm9zKCk7XG4gIH07XG5cbiAgLy8gKCk6dm9pZFxuICBza2lwVW5zaWduZWRFeHBHb2xvbWIoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTGVhZGluZ1plcm9zKCkpO1xuICB9O1xuXG4gIC8vICgpOnZvaWRcbiAgc2tpcEV4cEdvbG9tYigpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMZWFkaW5nWmVyb3MoKSk7XG4gIH07XG5cbiAgLy8gKCk6dWludFxuICByZWFkVW5zaWduZWRFeHBHb2xvbWIoKSB7XG4gICAgdmFyIGNseiA9IHRoaXMuc2tpcExlYWRpbmdaZXJvcygpOyAvLyA6dWludFxuICAgIHJldHVybiB0aGlzLnJlYWRCaXRzKGNseiArIDEpIC0gMTtcbiAgfTtcblxuICAvLyAoKTppbnRcbiAgcmVhZEV4cEdvbG9tYigpIHtcbiAgICB2YXIgdmFsdSA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIDppbnRcbiAgICBpZiAoMHgwMSAmIHZhbHUpIHtcbiAgICAgIC8vIHRoZSBudW1iZXIgaXMgb2RkIGlmIHRoZSBsb3cgb3JkZXIgYml0IGlzIHNldFxuICAgICAgcmV0dXJuICgxICsgdmFsdSkgPj4+IDE7IC8vIGFkZCAxIHRvIG1ha2UgaXQgZXZlbiwgYW5kIGRpdmlkZSBieSAyXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAtMSAqICh2YWx1ID4+PiAxKTsgLy8gZGl2aWRlIGJ5IHR3byB0aGVuIG1ha2UgaXQgbmVnYXRpdmVcbiAgICB9XG4gIH07XG5cbiAgLy8gU29tZSBjb252ZW5pZW5jZSBmdW5jdGlvbnNcbiAgLy8gOkJvb2xlYW5cbiAgcmVhZEJvb2xlYW4oKSB7XG4gICAgcmV0dXJuIDEgPT09IHRoaXMucmVhZEJpdHMoMSk7XG4gIH07XG5cbiAgLy8gKCk6aW50XG4gIHJlYWRVbnNpZ25lZEJ5dGUoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoOCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFkdmFuY2UgdGhlIEV4cEdvbG9tYiBkZWNvZGVyIHBhc3QgYSBzY2FsaW5nIGxpc3QuIFRoZSBzY2FsaW5nXG4gICAqIGxpc3QgaXMgb3B0aW9uYWxseSB0cmFuc21pdHRlZCBhcyBwYXJ0IG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyXG4gICAqIHNldCBhbmQgaXMgbm90IHJlbGV2YW50IHRvIHRyYW5zbXV4aW5nLlxuICAgKiBAcGFyYW0gY291bnQge251bWJlcn0gdGhlIG51bWJlciBvZiBlbnRyaWVzIGluIHRoaXMgc2NhbGluZyBsaXN0XG4gICAqIEBzZWUgUmVjb21tZW5kYXRpb24gSVRVLVQgSC4yNjQsIFNlY3Rpb24gNy4zLjIuMS4xLjFcbiAgICovXG4gIHNraXBTY2FsaW5nTGlzdChjb3VudCkge1xuICAgIHZhclxuICAgICAgbGFzdFNjYWxlID0gOCxcbiAgICAgIG5leHRTY2FsZSA9IDgsXG4gICAgICBqLFxuICAgICAgZGVsdGFTY2FsZTtcblxuICAgIGZvciAoaiA9IDA7IGogPCBjb3VudDsgaisrKSB7XG4gICAgICBpZiAobmV4dFNjYWxlICE9PSAwKSB7XG4gICAgICAgIGRlbHRhU2NhbGUgPSB0aGlzLnJlYWRFeHBHb2xvbWIoKTtcbiAgICAgICAgbmV4dFNjYWxlID0gKGxhc3RTY2FsZSArIGRlbHRhU2NhbGUgKyAyNTYpICUgMjU2O1xuICAgICAgfVxuXG4gICAgICBsYXN0U2NhbGUgPSAobmV4dFNjYWxlID09PSAwKSA/IGxhc3RTY2FsZSA6IG5leHRTY2FsZTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlYWQgYSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGFuZCByZXR1cm4gc29tZSBpbnRlcmVzdGluZyB2aWRlb1xuICAgKiBwcm9wZXJ0aWVzLiBBIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQgaXMgdGhlIEgyNjQgbWV0YWRhdGEgdGhhdFxuICAgKiBkZXNjcmliZXMgdGhlIHByb3BlcnRpZXMgb2YgdXBjb21pbmcgdmlkZW8gZnJhbWVzLlxuICAgKiBAcGFyYW0gZGF0YSB7VWludDhBcnJheX0gdGhlIGJ5dGVzIG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldFxuICAgKiBAcmV0dXJuIHtvYmplY3R9IGFuIG9iamVjdCB3aXRoIGNvbmZpZ3VyYXRpb24gcGFyc2VkIGZyb20gdGhlXG4gICAqIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQsIGluY2x1ZGluZyB0aGUgZGltZW5zaW9ucyBvZiB0aGVcbiAgICogYXNzb2NpYXRlZCB2aWRlbyBmcmFtZXMuXG4gICAqL1xuICByZWFkU2VxdWVuY2VQYXJhbWV0ZXJTZXQoKSB7XG4gICAgdmFyXG4gICAgICBmcmFtZUNyb3BMZWZ0T2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ID0gMCxcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BCb3R0b21PZmZzZXQgPSAwLFxuICAgICAgcHJvZmlsZUlkYywgbGV2ZWxJZGMsIHByb2ZpbGVDb21wYXRpYmlsaXR5LFxuICAgICAgY2hyb21hRm9ybWF0SWRjLCBwaWNPcmRlckNudFR5cGUsXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUsIHBpY1dpZHRoSW5NYnNNaW51czEsXG4gICAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxLFxuICAgICAgZnJhbWVNYnNPbmx5RmxhZyxcbiAgICAgIHNjYWxpbmdMaXN0Q291bnQsXG4gICAgICBpO1xuXG4gICAgcHJvZmlsZUlkYyA9IHRoaXMucmVhZFVuc2lnbmVkQnl0ZSgpOyAvLyBwcm9maWxlX2lkY1xuICAgIHByb2ZpbGVDb21wYXRpYmlsaXR5ID0gdGhpcy5yZWFkQml0cyg1KTsgLy8gY29uc3RyYWludF9zZXRbMC01XV9mbGFnXG4gICAgdGhpcy5za2lwQml0cygzKTsgLy8gIHUoMSksIHJlc2VydmVkX3plcm9fMmJpdHMgdSgyKVxuICAgIGxldmVsSWRjID0gdGhpcy5yZWFkVW5zaWduZWRCeXRlKCk7IC8vIGxldmVsX2lkYyB1KDgpXG4gICAgdGhpcy5za2lwVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gc2VxX3BhcmFtZXRlcl9zZXRfaWRcblxuICAgIC8vIHNvbWUgcHJvZmlsZXMgaGF2ZSBtb3JlIG9wdGlvbmFsIGRhdGEgd2UgZG9uJ3QgbmVlZFxuICAgIGlmIChwcm9maWxlSWRjID09PSAxMDAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTEwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDEyMiB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAyNDQgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gNDQgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gODMgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gODYgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTE4IHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDEyOCkge1xuICAgICAgY2hyb21hRm9ybWF0SWRjID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGlmIChjaHJvbWFGb3JtYXRJZGMgPT09IDMpIHtcbiAgICAgICAgdGhpcy5za2lwQml0cygxKTsgLy8gc2VwYXJhdGVfY29sb3VyX3BsYW5lX2ZsYWdcbiAgICAgIH1cbiAgICAgIHRoaXMuc2tpcFVuc2lnbmVkRXhwR29sb21iKCk7IC8vIGJpdF9kZXB0aF9sdW1hX21pbnVzOFxuICAgICAgdGhpcy5za2lwVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gYml0X2RlcHRoX2Nocm9tYV9taW51czhcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIHFwcHJpbWVfeV96ZXJvX3RyYW5zZm9ybV9ieXBhc3NfZmxhZ1xuICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkgeyAvLyBzZXFfc2NhbGluZ19tYXRyaXhfcHJlc2VudF9mbGFnXG4gICAgICAgIHNjYWxpbmdMaXN0Q291bnQgPSAoY2hyb21hRm9ybWF0SWRjICE9PSAzKSA/IDggOiAxMjtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHNjYWxpbmdMaXN0Q291bnQ7IGkrKykge1xuICAgICAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbGlzdF9wcmVzZW50X2ZsYWdbIGkgXVxuICAgICAgICAgICAgaWYgKGkgPCA2KSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDE2KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuc2tpcFNjYWxpbmdMaXN0KDY0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnNraXBVbnNpZ25lZEV4cEdvbG9tYigpOyAvLyBsb2cyX21heF9mcmFtZV9udW1fbWludXM0XG4gICAgcGljT3JkZXJDbnRUeXBlID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcblxuICAgIGlmIChwaWNPcmRlckNudFR5cGUgPT09IDApIHtcbiAgICAgIHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7IC8vbG9nMl9tYXhfcGljX29yZGVyX2NudF9sc2JfbWludXM0XG4gICAgfSBlbHNlIGlmIChwaWNPcmRlckNudFR5cGUgPT09IDEpIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGRlbHRhX3BpY19vcmRlcl9hbHdheXNfemVyb19mbGFnXG4gICAgICB0aGlzLnNraXBFeHBHb2xvbWIoKTsgLy8gb2Zmc2V0X2Zvcl9ub25fcmVmX3BpY1xuICAgICAgdGhpcy5za2lwRXhwR29sb21iKCk7IC8vIG9mZnNldF9mb3JfdG9wX3RvX2JvdHRvbV9maWVsZFxuICAgICAgbnVtUmVmRnJhbWVzSW5QaWNPcmRlckNudEN5Y2xlID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICAgIGZvcihpID0gMDsgaSA8IG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZTsgaSsrKSB7XG4gICAgICAgIHRoaXMuc2tpcEV4cEdvbG9tYigpOyAvLyBvZmZzZXRfZm9yX3JlZl9mcmFtZVsgaSBdXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5za2lwVW5zaWduZWRFeHBHb2xvbWIoKTsgLy8gbWF4X251bV9yZWZfZnJhbWVzXG4gICAgdGhpcy5za2lwQml0cygxKTsgLy8gZ2Fwc19pbl9mcmFtZV9udW1fdmFsdWVfYWxsb3dlZF9mbGFnXG5cbiAgICBwaWNXaWR0aEluTWJzTWludXMxID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcblxuICAgIGZyYW1lTWJzT25seUZsYWcgPSB0aGlzLnJlYWRCaXRzKDEpO1xuICAgIGlmIChmcmFtZU1ic09ubHlGbGFnID09PSAwKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBtYl9hZGFwdGl2ZV9mcmFtZV9maWVsZF9mbGFnXG4gICAgfVxuXG4gICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGlyZWN0Xzh4OF9pbmZlcmVuY2VfZmxhZ1xuICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gZnJhbWVfY3JvcHBpbmdfZmxhZ1xuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IHRoaXMucmVhZFVuc2lnbmVkRXhwR29sb21iKCk7XG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSB0aGlzLnJlYWRVbnNpZ25lZEV4cEdvbG9tYigpO1xuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gdGhpcy5yZWFkVW5zaWduZWRFeHBHb2xvbWIoKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgcHJvZmlsZUlkYzogcHJvZmlsZUlkYyxcbiAgICAgIGxldmVsSWRjOiBsZXZlbElkYyxcbiAgICAgIHByb2ZpbGVDb21wYXRpYmlsaXR5OiBwcm9maWxlQ29tcGF0aWJpbGl0eSxcbiAgICAgIHdpZHRoOiAoKHBpY1dpZHRoSW5NYnNNaW51czEgKyAxKSAqIDE2KSAtIGZyYW1lQ3JvcExlZnRPZmZzZXQgKiAyIC0gZnJhbWVDcm9wUmlnaHRPZmZzZXQgKiAyLFxuICAgICAgaGVpZ2h0OiAoKDIgLSBmcmFtZU1ic09ubHlGbGFnKSAqIChwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxICsgMSkgKiAxNikgLSAoZnJhbWVDcm9wVG9wT2Zmc2V0ICogMikgLSAoZnJhbWVDcm9wQm90dG9tT2Zmc2V0ICogMilcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEV4cEdvbG9tYjtcbiIsIi8qKlxuICogQSBzdHJlYW0tYmFzZWQgbXAydHMgdG8gbXA0IGNvbnZlcnRlci4gVGhpcyB1dGlsaXR5IGlzIHVzZWQgdG9cbiAqIGRlbGl2ZXIgbXA0cyB0byBhIFNvdXJjZUJ1ZmZlciBvbiBwbGF0Zm9ybXMgdGhhdCBzdXBwb3J0IG5hdGl2ZVxuICogTWVkaWEgU291cmNlIEV4dGVuc2lvbnMuXG4gKi9cblxuaW1wb3J0IEV4cEdvbG9tYiAgICAgICBmcm9tICcuL2V4cC1nb2xvbWInO1xuaW1wb3J0IFN0cmVhbSAgICAgICAgICBmcm9tICcuLi91dGlscy9zdHJlYW0nO1xuaW1wb3J0IE1QNCAgICAgICAgICAgICBmcm9tICcuLi9yZW11eC9tcDQtZ2VuZXJhdG9yJztcblxuY29uc3QgTVAyVF9QQUNLRVRfTEVOR1RIID0gMTg4OyAvLyBieXRlc1xuY29uc3QgSDI2NF9TVFJFQU1fVFlQRSA9IDB4MWI7XG5jb25zdCBBRFRTX1NUUkVBTV9UWVBFID0gMHgwZjtcbmNvbnN0IFBBVF9QSUQgPSAwO1xuXG4vKipcbiAqIFNwbGl0cyBhbiBpbmNvbWluZyBzdHJlYW0gb2YgYmluYXJ5IGRhdGEgaW50byBNUEVHLTIgVHJhbnNwb3J0XG4gKiBTdHJlYW0gcGFja2V0cy5cbiAqL1xuY2xhc3MgVHJhbnNwb3J0UGFja2V0U3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KE1QMlRfUEFDS0VUX0xFTkdUSCk7XG4gICAgdGhpcy5lbmQgPSAwO1xuICB9XG5cbiAgcHVzaChieXRlcykge1xuICAgIHZhciByZW1haW5pbmcsIGk7XG5cbiAgICAvLyBjbGVhciBvdXQgYW55IHBhcnRpYWwgcGFja2V0cyBpbiB0aGUgYnVmZmVyXG4gICAgaWYgKHRoaXMuZW5kID4gMCkge1xuICAgICAgcmVtYWluaW5nID0gTVAyVF9QQUNLRVRfTEVOR1RIIC0gdGhpcy5lbmQ7XG4gICAgICB0aGlzLmJ1ZmZlci5zZXQoYnl0ZXMuc3ViYXJyYXkoMCwgcmVtYWluaW5nKSwgdGhpcy5lbmQpO1xuXG4gICAgICAvLyB3ZSBzdGlsbCBkaWRuJ3Qgd3JpdGUgb3V0IGEgY29tcGxldGUgcGFja2V0XG4gICAgICBpZiAoYnl0ZXMuYnl0ZUxlbmd0aCA8IHJlbWFpbmluZykge1xuICAgICAgICB0aGlzLmVuZCArPSBieXRlcy5ieXRlTGVuZ3RoO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGJ5dGVzID0gYnl0ZXMuc3ViYXJyYXkocmVtYWluaW5nKTtcbiAgICAgIHRoaXMuZW5kID0gMDtcbiAgICAgIHN1cGVyLnRyaWdnZXIoJ2RhdGEnLCBidWZmZXIpO1xuICAgIH1cblxuICAgIC8vIGlmIGxlc3MgdGhhbiBhIHNpbmdsZSBwYWNrZXQgaXMgYXZhaWxhYmxlLCBidWZmZXIgaXQgdXAgZm9yIGxhdGVyXG4gICAgaWYgKGJ5dGVzLmJ5dGVMZW5ndGggPCBNUDJUX1BBQ0tFVF9MRU5HVEgpIHtcbiAgICAgIHRoaXMuYnVmZmVyLnNldChieXRlcy5zdWJhcnJheShpKSwgdGhpcy5lbmQpO1xuICAgICAgdGhpcy5lbmQgKz0gYnl0ZXMuYnl0ZUxlbmd0aDtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gcGFyc2Ugb3V0IGFsbCB0aGUgY29tcGxldGVkIHBhY2tldHNcbiAgICBpID0gMDtcbiAgICBkbyB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2RhdGEnLCBieXRlcy5zdWJhcnJheShpLCBpICsgTVAyVF9QQUNLRVRfTEVOR1RIKSk7XG4gICAgICBpICs9IE1QMlRfUEFDS0VUX0xFTkdUSDtcbiAgICAgIHJlbWFpbmluZyA9IGJ5dGVzLmJ5dGVMZW5ndGggLSBpO1xuICAgIH0gd2hpbGUgKGkgPCBieXRlcy5ieXRlTGVuZ3RoICYmIHJlbWFpbmluZyA+PSBNUDJUX1BBQ0tFVF9MRU5HVEgpO1xuICAgIC8vIGJ1ZmZlciBhbnkgcGFydGlhbCBwYWNrZXRzIGxlZnQgb3ZlclxuICAgIGlmIChyZW1haW5pbmcgPiAwKSB7XG4gICAgICB0aGlzLmJ1ZmZlci5zZXQoYnl0ZXMuc3ViYXJyYXkoaSkpO1xuICAgICAgdGhpcy5lbmQgPSByZW1haW5pbmc7XG4gICAgfVxuICB9O1xufTtcblxuLyoqXG4gKiBBY2NlcHRzIGFuIE1QMlQgVHJhbnNwb3J0UGFja2V0U3RyZWFtIGFuZCBlbWl0cyBkYXRhIGV2ZW50cyB3aXRoIHBhcnNlZFxuICogZm9ybXMgb2YgdGhlIGluZGl2aWR1YWwgdHJhbnNwb3J0IHN0cmVhbSBwYWNrZXRzLlxuICovXG5jbGFzcyBUcmFuc3BvcnRQYXJzZVN0cmVhbSBleHRlbmRzIFN0cmVhbSB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5wcm9ncmFtTWFwVGFibGUgPSB7fTtcbiAgfVxuXG4gIHBhcnNlUHNpKHBheWxvYWQsIHBzaSkge1xuICAgIHZhciBvZmZzZXQgPSAwO1xuICAgIC8vIFBTSSBwYWNrZXRzIG1heSBiZSBzcGxpdCBpbnRvIG11bHRpcGxlIHNlY3Rpb25zIGFuZCB0aG9zZVxuICAgIC8vIHNlY3Rpb25zIG1heSBiZSBzcGxpdCBpbnRvIG11bHRpcGxlIHBhY2tldHMuIElmIGEgUFNJXG4gICAgLy8gc2VjdGlvbiBzdGFydHMgaW4gdGhpcyBwYWNrZXQsIHRoZSBwYXlsb2FkX3VuaXRfc3RhcnRfaW5kaWNhdG9yXG4gICAgLy8gd2lsbCBiZSB0cnVlIGFuZCB0aGUgZmlyc3QgYnl0ZSBvZiB0aGUgcGF5bG9hZCB3aWxsIGluZGljYXRlXG4gICAgLy8gdGhlIG9mZnNldCBmcm9tIHRoZSBjdXJyZW50IHBvc2l0aW9uIHRvIHRoZSBzdGFydCBvZiB0aGVcbiAgICAvLyBzZWN0aW9uLlxuICAgIGlmIChwc2kucGF5bG9hZFVuaXRTdGFydEluZGljYXRvcikge1xuICAgICAgb2Zmc2V0ICs9IHBheWxvYWRbb2Zmc2V0XSArIDE7XG4gICAgfVxuXG4gICAgaWYgKHBzaS50eXBlID09PSAncGF0Jykge1xuICAgICAgdGhpcy5wYXJzZVBhdChwYXlsb2FkLnN1YmFycmF5KG9mZnNldCksIHBzaSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucGFyc2VQbXQocGF5bG9hZC5zdWJhcnJheShvZmZzZXQpLCBwc2kpO1xuICAgIH1cbiAgfTtcblxuICBwYXJzZVBhdChwYXlsb2FkLCBwYXQpIHtcbiAgICBwYXQuc2VjdGlvbl9udW1iZXIgPSBwYXlsb2FkWzddO1xuICAgIHBhdC5sYXN0X3NlY3Rpb25fbnVtYmVyID0gcGF5bG9hZFs4XTtcblxuICAgIC8vIHNraXAgdGhlIFBTSSBoZWFkZXIgYW5kIHBhcnNlIHRoZSBmaXJzdCBQTVQgZW50cnlcbiAgICBwYXQucG10UGlkID0gdGhpcy5wbXRQaWQgPSAocGF5bG9hZFsxMF0gJiAweDFGKSA8PCA4IHwgcGF5bG9hZFsxMV07XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhcnNlIG91dCB0aGUgcmVsZXZhbnQgZmllbGRzIG9mIGEgUHJvZ3JhbSBNYXAgVGFibGUgKFBNVCkuXG4gICAqIEBwYXJhbSBwYXlsb2FkIHtVaW50OEFycmF5fSB0aGUgUE1ULXNwZWNpZmljIHBvcnRpb24gb2YgYW4gTVAyVFxuICAgKiBwYWNrZXQuIFRoZSBmaXJzdCBieXRlIGluIHRoaXMgYXJyYXkgc2hvdWxkIGJlIHRoZSB0YWJsZV9pZFxuICAgKiBmaWVsZC5cbiAgICogQHBhcmFtIHBtdCB7b2JqZWN0fSB0aGUgb2JqZWN0IHRoYXQgc2hvdWxkIGJlIGRlY29yYXRlZCB3aXRoXG4gICAqIGZpZWxkcyBwYXJzZWQgZnJvbSB0aGUgUE1ULlxuICAgKi9cbiAgcGFyc2VQbXQocGF5bG9hZCwgcG10KSB7XG4gICAgdmFyIHNlY3Rpb25MZW5ndGgsIHRhYmxlRW5kLCBwcm9ncmFtSW5mb0xlbmd0aCwgb2Zmc2V0O1xuXG4gICAgLy8gUE1UcyBjYW4gYmUgc2VudCBhaGVhZCBvZiB0aGUgdGltZSB3aGVuIHRoZXkgc2hvdWxkIGFjdHVhbGx5XG4gICAgLy8gdGFrZSBlZmZlY3QuIFdlIGRvbid0IGJlbGlldmUgdGhpcyBzaG91bGQgZXZlciBiZSB0aGUgY2FzZVxuICAgIC8vIGZvciBITFMgYnV0IHdlJ2xsIGlnbm9yZSBcImZvcndhcmRcIiBQTVQgZGVjbGFyYXRpb25zIGlmIHdlIHNlZVxuICAgIC8vIHRoZW0uIEZ1dHVyZSBQTVQgZGVjbGFyYXRpb25zIGhhdmUgdGhlIGN1cnJlbnRfbmV4dF9pbmRpY2F0b3JcbiAgICAvLyBzZXQgdG8gemVyby5cbiAgICBpZiAoIShwYXlsb2FkWzVdICYgMHgwMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBvdmVyd3JpdGUgYW55IGV4aXN0aW5nIHByb2dyYW0gbWFwIHRhYmxlXG4gICAgdGhpcy5wcm9ncmFtTWFwVGFibGUgPSB7fTtcblxuICAgIC8vIHRoZSBtYXBwaW5nIHRhYmxlIGVuZHMgYXQgdGhlIGVuZCBvZiB0aGUgY3VycmVudCBzZWN0aW9uXG4gICAgc2VjdGlvbkxlbmd0aCA9IChwYXlsb2FkWzFdICYgMHgwZikgPDwgOCB8IHBheWxvYWRbMl07XG4gICAgdGFibGVFbmQgPSAzICsgc2VjdGlvbkxlbmd0aCAtIDQ7XG5cbiAgICAvLyB0byBkZXRlcm1pbmUgd2hlcmUgdGhlIHRhYmxlIGlzLCB3ZSBoYXZlIHRvIGZpZ3VyZSBvdXQgaG93XG4gICAgLy8gbG9uZyB0aGUgcHJvZ3JhbSBpbmZvIGRlc2NyaXB0b3JzIGFyZVxuICAgIHByb2dyYW1JbmZvTGVuZ3RoID0gKHBheWxvYWRbMTBdICYgMHgwZikgPDwgOCB8IHBheWxvYWRbMTFdO1xuXG4gICAgLy8gYWR2YW5jZSB0aGUgb2Zmc2V0IHRvIHRoZSBmaXJzdCBlbnRyeSBpbiB0aGUgbWFwcGluZyB0YWJsZVxuICAgIG9mZnNldCA9IDEyICsgcHJvZ3JhbUluZm9MZW5ndGg7XG4gICAgd2hpbGUgKG9mZnNldCA8IHRhYmxlRW5kKSB7XG4gICAgICAvLyBhZGQgYW4gZW50cnkgdGhhdCBtYXBzIHRoZSBlbGVtZW50YXJ5X3BpZCB0byB0aGUgc3RyZWFtX3R5cGVcbiAgICAgIHRoaXMucHJvZ3JhbU1hcFRhYmxlWyhwYXlsb2FkW29mZnNldCArIDFdICYgMHgxRikgPDwgOCB8IHBheWxvYWRbb2Zmc2V0ICsgMl1dID0gcGF5bG9hZFtvZmZzZXRdO1xuXG4gICAgICAvLyBtb3ZlIHRvIHRoZSBuZXh0IHRhYmxlIGVudHJ5XG4gICAgICAvLyBza2lwIHBhc3QgdGhlIGVsZW1lbnRhcnkgc3RyZWFtIGRlc2NyaXB0b3JzLCBpZiBwcmVzZW50XG4gICAgICBvZmZzZXQgKz0gKChwYXlsb2FkW29mZnNldCArIDNdICYgMHgwRikgPDwgOCB8IHBheWxvYWRbb2Zmc2V0ICsgNF0pICsgNTtcbiAgICB9XG5cbiAgICAvLyByZWNvcmQgdGhlIG1hcCBvbiB0aGUgcGFja2V0IGFzIHdlbGxcbiAgICBwbXQucHJvZ3JhbU1hcFRhYmxlID0gdGhpcy5wcm9ncmFtTWFwVGFibGU7XG4gIH07XG5cbiAgcGFyc2VQZXMocGF5bG9hZCwgcGVzKSB7XG4gICAgdmFyIHB0c0R0c0ZsYWdzO1xuXG4gICAgaWYgKCFwZXMucGF5bG9hZFVuaXRTdGFydEluZGljYXRvcikge1xuICAgICAgcGVzLmRhdGEgPSBwYXlsb2FkO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIGZpbmQgb3V0IGlmIHRoaXMgcGFja2V0cyBzdGFydHMgYSBuZXcga2V5ZnJhbWVcbiAgICBwZXMuZGF0YUFsaWdubWVudEluZGljYXRvciA9IChwYXlsb2FkWzZdICYgMHgwNCkgIT09IDA7XG4gICAgLy8gUEVTIHBhY2tldHMgbWF5IGJlIGFubm90YXRlZCB3aXRoIGEgUFRTIHZhbHVlLCBvciBhIFBUUyB2YWx1ZVxuICAgIC8vIGFuZCBhIERUUyB2YWx1ZS4gRGV0ZXJtaW5lIHdoYXQgY29tYmluYXRpb24gb2YgdmFsdWVzIGlzXG4gICAgLy8gYXZhaWxhYmxlIHRvIHdvcmsgd2l0aC5cbiAgICBwdHNEdHNGbGFncyA9IHBheWxvYWRbN107XG5cbiAgICAvLyBQVFMgYW5kIERUUyBhcmUgbm9ybWFsbHkgc3RvcmVkIGFzIGEgMzMtYml0IG51bWJlci4gIEphdmFzY3JpcHRcbiAgICAvLyBwZXJmb3JtcyBhbGwgYml0d2lzZSBvcGVyYXRpb25zIG9uIDMyLWJpdCBpbnRlZ2VycyBidXQgaXQnc1xuICAgIC8vIGNvbnZlbmllbnQgdG8gY29udmVydCBmcm9tIDkwbnMgdG8gMW1zIHRpbWUgc2NhbGUgYW55d2F5LiBTb1xuICAgIC8vIHdoYXQgd2UgYXJlIGdvaW5nIHRvIGRvIGluc3RlYWQgaXMgZHJvcCB0aGUgbGVhc3Qgc2lnbmlmaWNhbnRcbiAgICAvLyBiaXQgKGluIGVmZmVjdCwgZGl2aWRpbmcgYnkgdHdvKSB0aGVuIHdlIGNhbiBkaXZpZGUgYnkgNDUgKDQ1ICpcbiAgICAvLyAyID0gOTApIHRvIGdldCBtcy5cbiAgICBpZiAocHRzRHRzRmxhZ3MgJiAweEMwKSB7XG4gICAgICAvLyB0aGUgUFRTIGFuZCBEVFMgYXJlIG5vdCB3cml0dGVuIG91dCBkaXJlY3RseS4gRm9yIGluZm9ybWF0aW9uXG4gICAgICAvLyBvbiBob3cgdGhleSBhcmUgZW5jb2RlZCwgc2VlXG4gICAgICAvLyBodHRwOi8vZHZkLnNvdXJjZWZvcmdlLm5ldC9kdmRpbmZvL3Blcy1oZHIuaHRtbFxuICAgICAgcGVzLnB0cyA9IChwYXlsb2FkWzldICYgMHgwRSkgPDwgMjhcbiAgICAgICAgfCAocGF5bG9hZFsxMF0gJiAweEZGKSA8PCAyMVxuICAgICAgICB8IChwYXlsb2FkWzExXSAmIDB4RkUpIDw8IDEzXG4gICAgICAgIHwgKHBheWxvYWRbMTJdICYgMHhGRikgPDwgIDZcbiAgICAgICAgfCAocGF5bG9hZFsxM10gJiAweEZFKSA+Pj4gIDI7XG4gICAgICBwZXMucHRzIC89IDQ1O1xuICAgICAgcGVzLmR0cyA9IHBlcy5wdHM7XG4gICAgICBpZiAocHRzRHRzRmxhZ3MgJiAweDQwKSB7XG4gICAgICAgIHBlcy5kdHMgPSAocGF5bG9hZFsxNF0gJiAweDBFICkgPDwgMjhcbiAgICAgICAgICB8IChwYXlsb2FkWzE1XSAmIDB4RkYgKSA8PCAyMVxuICAgICAgICAgIHwgKHBheWxvYWRbMTZdICYgMHhGRSApIDw8IDEzXG4gICAgICAgICAgfCAocGF5bG9hZFsxN10gJiAweEZGICkgPDwgNlxuICAgICAgICAgIHwgKHBheWxvYWRbMThdICYgMHhGRSApID4+PiAyO1xuICAgICAgICBwZXMuZHRzIC89IDQ1O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHRoZSBkYXRhIHNlY3Rpb24gc3RhcnRzIGltbWVkaWF0ZWx5IGFmdGVyIHRoZSBQRVMgaGVhZGVyLlxuICAgIC8vIHBlc19oZWFkZXJfZGF0YV9sZW5ndGggc3BlY2lmaWVzIHRoZSBudW1iZXIgb2YgaGVhZGVyIGJ5dGVzXG4gICAgLy8gdGhhdCBmb2xsb3cgdGhlIGxhc3QgYnl0ZSBvZiB0aGUgZmllbGQuXG4gICAgcGVzLmRhdGEgPSBwYXlsb2FkLnN1YmFycmF5KDkgKyBwYXlsb2FkWzhdKTtcbiAgfTtcblxuICAvKipcbiAgICogRGVsaXZlciBhIG5ldyBNUDJUIHBhY2tldCB0byB0aGUgc3RyZWFtLlxuICAgKi9cbiAgcHVzaChwYWNrZXQpIHtcbiAgICB2YXJcbiAgICAgIHJlc3VsdCA9IHt9LFxuICAgICAgb2Zmc2V0ID0gNDtcbiAgICAvLyBtYWtlIHN1cmUgcGFja2V0IGlzIGFsaWduZWQgb24gYSBzeW5jIGJ5dGVcbiAgICBpZiAocGFja2V0WzBdICE9PSAweDQ3KSB7XG4gICAgICByZXR1cm4gdGhpcy50cmlnZ2VyKCdlcnJvcicsICdtaXMtYWxpZ25lZCBwYWNrZXQnKTtcbiAgICB9XG4gICAgcmVzdWx0LnBheWxvYWRVbml0U3RhcnRJbmRpY2F0b3IgPSAhIShwYWNrZXRbMV0gJiAweDQwKTtcblxuICAgIC8vIHBpZCBpcyBhIDEzLWJpdCBmaWVsZCBzdGFydGluZyBhdCB0aGUgbGFzdCBiaXQgb2YgcGFja2V0WzFdXG4gICAgcmVzdWx0LnBpZCA9IHBhY2tldFsxXSAmIDB4MWY7XG4gICAgcmVzdWx0LnBpZCA8PD0gODtcbiAgICByZXN1bHQucGlkIHw9IHBhY2tldFsyXTtcblxuICAgIC8vIGlmIGFuIGFkYXB0aW9uIGZpZWxkIGlzIHByZXNlbnQsIGl0cyBsZW5ndGggaXMgc3BlY2lmaWVkIGJ5IHRoZVxuICAgIC8vIGZpZnRoIGJ5dGUgb2YgdGhlIFRTIHBhY2tldCBoZWFkZXIuIFRoZSBhZGFwdGF0aW9uIGZpZWxkIGlzXG4gICAgLy8gdXNlZCB0byBhZGQgc3R1ZmZpbmcgdG8gUEVTIHBhY2tldHMgdGhhdCBkb24ndCBmaWxsIGEgY29tcGxldGVcbiAgICAvLyBUUyBwYWNrZXQsIGFuZCB0byBzcGVjaWZ5IHNvbWUgZm9ybXMgb2YgdGltaW5nIGFuZCBjb250cm9sIGRhdGFcbiAgICAvLyB0aGF0IHdlIGRvIG5vdCBjdXJyZW50bHkgdXNlLlxuICAgIGlmICgoKHBhY2tldFszXSAmIDB4MzApID4+PiA0KSA+IDB4MDEpIHtcbiAgICAgIG9mZnNldCArPSBwYWNrZXRbb2Zmc2V0XSArIDE7XG4gICAgfVxuXG4gICAgLy8gcGFyc2UgdGhlIHJlc3Qgb2YgdGhlIHBhY2tldCBiYXNlZCBvbiB0aGUgdHlwZVxuICAgIGlmIChyZXN1bHQucGlkID09PSBQQVRfUElEKSB7XG4gICAgICByZXN1bHQudHlwZSA9ICdwYXQnO1xuICAgICAgdGhpcy5wYXJzZVBzaShwYWNrZXQuc3ViYXJyYXkob2Zmc2V0KSwgcmVzdWx0KTtcbiAgICB9IGVsc2UgaWYgKHJlc3VsdC5waWQgPT09IHRoaXMucG10UGlkKSB7XG4gICAgICByZXN1bHQudHlwZSA9ICdwbXQnO1xuICAgICAgdGhpcy5wYXJzZVBzaShwYWNrZXQuc3ViYXJyYXkob2Zmc2V0KSwgcmVzdWx0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0LnN0cmVhbVR5cGUgPSB0aGlzLnByb2dyYW1NYXBUYWJsZVtyZXN1bHQucGlkXTtcbiAgICAgIGlmKHJlc3VsdC5zdHJlYW1UeXBlID09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQudHlwZSA9ICdwZXMnO1xuICAgICAgICB0aGlzLnBhcnNlUGVzKHBhY2tldC5zdWJhcnJheShvZmZzZXQpLCByZXN1bHQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMudHJpZ2dlcignZGF0YScsIHJlc3VsdCk7XG4gIH07XG59O1xuXG4vKipcbiAqIFJlY29uc2lzdHV0ZXMgcHJvZ3JhbSBlbGVtZW50YXJ5IHN0cmVhbSAoUEVTKSBwYWNrZXRzIGZyb20gcGFyc2VkXG4gKiB0cmFuc3BvcnQgc3RyZWFtIHBhY2tldHMuIFRoYXQgaXMsIGlmIHlvdSBwaXBlIGFuXG4gKiBtcDJ0LlRyYW5zcG9ydFBhcnNlU3RyZWFtIGludG8gYSBtcDJ0LkVsZW1lbnRhcnlTdHJlYW0sIHRoZSBvdXRwdXRcbiAqIGV2ZW50cyB3aWxsIGJlIGV2ZW50cyB3aGljaCBjYXB0dXJlIHRoZSBieXRlcyBmb3IgaW5kaXZpZHVhbCBQRVNcbiAqIHBhY2tldHMgcGx1cyByZWxldmFudCBtZXRhZGF0YSB0aGF0IGhhcyBiZWVuIGV4dHJhY3RlZCBmcm9tIHRoZVxuICogY29udGFpbmVyLlxuICovXG5jbGFzcyBFbGVtZW50YXJ5U3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuYXVkaW8gPSB7ZGF0YTogW10sc2l6ZTogMH07XG4gICAgdGhpcy52aWRlbyA9IHtkYXRhOiBbXSxzaXplOiAwfTtcbiAgfVxuXG4gIGZsdXNoU3RyZWFtKHN0cmVhbSwgdHlwZSkge1xuICAgIHZhclxuICAgICAgZXZlbnQgPSB7XG4gICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgIGRhdGE6IG5ldyBVaW50OEFycmF5KHN0cmVhbS5zaXplKSxcbiAgICAgIH0sXG4gICAgICBpID0gMCxcbiAgICAgIGZyYWdtZW50O1xuXG4gICAgLy8gZG8gbm90aGluZyBpZiB0aGVyZSBpcyBubyBidWZmZXJlZCBkYXRhXG4gICAgaWYgKCFzdHJlYW0uZGF0YS5sZW5ndGgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZXZlbnQudHJhY2tJZCA9IHN0cmVhbS5kYXRhWzBdLnBpZDtcbiAgICBldmVudC5wdHMgPSBzdHJlYW0uZGF0YVswXS5wdHM7XG4gICAgZXZlbnQuZHRzID0gc3RyZWFtLmRhdGFbMF0uZHRzO1xuICAgIC8vaWYodHlwZSA9PSAnYXVkaW8nKSB7XG4gICAgICAvL2NvbnNvbGUubG9nKFwiUEVTIGF1ZGlvIHNpemUvUFRTOlwiICsgc3RyZWFtLnNpemUgKyBcIi9cIiArIGV2ZW50LnB0cyk7XG4gICAgLy99XG4gICAgLy8gcmVhc3NlbWJsZSB0aGUgcGFja2V0XG4gICAgd2hpbGUgKHN0cmVhbS5kYXRhLmxlbmd0aCkge1xuICAgICAgZnJhZ21lbnQgPSBzdHJlYW0uZGF0YS5zaGlmdCgpO1xuXG4gICAgICBldmVudC5kYXRhLnNldChmcmFnbWVudC5kYXRhLCBpKTtcbiAgICAgIGkgKz0gZnJhZ21lbnQuZGF0YS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICBzdHJlYW0uc2l6ZSA9IDA7XG4gICAgdGhpcy50cmlnZ2VyKCdkYXRhJywgZXZlbnQpO1xuICB9XG5cbiAgcHVzaChkYXRhKSB7XG4gICAgc3dpdGNoKGRhdGEudHlwZSkge1xuICAgICAgY2FzZSBcInBhdFwiOlxuICAgICAgICAgIC8vIHdlIGhhdmUgdG8gd2FpdCBmb3IgdGhlIFBNVCB0byBhcnJpdmUgYXMgd2VsbCBiZWZvcmUgd2VcbiAgICAgICAgICAgIC8vIGhhdmUgYW55IG1lYW5pbmdmdWwgbWV0YWRhdGFcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcInBtdFwiOlxuICAgICAgICB2YXJcbiAgICAgICAgZXZlbnQgPSB7XG4gICAgICAgICAgdHlwZTogJ21ldGFkYXRhJyxcbiAgICAgICAgICB0cmFja3M6IFtdXG4gICAgICAgIH0sXG4gICAgICAgIHByb2dyYW1NYXBUYWJsZSA9IGRhdGEucHJvZ3JhbU1hcFRhYmxlLFxuICAgICAgICBrLFxuICAgICAgICB0cmFjaztcblxuICAgICAgICAvLyB0cmFuc2xhdGUgc3RyZWFtcyB0byB0cmFja3NcbiAgICAgICAgZm9yIChrIGluIHByb2dyYW1NYXBUYWJsZSkge1xuICAgICAgICAgIGlmIChwcm9ncmFtTWFwVGFibGUuaGFzT3duUHJvcGVydHkoaykpIHtcbiAgICAgICAgICAgIHRyYWNrID0ge307XG4gICAgICAgICAgICB0cmFjay5pZCA9ICtrO1xuICAgICAgICAgICAgaWYgKHByb2dyYW1NYXBUYWJsZVtrXSA9PT0gSDI2NF9TVFJFQU1fVFlQRSkge1xuICAgICAgICAgICAgICB0cmFjay5jb2RlYyA9ICdhdmMnO1xuICAgICAgICAgICAgICB0cmFjay50eXBlID0gJ3ZpZGVvJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvZ3JhbU1hcFRhYmxlW2tdID09PSBBRFRTX1NUUkVBTV9UWVBFKSB7XG4gICAgICAgICAgICAgIHRyYWNrLmNvZGVjID0gJ2FkdHMnO1xuICAgICAgICAgICAgICB0cmFjay50eXBlID0gJ2F1ZGlvJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGV2ZW50LnRyYWNrcy5wdXNoKHRyYWNrKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy50cmlnZ2VyKCdkYXRhJywgZXZlbnQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJwZXNcIjpcbiAgICAgICAgdmFyIHN0cmVhbSwgc3RyZWFtVHlwZTtcblxuICAgICAgICBpZiAoZGF0YS5zdHJlYW1UeXBlID09PSBIMjY0X1NUUkVBTV9UWVBFKSB7XG4gICAgICAgICAgc3RyZWFtID0gdGhpcy52aWRlbztcbiAgICAgICAgICBzdHJlYW1UeXBlID0gJ3ZpZGVvJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdHJlYW0gPSB0aGlzLmF1ZGlvO1xuICAgICAgICAgIHN0cmVhbVR5cGUgPSAnYXVkaW8nO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgYSBuZXcgcGFja2V0IGlzIHN0YXJ0aW5nLCB3ZSBjYW4gZmx1c2ggdGhlIGNvbXBsZXRlZFxuICAgICAgICAvLyBwYWNrZXRcbiAgICAgICAgaWYgKGRhdGEucGF5bG9hZFVuaXRTdGFydEluZGljYXRvcikge1xuICAgICAgICAgIHRoaXMuZmx1c2hTdHJlYW0oc3RyZWFtLCBzdHJlYW1UeXBlKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBidWZmZXIgdGhpcyBmcmFnbWVudCB1bnRpbCB3ZSBhcmUgc3VyZSB3ZSd2ZSByZWNlaXZlZCB0aGVcbiAgICAgICAgLy8gY29tcGxldGUgcGF5bG9hZFxuICAgICAgICBzdHJlYW0uZGF0YS5wdXNoKGRhdGEpO1xuICAgICAgICBzdHJlYW0uc2l6ZSArPSBkYXRhLmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfTtcbiAgLyoqXG4gICAqIEZsdXNoIGFueSByZW1haW5pbmcgaW5wdXQuIFZpZGVvIFBFUyBwYWNrZXRzIG1heSBiZSBvZiB2YXJpYWJsZVxuICAgKiBsZW5ndGguIE5vcm1hbGx5LCB0aGUgc3RhcnQgb2YgYSBuZXcgdmlkZW8gcGFja2V0IGNhbiB0cmlnZ2VyIHRoZVxuICAgKiBmaW5hbGl6YXRpb24gb2YgdGhlIHByZXZpb3VzIHBhY2tldC4gVGhhdCBpcyBub3QgcG9zc2libGUgaWYgbm9cbiAgICogbW9yZSB2aWRlbyBpcyBmb3J0aGNvbWluZywgaG93ZXZlci4gSW4gdGhhdCBjYXNlLCBzb21lIG90aGVyXG4gICAqIG1lY2hhbmlzbSAobGlrZSB0aGUgZW5kIG9mIHRoZSBmaWxlKSBoYXMgdG8gYmUgZW1wbG95ZWQuIFdoZW4gaXQgaXNcbiAgICogY2xlYXIgdGhhdCBubyBhZGRpdGlvbmFsIGRhdGEgaXMgZm9ydGhjb21pbmcsIGNhbGxpbmcgdGhpcyBtZXRob2RcbiAgICogd2lsbCBmbHVzaCB0aGUgYnVmZmVyZWQgcGFja2V0cy5cbiAgICovXG4gIGVuZCgpIHtcbiAgICB0aGlzLmZsdXNoU3RyZWFtKHRoaXMudmlkZW8sICd2aWRlbycpO1xuICAgIHRoaXMuZmx1c2hTdHJlYW0odGhpcy5hdWRpbywgJ2F1ZGlvJyk7XG4gIH07XG59O1xuLypcbiAqIEFjY2VwdHMgYSBFbGVtZW50YXJ5U3RyZWFtIGFuZCBlbWl0cyBkYXRhIGV2ZW50cyB3aXRoIHBhcnNlZFxuICogQUFDIEF1ZGlvIEZyYW1lcyBvZiB0aGUgaW5kaXZpZHVhbCBwYWNrZXRzLlxuICovXG5jbGFzcyBBYWNTdHJlYW0gZXh0ZW5kcyBTdHJlYW0ge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5hZHRzU2FtcGxlaW5nUmF0ZXMgPSBbXG4gICAgOTYwMDAsIDg4MjAwLFxuICAgIDY0MDAwLCA0ODAwMCxcbiAgICA0NDEwMCwgMzIwMDAsXG4gICAgMjQwMDAsIDIyMDUwLFxuICAgIDE2MDAwLCAxMjAwMFxuICBdO1xuICB9XG5cbiAgZ2V0QXVkaW9TcGVjaWZpY0NvbmZpZyhkYXRhKSB7XG4gICAgdmFyIGFkdHNQcm90ZWN0aW9uQWJzZW50LCAvLyA6Qm9vbGVhblxuICAgICAgICBhZHRzT2JqZWN0VHlwZSwgLy8gOmludFxuICAgICAgICBhZHRzU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0NoYW5lbENvbmZpZywgLy8gOmludFxuICAgICAgICBhZHRzRnJhbWVTaXplLCAvLyA6aW50XG4gICAgICAgIGFkdHNTYW1wbGVDb3VudCwgLy8gOmludFxuICAgICAgICBhZHRzRHVyYXRpb247IC8vIDppbnRcblxuICAgICAgLy8gYnl0ZSAxXG4gICAgICBhZHRzUHJvdGVjdGlvbkFic2VudCA9ICEhKGRhdGFbMV0gJiAweDAxKTtcblxuICAgICAgLy8gYnl0ZSAyXG4gICAgICBhZHRzT2JqZWN0VHlwZSA9ICgoZGF0YVsyXSAmIDB4QzApID4+PiA2KSArIDE7XG4gICAgICBhZHRzU2FtcGxlaW5nSW5kZXggPSAoKGRhdGFbMl0gJiAweDNDKSA+Pj4gMik7XG4gICAgICBhZHRzQ2hhbmVsQ29uZmlnID0gKChkYXRhWzJdICYgMHgwMSkgPDwgMik7XG5cbiAgICAgIC8vIGJ5dGUgM1xuICAgICAgYWR0c0NoYW5lbENvbmZpZyB8PSAoKGRhdGFbM10gJiAweEMwKSA+Pj4gNik7XG4gICAgICBhZHRzRnJhbWVTaXplID0gKChkYXRhWzNdICYgMHgwMykgPDwgMTEpO1xuXG4gICAgICAvLyBieXRlIDRcbiAgICAgIGFkdHNGcmFtZVNpemUgfD0gKGRhdGFbNF0gPDwgMyk7XG5cbiAgICAgIC8vIGJ5dGUgNVxuICAgICAgYWR0c0ZyYW1lU2l6ZSB8PSAoKGRhdGFbNV0gJiAweEUwKSA+Pj4gNSk7XG4gICAgICBhZHRzRnJhbWVTaXplIC09IChhZHRzUHJvdGVjdGlvbkFic2VudCA/IDcgOiA5KTtcblxuICAgICAgLy8gYnl0ZSA2XG4gICAgICBhZHRzU2FtcGxlQ291bnQgPSAoKGRhdGFbNl0gJiAweDAzKSArIDEpICogMTAyNDtcbiAgICAgIGFkdHNEdXJhdGlvbiA9IChhZHRzU2FtcGxlQ291bnQgKiAxMDAwKSAvIHRoaXMuYWR0c1NhbXBsZWluZ1JhdGVzW2FkdHNTYW1wbGVpbmdJbmRleF07XG5cblxuICAgICAgdGhpcy5hdWRpb1NwZWNpZmljQ29uZmlnID0gbmV3IFVpbnQ4QXJyYXkoMik7XG5cbiAgICAgIC8vIGF1ZGlvT2JqZWN0VHlwZSA9IHByb2ZpbGUgPT4gcHJvZmlsZSwgdGhlIE1QRUctNCBBdWRpbyBPYmplY3QgVHlwZSBtaW51cyAxXG4gICAgICB0aGlzLmF1ZGlvU3BlY2lmaWNDb25maWdbMF0gPSBhZHRzT2JqZWN0VHlwZSA8PCAzO1xuXG4gICAgICAvLyBzYW1wbGluZ0ZyZXF1ZW5jeUluZGV4XG4gICAgICB0aGlzLmF1ZGlvU3BlY2lmaWNDb25maWdbMF0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgICB0aGlzLmF1ZGlvU3BlY2lmaWNDb25maWdbMV0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG5cbiAgICAgIC8vIGNoYW5uZWxDb25maWd1cmF0aW9uXG4gICAgICB0aGlzLmF1ZGlvU3BlY2lmaWNDb25maWdbMV0gfD0gYWR0c0NoYW5lbENvbmZpZyA8PCAzO1xuXG4gICAgICB0aGlzLnN0ZXJlbyA9ICgyID09PSBhZHRzQ2hhbmVsQ29uZmlnKTtcbiAgICAgIHRoaXMuYXVkaW9zYW1wbGVyYXRlID0gdGhpcy5hZHRzU2FtcGxlaW5nUmF0ZXNbYWR0c1NhbXBsZWluZ0luZGV4XVxuICB9O1xuXG4gIHB1c2gocGFja2V0KSB7XG5cbiAgICBpZiAocGFja2V0LnR5cGUgPT0gXCJhdWRpb1wiICYmIHBhY2tldC5kYXRhICE9IHVuZGVmaW5lZCkge1xuXG4gICAgICB2YXIgYWFjRnJhbWUsIC8vIDpGcmFtZSA9IG51bGw7XG4gICAgICAgIG5leHRfcHRzID0gcGFja2V0LnB0cyxcbiAgICAgICAgZGF0YSA9IHBhY2tldC5kYXRhO1xuXG4gICAgICAvLyBieXRlIDBcbiAgICAgIGlmICgweEZGICE9PSBkYXRhWzBdKSB7XG4gICAgICAgIGNvbnNvbGUuYXNzZXJ0KGZhbHNlLCAnRXJyb3Igbm8gQVREUyBoZWFkZXIgZm91bmQnKTtcbiAgICAgIH1cblxuICAgICAgaWYodGhpcy5hdWRpb1NwZWNpZmljQ29uZmlnID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aGlzLmdldEF1ZGlvU3BlY2lmaWNDb25maWcoZGF0YSk7XG4gICAgICB9XG5cbiAgICAgIGFhY0ZyYW1lID0ge307XG4gICAgICBhYWNGcmFtZS5wdHMgPSBuZXh0X3B0cztcbiAgICAgIGFhY0ZyYW1lLmR0cyA9IG5leHRfcHRzO1xuICAgICAgYWFjRnJhbWUuYnl0ZXMgPSBuZXcgVWludDhBcnJheSgpO1xuXG4gICAgICAvLyBBQUMgaXMgYWx3YXlzIDEwXG4gICAgICBhYWNGcmFtZS5hdWRpb2NvZGVjaWQgPSAxMDtcbiAgICAgIGFhY0ZyYW1lLnN0ZXJlbyA9IHRoaXMuc3RlcmVvO1xuICAgICAgYWFjRnJhbWUuYXVkaW9zYW1wbGVyYXRlID0gdGhpcy5hdWRpb3NhbXBsZXJhdGU7XG4gICAgICAvLyBJcyBBQUMgYWx3YXlzIDE2IGJpdD9cbiAgICAgIGFhY0ZyYW1lLmF1ZGlvc2FtcGxlc2l6ZSA9IDE2O1xuICAgICAgYWFjRnJhbWUuYnl0ZXMgPSBwYWNrZXQuZGF0YS5zdWJhcnJheSg3LCBwYWNrZXQuZGF0YS5sZW5ndGgpO1xuICAgICAgcGFja2V0LmZyYW1lID0gYWFjRnJhbWU7XG5cbiAgICAgIHRoaXMudHJpZ2dlcignZGF0YScsIHBhY2tldCk7XG4gICAgfVxuICB9O1xufTtcblxuLyoqXG4gKiBBY2NlcHRzIGEgTkFMIHVuaXQgYnl0ZSBzdHJlYW0gYW5kIHVucGFja3MgdGhlIGVtYmVkZGVkIE5BTCB1bml0cy5cbiAqL1xuY2xhc3MgTmFsQnl0ZVN0cmVhbSBleHRlbmRzIFN0cmVhbSB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmk9NjtcbiAgICB0aGlzLnN5bmNQb2ludCA9MTtcbiAgICB0aGlzLmJ1ZmZlciA9IG51bGw7XG4gIH1cblxuICBwdXNoIChkYXRhKSB7XG4gICAgdmFyIHN3YXBCdWZmZXI7XG5cbiAgICBpZiAoIXRoaXMuYnVmZmVyKSB7XG4gICAgICB0aGlzLmJ1ZmZlciA9IGRhdGEuZGF0YTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3dhcEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KHRoaXMuYnVmZmVyLmJ5dGVMZW5ndGggKyBkYXRhLmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICBzd2FwQnVmZmVyLnNldCh0aGlzLmJ1ZmZlcik7XG4gICAgICBzd2FwQnVmZmVyLnNldChkYXRhLmRhdGEsIHRoaXMuYnVmZmVyLmJ5dGVMZW5ndGgpO1xuICAgICAgdGhpcy5idWZmZXIgPSBzd2FwQnVmZmVyO1xuICAgIH1cblxuICAgIC8vIFJlYy4gSVRVLVQgSC4yNjQsIEFubmV4IEJcbiAgICAvLyBzY2FuIGZvciBOQUwgdW5pdCBib3VuZGFyaWVzXG5cbiAgICAvLyBhIG1hdGNoIGxvb2tzIGxpa2UgdGhpczpcbiAgICAvLyAwIDAgMSAuLiBOQUwgLi4gMCAwIDFcbiAgICAvLyBeIHN5bmMgcG9pbnQgICAgICAgIF4gaVxuICAgIC8vIG9yIHRoaXM6XG4gICAgLy8gMCAwIDEgLi4gTkFMIC4uIDAgMCAwXG4gICAgLy8gXiBzeW5jIHBvaW50ICAgICAgICBeIGlcbiAgICB3aGlsZSAodGhpcy5pIDwgdGhpcy5idWZmZXIuYnl0ZUxlbmd0aCkge1xuICAgICAgc3dpdGNoICh0aGlzLmJ1ZmZlclt0aGlzLmldKSB7XG4gICAgICBjYXNlIDA6XG4gICAgICAgIC8vIHNraXAgcGFzdCBub24tc3luYyBzZXF1ZW5jZXNcbiAgICAgICAgaWYgKHRoaXMuYnVmZmVyW3RoaXMuaSAtIDFdICE9PSAwKSB7XG4gICAgICAgICAgdGhpcy5pICs9IDI7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5idWZmZXJbdGhpcy5pIC0gMl0gIT09IDApIHtcbiAgICAgICAgICB0aGlzLmkrKztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlbGl2ZXIgdGhlIE5BTCB1bml0XG4gICAgICAgIHRoaXMudHJpZ2dlcignZGF0YScsIHRoaXMuYnVmZmVyLnN1YmFycmF5KHRoaXMuc3luY1BvaW50ICsgMywgdGhpcy5pIC0gMikpO1xuXG4gICAgICAgIC8vIGRyb3AgdHJhaWxpbmcgemVyb2VzXG4gICAgICAgIGRvIHtcbiAgICAgICAgICB0aGlzLmkrKztcbiAgICAgICAgfSB3aGlsZSAodGhpcy5idWZmZXJbdGhpcy5pXSAhPT0gMSk7XG4gICAgICAgIHRoaXMuc3luY1BvaW50ID0gdGhpcy5pIC0gMjtcbiAgICAgICAgdGhpcy5pICs9IDM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAxOlxuICAgICAgICAvLyBza2lwIHBhc3Qgbm9uLXN5bmMgc2VxdWVuY2VzXG4gICAgICAgIGlmICh0aGlzLmJ1ZmZlclt0aGlzLmkgLSAxXSAhPT0gMCB8fFxuICAgICAgICAgICAgdGhpcy5idWZmZXJbdGhpcy5pIC0gMl0gIT09IDApIHtcbiAgICAgICAgICB0aGlzLmkgKz0gMztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlbGl2ZXIgdGhlIE5BTCB1bml0XG4gICAgICAgIHRoaXMudHJpZ2dlcignZGF0YScsIHRoaXMuYnVmZmVyLnN1YmFycmF5KHRoaXMuc3luY1BvaW50ICsgMywgdGhpcy5pIC0gMikpO1xuICAgICAgICB0aGlzLnN5bmNQb2ludCA9IHRoaXMuaSAtIDI7XG4gICAgICAgIHRoaXMuaSArPSAzO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRoaXMuaSArPSAzO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZmlsdGVyIG91dCB0aGUgTkFMIHVuaXRzIHRoYXQgd2VyZSBkZWxpdmVyZWRcbiAgICB0aGlzLmJ1ZmZlciA9IHRoaXMuYnVmZmVyLnN1YmFycmF5KHRoaXMuc3luY1BvaW50KTtcbiAgICB0aGlzLmkgLT0gdGhpcy5zeW5jUG9pbnQ7XG4gICAgdGhpcy5zeW5jUG9pbnQgPSAwO1xuICB9O1xuXG4gIGVuZCgpIHtcbiAgICAvLyBkZWxpdmVyIHRoZSBsYXN0IGJ1ZmZlcmVkIE5BTCB1bml0XG4gICAgaWYgKHRoaXMuYnVmZmVyLmJ5dGVMZW5ndGggPiAzKSB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2RhdGEnLCB0aGlzLmJ1ZmZlci5zdWJhcnJheSh0aGlzLnN5bmNQb2ludCArIDMpKTtcbiAgICB9XG4gICAgdGhpcy5idWZmZXIgPSBudWxsO1xuICAgIHRoaXMuaSA9IDY7XG4gICAgdGhpcy5zeW5jUG9pbnQgPSAxO1xuICB9O1xufTtcbi8qKlxuICogQWNjZXB0cyBpbnB1dCBmcm9tIGEgRWxlbWVudGFyeVN0cmVhbSBhbmQgcHJvZHVjZXMgSC4yNjQgTkFMIHVuaXQgZGF0YVxuICogZXZlbnRzLlxuICovXG5jbGFzcyBIMjY0U3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubmFsQnl0ZVN0cmVhbSA9IG5ldyBOYWxCeXRlU3RyZWFtKCk7XG4gICAgdGhpcy5uYWxCeXRlU3RyZWFtLnBhcmVudCA9IHRoaXM7XG4gICAgdGhpcy5uYWxCeXRlU3RyZWFtLm9uKCdkYXRhJywgZnVuY3Rpb24oZGF0YSkge1xuICAgIHZhciBldmVudCA9IHtcbiAgICAgIHRyYWNrSWQ6IHRoaXMucGFyZW50LnRyYWNrSWQsXG4gICAgICBwdHM6IHRoaXMucGFyZW50LmN1cnJlbnRQdHMsXG4gICAgICBkdHM6IHRoaXMucGFyZW50LmN1cnJlbnREdHMsXG4gICAgICBkYXRhOiBkYXRhXG4gICAgfTtcbiAgICBzd2l0Y2ggKGRhdGFbMF0gJiAweDFmKSB7XG4gICAgY2FzZSAweDA1OlxuICAgICAgZXZlbnQubmFsVW5pdFR5cGUgPSAnc2xpY2VfbGF5ZXJfd2l0aG91dF9wYXJ0aXRpb25pbmdfcmJzcF9pZHInO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAweDA3OlxuICAgICAgZXZlbnQubmFsVW5pdFR5cGUgPSAnc2VxX3BhcmFtZXRlcl9zZXRfcmJzcCc7XG4gICAgICB2YXIgZXhwR29sb21iRGVjb2RlciA9IG5ldyBFeHBHb2xvbWIoZGF0YS5zdWJhcnJheSgxKSk7XG4gICAgICBldmVudC5jb25maWcgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRTZXF1ZW5jZVBhcmFtZXRlclNldCgpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAweDA4OlxuICAgICAgZXZlbnQubmFsVW5pdFR5cGUgPSAncGljX3BhcmFtZXRlcl9zZXRfcmJzcCc7XG4gICAgICBicmVhaztcbiAgICBjYXNlIDB4MDk6XG4gICAgICBldmVudC5uYWxVbml0VHlwZSA9ICdhY2Nlc3NfdW5pdF9kZWxpbWl0ZXJfcmJzcCc7XG4gICAgICBicmVhaztcblxuICAgIGRlZmF1bHQ6XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgdGhpcy5wYXJlbnQudHJpZ2dlcignZGF0YScsIGV2ZW50KTtcbiAgfSk7XG4gIH1cblxuICBwdXNoKHBhY2tldCkge1xuICAgIGlmIChwYWNrZXQudHlwZSAhPT0gJ3ZpZGVvJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnRyYWNrSWQgPSBwYWNrZXQudHJhY2tJZDtcbiAgICB0aGlzLmN1cnJlbnRQdHMgPSBwYWNrZXQucHRzO1xuICAgIHRoaXMuY3VycmVudER0cyA9IHBhY2tldC5kdHM7XG4gICAgdGhpcy5uYWxCeXRlU3RyZWFtLnB1c2gocGFja2V0KTtcbiAgfTtcblxuICBlbmQoKSB7XG4gICAgdGhpcy5uYWxCeXRlU3RyZWFtLmVuZCgpO1xuICB9O1xuXG59O1xuXG4vKipcbiAqIENvbnN0cnVjdHMgYSBzaW5nbGUtdHJhY2ssIElTTyBCTUZGIG1lZGlhIHNlZ21lbnQgZnJvbSBIMjY0IGRhdGFcbiAqIGV2ZW50cy4gVGhlIG91dHB1dCBvZiB0aGlzIHN0cmVhbSBjYW4gYmUgZmVkIHRvIGEgU291cmNlQnVmZmVyXG4gKiBjb25maWd1cmVkIHdpdGggYSBzdWl0YWJsZSBpbml0aWFsaXphdGlvbiBzZWdtZW50LlxuICogQHBhcmFtIHRyYWNrIHtvYmplY3R9IHRyYWNrIG1ldGFkYXRhIGNvbmZpZ3VyYXRpb25cbiAqL1xuY2xhc3MgVmlkZW9TZWdtZW50U3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcblxuICBjb25zdHJ1Y3Rvcih0cmFjaykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zZXF1ZW5jZU51bWJlciA9IDA7XG4gICAgdGhpcy50b3RhbGR1cmF0aW9uID0gMDtcbiAgICB0aGlzLm5hbFVuaXRzID0gW107XG4gICAgdGhpcy5uYWxVbml0c0xlbmd0aCA9IDA7XG4gICAgdGhpcy50cmFjayA9IHRyYWNrO1xuICB9XG5cbiAgcHVzaChkYXRhKSB7XG4gICAgLy8gYnVmZmVyIHZpZGVvIHVudGlsIGVuZCgpIGlzIGNhbGxlZFxuICAgIHRoaXMubmFsVW5pdHMucHVzaChkYXRhKTtcbiAgICB0aGlzLm5hbFVuaXRzTGVuZ3RoICs9IGRhdGEuZGF0YS5ieXRlTGVuZ3RoO1xuICB9O1xuXG4gIGVuZCgpIHtcbiAgICB2YXIgc3RhcnRVbml0LCBjdXJyZW50TmFsLCBtb29mLCBtZGF0LCBib3hlcywgaSwgZGF0YSwgdmlldywgc2FtcGxlLCBzdGFydGR0cztcblxuICAgIC8vIGNvbmNhdGVuYXRlIHRoZSB2aWRlbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXRcbiAgICAvLyBmaXJzdCwgd2UgaGF2ZSB0byBidWlsZCB0aGUgaW5kZXggZnJvbSBieXRlIGxvY2F0aW9ucyB0b1xuICAgIC8vIHNhbXBsZXMgKHRoYXQgaXMsIGZyYW1lcykgaW4gdGhlIHZpZGVvIGRhdGFcbiAgICBkYXRhID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5uYWxVbml0c0xlbmd0aCArICg0ICogdGhpcy5uYWxVbml0cy5sZW5ndGgpKTtcbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KGRhdGEuYnVmZmVyKTtcbiAgICB0aGlzLnRyYWNrLnNhbXBsZXMgPSBbXTtcbiAgICBzYW1wbGUgPSB7XG4gICAgICBzaXplOiAwLFxuICAgICAgZmxhZ3M6IHtcbiAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICBkZXBlbmRzT246IDEsXG4gICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgaXNOb25TeW5jU2FtcGxlIDogMSxcbiAgICAgICAgZGVncmFkYXRpb25Qcmlvcml0eTogMFxuICAgICAgfVxuICAgIH07XG4gICAgaSA9IDA7XG4gICAgc3RhcnRkdHMgPSB0aGlzLm5hbFVuaXRzWzBdLmR0cztcbiAgICB3aGlsZSAodGhpcy5uYWxVbml0cy5sZW5ndGgpIHtcbiAgICAgIGN1cnJlbnROYWwgPSB0aGlzLm5hbFVuaXRzWzBdO1xuICAgICAgLy8gZmx1c2ggdGhlIHNhbXBsZSB3ZSd2ZSBiZWVuIGJ1aWxkaW5nIHdoZW4gYSBuZXcgc2FtcGxlIGlzIHN0YXJ0ZWRcbiAgICAgIGlmIChjdXJyZW50TmFsLm5hbFVuaXRUeXBlID09PSAnYWNjZXNzX3VuaXRfZGVsaW1pdGVyX3Jic3AnKSB7XG4gICAgICAgIGlmIChzdGFydFVuaXQpIHtcbiAgICAgICAgICAvLyBjb252ZXJ0IHRoZSBkdXJhdGlvbiB0byA5MGtIWiB0aW1lc2NhbGUgdG8gbWF0Y2ggdGhlXG4gICAgICAgICAgLy8gdGltZXNjYWxlcyBzcGVjaWZpZWQgaW4gdGhlIGluaXQgc2VnbWVudFxuICAgICAgICAgIHNhbXBsZS5kdXJhdGlvbiA9IChjdXJyZW50TmFsLmR0cyAtIHN0YXJ0VW5pdC5kdHMpICogOTA7XG4gICAgICAgICAgdGhpcy50cmFjay5zYW1wbGVzLnB1c2goc2FtcGxlKTtcbiAgICAgICAgfVxuICAgICAgICBzYW1wbGUgPSB7XG4gICAgICAgICAgc2l6ZTogMCxcbiAgICAgICAgICBmbGFnczoge1xuICAgICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgICAgZGVwZW5kc09uOiAxLFxuICAgICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgICAgaGFzUmVkdW5kYW5jeTogMCxcbiAgICAgICAgICAgIGlzTm9uU3luY1NhbXBsZSA6IDEsXG4gICAgICAgICAgICBkZWdyYWRhdGlvblByaW9yaXR5OiAwLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29tcG9zaXRpb25UaW1lT2Zmc2V0OiBjdXJyZW50TmFsLnB0cyAtIGN1cnJlbnROYWwuZHRzXG4gICAgICAgIH07XG4gICAgICAgIHN0YXJ0VW5pdCA9IGN1cnJlbnROYWw7XG4gICAgICB9XG4gICAgICBpZiAoY3VycmVudE5hbC5uYWxVbml0VHlwZSA9PT0gJ3NsaWNlX2xheWVyX3dpdGhvdXRfcGFydGl0aW9uaW5nX3Jic3BfaWRyJykge1xuICAgICAgICAvLyB0aGUgY3VycmVudCBzYW1wbGUgaXMgYSBrZXkgZnJhbWVcbiAgICAgICAgc2FtcGxlLmZsYWdzLmRlcGVuZHNPbiA9IDI7XG4gICAgICAgIHNhbXBsZS5mbGFncy5pc05vblN5bmNTYW1wbGUgPSAwO1xuICAgICAgfVxuICAgICAgc2FtcGxlLnNpemUgKz0gNDsgLy8gc3BhY2UgZm9yIHRoZSBOQUwgbGVuZ3RoXG4gICAgICBzYW1wbGUuc2l6ZSArPSBjdXJyZW50TmFsLmRhdGEuYnl0ZUxlbmd0aDtcblxuICAgICAgdmlldy5zZXRVaW50MzIoaSwgY3VycmVudE5hbC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgaSArPSA0O1xuICAgICAgZGF0YS5zZXQoY3VycmVudE5hbC5kYXRhLCBpKTtcbiAgICAgIGkgKz0gY3VycmVudE5hbC5kYXRhLmJ5dGVMZW5ndGg7XG5cbiAgICAgIHRoaXMubmFsVW5pdHMuc2hpZnQoKTtcbiAgICB9XG4gICAgLy8gcmVjb3JkIHRoZSBsYXN0IHNhbXBsZVxuICAgIGlmICh0aGlzLnRyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICBzYW1wbGUuZHVyYXRpb24gPSB0aGlzLnRyYWNrLnNhbXBsZXNbdGhpcy50cmFjay5zYW1wbGVzLmxlbmd0aCAtIDFdLmR1cmF0aW9uO1xuICAgIH1cbiAgICB0aGlzLnRyYWNrLnNhbXBsZXMucHVzaChzYW1wbGUpO1xuICAgIHRoaXMubmFsVW5pdHNMZW5ndGggPSAwO1xuICAgIG1kYXQgPSBNUDQubWRhdChkYXRhKTtcbiAgICBtb29mID0gTVA0Lm1vb2YodGhpcy5zZXF1ZW5jZU51bWJlcix0aGlzLnRvdGFsZHVyYXRpb24sW3RoaXMudHJhY2tdKTtcbiAgICB0aGlzLnRvdGFsZHVyYXRpb24gKz0gKGN1cnJlbnROYWwuZHRzIC0gc3RhcnRkdHMpKjkwO1xuICAgIC8vIGl0IHdvdWxkIGJlIGdyZWF0IHRvIGFsbG9jYXRlIHRoaXMgYXJyYXkgdXAgZnJvbnQgaW5zdGVhZCBvZlxuICAgIC8vIHRocm93aW5nIGF3YXkgaHVuZHJlZHMgb2YgbWVkaWEgc2VnbWVudCBmcmFnbWVudHNcbiAgICBib3hlcyA9IG5ldyBVaW50OEFycmF5KG1vb2YuYnl0ZUxlbmd0aCArIG1kYXQuYnl0ZUxlbmd0aCk7XG5cbiAgICAvLyBidW1wIHRoZSBzZXF1ZW5jZSBudW1iZXIgZm9yIG5leHQgdGltZVxuICAgIHRoaXMuc2VxdWVuY2VOdW1iZXIrKztcblxuICAgIGJveGVzLnNldChtb29mKTtcbiAgICBib3hlcy5zZXQobWRhdCwgbW9vZi5ieXRlTGVuZ3RoKTtcblxuICAgIHRoaXMudHJpZ2dlcignZGF0YScsIGJveGVzKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGEgc2luZ2xlLXRyYWNrLCBJU08gQk1GRiBtZWRpYSBzZWdtZW50IGZyb20gQUFDIGRhdGFcbiAqIGV2ZW50cy4gVGhlIG91dHB1dCBvZiB0aGlzIHN0cmVhbSBjYW4gYmUgZmVkIHRvIGEgU291cmNlQnVmZmVyXG4gKiBjb25maWd1cmVkIHdpdGggYSBzdWl0YWJsZSBpbml0aWFsaXphdGlvbiBzZWdtZW50LlxuICogQHBhcmFtIHRyYWNrIHtvYmplY3R9IHRyYWNrIG1ldGFkYXRhIGNvbmZpZ3VyYXRpb25cbiAqL1xuY2xhc3MgQXVkaW9TZWdtZW50U3RyZWFtIGV4dGVuZHMgU3RyZWFtIHtcblxuICBjb25zdHJ1Y3Rvcih0cmFjaykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zZXF1ZW5jZU51bWJlciA9IDA7XG4gICAgdGhpcy50b3RhbGR1cmF0aW9uID0gMDtcbiAgICB0aGlzLmFhY1VuaXRzID0gW107XG4gICAgdGhpcy5hYWNVbml0c0xlbmd0aCA9IDA7XG4gICAgdGhpcy50cmFjayA9IHRyYWNrO1xuICB9XG5cbiAgcHVzaChkYXRhKSB7XG4gICAgLy9yZW1vdmUgQURUUyBoZWFkZXJcbiAgICBkYXRhLmRhdGEgPSBkYXRhLmRhdGEuc3ViYXJyYXkoNyk7XG4gICAgLy8gYnVmZmVyIGF1ZGlvIHVudGlsIGVuZCgpIGlzIGNhbGxlZFxuICAgIHRoaXMuYWFjVW5pdHMucHVzaChkYXRhKTtcbiAgICB0aGlzLmFhY1VuaXRzTGVuZ3RoICs9IGRhdGEuZGF0YS5ieXRlTGVuZ3RoO1xuICB9O1xuXG4gIGVuZCgpIHtcbiAgICB2YXIgZGF0YSwgdmlldywgaSwgY3VycmVudFVuaXQsIHN0YXJ0VW5pdCwgbGFzdFVuaXQsIG1kYXQsIG1vb2YsIGJveGVzO1xuICAgIC8vIC8vIGNvbmNhdGVuYXRlIHRoZSBhdWRpbyBkYXRhIGFuZCBjb25zdHJ1Y3QgdGhlIG1kYXRcbiAgICAvLyAvLyBmaXJzdCwgd2UgaGF2ZSB0byBidWlsZCB0aGUgaW5kZXggZnJvbSBieXRlIGxvY2F0aW9ucyB0b1xuICAgIC8vIC8vIHNhbXBsZXMgKHRoYXQgaXMsIGZyYW1lcykgaW4gdGhlIGF1ZGlvIGRhdGFcbiAgICAvL2RhdGEgPSBuZXcgVWludDhBcnJheShhYWNVbml0c0xlbmd0aCArICg0ICogYWFjVW5pdHMubGVuZ3RoKSk7XG4gICAgZGF0YSA9IG5ldyBVaW50OEFycmF5KHRoaXMuYWFjVW5pdHNMZW5ndGgpO1xuICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcoZGF0YS5idWZmZXIpO1xuICAgIHRoaXMudHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHZhciBzYW1wbGUgPSB7XG4gICAgICBzaXplOiB0aGlzLmFhY1VuaXRzWzBdLmRhdGEuYnl0ZUxlbmd0aCxcbiAgICAgIGZsYWdzOiB7XG4gICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgZGVwZW5kc09uOiAxLFxuICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgIGRlZ3JhZGF0aW9uUHJpb3JpdHk6IDBcbiAgICAgIH0sXG4gICAgICBjb21wb3NpdGlvblRpbWVPZmZzZXQ6IDBcbiAgICB9O1xuICAgIGkgPSAwO1xuICAgIHN0YXJ0VW5pdCA9IHRoaXMuYWFjVW5pdHNbMF07XG4gICAgbGFzdFVuaXQgPSBudWxsO1xuICAgIHdoaWxlICh0aGlzLmFhY1VuaXRzLmxlbmd0aCkge1xuICAgICAgY3VycmVudFVuaXQgPSB0aGlzLmFhY1VuaXRzWzBdO1xuICAgICAgaWYobGFzdFVuaXQgIT0gbnVsbCkge1xuICAgICAgICAvL2ZsdXNoIHByZXZpb3VzIHNhbXBsZSwgdXBkYXRlIGl0cyBkdXJhdGlvbiBiZWZvcmVoYW5kXG4gICAgICAgICAgc2FtcGxlLmR1cmF0aW9uID0gKGN1cnJlbnRVbml0LmR0cyAtIGxhc3RVbml0LmR0cykgKiA5MDtcbiAgICAgICAgICB0aGlzLnRyYWNrLnNhbXBsZXMucHVzaChzYW1wbGUpO1xuICAgICAgICAgIHNhbXBsZSA9IHtcbiAgICAgICAgICAgIHNpemU6IGN1cnJlbnRVbml0LmRhdGEuYnl0ZUxlbmd0aCxcbiAgICAgICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgICAgIGlzTGVhZGluZzogMCxcbiAgICAgICAgICAgICAgZGVwZW5kc09uOiAxLFxuICAgICAgICAgICAgICBpc0RlcGVuZGVkT246IDAsXG4gICAgICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgICAgIGRlZ3JhZGF0aW9uUHJpb3JpdHk6IDBcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb21wb3NpdGlvblRpbWVPZmZzZXQ6IDBcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIC8vdmlldy5zZXRVaW50MzIoaSwgY3VycmVudFVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgLy9pICs9IDQ7XG4gICAgICAgIGRhdGEuc2V0KGN1cnJlbnRVbml0LmRhdGEsIGkpO1xuICAgICAgICBpICs9IGN1cnJlbnRVbml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgICAgdGhpcy5hYWNVbml0cy5zaGlmdCgpO1xuICAgICAgICBsYXN0VW5pdCA9IGN1cnJlbnRVbml0O1xuICAgIH1cbiAgICAvLyByZWNvcmQgdGhlIGxhc3Qgc2FtcGxlXG4gICAgaWYgKHRoaXMudHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHNhbXBsZS5kdXJhdGlvbiA9IHRoaXMudHJhY2suc2FtcGxlc1t0aGlzLnRyYWNrLnNhbXBsZXMubGVuZ3RoIC0gMV0uZHVyYXRpb247XG4gICAgICB0aGlzLnRyYWNrLnNhbXBsZXMucHVzaChzYW1wbGUpO1xuICAgIH1cbiAgICB0aGlzLmFhY1VuaXRzTGVuZ3RoID0gMDtcbiAgICBtZGF0ID0gTVA0Lm1kYXQoZGF0YSk7XG4gICAgbW9vZiA9IE1QNC5tb29mKHRoaXMuc2VxdWVuY2VOdW1iZXIsdGhpcy50b3RhbGR1cmF0aW9uLFt0aGlzLnRyYWNrXSk7XG4gICAgdGhpcy50b3RhbGR1cmF0aW9uICs9IChjdXJyZW50VW5pdC5kdHMgLSBzdGFydFVuaXQuZHRzKSo5MDtcbiAgICAvLyBpdCB3b3VsZCBiZSBncmVhdCB0byBhbGxvY2F0ZSB0aGlzIGFycmF5IHVwIGZyb250IGluc3RlYWQgb2ZcbiAgICAvLyB0aHJvd2luZyBhd2F5IGh1bmRyZWRzIG9mIG1lZGlhIHNlZ21lbnQgZnJhZ21lbnRzXG4gICAgYm94ZXMgPSBuZXcgVWludDhBcnJheShtb29mLmJ5dGVMZW5ndGggKyBtZGF0LmJ5dGVMZW5ndGgpO1xuXG4gICAgLy8gYnVtcCB0aGUgc2VxdWVuY2UgbnVtYmVyIGZvciBuZXh0IHRpbWVcbiAgICB0aGlzLnNlcXVlbmNlTnVtYmVyKys7XG4gICAgYm94ZXMuc2V0KG1vb2YpO1xuICAgIGJveGVzLnNldChtZGF0LCBtb29mLmJ5dGVMZW5ndGgpO1xuXG4gICAgdGhpcy50cmlnZ2VyKCdkYXRhJywgYm94ZXMpO1xuICB9O1xufVxuXG4vKipcbiAqIEEgU3RyZWFtIHRoYXQgZXhwZWN0cyBNUDJUIGJpbmFyeSBkYXRhIGFzIGlucHV0IGFuZCBwcm9kdWNlc1xuICogY29ycmVzcG9uZGluZyBtZWRpYSBzZWdtZW50cywgc3VpdGFibGUgZm9yIHVzZSB3aXRoIE1lZGlhIFNvdXJjZVxuICogRXh0ZW5zaW9uIChNU0UpIGltcGxlbWVudGF0aW9ucyB0aGF0IHN1cHBvcnQgdGhlIElTTyBCTUZGIGJ5dGVcbiAqIHN0cmVhbSBmb3JtYXQsIGxpa2UgQ2hyb21lLlxuICogQHNlZSB0ZXN0L211eGVyL21zZS1kZW1vLmh0bWwgZm9yIHNhbXBsZSB1c2FnZSBvZiBhIFRyYW5zbXV4ZXIgd2l0aFxuICogTVNFXG4gKi9cblxuXG52YXIgcGFja2V0U3RyZWFtLHBhcnNlU3RyZWFtLCBlbGVtZW50YXJ5U3RyZWFtLCBhYWNTdHJlYW0sIGgyNjRTdHJlYW0sXG4gICAgYXVkaW9TZWdtZW50U3RyZWFtLCB2aWRlb1NlZ21lbnRTdHJlYW0sXG4gICAgY29uZmlnQXVkaW8sIGNvbmZpZ1ZpZGVvLFxuICAgIHRyYWNrVmlkZW8sIHRyYWNrQXVkaW8sXG4gICAgcHBzLHNwcyxzZWxmO1xuXG5jbGFzcyBUU0RlbXV4ZXIgZXh0ZW5kcyBTdHJlYW0ge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG5cbiAgICAvLyBzZXQgdXAgdGhlIHBhcnNpbmcgcGlwZWxpbmVcbiAgICBwYWNrZXRTdHJlYW0gPSBuZXcgVHJhbnNwb3J0UGFja2V0U3RyZWFtKCk7XG4gICAgcGFyc2VTdHJlYW0gPSBuZXcgVHJhbnNwb3J0UGFyc2VTdHJlYW0oKTtcbiAgICBlbGVtZW50YXJ5U3RyZWFtID0gbmV3IEVsZW1lbnRhcnlTdHJlYW0oKTtcbiAgICBhYWNTdHJlYW0gPSBuZXcgQWFjU3RyZWFtKCk7XG4gICAgaDI2NFN0cmVhbSA9IG5ldyBIMjY0U3RyZWFtKCk7XG5cbiAgICBwYWNrZXRTdHJlYW0ucGlwZShwYXJzZVN0cmVhbSk7XG4gICAgcGFyc2VTdHJlYW0ucGlwZShlbGVtZW50YXJ5U3RyZWFtKTtcbiAgICBlbGVtZW50YXJ5U3RyZWFtLnBpcGUoYWFjU3RyZWFtKTtcbiAgICBlbGVtZW50YXJ5U3RyZWFtLnBpcGUoaDI2NFN0cmVhbSk7XG4gICAgc2VsZiA9IHRoaXM7XG5cblxuICAgIC8vIGhhbmRsZSBpbmNvbWluZyBkYXRhIGV2ZW50c1xuICAgIGFhY1N0cmVhbS5vbignZGF0YScsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIGlmKCFjb25maWdBdWRpbykge1xuICAgICAgICBjb25maWdBdWRpbyA9IGRhdGFcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGgyNjRTdHJlYW0ub24oJ2RhdGEnLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAvLyByZWNvcmQgdGhlIHRyYWNrIGNvbmZpZ1xuICAgICAgaWYgKGRhdGEubmFsVW5pdFR5cGUgPT09ICdzZXFfcGFyYW1ldGVyX3NldF9yYnNwJyAmJlxuICAgICAgICAhY29uZmlnVmlkZW8pIHtcbiAgICAgICAgY29uZmlnVmlkZW8gPSBkYXRhLmNvbmZpZztcblxuICAgICAgdHJhY2tWaWRlby53aWR0aCA9IGNvbmZpZ1ZpZGVvLndpZHRoO1xuICAgICAgdHJhY2tWaWRlby5oZWlnaHQgPSBjb25maWdWaWRlby5oZWlnaHQ7XG4gICAgICB0cmFja1ZpZGVvLnNwcyA9IFtkYXRhLmRhdGFdO1xuICAgICAgdHJhY2tWaWRlby5wcm9maWxlSWRjID0gY29uZmlnVmlkZW8ucHJvZmlsZUlkYztcbiAgICAgIHRyYWNrVmlkZW8ubGV2ZWxJZGMgPSBjb25maWdWaWRlby5sZXZlbElkYztcbiAgICAgIHRyYWNrVmlkZW8ucHJvZmlsZUNvbXBhdGliaWxpdHkgPSBjb25maWdWaWRlby5wcm9maWxlQ29tcGF0aWJpbGl0eTtcblxuICAgICAgICAvLyBnZW5lcmF0ZSBhbiBpbml0IHNlZ21lbnQgb25jZSBhbGwgdGhlIG1ldGFkYXRhIGlzIGF2YWlsYWJsZVxuICAgICAgICBpZiAocHBzKSB7XG4gICAgICAgICAgdGhpcy50cmlnZ2VyKCdkYXRhJywge1xuICAgICAgICAgICAgZGF0YTogTVA0LmluaXRTZWdtZW50KFt0cmFja1ZpZGVvLHRyYWNrQXVkaW9dKVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZGF0YS5uYWxVbml0VHlwZSA9PT0gJ3BpY19wYXJhbWV0ZXJfc2V0X3Jic3AnICYmXG4gICAgICAgICFwcHMpIHtcbiAgICAgICAgICBwcHMgPSBkYXRhLmRhdGE7XG4gICAgICAgICAgdHJhY2tWaWRlby5wcHMgPSBbZGF0YS5kYXRhXTtcblxuICAgICAgICAgIGlmIChjb25maWdWaWRlbykge1xuICAgICAgICAgICAgc2VsZi50cmlnZ2VyKCdkYXRhJywge1xuICAgICAgICAgICAgICBkYXRhOiBNUDQuaW5pdFNlZ21lbnQoW3RyYWNrVmlkZW8sdHJhY2tBdWRpb10pXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIC8vIGhvb2sgdXAgdGhlIHZpZGVvIHNlZ21lbnQgc3RyZWFtIG9uY2UgdHJhY2sgbWV0YWRhdGEgaXMgZGVsaXZlcmVkXG4gICAgZWxlbWVudGFyeVN0cmVhbS5vbignZGF0YScsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHZhciBpLCB0cmlnZ2VyRGF0YSA9IGZ1bmN0aW9uKHNlZ21lbnQpIHtcbiAgICAgICAgc2VsZi50cmlnZ2VyKCdkYXRhJywge1xuICAgICAgICAgIGRhdGE6IHNlZ21lbnRcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgaWYgKGRhdGEudHlwZSA9PT0gJ21ldGFkYXRhJykge1xuICAgICAgICBpID0gZGF0YS50cmFja3MubGVuZ3RoO1xuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgaWYgKGRhdGEudHJhY2tzW2ldLnR5cGUgPT09ICd2aWRlbycpIHtcbiAgICAgICAgICAgIHRyYWNrVmlkZW8gPSBkYXRhLnRyYWNrc1tpXTtcbiAgICAgICAgICAgIGlmICghdmlkZW9TZWdtZW50U3RyZWFtKSB7XG4gICAgICAgICAgICAgIHZpZGVvU2VnbWVudFN0cmVhbSA9IG5ldyBWaWRlb1NlZ21lbnRTdHJlYW0odHJhY2tWaWRlbyk7XG4gICAgICAgICAgICAgIGgyNjRTdHJlYW0ucGlwZSh2aWRlb1NlZ21lbnRTdHJlYW0pO1xuICAgICAgICAgICAgICB2aWRlb1NlZ21lbnRTdHJlYW0ub24oJ2RhdGEnLCB0cmlnZ2VyRGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGRhdGEudHJhY2tzW2ldLnR5cGUgPT09ICdhdWRpbycpIHtcbiAgICAgICAgICAgICAgdHJhY2tBdWRpbyA9IGRhdGEudHJhY2tzW2ldO1xuICAgICAgICAgICAgICBpZiAoIWF1ZGlvU2VnbWVudFN0cmVhbSkge1xuICAgICAgICAgICAgICAgIGF1ZGlvU2VnbWVudFN0cmVhbSA9IG5ldyBBdWRpb1NlZ21lbnRTdHJlYW0odHJhY2tBdWRpbyk7XG4gICAgICAgICAgICAgICAgYWFjU3RyZWFtLnBpcGUoYXVkaW9TZWdtZW50U3RyZWFtKTtcbiAgICAgICAgICAgICAgICBhdWRpb1NlZ21lbnRTdHJlYW0ub24oJ2RhdGEnLCB0cmlnZ2VyRGF0YSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIGZlZWQgaW5jb21pbmcgZGF0YSB0byB0aGUgZnJvbnQgb2YgdGhlIHBhcnNpbmcgcGlwZWxpbmVcbiAgcHVzaChkYXRhKSB7XG4gICAgcGFja2V0U3RyZWFtLnB1c2goZGF0YSk7XG4gIH1cbiAgLy8gZmx1c2ggYW55IGJ1ZmZlcmVkIGRhdGFcbiAgZW5kKCkge1xuICAgIGVsZW1lbnRhcnlTdHJlYW0uZW5kKCk7XG4gICAgaDI2NFN0cmVhbS5lbmQoKTtcbiAgICB2aWRlb1NlZ21lbnRTdHJlYW0uZW5kKCk7XG4gICAgYXVkaW9TZWdtZW50U3RyZWFtLmVuZCgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFRTRGVtdXhlcjtcbiIsIi8qKlxuICogSExTIGVuZ2luZVxuICovXG4ndXNlIHN0cmljdCc7XG5cbmltcG9ydCBUU0RlbXV4ZXIgICAgICAgICAgICBmcm9tICcuL2RlbXV4L3RzZGVtdXhlcic7XG5pbXBvcnQgRnJhZ21lbnRMb2FkZXIgICAgICAgZnJvbSAnLi9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyJztcbmltcG9ydCBQbGF5bGlzdExvYWRlciAgICAgICBmcm9tICcuL2xvYWRlci9wbGF5bGlzdC1sb2FkZXInO1xuaW1wb3J0IHtsb2dnZXIsZW5hYmxlTG9nc30gIGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBTdHJlYW0gICAgICAgICAgICAgICBmcm9tICcuL3V0aWxzL3N0cmVhbSc7XG4vL2ltcG9ydCBNUDRJbnNwZWN0ICAgICAgICAgZnJvbSAnL3JlbXV4L21wNC1pbnNwZWN0b3InO1xuXG52YXIgaW5pdCwgYXR0YWNoVmlldywgYXR0YWNoU291cmNlO1xudmFyIHN0cmVhbTtcbnZhciBtZWRpYVNvdXJjZSwgdmlkZW8sIHVybDtcbnZhciBwbGF5bGlzdExvYWRlciwgZnJhZ21lbnRMb2FkZXI7XG52YXIgYnVmZmVyLCBkZW11eGVyO1xudmFyIG1wNHNlZ21lbnRzO1xuXG4gIGluaXQgPSBmdW5jdGlvbigpIHtcbiAgICBtZWRpYVNvdXJjZSA9IG5ldyBNZWRpYVNvdXJjZSgpO1xuICAgIHN0cmVhbSA9IG5ldyBTdHJlYW0oKTtcbiAgICBwbGF5bGlzdExvYWRlciA9IG5ldyBQbGF5bGlzdExvYWRlcigpO1xuICAgIGZyYWdtZW50TG9hZGVyID0gbmV3IEZyYWdtZW50TG9hZGVyKCk7XG4gICAgLy8gc2V0dXAgdGhlIG1lZGlhIHNvdXJjZVxuICAgIG1lZGlhU291cmNlLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZW9wZW4nLCBvbk1lZGlhU291cmNlT3Blbik7XG4gICAgbWVkaWFTb3VyY2UuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlZW5kZWQnLCBmdW5jdGlvbigpIHtcbiAgICBsb2dnZXIubG9nKFwibWVkaWEgc291cmNlIGVuZGVkXCIpO1xuICB9KTtcblxuICBtZWRpYVNvdXJjZS5hZGRFdmVudExpc3RlbmVyKCdzb3VyY2VjbG9zZScsIGZ1bmN0aW9uKCkge1xuICAgIGxvZ2dlci5sb2coXCJtZWRpYSBzb3VyY2UgY2xvc2VkXCIpO1xuICB9KTtcbn1cblxuYXR0YWNoVmlldyA9IGZ1bmN0aW9uKHZpZXcpIHtcbiAgdmlkZW8gPSB2aWV3O1xuICB2aWRlby5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKG1lZGlhU291cmNlKTtcbiAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignbG9hZHN0YXJ0JywgZnVuY3Rpb24oZXZ0KSB7IGxvZ0V2dChldnQpOyB9KSA7XG4gIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3Byb2dyZXNzJywgZnVuY3Rpb24oZXZ0KSB7IGxvZ0V2dChldnQpOyB9KSA7XG4gIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3N1c3BlbmQnLCBmdW5jdGlvbihldnQpIHsgbG9nRXZ0KGV2dCk7IH0pIDtcbiAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCBmdW5jdGlvbihldnQpIHsgbG9nRXZ0KGV2dCk7IH0pIDtcbiAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCBmdW5jdGlvbihldnQpIHsgbG9nRXZ0KGV2dCk7IH0pIDtcbiAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignZW1wdGllZCcsIGZ1bmN0aW9uKGV2dCkgeyBsb2dFdnQoZXZ0KTsgfSkgO1xuICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdzdGFsbGVkJywgZnVuY3Rpb24oZXZ0KSB7IGxvZ0V2dChldnQpOyB9KSA7XG4gIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgZnVuY3Rpb24oZXZ0KSB7IGxvZ0V2dChldnQpOyB9KSA7XG4gIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZGRhdGEnLCBmdW5jdGlvbihldnQpIHsgbG9nRXZ0KGV2dCk7IH0pIDtcbiAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignY2FucGxheScsIGZ1bmN0aW9uKGV2dCkgeyBsb2dFdnQoZXZ0KTsgfSkgO1xuICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdjYW5wbGF5dGhyb3VnaCcsIGZ1bmN0aW9uKGV2dCkgeyBsb2dFdnQoZXZ0KTsgfSkgO1xuICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdwbGF5aW5nJywgZnVuY3Rpb24oZXZ0KSB7IGxvZ0V2dChldnQpOyB9KSA7XG4gIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3dhaXRpbmcnLCBmdW5jdGlvbihldnQpIHsgbG9nRXZ0KGV2dCk7IH0pIDtcbiAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignc2Vla2luZycsIGZ1bmN0aW9uKGV2dCkgeyBsb2dFdnQoZXZ0KTsgfSkgO1xuICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdzZWVrZWQnLCBmdW5jdGlvbihldnQpIHsgbG9nRXZ0KGV2dCk7IH0pIDtcbiAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcignZHVyYXRpb25jaGFuZ2UnLCBmdW5jdGlvbihldnQpIHsgbG9nRXZ0KGV2dCk7IH0pIDtcbiAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIGZ1bmN0aW9uKGV2dCkgeyBsb2dFdnQoZXZ0KTsgfSkgO1xuICB2aWRlby5hZGRFdmVudExpc3RlbmVyKCdwbGF5JywgZnVuY3Rpb24oZXZ0KSB7IGxvZ0V2dChldnQpOyB9KSA7XG4gIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3BhdXNlJywgZnVuY3Rpb24oZXZ0KSB7IGxvZ0V2dChldnQpOyB9KSA7XG4gIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3JhdGVjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHsgbG9nRXZ0KGV2dCk7IH0pIDtcbiAgdmlkZW8uYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgZnVuY3Rpb24oZXZ0KSB7IGxvZ0V2dChldnQpOyB9KSA7XG4gIHZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ3ZvbHVtZWNoYW5nZScsIGZ1bmN0aW9uKGV2dCkgeyBsb2dFdnQoZXZ0KTsgfSkgO1xufVxuXG5hdHRhY2hTb3VyY2UgPSBmdW5jdGlvbih1cmwpIHtcbiAgdXJsID0gdXJsO1xuICBwbGF5bGlzdExvYWRlci5sb2FkKHVybCk7XG59XG5cbmZ1bmN0aW9uIG9uTWVkaWFTb3VyY2VPcGVuKCkge1xuICBidWZmZXIgPSBtZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIoJ3ZpZGVvL21wNDtjb2RlY3M9YXZjMS40ZDQwMGQsbXA0YS40MC41Jyk7XG4gIGRlbXV4ZXIgPSBuZXcgVFNEZW11eGVyKCk7XG4gIG1wNHNlZ21lbnRzID0gW107XG5cbiAgYnVmZmVyLmFkZEV2ZW50TGlzdGVuZXIoJ3VwZGF0ZWVuZCcsIGZ1bmN0aW9uKCkge1xuICAgIGFwcGVuZFNlZ21lbnRzKCk7XG4gIH0pO1xuXG4gIGJ1ZmZlci5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgbG9nZ2VyLmxvZyhcIiBidWZmZXIgYXBwZW5kIGVycm9yOlwiICsgZXZlbnQpO1xuICB9KTtcblxuICB2YXIgZnJhZ21lbnRzO1xuICB2YXIgZnJhZ21lbnRJbmRleDtcbiAgcGxheWxpc3RMb2FkZXIub24oJ2RhdGEnLGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBmcmFnbWVudHMgPSBkYXRhO1xuICAgIGZyYWdtZW50SW5kZXggPSAwO1xuICAgIGZyYWdtZW50TG9hZGVyLmxvYWQoZnJhZ21lbnRzW2ZyYWdtZW50SW5kZXgrK10pO1xuICB9KTtcblxuICBwbGF5bGlzdExvYWRlci5vbignc3RhdHMnLCBmdW5jdGlvbihzdGF0cykge1xuICAgIHZhciBydHQsbG9hZHRpbWUsYnc7XG4gICAgcnR0ID0gc3RhdHMudGZpcnN0IC0gc3RhdHMudHJlcXVlc3Q7XG4gICAgbG9hZHRpbWUgPSBzdGF0cy50ZW5kIC0gc3RhdHMudHJlcXVlc3Q7XG4gICAgbG9nZ2VyLmxvZyhcInBsYXlsaXN0IGxvYWRlZCxSVFQobXMpL2xvYWQobXMpL25iIGZyYWc6XCIgKyBydHQgKyBcIi9cIiArIGxvYWR0aW1lICsgXCIvXCIgKyBzdGF0cy5sZW5ndGgpO1xuICB9KTtcblxuXG4gIGZyYWdtZW50TG9hZGVyLm9uKCdkYXRhJywgZnVuY3Rpb24oZGF0YSkge1xuICAgIGRlbXV4ZXIucHVzaChuZXcgVWludDhBcnJheShkYXRhKSk7XG4gICAgZGVtdXhlci5lbmQoKTtcbiAgICBhcHBlbmRTZWdtZW50cygpO1xuICAgIGlmIChmcmFnbWVudEluZGV4IDwgZnJhZ21lbnRzLmxlbmd0aCkge1xuICAgICAgZnJhZ21lbnRMb2FkZXIubG9hZChmcmFnbWVudHNbZnJhZ21lbnRJbmRleCsrXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci5sb2coXCJsYXN0IGZyYWdtZW50IGxvYWRlZFwiKTtcbiAgICB9XG4gIH0pO1xuXG4gIGZyYWdtZW50TG9hZGVyLm9uKCdzdGF0cycsIGZ1bmN0aW9uKHN0YXRzKSB7XG4gICAgdmFyIHJ0dCxsb2FkdGltZSxidztcbiAgICBydHQgPSBzdGF0cy50Zmlyc3QgLSBzdGF0cy50cmVxdWVzdDtcbiAgICBsb2FkdGltZSA9IHN0YXRzLnRlbmQgLSBzdGF0cy50cmVxdWVzdDtcbiAgICBidyA9IHN0YXRzLmxlbmd0aCo4LygxMDAwKmxvYWR0aW1lKTtcbiAgICBsb2dnZXIubG9nKFwiZnJhZyBsb2FkZWQsIFJUVChtcykvbG9hZChtcykvYml0cmF0ZTpcIiArIHJ0dCArIFwiL1wiICsgbG9hZHRpbWUgKyBcIi9cIiArIGJ3LnRvRml4ZWQoMykgKyBcIiBNYi9zXCIpO1xuICB9KTtcblxuICAvLyB0cmFuc211eCB0aGUgTVBFRy1UUyBkYXRhIHRvIElTTy1CTUZGIHNlZ21lbnRzXG4gICAgZGVtdXhlci5vbignZGF0YScsIGZ1bmN0aW9uKHNlZ21lbnQpIHtcbiAgICAvL2xvZ2dlci5sb2coSlNPTi5zdHJpbmdpZnkoTVA0SW5zcGVjdC5tcDR0b0pTT04oc2VnbWVudC5kYXRhKSksbnVsbCw0KTtcbiAgICBtcDRzZWdtZW50cy5wdXNoKHNlZ21lbnQpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gYXBwZW5kU2VnbWVudHMoKSB7XG4gIGlmICghYnVmZmVyLnVwZGF0aW5nICYmIG1wNHNlZ21lbnRzLmxlbmd0aCkge1xuICAgIGJ1ZmZlci5hcHBlbmRCdWZmZXIobXA0c2VnbWVudHMuc2hpZnQoKS5kYXRhKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBsb2dFdnQoZXZ0KSB7XG4gIHZhciBkYXRhID0gJyc7XG4gIHN3aXRjaChldnQudHlwZSkge1xuICAgIGNhc2UgJ2R1cmF0aW9uY2hhbmdlJzpcbiAgICBkYXRhID0gZXZlbnQudGFyZ2V0LmR1cmF0aW9uO1xuICAgIGJyZWFrO1xuICAgIGNhc2UgJ3Jlc2l6ZSc6XG4gICAgZGF0YSA9IFwidmlkZW9XaWR0aDpcIiArIGV2dC50YXJnZXQudmlkZW9XaWR0aCArIFwiL3ZpZGVvSGVpZ2h0OlwiICsgZXZ0LnRhcmdldC52aWRlb0hlaWdodDtcbiAgICBicmVhaztcbiAgICBjYXNlICdsb2FkZWRtZXRhZGF0YSc6XG4gICAgZGF0YSA9IFwiZHVyYXRpb246XCIgKyBldnQudGFyZ2V0LmR1cmF0aW9uICsgXCIvdmlkZW9XaWR0aDpcIiArIGV2dC50YXJnZXQudmlkZW9XaWR0aCArIFwiL3ZpZGVvSGVpZ2h0OlwiICsgZXZ0LnRhcmdldC52aWRlb0hlaWdodDtcbiAgICBicmVhaztcbiAgICBjYXNlICdsb2FkZWRkYXRhJzpcbiAgICBjYXNlICdjYW5wbGF5JzpcbiAgICBjYXNlICdjYW5wbGF5dGhyb3VnaCc6XG4gICAgY2FzZSAndGltZXVwZGF0ZSc6XG4gICAgY2FzZSAnc2Vla2luZyc6XG4gICAgY2FzZSAnc2Vla2VkJzpcbiAgICBjYXNlICdwYXVzZSc6XG4gICAgY2FzZSAncGxheSc6XG4gICAgY2FzZSAnc3RhbGxlZCc6XG4gICAgZGF0YSA9IFwiY3VycmVudFRpbWU6XCIgKyBldnQudGFyZ2V0LmN1cnJlbnRUaW1lO1xuICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgYnJlYWs7XG4gIH1cbiAgbG9nZ2VyLmxvZyhldnQudHlwZSArIFwiOlwiICsgZGF0YSk7XG59XG5cblxuXG5sZXQgaGxzID0ge1xuICBpbml0IDogaW5pdCxcbiAgZGVidWcgOiBlbmFibGVMb2dzLFxuICBhdHRhY2hWaWV3IDogYXR0YWNoVmlldyxcbiAgYXR0YWNoU291cmNlIDogYXR0YWNoU291cmNlXG59O1xuXG5leHBvcnQgZGVmYXVsdCBobHM7XG4iLCIvKlxuICogZnJhZ21lbnQgbG9hZGVyXG4gKlxuICovXG5cbiAvL2ltcG9ydCB7ZW5hYmxlTG9nc30gICAgZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbiBpbXBvcnQgU3RyZWFtICAgICAgICAgIGZyb20gJy4uL3V0aWxzL3N0cmVhbSc7XG5cbiBjbGFzcyBGcmFnbWVudExvYWRlciBleHRlbmRzIFN0cmVhbSB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIGxvYWQodXJsKSB7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgdGhpcy50cmVxdWVzdCA9IERhdGUubm93KCk7XG4gICAgdGhpcy50Zmlyc3QgPSBudWxsO1xuICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB4aHIub25sb2FkPSAgdGhpcy5sb2Fkc3VjY2VzcztcbiAgICB4aHIub25lcnJvciA9IHRoaXMubG9hZGVycm9yO1xuICAgIHhoci5vbnByb2dyZXNzID0gdGhpcy5sb2FkcHJvZ3Jlc3M7XG4gICAgeGhyLnJlc3BvbnNlVHlwZSA9IFwiYXJyYXlidWZmZXJcIjtcbiAgICB4aHIucGFyZW50ID0gdGhpcztcbiAgICB4aHIub3BlbignR0VUJywgdXJsICwgdHJ1ZSk7XG4gICAgeGhyLnNlbmQoKTtcbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50KSB7XG4gICAgdGhpcy5wYXJlbnQudHJpZ2dlcignc3RhdHMnLCB7dHJlcXVlc3QgOiB0aGlzLnBhcmVudC50cmVxdWVzdCwgdGZpcnN0IDogdGhpcy5wYXJlbnQudGZpcnN0LCB0ZW5kIDogRGF0ZS5ub3coKSwgbGVuZ3RoIDpldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlLmJ5dGVMZW5ndGgsIHVybCA6IHRoaXMudXJsIH0pO1xuICAgIHRoaXMucGFyZW50LnRyaWdnZXIoJ2RhdGEnLGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2UpO1xuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgY29uc29sZS5sb2coJ2Vycm9yIGxvYWRpbmcgJyArIHRoaXMucGFyZW50LnVybCk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoZXZlbnQpIHtcbiAgICBpZih0aGlzLnBhcmVudC50Zmlyc3QgPT09IG51bGwpIHtcbiAgICAgIHRoaXMucGFyZW50LnRmaXJzdCA9IERhdGUubm93KCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEZyYWdtZW50TG9hZGVyO1xuIiwiLypcbiAqIHBsYXlsaXN0IGxvYWRlclxuICpcbiAqL1xuXG4gaW1wb3J0IFN0cmVhbSAgICAgICAgICBmcm9tICcuLi91dGlscy9zdHJlYW0nO1xuXG5cbi8vIHJlbGF0aXZlIFVSTCByZXNvbHZlclxudmFyIHJlc29sdmVVUkwgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciBkb2MgPSBkb2N1bWVudCxcbiAgb2xkX2Jhc2UgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2Jhc2UnKVswXSxcbiAgb2xkX2hyZWYgPSBvbGRfYmFzZSAmJiBvbGRfYmFzZS5ocmVmLFxuICBkb2NfaGVhZCA9IGRvYy5oZWFkIHx8IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdLFxuICBvdXJfYmFzZSA9IG9sZF9iYXNlIHx8IGRvYy5jcmVhdGVFbGVtZW50KCdiYXNlJyksXG4gIHJlc29sdmVyID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2EnKSxcbiAgcmVzb2x2ZWRfdXJsO1xuXG4gIHJldHVybiBmdW5jdGlvbihiYXNlX3VybCwgdXJsKSB7XG4gICAgb2xkX2Jhc2UgfHwgZG9jX2hlYWQuYXBwZW5kQ2hpbGQob3VyX2Jhc2UpO1xuICAgIG91cl9iYXNlLmhyZWYgPSBiYXNlX3VybDtcbiAgICByZXNvbHZlci5ocmVmID0gdXJsO1xuICAgIHJlc29sdmVkX3VybCA9IHJlc29sdmVyLmhyZWY7IC8vIGJyb3dzZXIgbWFnaWMgYXQgd29yayBoZXJlXG5cbiAgICBvbGRfYmFzZSA/IG9sZF9iYXNlLmhyZWYgPSBvbGRfaHJlZiA6IGRvY19oZWFkLnJlbW92ZUNoaWxkKG91cl9iYXNlKTtcblxuICAgIHJldHVybiByZXNvbHZlZF91cmw7XG4gIH07XG59KSgpO1xuXG5cbiBjbGFzcyBQbGF5bGlzdExvYWRlciBleHRlbmRzIFN0cmVhbSB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIGxvYWQodXJsKSB7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgdGhpcy50cmVxdWVzdCA9IERhdGUubm93KCk7XG4gICAgdGhpcy50Zmlyc3QgPSBudWxsO1xuICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB4aHIub25sb2FkPSAgdGhpcy5sb2Fkc3VjY2VzcztcbiAgICB4aHIub25lcnJvciA9ICB0aGlzLmxvYWRlcnJvcjtcbiAgICB4aHIub25wcm9ncmVzcyA9IHRoaXMubG9hZHByb2dyZXNzO1xuICAgIHhoci5wYXJlbnQgPSB0aGlzO1xuICAgIHhoci5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuICAgIHhoci5zZW5kKCk7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCkge1xuICAgIHZhciBmcmFnbWVudHMgPVxuICAgIHRoaXMucmVzcG9uc2VUZXh0XG4gICAgLnNwbGl0KC9cXHI/XFxuLylcbiAgICAuZmlsdGVyKFJlZ0V4cC5wcm90b3R5cGUudGVzdC5iaW5kKC9cXC50cyQvKSlcbiAgICAubWFwKHJlc29sdmVVUkwuYmluZChudWxsLCB0aGlzLnBhcmVudC51cmwpKVxuICAgIGNvbnNvbGUubG9nKCdmb3VuZCAnICsgZnJhZ21lbnRzLmxlbmd0aCArICcgZnJhZ21lbnRzJyk7XG4gICAgdGhpcy5wYXJlbnQudHJpZ2dlcignc3RhdHMnLCB7dHJlcXVlc3QgOiB0aGlzLnBhcmVudC50cmVxdWVzdCwgdGZpcnN0IDogdGhpcy5wYXJlbnQudGZpcnN0LCB0ZW5kIDogRGF0ZS5ub3coKSwgbGVuZ3RoIDpmcmFnbWVudHMubGVuZ3RoLCB1cmwgOiB0aGlzLnBhcmVudC51cmx9KTtcbiAgICB0aGlzLnBhcmVudC50cmlnZ2VyKCdkYXRhJyxmcmFnbWVudHMpO1xuICB9XG5cbiAgbG9hZGVycm9yKGV2ZW50KSB7XG4gICAgY29uc29sZS5sb2coJ2Vycm9yIGxvYWRpbmcgJyArIHNlbGYudXJsKTtcbiAgfVxuXG4gIGxvYWRwcm9ncmVzcyhldmVudCkge1xuICAgIGlmKHRoaXMucGFyZW50LnRmaXJzdCA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5wYXJlbnQudGZpcnN0ID0gRGF0ZS5ub3coKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGxheWxpc3RMb2FkZXI7XG4iLCIvKipcbiAqIGdlbmVyYXRlIE1QNCBCb3hcbiAqL1xuKGZ1bmN0aW9uKCkge1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgYm94LCBkaW5mLCBmdHlwLCBtZGF0LCBtZmhkLCBtaW5mLCBtb29mLCBtb292LCBtdmV4LCBtdmhkLCB0cmFrLFxuICAgIHRraGQsIG1kaWEsIG1kaGQsIGhkbHIsIHNkdHAsIHN0YmwsIHN0c2QsIHN0eXAsIHRyYWYsIHRyZXgsIHRydW4sXG4gICAgYXZjMSwgbXA0YSwgZXNkcyxcbiAgICB0eXBlcywgTUFKT1JfQlJBTkQsIE1JTk9SX1ZFUlNJT04sIEFWQzFfQlJBTkQsIFZJREVPX0hETFIsXG4gICAgQVVESU9fSERMUiwgSERMUl9UWVBFUywgVk1IRCwgU01IRCwgTUVESUFIRUFERVJfVFlQRVMsIERSRUYsIFNUQ08sIFNUU0MsIFNUU1osIFNUVFMsIEVTRFMsIFNUU0Q7XG5cbi8vIHByZS1jYWxjdWxhdGUgY29uc3RhbnRzXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBpO1xuICB0eXBlcyA9IHtcbiAgICBhdmMxOiBbXSwgLy8gY29kaW5nbmFtZVxuICAgIGF2Y0M6IFtdLFxuICAgIGJ0cnQ6IFtdLFxuICAgIGRpbmY6IFtdLFxuICAgIGRyZWY6IFtdLFxuICAgIGVzZHM6IFtdLFxuICAgIGZ0eXA6IFtdLFxuICAgIGhkbHI6IFtdLFxuICAgIG1kYXQ6IFtdLFxuICAgIG1kaGQ6IFtdLFxuICAgIG1kaWE6IFtdLFxuICAgIG1maGQ6IFtdLFxuICAgIG1pbmY6IFtdLFxuICAgIG1vb2Y6IFtdLFxuICAgIG1vb3Y6IFtdLFxuICAgIG1wNGE6IFtdLFxuICAgIG12ZXg6IFtdLFxuICAgIG12aGQ6IFtdLFxuICAgIHNkdHA6IFtdLFxuICAgIHN0Ymw6IFtdLFxuICAgIHN0Y286IFtdLFxuICAgIHN0c2M6IFtdLFxuICAgIHN0c2Q6IFtdLFxuICAgIHN0c3o6IFtdLFxuICAgIHN0dHM6IFtdLFxuICAgIHN0eXA6IFtdLFxuICAgIHRmZHQ6IFtdLFxuICAgIHRmaGQ6IFtdLFxuICAgIHRyYWY6IFtdLFxuICAgIHRyYWs6IFtdLFxuICAgIHRydW46IFtdLFxuICAgIHRyZXg6IFtdLFxuICAgIHRraGQ6IFtdLFxuICAgIHZtaGQ6IFtdXG4gIH07XG5cbiAgZm9yIChpIGluIHR5cGVzKSB7XG4gICAgaWYgKHR5cGVzLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICB0eXBlc1tpXSA9IFtcbiAgICAgICAgaS5jaGFyQ29kZUF0KDApLFxuICAgICAgICBpLmNoYXJDb2RlQXQoMSksXG4gICAgICAgIGkuY2hhckNvZGVBdCgyKSxcbiAgICAgICAgaS5jaGFyQ29kZUF0KDMpXG4gICAgICBdO1xuICAgIH1cbiAgfVxuXG4gIE1BSk9SX0JSQU5EID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICdpJy5jaGFyQ29kZUF0KDApLFxuICAgICdzJy5jaGFyQ29kZUF0KDApLFxuICAgICdvJy5jaGFyQ29kZUF0KDApLFxuICAgICdtJy5jaGFyQ29kZUF0KDApXG4gIF0pO1xuICBBVkMxX0JSQU5EID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICdhJy5jaGFyQ29kZUF0KDApLFxuICAgICd2Jy5jaGFyQ29kZUF0KDApLFxuICAgICdjJy5jaGFyQ29kZUF0KDApLFxuICAgICcxJy5jaGFyQ29kZUF0KDApXG4gIF0pO1xuICBNSU5PUl9WRVJTSU9OID0gbmV3IFVpbnQ4QXJyYXkoWzAsIDAsIDAsIDFdKTtcbiAgVklERU9fSERMUiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSwgLy8gaGFuZGxlcl90eXBlOiAndmlkZSdcbiAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAweDU2LCAweDY5LCAweDY0LCAweDY1LFxuICAgIDB4NmYsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnVmlkZW9IYW5kbGVyJ1xuICBdKTtcbiAgQVVESU9fSERMUiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgMHg3MywgMHg2ZiwgMHg3NSwgMHg2ZSwgLy8gaGFuZGxlcl90eXBlOiAnc291bidcbiAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAweDUzLCAweDZmLCAweDc1LCAweDZlLFxuICAgIDB4NjQsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnU291bmRIYW5kbGVyJ1xuICBdKTtcbiAgSERMUl9UWVBFUyA9IHtcbiAgICBcInZpZGVvXCI6VklERU9fSERMUixcbiAgICBcImF1ZGlvXCI6IEFVRElPX0hETFJcbiAgfTtcbiAgRFJFRiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGVudHJ5X2NvdW50XG4gICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwYywgLy8gZW50cnlfc2l6ZVxuICAgIDB4NzUsIDB4NzIsIDB4NmMsIDB4MjAsIC8vICd1cmwnIHR5cGVcbiAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAweDAwLCAweDAwLCAweDAxIC8vIGVudHJ5X2ZsYWdzXG4gIF0pO1xuICBTVENPID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAgLy8gZW50cnlfY291bnRcbiAgXSk7XG4gIFNUU0MgPSBTVENPO1xuICBTVFNaID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHNhbXBsZV9zaXplXG4gICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX2NvdW50XG4gIF0pO1xuICBTVFRTID0gU1RDTztcbiAgVk1IRCA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgMHgwMCwgMHgwMCwgMHgwMSwgLy8gZmxhZ3NcbiAgICAweDAwLCAweDAwLCAvLyBncmFwaGljc21vZGVcbiAgICAweDAwLCAweDAwLFxuICAgIDB4MDAsIDB4MDAsXG4gICAgMHgwMCwgMHgwMCAvLyBvcGNvbG9yXG4gIF0pO1xuICBTTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgIDB4MDAsIDB4MDAsIC8vIGJhbGFuY2VcbiAgICAweDAwLCAweDAwIC8vIHJlc2VydmVkXG4gIF0pO1xuXG4gIFNUU0QgPSBuZXcgVWludDhBcnJheShbXG4gICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAweDAwLCAweDAwLCAweDAwLCAweDAxXSk7Ly8gZW50cnlfY291bnRcblxuICBNRURJQUhFQURFUl9UWVBFUyA9IHtcbiAgICBcInZpZGVvXCI6IFZNSEQsXG4gICAgXCJhdWRpb1wiOiBTTUhEXG4gIH07XG59KSgpO1xuXG5ib3ggPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhclxuICAgIHBheWxvYWQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLFxuICAgIHNpemUgPSAwLFxuICAgIGkgPSBwYXlsb2FkLmxlbmd0aCxcbiAgICByZXN1bHQsXG4gICAgdmlldztcblxuICAvLyBjYWxjdWxhdGUgdGhlIHRvdGFsIHNpemUgd2UgbmVlZCB0byBhbGxvY2F0ZVxuICB3aGlsZSAoaS0tKSB7XG4gICAgc2l6ZSArPSBwYXlsb2FkW2ldLmJ5dGVMZW5ndGg7XG4gIH1cbiAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkoc2l6ZSArIDgpO1xuICB2aWV3ID0gbmV3IERhdGFWaWV3KHJlc3VsdC5idWZmZXIsIHJlc3VsdC5ieXRlT2Zmc2V0LCByZXN1bHQuYnl0ZUxlbmd0aCk7XG4gIHZpZXcuc2V0VWludDMyKDAsIHJlc3VsdC5ieXRlTGVuZ3RoKTtcbiAgcmVzdWx0LnNldCh0eXBlLCA0KTtcblxuICAvLyBjb3B5IHRoZSBwYXlsb2FkIGludG8gdGhlIHJlc3VsdFxuICBmb3IgKGkgPSAwLCBzaXplID0gODsgaSA8IHBheWxvYWQubGVuZ3RoOyBpKyspIHtcbiAgICByZXN1bHQuc2V0KHBheWxvYWRbaV0sIHNpemUpO1xuICAgIHNpemUgKz0gcGF5bG9hZFtpXS5ieXRlTGVuZ3RoO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG5kaW5mID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBib3godHlwZXMuZGluZiwgYm94KHR5cGVzLmRyZWYsIERSRUYpKTtcbn07XG5cbmZ0eXAgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGJveCh0eXBlcy5mdHlwLCBNQUpPUl9CUkFORCwgTUlOT1JfVkVSU0lPTiwgTUFKT1JfQlJBTkQsIEFWQzFfQlJBTkQpO1xufTtcblxuaGRsciA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgcmV0dXJuIGJveCh0eXBlcy5oZGxyLCBIRExSX1RZUEVTW3R5cGVdKTtcbn07XG5tZGF0ID0gZnVuY3Rpb24oZGF0YSkge1xuICByZXR1cm4gYm94KHR5cGVzLm1kYXQsIGRhdGEpO1xufTtcbm1kaGQgPSBmdW5jdGlvbihkdXJhdGlvbikge1xuICByZXR1cm4gYm94KHR5cGVzLm1kaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAweDAwLCAweDAwLCAweDAwLCAweDAzLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgIDB4MDAsIDB4MDEsIDB4NWYsIDB4OTAsIC8vIHRpbWVzY2FsZSwgOTAsMDAwIFwidGlja3NcIiBwZXIgc2Vjb25kXG5cbiAgICAoZHVyYXRpb24gJiAweEZGMDAwMDAwKSA+PiAyNCxcbiAgICAoZHVyYXRpb24gJiAweEZGMDAwMCkgPj4gMTYsXG4gICAgKGR1cmF0aW9uICYgMHhGRjAwKSA+PiA4LFxuICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAweDU1LCAweGM0LCAvLyAndW5kJyBsYW5ndWFnZSAodW5kZXRlcm1pbmVkKVxuICAgIDB4MDAsIDB4MDBcbiAgXSkpO1xufTtcbm1kaWEgPSBmdW5jdGlvbih0cmFjaykge1xuICByZXR1cm4gYm94KHR5cGVzLm1kaWEsIG1kaGQodHJhY2suZHVyYXRpb24pLCBoZGxyKHRyYWNrLnR5cGUpLCBtaW5mKHRyYWNrKSk7XG59O1xubWZoZCA9IGZ1bmN0aW9uKHNlcXVlbmNlTnVtYmVyKSB7XG4gIHJldHVybiBib3godHlwZXMubWZoZCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgIDB4MDAsXG4gICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAoc2VxdWVuY2VOdW1iZXIgJiAweEZGMDAwMDAwKSA+PiAyNCxcbiAgICAoc2VxdWVuY2VOdW1iZXIgJiAweEZGMDAwMCkgPj4gMTYsXG4gICAgKHNlcXVlbmNlTnVtYmVyICYgMHhGRjAwKSA+PiA4LFxuICAgIHNlcXVlbmNlTnVtYmVyICYgMHhGRiwgLy8gc2VxdWVuY2VfbnVtYmVyXG4gIF0pKTtcbn07XG5taW5mID0gZnVuY3Rpb24odHJhY2spIHtcbiAgcmV0dXJuIGJveCh0eXBlcy5taW5mLCBib3godHlwZXMudm1oZCwgTUVESUFIRUFERVJfVFlQRVNbdHJhY2sudHlwZV0pLCBkaW5mKCksIHN0YmwodHJhY2spKTtcbn07XG5tb29mID0gZnVuY3Rpb24oc2VxdWVuY2VOdW1iZXIsIGJhc2VNZWRpYURlY29kZVRpbWUsIHRyYWNrcykge1xuICB2YXJcbiAgICB0cmFja0ZyYWdtZW50cyA9IFtdLFxuICAgIGkgPSB0cmFja3MubGVuZ3RoO1xuICAvLyBidWlsZCB0cmFmIGJveGVzIGZvciBlYWNoIHRyYWNrIGZyYWdtZW50XG4gIHdoaWxlIChpLS0pIHtcbiAgICB0cmFja0ZyYWdtZW50c1tpXSA9IHRyYWYodHJhY2tzW2ldLGJhc2VNZWRpYURlY29kZVRpbWUpO1xuICB9XG4gIHJldHVybiBib3guYXBwbHkobnVsbCwgW1xuICAgIHR5cGVzLm1vb2YsXG4gICAgbWZoZChzZXF1ZW5jZU51bWJlcilcbiAgXS5jb25jYXQodHJhY2tGcmFnbWVudHMpKTtcbn07XG4vKipcbiAqIEBwYXJhbSB0cmFja3MuLi4gKG9wdGlvbmFsKSB7YXJyYXl9IHRoZSB0cmFja3MgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbW92aWVcbiAqL1xubW9vdiA9IGZ1bmN0aW9uKHRyYWNrcykge1xuICB2YXJcbiAgICBpID0gdHJhY2tzLmxlbmd0aCxcbiAgICBib3hlcyA9IFtdO1xuXG4gIHdoaWxlIChpLS0pIHtcbiAgICBib3hlc1tpXSA9IHRyYWsodHJhY2tzW2ldKTtcbiAgfVxuXG4gIHJldHVybiBib3guYXBwbHkobnVsbCwgW3R5cGVzLm1vb3YsIG12aGQoMSldLmNvbmNhdChib3hlcykuY29uY2F0KG12ZXgodHJhY2tzKSkpO1xufTtcbm12ZXggPSBmdW5jdGlvbih0cmFja3MpIHtcbiAgdmFyXG4gICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgYm94ZXMgPSBbXTtcblxuICB3aGlsZSAoaS0tKSB7XG4gICAgYm94ZXNbaV0gPSB0cmV4KHRyYWNrc1tpXSk7XG4gIH1cbiAgcmV0dXJuIGJveC5hcHBseShudWxsLCBbdHlwZXMubXZleF0uY29uY2F0KGJveGVzKSk7XG59O1xubXZoZCA9IGZ1bmN0aW9uKGR1cmF0aW9uKSB7XG4gIHZhclxuICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMiwgLy8gbW9kaWZpY2F0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDEsIDB4NWYsIDB4OTAsIC8vIHRpbWVzY2FsZSwgOTAsMDAwIFwidGlja3NcIiBwZXIgc2Vjb25kXG4gICAgICAoZHVyYXRpb24gJiAweEZGMDAwMDAwKSA+PiAyNCxcbiAgICAgIChkdXJhdGlvbiAmIDB4RkYwMDAwKSA+PiAxNixcbiAgICAgIChkdXJhdGlvbiAmIDB4RkYwMCkgPj4gOCxcbiAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gZHVyYXRpb25cbiAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsIC8vIDEuMCByYXRlXG4gICAgICAweDAxLCAweDAwLCAvLyAxLjAgdm9sdW1lXG4gICAgICAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4ZmYsIDB4ZmYsIDB4ZmYsIDB4ZmYgLy8gbmV4dF90cmFja19JRFxuICAgIF0pO1xuICByZXR1cm4gYm94KHR5cGVzLm12aGQsIGJ5dGVzKTtcbn07XG5cbnNkdHAgPSBmdW5jdGlvbih0cmFjaykge1xuICB2YXJcbiAgICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXSxcbiAgICBieXRlcyA9IG5ldyBVaW50OEFycmF5KDQgKyBzYW1wbGVzLmxlbmd0aCksXG4gICAgc2FtcGxlLFxuICAgIGk7XG5cbiAgLy8gbGVhdmUgdGhlIGZ1bGwgYm94IGhlYWRlciAoNCBieXRlcykgYWxsIHplcm9cblxuICAvLyB3cml0ZSB0aGUgc2FtcGxlIHRhYmxlXG4gIGZvciAoaSA9IDA7IGkgPCBzYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgc2FtcGxlID0gc2FtcGxlc1tpXTtcbiAgICBieXRlc1tpICsgNF0gPSAoc2FtcGxlLmZsYWdzLmRlcGVuZHNPbiA8PCA0KSB8XG4gICAgICAoc2FtcGxlLmZsYWdzLmlzRGVwZW5kZWRPbiA8PCAyKSB8XG4gICAgICAoc2FtcGxlLmZsYWdzLmhhc1JlZHVuZGFuY3kpO1xuICB9XG5cbiAgcmV0dXJuIGJveCh0eXBlcy5zZHRwLFxuICAgICAgICAgICAgIGJ5dGVzKTtcbn07XG5cbnN0YmwgPSBmdW5jdGlvbih0cmFjaykge1xuICByZXR1cm4gYm94KHR5cGVzLnN0YmwsXG4gICAgICAgICAgICAgc3RzZCh0cmFjayksXG4gICAgICAgICAgICAgYm94KHR5cGVzLnN0dHMsIFNUVFMpLFxuICAgICAgICAgICAgIGJveCh0eXBlcy5zdHNjLCBTVFNDKSxcbiAgICAgICAgICAgICBib3godHlwZXMuc3RzeiwgU1RTWiksXG4gICAgICAgICAgICAgYm94KHR5cGVzLnN0Y28sIFNUQ08pKTtcbn07XG5cbmF2YzEgPSBmdW5jdGlvbih0cmFjaykge1xuICB2YXIgc2VxdWVuY2VQYXJhbWV0ZXJTZXRzID0gW10sIHBpY3R1cmVQYXJhbWV0ZXJTZXRzID0gW10sIGk7XG4gIC8vIGFzc2VtYmxlIHRoZSBTUFNzXG4gIGZvciAoaSA9IDA7IGkgPCB0cmFjay5zcHMubGVuZ3RoOyBpKyspIHtcbiAgICBzZXF1ZW5jZVBhcmFtZXRlclNldHMucHVzaCgodHJhY2suc3BzW2ldLmJ5dGVMZW5ndGggJiAweEZGMDApID4+PiA4KTtcbiAgICBzZXF1ZW5jZVBhcmFtZXRlclNldHMucHVzaCgodHJhY2suc3BzW2ldLmJ5dGVMZW5ndGggJiAweEZGKSk7IC8vIHNlcXVlbmNlUGFyYW1ldGVyU2V0TGVuZ3RoXG4gICAgc2VxdWVuY2VQYXJhbWV0ZXJTZXRzID0gc2VxdWVuY2VQYXJhbWV0ZXJTZXRzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0cmFjay5zcHNbaV0pKTsgLy8gU1BTXG4gIH1cblxuICAvLyBhc3NlbWJsZSB0aGUgUFBTc1xuICBmb3IgKGkgPSAwOyBpIDwgdHJhY2sucHBzLmxlbmd0aDsgaSsrKSB7XG4gICAgcGljdHVyZVBhcmFtZXRlclNldHMucHVzaCgodHJhY2sucHBzW2ldLmJ5dGVMZW5ndGggJiAweEZGMDApID4+PiA4KTtcbiAgICBwaWN0dXJlUGFyYW1ldGVyU2V0cy5wdXNoKCh0cmFjay5wcHNbaV0uYnl0ZUxlbmd0aCAmIDB4RkYpKTtcbiAgICBwaWN0dXJlUGFyYW1ldGVyU2V0cyA9IHBpY3R1cmVQYXJhbWV0ZXJTZXRzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0cmFjay5wcHNbaV0pKTtcbiAgfVxuXG4gIHJldHVybiBib3godHlwZXMuYXZjMSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAodHJhY2sud2lkdGggJiAweGZmMDApID4+IDgsXG4gICAgICB0cmFjay53aWR0aCAmIDB4ZmYsIC8vIHdpZHRoXG4gICAgICAodHJhY2suaGVpZ2h0ICYgMHhmZjAwKSA+PiA4LFxuICAgICAgdHJhY2suaGVpZ2h0ICYgMHhmZiwgLy8gaGVpZ2h0XG4gICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyBob3JpenJlc29sdXRpb25cbiAgICAgIDB4MDAsIDB4NDgsIDB4MDAsIDB4MDAsIC8vIHZlcnRyZXNvbHV0aW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMSwgLy8gZnJhbWVfY291bnRcbiAgICAgIDB4MTMsXG4gICAgICAweDc2LCAweDY5LCAweDY0LCAweDY1LFxuICAgICAgMHg2ZiwgMHg2YSwgMHg3MywgMHgyZCxcbiAgICAgIDB4NjMsIDB4NmYsIDB4NmUsIDB4NzQsXG4gICAgICAweDcyLCAweDY5LCAweDYyLCAweDJkLFxuICAgICAgMHg2OCwgMHg2YywgMHg3MywgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY29tcHJlc3Nvcm5hbWVcbiAgICAgIDB4MDAsIDB4MTgsIC8vIGRlcHRoID0gMjRcbiAgICAgIDB4MTEsIDB4MTFdKSwgLy8gcHJlX2RlZmluZWQgPSAtMVxuICAgICAgICBib3godHlwZXMuYXZjQywgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgIDB4MDEsIC8vIGNvbmZpZ3VyYXRpb25WZXJzaW9uXG4gICAgICAgICAgdHJhY2sucHJvZmlsZUlkYywgLy8gQVZDUHJvZmlsZUluZGljYXRpb25cbiAgICAgICAgICB0cmFjay5wcm9maWxlQ29tcGF0aWJpbGl0eSwgLy8gcHJvZmlsZV9jb21wYXRpYmlsaXR5XG4gICAgICAgICAgdHJhY2subGV2ZWxJZGMsIC8vIEFWQ0xldmVsSW5kaWNhdGlvblxuICAgICAgICAgIDB4ZmYgLy8gbGVuZ3RoU2l6ZU1pbnVzT25lLCBoYXJkLWNvZGVkIHRvIDQgYnl0ZXNcbiAgICAgICAgXS5jb25jYXQoW1xuICAgICAgICAgIHRyYWNrLnNwcy5sZW5ndGggLy8gbnVtT2ZTZXF1ZW5jZVBhcmFtZXRlclNldHNcbiAgICAgICAgXSkuY29uY2F0KHNlcXVlbmNlUGFyYW1ldGVyU2V0cykuY29uY2F0KFtcbiAgICAgICAgICB0cmFjay5wcHMubGVuZ3RoIC8vIG51bU9mUGljdHVyZVBhcmFtZXRlclNldHNcbiAgICAgICAgXSkuY29uY2F0KHBpY3R1cmVQYXJhbWV0ZXJTZXRzKSkpLCAvLyBcIlBQU1wiXG4gICAgICAgIGJveCh0eXBlcy5idHJ0LCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgMHgwMCwgMHgxYywgMHg5YywgMHg4MCwgLy8gYnVmZmVyU2l6ZURCXG4gICAgICAgICAgMHgwMCwgMHgyZCwgMHhjNiwgMHhjMCwgLy8gbWF4Qml0cmF0ZVxuICAgICAgICAgIDB4MDAsIDB4MmQsIDB4YzYsIDB4YzBdKSkgLy8gYXZnQml0cmF0ZVxuICAgICAgICApXG59O1xuXG5lc2RzID0gZnVuY3Rpb24odHJhY2spIHtcbiAgICB2YXIgYXVkaW9fcHJvZmlsZSxzYW1wbGluZ19mcmVxLGNoYW5uZWxfY29uZmlnLGF1ZGlvU3BlY2lmaWNDb25maWc7XG4gICAgLyogcmVmZXIgdG8gaHR0cDovL3dpa2kubXVsdGltZWRpYS5jeC9pbmRleC5waHA/dGl0bGU9TVBFRy00X0F1ZGlvI0F1ZGlvX1NwZWNpZmljX0NvbmZpZ1xuICAgICAgQXVkaW8gUHJvZmlsZVxuICAgICAgMDogTnVsbFxuICAgICAgMTogQUFDIE1haW5cbiAgICAgIDI6IEFBQyBMQyAoTG93IENvbXBsZXhpdHkpXG4gICAgICAzOiBBQUMgU1NSIChTY2FsYWJsZSBTYW1wbGUgUmF0ZSlcbiAgICAgIDQ6IEFBQyBMVFAgKExvbmcgVGVybSBQcmVkaWN0aW9uKVxuICAgICAgNTogU0JSIChTcGVjdHJhbCBCYW5kIFJlcGxpY2F0aW9uKVxuICAgICAgNjogQUFDIFNjYWxhYmxlXG4gICAgKi9cbiAgICBhdWRpb19wcm9maWxlID0gMjtcbiAgLyogc2FtcGxpbmcgZnJlcVxuICAgIDA6IDk2MDAwIEh6XG4gICAgMTogODgyMDAgSHpcbiAgICAyOiA2NDAwMCBIelxuICAgIDM6IDQ4MDAwIEh6XG4gICAgNDogNDQxMDAgSHpcbiAgICA1OiAzMjAwMCBIelxuICAgIDY6IDI0MDAwIEh6XG4gICAgNzogMjIwNTAgSHpcbiAgICA4OiAxNjAwMCBIelxuICAgIDk6IDEyMDAwIEh6XG4gICAgMTA6IDExMDI1IEh6XG4gICAgMTE6IDgwMDAgSHpcbiAgICAxMjogNzM1MCBIelxuICAgIDEzOiBSZXNlcnZlZFxuICAgIDE0OiBSZXNlcnZlZFxuICAgIDE1OiBmcmVxdWVuY3kgaXMgd3JpdHRlbiBleHBsaWN0bHlcbiAgKi9cbiAgc2FtcGxpbmdfZnJlcSA9IDM7XG5cbiAgLyogQ2hhbm5lbCBDb25maWd1cmF0aW9uc1xuICAgIFRoZXNlIGFyZSB0aGUgY2hhbm5lbCBjb25maWd1cmF0aW9uczpcbiAgICAwOiBEZWZpbmVkIGluIEFPVCBTcGVjaWZjIENvbmZpZ1xuICAgIDE6IDEgY2hhbm5lbDogZnJvbnQtY2VudGVyXG4gICAgMjogMiBjaGFubmVsczogZnJvbnQtbGVmdCwgZnJvbnQtcmlnaHRcbiAgKi9cbiAgY2hhbm5lbF9jb25maWcgPSAyO1xuICAvL2F1ZGlvU3BlY2lmaWNDb25maWcgPSAoYXVkaW9fcHJvZmlsZSA8PCAxMSkgKyAoc2FtcGxpbmdfZnJlcSA8PCA3KSArIChjaGFubmVsX2NvbmZpZyA8PCAzKTtcbiAgYXVkaW9TcGVjaWZpY0NvbmZpZyA9IDQ4ODA7XG5cblxuICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoW1xuICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG5cbiAgICAweDAzLCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAweDE5LCAvLyBsZW5ndGhcbiAgICAweDAwLCAweDAxLCAvL2VzX2lkXG4gICAgMHgwMCwgLy8gc3RyZWFtX3ByaW9yaXR5XG5cbiAgICAweDA0LCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAweDExLCAvLyBsZW5ndGhcbiAgICAweDQwLCAvL2NvZGVjIDogbXBlZzRfYXVkaW9cbiAgICAweDE1LCAvLyBzdHJlYW1fdHlwZVxuICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGJ1ZmZlcl9zaXplXG4gICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gbWF4Qml0cmF0ZVxuICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGF2Z0JpdHJhdGVcblxuICAgIDB4MDUsIC8vIGRlc2NyaXB0b3JfdHlwZVxuICAgIDB4MDIsIC8vIGxlbmd0aFxuICAgIChhdWRpb1NwZWNpZmljQ29uZmlnICYgMHhGRjAwKSA+PiA4LFxuICAgIGF1ZGlvU3BlY2lmaWNDb25maWcgJiAweEZGXG4gICAgLy8weDEyLDB4MTAgLy9hdWRpb19wcm9maWxlKDUgYml0cy9zYW1wbGluZyBmcmVxIDQgYml0cy9jaGFubmVsIGNvbmZpZyA0Yml0cy9mcmFtZUxlbmd0aCAxYml0L2RlcGVuZHNPbkNvcmVDb2RlciAxIGJpdC9leHRlbnNpb25GbGFnIDEgYml0KVxuICBdKTtcbn1cblxubXA0YSA9IGZ1bmN0aW9uKHRyYWNrKSB7XG4gICAgICByZXR1cm4gYm94KHR5cGVzLm1wNGEsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMSwgLy8gZGF0YV9yZWZlcmVuY2VfaW5kZXhcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMiwgLy8gY2hhbm5lbGNvdW50OjIgY2hhbm5lbHNcbiAgICAgIDB4MDAsIDB4MTAsIC8vIHNhbXBsZVNpemU6MTZiaXRzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZDJcbiAgICAgIDB4QkIsIDB4ODAsIDB4MDAsIDB4MDBdKSwgLy8gUmF0ZT00ODAwMFxuICAgICAgYm94KHR5cGVzLmVzZHMsIGVzZHModHJhY2spKSk7XG59O1xuXG5zdHNkID0gZnVuY3Rpb24odHJhY2spIHtcbiAgaWYgKHRyYWNrLnR5cGUgPT09ICdhdWRpbycpIHtcbiAgICByZXR1cm4gYm94KHR5cGVzLnN0c2QsIFNUU0QgLCBtcDRhKHRyYWNrKSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJveCh0eXBlcy5zdHNkLCBTVFNEICwgYXZjMSh0cmFjaykpO1xuICB9XG59O1xuXG5zdHlwID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBib3godHlwZXMuc3R5cCwgTUFKT1JfQlJBTkQsIE1JTk9SX1ZFUlNJT04sIE1BSk9SX0JSQU5EKTtcbn07XG5cbnRraGQgPSBmdW5jdGlvbih0cmFjaykge1xuICByZXR1cm4gYm94KHR5cGVzLnRraGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAweDAwLCAweDAwLCAweDA3LCAvLyBmbGFnc1xuICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICh0cmFjay5pZCAmIDB4RkYwMDAwMDApID4+IDI0LFxuICAgICh0cmFjay5pZCAmIDB4RkYwMDAwKSA+PiAxNixcbiAgICAodHJhY2suaWQgJiAweEZGMDApID4+IDgsXG4gICAgdHJhY2suaWQgJiAweEZGLCAvLyB0cmFja19JRFxuICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgKHRyYWNrLmR1cmF0aW9uICYgMHhGRjAwMDAwMCkgPj4gMjQsXG4gICAgKHRyYWNrLmR1cmF0aW9uICYgMHhGRjAwMDApID4+IDE2LFxuICAgICh0cmFjay5kdXJhdGlvbiAmIDB4RkYwMCkgPj4gOCxcbiAgICB0cmFjay5kdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgIDB4MDAsIDB4MDAsIC8vIGxheWVyXG4gICAgMHgwMCwgMHgwMCwgLy8gYWx0ZXJuYXRlX2dyb3VwXG4gICAgMHgwMCwgMHgwMCwgLy8gbm9uLWF1ZGlvIHRyYWNrIHZvbHVtZVxuICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAodHJhY2sud2lkdGggJiAweEZGMDApID4+IDgsXG4gICAgdHJhY2sud2lkdGggJiAweEZGLFxuICAgIDB4MDAsIDB4MDAsIC8vIHdpZHRoXG4gICAgKHRyYWNrLmhlaWdodCAmIDB4RkYwMCkgPj4gOCxcbiAgICB0cmFjay5oZWlnaHQgJiAweEZGLFxuICAgIDB4MDAsIDB4MDAgLy8gaGVpZ2h0XG4gIF0pKTtcbn07XG5cbnRyYWYgPSBmdW5jdGlvbih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSB7XG4gIHZhciBzYW1wbGVEZXBlbmRlbmN5VGFibGUgPSBzZHRwKHRyYWNrKTtcbiAgcmV0dXJuIGJveCh0eXBlcy50cmFmLFxuICAgICAgICAgICAgIGJveCh0eXBlcy50ZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAodHJhY2suaWQgJiAweEZGMDAwMDAwKSA+PiAyNCxcbiAgICAgICAgICAgICAgICh0cmFjay5pZCAmIDB4RkYwMDAwKSA+PiAxNixcbiAgICAgICAgICAgICAgICh0cmFjay5pZCAmIDB4RkYwMCkgPj4gOCxcbiAgICAgICAgICAgICAgICh0cmFjay5pZCAmIDB4RkYpIC8vIHRyYWNrX0lEXG4gICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgIGJveCh0eXBlcy50ZmR0LCBuZXcgVWludDhBcnJheShbXG4gICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSAmIDB4RkYwMDAwMDApID4+IDI0LFxuICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgJiAweEZGMDAwMCkgPj4gMTYsXG4gICAgICAgICAgICAgICAoYmFzZU1lZGlhRGVjb2RlVGltZSAmIDB4RkYwMCkgPj4gOCxcbiAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lICYgMHhGRikgLy8gYmFzZU1lZGlhRGVjb2RlVGltZVxuICAgICAgICAgICAgIF0pKSxcbiAgICAgICAgICAgICB0cnVuKHRyYWNrLFxuICAgICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAxNiArIC8vIHRmaGRcbiAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZkdFxuICAgICAgICAgICAgICAgICAgOCArICAvLyB0cmFmIGhlYWRlclxuICAgICAgICAgICAgICAgICAgMTYgKyAvLyBtZmhkXG4gICAgICAgICAgICAgICAgICA4ICsgIC8vIG1vb2YgaGVhZGVyXG4gICAgICAgICAgICAgICAgICA4KSwgIC8vIG1kYXQgaGVhZGVyXG4gICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlKTtcbn07XG5cbi8qKlxuICogR2VuZXJhdGUgYSB0cmFjayBib3guXG4gKiBAcGFyYW0gdHJhY2sge29iamVjdH0gYSB0cmFjayBkZWZpbml0aW9uXG4gKiBAcmV0dXJuIHtVaW50OEFycmF5fSB0aGUgdHJhY2sgYm94XG4gKi9cbnRyYWsgPSBmdW5jdGlvbih0cmFjaykge1xuICB0cmFjay5kdXJhdGlvbiA9IHRyYWNrLmR1cmF0aW9uIHx8IDB4ZmZmZmZmZmY7XG4gIHJldHVybiBib3godHlwZXMudHJhayxcbiAgICAgICAgICAgICB0a2hkKHRyYWNrKSxcbiAgICAgICAgICAgICBtZGlhKHRyYWNrKSk7XG59O1xuXG50cmV4ID0gZnVuY3Rpb24odHJhY2spIHtcbiAgcmV0dXJuIGJveCh0eXBlcy50cmV4LCBuZXcgVWludDhBcnJheShbXG4gICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAodHJhY2suaWQgJiAweEZGMDAwMDAwKSA+PiAyNCxcbiAgICAodHJhY2suaWQgJiAweEZGMDAwMCkgPj4gMTYsXG4gICAgKHRyYWNrLmlkICYgMHhGRjAwKSA+PiA4LFxuICAgICh0cmFjay5pZCAmIDB4RkYpLCAvLyB0cmFja19JRFxuICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGRlZmF1bHRfc2FtcGxlX2Rlc2NyaXB0aW9uX2luZGV4XG4gICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfZHVyYXRpb25cbiAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBkZWZhdWx0X3NhbXBsZV9zaXplXG4gICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMSAvLyBkZWZhdWx0X3NhbXBsZV9mbGFnc1xuICBdKSk7XG59O1xuXG50cnVuID0gZnVuY3Rpb24odHJhY2ssIG9mZnNldCkge1xuICB2YXIgYnl0ZXMsIHNhbXBsZXMsIHNhbXBsZSwgaTtcblxuICBzYW1wbGVzID0gdHJhY2suc2FtcGxlcyB8fCBbXTtcbiAgb2Zmc2V0ICs9IDggKyAxMiArICgxNiAqIHNhbXBsZXMubGVuZ3RoKTtcblxuICBieXRlcyA9IFtcbiAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAweDAwLCAweDBmLCAweDAxLCAvLyBmbGFnc1xuICAgIChzYW1wbGVzLmxlbmd0aCAmIDB4RkYwMDAwMDApID4+PiAyNCxcbiAgICAoc2FtcGxlcy5sZW5ndGggJiAweEZGMDAwMCkgPj4+IDE2LFxuICAgIChzYW1wbGVzLmxlbmd0aCAmIDB4RkYwMCkgPj4+IDgsXG4gICAgc2FtcGxlcy5sZW5ndGggJiAweEZGLCAvLyBzYW1wbGVfY291bnRcbiAgICAob2Zmc2V0ICYgMHhGRjAwMDAwMCkgPj4+IDI0LFxuICAgIChvZmZzZXQgJiAweEZGMDAwMCkgPj4+IDE2LFxuICAgIChvZmZzZXQgJiAweEZGMDApID4+PiA4LFxuICAgIG9mZnNldCAmIDB4RkYgLy8gZGF0YV9vZmZzZXRcbiAgXTtcblxuICBmb3IgKGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuICAgIHNhbXBsZSA9IHNhbXBsZXNbaV07XG4gICAgYnl0ZXMgPSBieXRlcy5jb25jYXQoW1xuICAgICAgKHNhbXBsZS5kdXJhdGlvbiAmIDB4RkYwMDAwMDApID4+PiAyNCxcbiAgICAgIChzYW1wbGUuZHVyYXRpb24gJiAweEZGMDAwMCkgPj4+IDE2LFxuICAgICAgKHNhbXBsZS5kdXJhdGlvbiAmIDB4RkYwMCkgPj4+IDgsXG4gICAgICBzYW1wbGUuZHVyYXRpb24gJiAweEZGLCAvLyBzYW1wbGVfZHVyYXRpb25cbiAgICAgIChzYW1wbGUuc2l6ZSAmIDB4RkYwMDAwMDApID4+PiAyNCxcbiAgICAgIChzYW1wbGUuc2l6ZSAmIDB4RkYwMDAwKSA+Pj4gMTYsXG4gICAgICAoc2FtcGxlLnNpemUgJiAweEZGMDApID4+PiA4LFxuICAgICAgc2FtcGxlLnNpemUgJiAweEZGLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgKHNhbXBsZS5mbGFncy5pc0xlYWRpbmcgPDwgMikgfCBzYW1wbGUuZmxhZ3MuZGVwZW5kc09uLFxuICAgICAgKHNhbXBsZS5mbGFncy5pc0RlcGVuZGVkT24gPDwgNikgfFxuICAgICAgICAoc2FtcGxlLmZsYWdzLmhhc1JlZHVuZGFuY3kgPDwgNCkgfFxuICAgICAgICAoc2FtcGxlLmZsYWdzLnBhZGRpbmdWYWx1ZSA8PCAxKSB8XG4gICAgICAgIHNhbXBsZS5mbGFncy5pc05vblN5bmNTYW1wbGUsXG4gICAgICBzYW1wbGUuZmxhZ3MuZGVncmFkYXRpb25Qcmlvcml0eSAmIDB4RjAgPDwgOCxcbiAgICAgIHNhbXBsZS5mbGFncy5kZWdyYWRhdGlvblByaW9yaXR5ICYgMHgwRiwgLy8gc2FtcGxlX2ZsYWdzXG4gICAgICAoc2FtcGxlLmNvbXBvc2l0aW9uVGltZU9mZnNldCAmIDB4RkYwMDAwMDApID4+PiAyNCxcbiAgICAgIChzYW1wbGUuY29tcG9zaXRpb25UaW1lT2Zmc2V0ICYgMHhGRjAwMDApID4+PiAxNixcbiAgICAgIChzYW1wbGUuY29tcG9zaXRpb25UaW1lT2Zmc2V0ICYgMHhGRjAwKSA+Pj4gOCxcbiAgICAgIHNhbXBsZS5jb21wb3NpdGlvblRpbWVPZmZzZXQgJiAweEZGIC8vIHNhbXBsZV9jb21wb3NpdGlvbl90aW1lX29mZnNldFxuICAgIF0pO1xuICB9XG4gIHJldHVybiBib3godHlwZXMudHJ1biwgbmV3IFVpbnQ4QXJyYXkoYnl0ZXMpKTtcbn07XG5cbmxldCBNUDQgPSB7XG4gIG1kYXQ6IG1kYXQsXG4gIG1vb2Y6IG1vb2YsXG4gIG1vb3Y6IG1vb3YsXG4gIGluaXRTZWdtZW50OiBmdW5jdGlvbih0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGZpbGVUeXBlID0gZnR5cCgpLFxuICAgICAgbW92aWUgPSBtb292KHRyYWNrcyksXG4gICAgICByZXN1bHQ7XG5cbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShmaWxlVHlwZS5ieXRlTGVuZ3RoICsgbW92aWUuYnl0ZUxlbmd0aCk7XG4gICAgcmVzdWx0LnNldChmaWxlVHlwZSk7XG4gICAgcmVzdWx0LnNldChtb3ZpZSwgZmlsZVR5cGUuYnl0ZUxlbmd0aCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgTVA0O1xuXG59KSgpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBub29wKCl7fVxubGV0IGZha2VMb2dnZXIgPSB7XG4gIGxvZzogbm9vcCxcbiAgd2Fybjogbm9vcCxcbiAgaW5mbzogbm9vcCxcbiAgZXJyb3I6IG5vb3Bcbn07XG5sZXQgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuXG5leHBvcnQgdmFyIGVuYWJsZUxvZ3MgPSBmdW5jdGlvbihkZWJ1Zykge1xuICBpZiAoZGVidWcgPT09IHRydWUgfHwgdHlwZW9mIGRlYnVnICAgICAgID09PSAnb2JqZWN0Jykge1xuICAgIGV4cG9ydGVkTG9nZ2VyLmxvZyAgID0gZGVidWcubG9nICAgPyBkZWJ1Zy5sb2cuYmluZChkZWJ1ZykgICA6IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSk7XG4gICAgZXhwb3J0ZWRMb2dnZXIuaW5mbyAgPSBkZWJ1Zy5pbmZvICA/IGRlYnVnLmluZm8uYmluZChkZWJ1ZykgIDogY29uc29sZS5pbmZvLmJpbmQoY29uc29sZSk7XG4gICAgZXhwb3J0ZWRMb2dnZXIuZXJyb3IgPSBkZWJ1Zy5lcnJvciA/IGRlYnVnLmVycm9yLmJpbmQoZGVidWcpIDogY29uc29sZS5lcnJvci5iaW5kKGNvbnNvbGUpO1xuICAgIGV4cG9ydGVkTG9nZ2VyLndhcm4gID0gZGVidWcud2FybiAgPyBkZWJ1Zy53YXJuLmJpbmQoZGVidWcpICA6IGNvbnNvbGUud2Fybi5iaW5kKGNvbnNvbGUpO1xuXG4gICAgLy8gU29tZSBicm93c2VycyBkb24ndCBhbGxvdyB0byB1c2UgYmluZCBvbiBjb25zb2xlIG9iamVjdCBhbnl3YXlcbiAgICAvLyBmYWxsYmFjayB0byBkZWZhdWx0IGlmIG5lZWRlZFxuICAgIHRyeSB7XG4gICAgIGV4cG9ydGVkTG9nZ2VyLmxvZygpO1xuICAgIH1cbiAgICBjYXRjaCAoZSkge1xuICAgICAgZXhwb3J0ZWRMb2dnZXIubG9nICAgPSBub29wO1xuICAgICAgZXhwb3J0ZWRMb2dnZXIuaW5mbyAgPSBub29wO1xuICAgICAgZXhwb3J0ZWRMb2dnZXIuZXJyb3IgPSBub29wO1xuICAgICAgZXhwb3J0ZWRMb2dnZXIud2FybiAgPSBub29wO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG4gIH1cbn07XG5leHBvcnQgdmFyIGxvZ2dlciA9IGV4cG9ydGVkTG9nZ2VyO1xuIiwiLyoqXG4gKiBBIGxpZ2h0d2VpZ2h0IHJlYWRhYmxlIHN0cmVhbSBpbXBsZW1lbnRpb24gdGhhdCBoYW5kbGVzIGV2ZW50IGRpc3BhdGNoaW5nLlxuICogT2JqZWN0cyB0aGF0IGluaGVyaXQgZnJvbSBzdHJlYW1zIHNob3VsZCBjYWxsIGluaXQgaW4gdGhlaXIgY29uc3RydWN0b3JzLlxuICovXG5cbiAndXNlIHN0cmljdCc7XG5cbiBjbGFzcyBTdHJlYW0gIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgZm9yIGEgc3BlY2lmaWVkIGV2ZW50IHR5cGUuXG4gICAqIEBwYXJhbSB0eXBlIHtzdHJpbmd9IHRoZSBldmVudCBuYW1lXG4gICAqIEBwYXJhbSBsaXN0ZW5lciB7ZnVuY3Rpb259IHRoZSBjYWxsYmFjayB0byBiZSBpbnZva2VkIHdoZW4gYW4gZXZlbnQgb2ZcbiAgICogdGhlIHNwZWNpZmllZCB0eXBlIG9jY3Vyc1xuICAgKi9cbiAgIG9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gICAgaWYgKCF0aGlzLmxpc3RlbmVyc1t0eXBlXSkge1xuICAgICAgdGhpcy5saXN0ZW5lcnNbdHlwZV0gPSBbXTtcbiAgICB9XG4gICAgdGhpcy5saXN0ZW5lcnNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIH1cbiAgLyoqXG4gICAqIFJlbW92ZSBhIGxpc3RlbmVyIGZvciBhIHNwZWNpZmllZCBldmVudCB0eXBlLlxuICAgKiBAcGFyYW0gdHlwZSB7c3RyaW5nfSB0aGUgZXZlbnQgbmFtZVxuICAgKiBAcGFyYW0gbGlzdGVuZXIge2Z1bmN0aW9ufSBhIGZ1bmN0aW9uIHByZXZpb3VzbHkgcmVnaXN0ZXJlZCBmb3IgdGhpc1xuICAgKiB0eXBlIG9mIGV2ZW50IHRocm91Z2ggYG9uYFxuICAgKi9cbiAgIG9mZih0eXBlLCBsaXN0ZW5lcikge1xuICAgIHZhciBpbmRleDtcbiAgICBpZiAoIXRoaXMubGlzdGVuZXJzW3R5cGVdKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGluZGV4ID0gdGhpcy5saXN0ZW5lcnNbdHlwZV0uaW5kZXhPZihsaXN0ZW5lcik7XG4gICAgdGhpcy5saXN0ZW5lcnNbdHlwZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICByZXR1cm4gaW5kZXggPiAtMTtcbiAgfVxuICAvKipcbiAgICogVHJpZ2dlciBhbiBldmVudCBvZiB0aGUgc3BlY2lmaWVkIHR5cGUgb24gdGhpcyBzdHJlYW0uIEFueSBhZGRpdGlvbmFsXG4gICAqIGFyZ3VtZW50cyB0byB0aGlzIGZ1bmN0aW9uIGFyZSBwYXNzZWQgYXMgcGFyYW1ldGVycyB0byBldmVudCBsaXN0ZW5lcnMuXG4gICAqIEBwYXJhbSB0eXBlIHtzdHJpbmd9IHRoZSBldmVudCBuYW1lXG4gICAqL1xuICAgdHJpZ2dlcih0eXBlKSB7XG4gICAgdmFyIGNhbGxiYWNrcywgaSwgbGVuZ3RoLCBhcmdzO1xuICAgIGNhbGxiYWNrcyA9IHRoaXMubGlzdGVuZXJzW3R5cGVdO1xuICAgIGlmICghY2FsbGJhY2tzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIFNsaWNpbmcgdGhlIGFyZ3VtZW50cyBvbiBldmVyeSBpbnZvY2F0aW9uIG9mIHRoaXMgbWV0aG9kXG4gICAgLy8gY2FuIGFkZCBhIHNpZ25pZmljYW50IGFtb3VudCBvZiBvdmVyaGVhZC4gQXZvaWQgdGhlXG4gICAgLy8gaW50ZXJtZWRpYXRlIG9iamVjdCBjcmVhdGlvbiBmb3IgdGhlIGNvbW1vbiBjYXNlIG9mIGFcbiAgICAvLyBzaW5nbGUgY2FsbGJhY2sgYXJndW1lbnRcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgbGVuZ3RoID0gY2FsbGJhY2tzLmxlbmd0aDtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgICAgICBjYWxsYmFja3NbaV0uY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgIGxlbmd0aCA9IGNhbGxiYWNrcy5sZW5ndGg7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY2FsbGJhY2tzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgLyoqXG4gICAqIERlc3Ryb3lzIHRoZSBzdHJlYW0gYW5kIGNsZWFucyB1cC5cbiAgICovXG4gICBkaXNwb3NlKCkge1xuICAgIHRoaXMubGlzdGVuZXJzID0ge307XG4gIH07XG5cblxuICAvKipcbiAgICogRm9yd2FyZHMgYWxsIGBkYXRhYCBldmVudHMgb24gdGhpcyBzdHJlYW0gdG8gdGhlIGRlc3RpbmF0aW9uIHN0cmVhbS4gVGhlXG4gICAqIGRlc3RpbmF0aW9uIHN0cmVhbSBzaG91bGQgcHJvdmlkZSBhIG1ldGhvZCBgcHVzaGAgdG8gcmVjZWl2ZSB0aGUgZGF0YVxuICAgKiBldmVudHMgYXMgdGhleSBhcnJpdmUuXG4gICAqIEBwYXJhbSBkZXN0aW5hdGlvbiB7c3RyZWFtfSB0aGUgc3RyZWFtIHRoYXQgd2lsbCByZWNlaXZlIGFsbCBgZGF0YWAgZXZlbnRzXG4gICAqIEBzZWUgaHR0cDovL25vZGVqcy5vcmcvYXBpL3N0cmVhbS5odG1sI3N0cmVhbV9yZWFkYWJsZV9waXBlX2Rlc3RpbmF0aW9uX29wdGlvbnNcbiAgICovXG4gICBwaXBlKGRlc3RpbmF0aW9uKSB7XG4gICAgdGhpcy5vbignZGF0YScsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIGRlc3RpbmF0aW9uLnB1c2goZGF0YSk7XG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgU3RyZWFtO1xuXG4iXX0=
