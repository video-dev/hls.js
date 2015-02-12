/**
 * A stream-based mp2ts to mp4 converter. This utility is used to
 * deliver mp4s to a SourceBuffer on platforms that support native
 * Media Source Extensions.
 */

import Event           from '../events';
import ExpGolomb       from './exp-golomb';
import MP4             from '../remux/mp4-generator';
import observer        from '../observer';
import Stream          from '../utils/stream';

const MP2T_PACKET_LENGTH = 188; // bytes
const H264_STREAM_TYPE = 0x1b;
const ADTS_STREAM_TYPE = 0x0f;
const PAT_PID = 0;

/**
 * Splits an incoming stream of binary data into MPEG-2 Transport
 * Stream packets.
 */
class TransportPacketStream extends Stream {
  constructor() {
    super();
    this.buffer = new Uint8Array(MP2T_PACKET_LENGTH);
    this.end = 0;
  }

  push(bytes) {
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
      this.trigger('data', buffer);
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
      this.trigger('data', bytes.subarray(i, i + MP2T_PACKET_LENGTH));
      i += MP2T_PACKET_LENGTH;
      remaining = bytes.byteLength - i;
    } while (i < bytes.byteLength && remaining >= MP2T_PACKET_LENGTH);
    // buffer any partial packets left over
    if (remaining > 0) {
      this.buffer.set(bytes.subarray(i));
      this.end = remaining;
    }
  };
};

/**
 * Accepts an MP2T TransportPacketStream and emits data events with parsed
 * forms of the individual transport stream packets.
 */
class TransportParseStream extends Stream {
  constructor() {
    super();
    this.programMapTable = {};
  }

  parsePsi(payload, psi) {
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

    if (psi.type === 'pat') {
      this.parsePat(payload.subarray(offset), psi);
    } else {
      this.parsePmt(payload.subarray(offset), psi);
    }
  };

  parsePat(payload, pat) {
    pat.section_number = payload[7];
    pat.last_section_number = payload[8];

    // skip the PSI header and parse the first PMT entry
    pat.pmtPid = this.pmtPid = (payload[10] & 0x1F) << 8 | payload[11];
  };

  /**
   * Parse out the relevant fields of a Program Map Table (PMT).
   * @param payload {Uint8Array} the PMT-specific portion of an MP2T
   * packet. The first byte in this array should be the table_id
   * field.
   * @param pmt {object} the object that should be decorated with
   * fields parsed from the PMT.
   */
  parsePmt(payload, pmt) {
    var sectionLength, tableEnd, programInfoLength, offset;

    // PMTs can be sent ahead of the time when they should actually
    // take effect. We don't believe this should ever be the case
    // for HLS but we'll ignore "forward" PMT declarations if we see
    // them. Future PMT declarations have the current_next_indicator
    // set to zero.
    if (!(payload[5] & 0x01)) {
      return;
    }

    // overwrite any existing program map table
    this.programMapTable = {};

    // the mapping table ends at the end of the current section
    sectionLength = (payload[1] & 0x0f) << 8 | payload[2];
    tableEnd = 3 + sectionLength - 4;

    // to determine where the table is, we have to figure out how
    // long the program info descriptors are
    programInfoLength = (payload[10] & 0x0f) << 8 | payload[11];

    // advance the offset to the first entry in the mapping table
    offset = 12 + programInfoLength;
    while (offset < tableEnd) {
      // add an entry that maps the elementary_pid to the stream_type
      this.programMapTable[(payload[offset + 1] & 0x1F) << 8 | payload[offset + 2]] = payload[offset];

      // move to the next table entry
      // skip past the elementary stream descriptors, if present
      offset += ((payload[offset + 3] & 0x0F) << 8 | payload[offset + 4]) + 5;
    }

    // record the map on the packet as well
    pmt.programMapTable = this.programMapTable;
  };

  parsePes(payload, pes) {
    var ptsDtsFlags;

    if (!pes.payloadUnitStartIndicator) {
      pes.data = payload;
      return;
    }

    // find out if this packets starts a new keyframe
    pes.dataAlignmentIndicator = (payload[6] & 0x04) !== 0;
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
    if (ptsDtsFlags & 0xC0) {
      // the PTS and DTS are not written out directly. For information
      // on how they are encoded, see
      // http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
      pes.pts = (payload[9] & 0x0E) << 28
        | (payload[10] & 0xFF) << 21
        | (payload[11] & 0xFE) << 13
        | (payload[12] & 0xFF) <<  6
        | (payload[13] & 0xFE) >>>  2;
      pes.pts /= 45;
      pes.dts = pes.pts;
      if (ptsDtsFlags & 0x40) {
        pes.dts = (payload[14] & 0x0E ) << 28
          | (payload[15] & 0xFF ) << 21
          | (payload[16] & 0xFE ) << 13
          | (payload[17] & 0xFF ) << 6
          | (payload[18] & 0xFE ) >>> 2;
        pes.dts /= 45;
      }
    }

    // the data section starts immediately after the PES header.
    // pes_header_data_length specifies the number of header bytes
    // that follow the last byte of the field.
    pes.data = payload.subarray(9 + payload[8]);
  };

  /**
   * Deliver a new MP2T packet to the stream.
   */
  push(packet) {
    var
      result = {},
      offset = 4;
    // make sure packet is aligned on a sync byte
    if (packet[0] !== 0x47) {
      return this.trigger('error', 'mis-aligned packet');
    }
    result.payloadUnitStartIndicator = !!(packet[1] & 0x40);

    // pid is a 13-bit field starting at the last bit of packet[1]
    result.pid = packet[1] & 0x1f;
    result.pid <<= 8;
    result.pid |= packet[2];

    // if an adaption field is present, its length is specified by the
    // fifth byte of the TS packet header. The adaptation field is
    // used to add stuffing to PES packets that don't fill a complete
    // TS packet, and to specify some forms of timing and control data
    // that we do not currently use.
    if (((packet[3] & 0x30) >>> 4) > 0x01) {
      offset += packet[offset] + 1;
    }

    // parse the rest of the packet based on the type
    if (result.pid === PAT_PID) {
      result.type = 'pat';
      this.parsePsi(packet.subarray(offset), result);
    } else if (result.pid === this.pmtPid) {
      result.type = 'pmt';
      this.parsePsi(packet.subarray(offset), result);
    } else {
      result.streamType = this.programMapTable[result.pid];
      if(result.streamType == undefined) {
        return;
      } else {
        result.type = 'pes';
        this.parsePes(packet.subarray(offset), result);
      }
    }

    this.trigger('data', result);
  };
};

/**
 * Reconsistutes program elementary stream (PES) packets from parsed
 * transport stream packets. That is, if you pipe an
 * mp2t.TransportParseStream into a mp2t.ElementaryStream, the output
 * events will be events which capture the bytes for individual PES
 * packets plus relevant metadata that has been extracted from the
 * container.
 */
class ElementaryStream extends Stream {

  constructor() {
    super();
    this.audio = {data: [],size: 0};
    this.video = {data: [],size: 0};
  }

  flushStream(stream, type) {
    var
      event = {
        type: type,
        data: new Uint8Array(stream.size),
      },
      i = 0,
      fragment;

    // do nothing if there is no buffered data
    if (!stream.data.length) {
      return;
    }
    event.trackId = stream.data[0].pid;
    event.pts = stream.data[0].pts;
    event.dts = stream.data[0].dts;
    // reassemble the packet
    while (stream.data.length) {
      fragment = stream.data.shift();

      event.data.set(fragment.data, i);
      i += fragment.data.byteLength;
    }
    stream.size = 0;
    this.trigger('data', event);
  }

  push(data) {
    switch(data.type) {
      case "pat":
          // we have to wait for the PMT to arrive as well before we
            // have any meaningful metadata
            break;
      case "pmt":
        var
        event = {
          type: 'metadata',
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
              track.codec = 'avc';
              track.type = 'video';
            } else if (programMapTable[k] === ADTS_STREAM_TYPE) {
              track.codec = 'adts';
              track.type = 'audio';
            }
            event.tracks.push(track);
          }
        }
        this.trigger('data', event);
        break;
      case "pes":
        var stream, streamType;

        if (data.streamType === H264_STREAM_TYPE) {
          stream = this.video;
          streamType = 'video';
        } else {
          stream = this.audio;
          streamType = 'audio';
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
      };
  /**
   * Flush any remaining input. Video PES packets may be of variable
   * length. Normally, the start of a new video packet can trigger the
   * finalization of the previous packet. That is not possible if no
   * more video is forthcoming, however. In that case, some other
   * mechanism (like the end of the file) has to be employed. When it is
   * clear that no additional data is forthcoming, calling this method
   * will flush the buffered packets.
   */
  end() {
    this.flushStream(this.video, 'video');
    this.flushStream(this.audio, 'audio');
  };
};
/*
 * Accepts a ElementaryStream and emits data events with parsed
 * AAC Audio Frames of the individual packets.
 */
class AacStream extends Stream {

  constructor() {
    super();
    this.adtsSampleingRates = [
    96000, 88200,
    64000, 48000,
    44100, 32000,
    24000, 22050,
    16000, 12000
  ];
  }

  getAudioSpecificConfig(data) {
    var adtsProtectionAbsent, // :Boolean
        adtsObjectType, // :int
        adtsSampleingIndex, // :int
        adtsChanelConfig, // :int
        adtsFrameSize, // :int
        adtsSampleCount, // :int
        adtsDuration; // :int

      // byte 1
      adtsProtectionAbsent = !!(data[1] & 0x01);

      // byte 2
      adtsObjectType = ((data[2] & 0xC0) >>> 6) + 1;
      adtsSampleingIndex = ((data[2] & 0x3C) >>> 2);
      adtsChanelConfig = ((data[2] & 0x01) << 2);

      // byte 3
      adtsChanelConfig |= ((data[3] & 0xC0) >>> 6);
      adtsFrameSize = ((data[3] & 0x03) << 11);

      // byte 4
      adtsFrameSize |= (data[4] << 3);

      // byte 5
      adtsFrameSize |= ((data[5] & 0xE0) >>> 5);
      adtsFrameSize -= (adtsProtectionAbsent ? 7 : 9);

      // byte 6
      adtsSampleCount = ((data[6] & 0x03) + 1) * 1024;
      adtsDuration = (adtsSampleCount * 1000) / this.adtsSampleingRates[adtsSampleingIndex];
      this.config = new Uint8Array(2);
    /* refer to http://wiki.multimedia.cx/index.php?title=MPEG-4_Audio#Audio_Specific_Config
      Audio Profile
      0: Null
      1: AAC Main
      2: AAC LC (Low Complexity)
      3: AAC SSR (Scalable Sample Rate)
      4: AAC LTP (Long Term Prediction)
      5: SBR (Spectral Band Replication)
      6: AAC Scalable
     sampling freq
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
    Channel Configurations
      These are the channel configurations:
      0: Defined in AOT Specifc Config
      1: 1 channel: front-center
      2: 2 channels: front-left, front-right
    */
      // audioObjectType = profile => profile, the MPEG-4 Audio Object Type minus 1
      this.config[0] = adtsObjectType << 3;

      // samplingFrequencyIndex
      this.config[0] |= (adtsSampleingIndex & 0x0E) >> 1;
      this.config[1] |= (adtsSampleingIndex & 0x01) << 7;

      // channelConfiguration
      this.config[1] |= adtsChanelConfig << 3;

      this.stereo = (2 === adtsChanelConfig);
      this.audiosamplerate = this.adtsSampleingRates[adtsSampleingIndex];
  };

  push(packet) {

    if (packet.type == "audio" && packet.data != undefined) {

      var aacFrame, // :Frame = null;
        next_pts = packet.pts,
        data = packet.data;

      // byte 0
      if (0xFF !== data[0]) {
        console.assert(false, 'Error no ATDS header found');
      }

      if(this.config == undefined) {
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
      packet.config = this.config;
      this.trigger('data', packet);
    }
  };
};

/**
 * Accepts a NAL unit byte stream and unpacks the embedded NAL units.
 */
class NalByteStream extends Stream {

  constructor() {
    super();
    this.index=6;
    this.syncPoint =1;
    this.buffer = null;
  }

  push (data) {
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
    var i = this.index;
    var sync = this.syncPoint;
    var buf = this.buffer;
    while (i < buf.byteLength) {
      switch (buf[i]) {
      case 0:
        // skip past non-sync sequences
        if (buf[i - 1] !== 0) {
          i += 2;
          break;
        } else if (buf[i - 2] !== 0) {
          i++;
          break;
        }

        // deliver the NAL unit
        this.trigger('data', buf.subarray(sync + 3, i - 2));

        // drop trailing zeroes
        do {
          i++;
        } while (buf[i] !== 1);
        sync = i - 2;
        i += 3;
        break;
      case 1:
        // skip past non-sync sequences
        if (buf[i - 1] !== 0 ||
            buf[i - 2] !== 0) {
          i += 3;
          break;
        }

        // deliver the NAL unit
        this.trigger('data', buf.subarray(sync + 3, i - 2));
        sync = i - 2;
        i += 3;
        break;
      default:
        i += 3;
        break;
      }
    }
    // filter out the NAL units that were delivered
    this.buffer = buf.subarray(sync);
    i -= sync;
    this.index = i;
    this.syncPoint = 0;
  };

  end() {
    // deliver the last buffered NAL unit
    if (this.buffer.byteLength > 3) {
      this.trigger('data', this.buffer.subarray(this.syncPoint + 3));
    }
    this.buffer = null;
    this.index = 6;
    this.syncPoint = 1;
  };
};
/**
 * Accepts input from a ElementaryStream and produces H.264 NAL unit data
 * events.
 */
class H264Stream extends Stream {

  constructor() {
    super();
    this.nalByteStream = new NalByteStream();
    this.nalByteStream.on('data', function(data) {
    var event = {
      trackId: this.trackId,
      pts: this.currentPts,
      dts: this.currentDts,
      data: data
    };
    switch (data[0] & 0x1f) {
    case 0x05:
      event.nalUnitType = 'IDR';
      break;
    case 0x07:
      event.nalUnitType = 'SPS';
      var expGolombDecoder = new ExpGolomb(data.subarray(1));
      event.config = expGolombDecoder.readSequenceParameterSet();
      break;
    case 0x08:
      event.nalUnitType = 'PPS';
      break;
    case 0x09:
      event.nalUnitType = 'AUD';
      break;

    default:
      break;
    }
    this.trigger('data', event);
  }.bind(this));
  }

  push(packet) {
    if (packet.type !== 'video') {
      return;
    }
    this.trackId = packet.trackId;
    this.currentPts = packet.pts;
    this.currentDts = packet.dts;
    this.nalByteStream.push(packet);
  };

  end() {
    this.nalByteStream.end();
  };

};

/**
 * Constructs a single-track, ISO BMFF media segment from H264 data
 * events. The output of this stream can be fed to a SourceBuffer
 * configured with a suitable initialization segment.
 * @param track {object} track metadata configuration
 */
class VideoSegmentStream extends Stream {

  constructor(track) {
    super();
    this.sequenceNumber = 0;
    this.totalduration = 0;
    this.nalUnits = [];
    this.nalUnitsLength = 0;
    this.track = track;
  }

  push(data) {
    // buffer video until end() is called
    this.nalUnits.push(data);
    this.nalUnitsLength += data.data.byteLength;
  };

  end() {
    var startUnit, currentNal, moof, mdat, boxes, i, data, view, sample, startdts;

    // concatenate the video data and construct the mdat
    // first, we have to build the index from byte locations to
    // samples (that is, frames) in the video data
    data = new Uint8Array(this.nalUnitsLength + (4 * this.nalUnits.length));
    view = new DataView(data.buffer);
    this.track.samples = [];
    sample = {
      size: 0,
      flags: {
        isLeading: 0,
        dependsOn: 1,
        isDependedOn: 0,
        hasRedundancy: 0,
        isNonSyncSample : 1,
        degradationPriority: 0
      }
    };
    i = 0;
    startdts = this.nalUnits[0].dts;
    while (this.nalUnits.length) {
      currentNal = this.nalUnits[0];
      // flush the sample we've been building when a new sample is started
      if (currentNal.nalUnitType === 'AUD') {
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
            isNonSyncSample : 1,
            degradationPriority: 0,
          },
          compositionTimeOffset: currentNal.pts - currentNal.dts
        };
        startUnit = currentNal;
      }
      if (currentNal.nalUnitType === 'IDR') {
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
    moof = MP4.moof(this.sequenceNumber,this.totalduration,[this.track]);
    this.totalduration += (currentNal.dts - startdts)*90;
    // it would be great to allocate this array up front instead of
    // throwing away hundreds of media segment fragments
    boxes = new Uint8Array(moof.byteLength + mdat.byteLength);

    // bump the sequence number for next time
    this.sequenceNumber++;

    boxes.set(moof);
    boxes.set(mdat, moof.byteLength);

    this.trigger('data', boxes);
  };
}

/**
 * Constructs a single-track, ISO BMFF media segment from AAC data
 * events. The output of this stream can be fed to a SourceBuffer
 * configured with a suitable initialization segment.
 * @param track {object} track metadata configuration
 */
class AudioSegmentStream extends Stream {

  constructor(track) {
    super();
    this.sequenceNumber = 0;
    this.totalduration = 0;
    this.aacUnits = [];
    this.aacUnitsLength = 0;
    this.track = track;
  }

  push(data) {
    //remove ADTS header
    data.data = data.data.subarray(7);
    // buffer audio until end() is called
    this.aacUnits.push(data);
    this.aacUnitsLength += data.data.byteLength;
  };

  end() {
    var data, view, i, currentUnit, startUnit, lastUnit, mdat, moof, boxes;
    // // concatenate the audio data and construct the mdat
    // // first, we have to build the index from byte locations to
    // // samples (that is, frames) in the audio data
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
      if(lastUnit != null) {
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
    moof = MP4.moof(this.sequenceNumber,this.totalduration,[this.track]);
    this.totalduration += (currentUnit.dts - startUnit.dts)*90;
    // it would be great to allocate this array up front instead of
    // throwing away hundreds of media segment fragments
    boxes = new Uint8Array(moof.byteLength + mdat.byteLength);

    // bump the sequence number for next time
    this.sequenceNumber++;
    boxes.set(moof);
    boxes.set(mdat, moof.byteLength);

    this.trigger('data', boxes);
  };
}

/**
 * A Stream that expects MP2T binary data as input and produces
 * corresponding media segments, suitable for use with Media Source
 * Extension (MSE) implementations that support the ISO BMFF byte
 * stream format, like Chrome.
 * @see test/muxer/mse-demo.html for sample usage of a Transmuxer with
 * MSE
 */


var packetStream,parseStream, elementaryStream, aacStream, h264Stream,
    audioSegmentStream, videoSegmentStream,
    configAudio, configVideo,
    trackVideo, trackAudio,
    pps,sps;

class TSDemuxer {

  constructor() {
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

    // handle incoming data events
    aacStream.on('data', function(data) {
      if(!configAudio) {
        trackAudio.config = configAudio = data.config;
        trackAudio.audiosamplerate = data.audiosamplerate;
        if (configVideo) {
            observer.trigger(Event.FRAGMENT_PARSED,{
            data: MP4.initSegment([trackVideo,trackAudio])
          });
        }
      }
    });

    h264Stream.on('data', function(data) {
      // record the track config
      if (data.nalUnitType === 'SPS' &&
        !configVideo) {
        configVideo = data.config;

      trackVideo.width = configVideo.width;
      trackVideo.height = configVideo.height;
      trackVideo.sps = [data.data];
      trackVideo.profileIdc = configVideo.profileIdc;
      trackVideo.levelIdc = configVideo.levelIdc;
      trackVideo.profileCompatibility = configVideo.profileCompatibility;

        // generate an init segment once all the metadata is available
        if (pps) {
            observer.trigger(Event.FRAGMENT_PARSED,{
            data: MP4.initSegment([trackVideo,trackAudio])
          });
        }
      }
      if (data.nalUnitType === 'PPS' &&
        !pps) {
          pps = data.data;
          trackVideo.pps = [data.data];

          if (configVideo && configAudio) {
            observer.trigger(Event.FRAGMENT_PARSED,{
              data: MP4.initSegment([trackVideo,trackAudio])
            });
          }
        }
      });
    // hook up the video segment stream once track metadata is delivered
    elementaryStream.on('data', function(data) {
      var i, triggerData = function(segment) {
        observer.trigger(Event.FRAGMENT_PARSED,{
          data: segment
        });
      };
      if (data.type === 'metadata') {
        i = data.tracks.length;
        while (i--) {
          if (data.tracks[i].type === 'video') {
            trackVideo = data.tracks[i];
            if (!videoSegmentStream) {
              videoSegmentStream = new VideoSegmentStream(trackVideo);
              h264Stream.pipe(videoSegmentStream);
              videoSegmentStream.on('data', triggerData);
            }
          } else {
            if (data.tracks[i].type === 'audio') {
              trackAudio = data.tracks[i];
              if (!audioSegmentStream) {
                audioSegmentStream = new AudioSegmentStream(trackAudio);
                aacStream.pipe(audioSegmentStream);
                audioSegmentStream.on('data', triggerData);
              }
            }
          }
        }
      }
    });
  }

  // feed incoming data to the front of the parsing pipeline
  push(data) {
    packetStream.push(data);
  }
  // flush any buffered data
  end() {
    elementaryStream.end();
    h264Stream.end();
    videoSegmentStream.end();
    audioSegmentStream.end();
  }
}

export default TSDemuxer;
