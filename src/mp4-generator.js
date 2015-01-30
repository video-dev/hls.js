(function(window, mseHls, undefined) {
    'use strict';

    var box,
        dinf,
        ftyp,
        mdat,
        mfhd,
        minf,
        moof,
        moov,
        mvex,
        mvhd,
        trak,
        tkhd,
        mdia,
        mdhd,
        hdlr,
        sdtp,
        stbl,
        stsd,
        styp,
        traf,
        trex,
        trun,
        avc1,
        mp4a,
        esds,
        types,
        MAJOR_BRAND,
        MINOR_VERSION,
        AVC1_BRAND,
        VIDEO_HDLR,
        AUDIO_HDLR,
        HDLR_TYPES,
        VMHD,
        SMHD,
        MEDIAHEADER_TYPES,
        DREF,
        STCO,
        STSC,
        STSZ,
        STTS,
        ESDS,
        STSD;
    Uint8Array, DataView;

    Uint8Array = window.Uint8Array;
    DataView = window.DataView;

    // pre-calculate constants
    (function() {
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
                types[i] = [
                    i.charCodeAt(0),
                    i.charCodeAt(1),
                    i.charCodeAt(2),
                    i.charCodeAt(3)
                ];
            }
        }

        MAJOR_BRAND = new Uint8Array([
            'i'.charCodeAt(0),
            's'.charCodeAt(0),
            'o'.charCodeAt(0),
            'm'.charCodeAt(0)
        ]);
        AVC1_BRAND = new Uint8Array([
            'a'.charCodeAt(0),
            'v'.charCodeAt(0),
            'c'.charCodeAt(0),
            '1'.charCodeAt(0)
        ]);
        MINOR_VERSION = new Uint8Array([0, 0, 0, 1]);
        VIDEO_HDLR = new Uint8Array([
            0x00, // version 0
            0x00,
            0x00,
            0x00, // flags
            0x00,
            0x00,
            0x00,
            0x00, // pre_defined
            0x76,
            0x69,
            0x64,
            0x65, // handler_type: 'vide'
            0x00,
            0x00,
            0x00,
            0x00, // reserved
            0x00,
            0x00,
            0x00,
            0x00, // reserved
            0x00,
            0x00,
            0x00,
            0x00, // reserved
            0x56,
            0x69,
            0x64,
            0x65,
            0x6f,
            0x48,
            0x61,
            0x6e,
            0x64,
            0x6c,
            0x65,
            0x72,
            0x00 // name: 'VideoHandler'
        ]);
        AUDIO_HDLR = new Uint8Array([
            0x00, // version 0
            0x00,
            0x00,
            0x00, // flags
            0x00,
            0x00,
            0x00,
            0x00, // pre_defined
            0x73,
            0x6f,
            0x75,
            0x6e, // handler_type: 'soun'
            0x00,
            0x00,
            0x00,
            0x00, // reserved
            0x00,
            0x00,
            0x00,
            0x00, // reserved
            0x00,
            0x00,
            0x00,
            0x00, // reserved
            0x53,
            0x6f,
            0x75,
            0x6e,
            0x64,
            0x48,
            0x61,
            0x6e,
            0x64,
            0x6c,
            0x65,
            0x72,
            0x00 // name: 'SoundHandler'
        ]);
        HDLR_TYPES = {
            video: VIDEO_HDLR,
            audio: AUDIO_HDLR
        };
        DREF = new Uint8Array([
            0x00, // version 0
            0x00,
            0x00,
            0x00, // flags
            0x00,
            0x00,
            0x00,
            0x01, // entry_count
            0x00,
            0x00,
            0x00,
            0x0c, // entry_size
            0x75,
            0x72,
            0x6c,
            0x20, // 'url' type
            0x00, // version 0
            0x00,
            0x00,
            0x01 // entry_flags
        ]);
        STCO = new Uint8Array([
            0x00, // version
            0x00,
            0x00,
            0x00, // flags
            0x00,
            0x00,
            0x00,
            0x00 // entry_count
        ]);
        STSC = STCO;
        STSZ = new Uint8Array([
            0x00, // version
            0x00,
            0x00,
            0x00, // flags
            0x00,
            0x00,
            0x00,
            0x00, // sample_size
            0x00,
            0x00,
            0x00,
            0x00 // sample_count
        ]);
        STTS = STCO;
        VMHD = new Uint8Array([
            0x00, // version
            0x00,
            0x00,
            0x01, // flags
            0x00,
            0x00, // graphicsmode
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00 // opcolor
        ]);
        SMHD = new Uint8Array([
            0x00, // version
            0x00,
            0x00,
            0x00, // flags
            0x00,
            0x00, // balance
            0x00,
            0x00 // reserved
        ]);

        STSD = new Uint8Array([
            0x00, // version 0
            0x00,
            0x00,
            0x00, // flags
            0x00,
            0x00,
            0x00,
            0x01
        ]); // entry_count

        MEDIAHEADER_TYPES = {
            video: VMHD,
            audio: SMHD
        };
    })();

    box = function(type) {
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
        view = new DataView(
            result.buffer,
            result.byteOffset,
            result.byteLength
        );
        view.setUint32(0, result.byteLength);
        result.set(type, 4);

        // copy the payload into the result
        for (i = 0, size = 8; i < payload.length; i++) {
            result.set(payload[i], size);
            size += payload[i].byteLength;
        }
        return result;
    };

    dinf = function() {
        return box(types.dinf, box(types.dref, DREF));
    };

    ftyp = function() {
        return box(
            types.ftyp,
            MAJOR_BRAND,
            MINOR_VERSION,
            MAJOR_BRAND,
            AVC1_BRAND
        );
    };

    hdlr = function(type) {
        return box(types.hdlr, HDLR_TYPES[type]);
    };
    mdat = function(data) {
        return box(types.mdat, data);
    };
    mdhd = function(duration) {
        return box(
            types.mdhd,
            new Uint8Array([
                0x00, // version 0
                0x00,
                0x00,
                0x00, // flags
                0x00,
                0x00,
                0x00,
                0x02, // creation_time
                0x00,
                0x00,
                0x00,
                0x03, // modification_time
                0x00,
                0x01,
                0x5f,
                0x90, // timescale, 90,000 "ticks" per second

                (duration & 0xff000000) >> 24,
                (duration & 0xff0000) >> 16,
                (duration & 0xff00) >> 8,
                duration & 0xff, // duration
                0x55,
                0xc4, // 'und' language (undetermined)
                0x00,
                0x00
            ])
        );
    };
    mdia = function(track) {
        return box(
            types.mdia,
            mdhd(track.duration),
            hdlr(track.type),
            minf(track)
        );
    };
    mfhd = function(sequenceNumber) {
        return box(
            types.mfhd,
            new Uint8Array([
                0x00,
                0x00,
                0x00,
                0x00, // flags
                (sequenceNumber & 0xff000000) >> 24,
                (sequenceNumber & 0xff0000) >> 16,
                (sequenceNumber & 0xff00) >> 8,
                sequenceNumber & 0xff // sequence_number
            ])
        );
    };
    minf = function(track) {
        return box(
            types.minf,
            box(types.vmhd, MEDIAHEADER_TYPES[track.type]),
            dinf(),
            stbl(track)
        );
    };
    moof = function(sequenceNumber, baseMediaDecodeTime, tracks) {
        var trackFragments = [],
            i = tracks.length;
        // build traf boxes for each track fragment
        while (i--) {
            trackFragments[i] = traf(tracks[i], baseMediaDecodeTime);
        }
        return box.apply(
            null,
            [types.moof, mfhd(sequenceNumber)].concat(trackFragments)
        );
    };
    /**
     * @param tracks... (optional) {array} the tracks associated with this movie
     */
    moov = function(tracks) {
        var i = tracks.length,
            boxes = [];

        while (i--) {
            boxes[i] = trak(tracks[i]);
        }

        return box.apply(
            null,
            [types.moov, mvhd(1)].concat(boxes).concat(mvex(tracks))
        );
    };
    mvex = function(tracks) {
        var i = tracks.length,
            boxes = [];

        while (i--) {
            boxes[i] = trex(tracks[i]);
        }
        return box.apply(null, [types.mvex].concat(boxes));
    };
    mvhd = function(duration) {
        var bytes = new Uint8Array([
            0x00, // version 0
            0x00,
            0x00,
            0x00, // flags
            0x00,
            0x00,
            0x00,
            0x01, // creation_time
            0x00,
            0x00,
            0x00,
            0x02, // modification_time
            0x00,
            0x01,
            0x5f,
            0x90, // timescale, 90,000 "ticks" per second
            (duration & 0xff000000) >> 24,
            (duration & 0xff0000) >> 16,
            (duration & 0xff00) >> 8,
            duration & 0xff, // duration
            0x00,
            0x01,
            0x00,
            0x00, // 1.0 rate
            0x01,
            0x00, // 1.0 volume
            0x00,
            0x00, // reserved
            0x00,
            0x00,
            0x00,
            0x00, // reserved
            0x00,
            0x00,
            0x00,
            0x00, // reserved
            0x00,
            0x01,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x01,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x40,
            0x00,
            0x00,
            0x00, // transformation: unity matrix
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00, // pre_defined
            0xff,
            0xff,
            0xff,
            0xff // next_track_ID
        ]);
        return box(types.mvhd, bytes);
    };

    sdtp = function(track) {
        var samples = track.samples || [],
            bytes = new Uint8Array(4 + samples.length),
            sample,
            i;

        // leave the full box header (4 bytes) all zero

        // write the sample table
        for (i = 0; i < samples.length; i++) {
            sample = samples[i];
            bytes[i + 4] =
                (sample.flags.dependsOn << 4) |
                (sample.flags.isDependedOn << 2) |
                sample.flags.hasRedundancy;
        }

        return box(types.sdtp, bytes);
    };

    stbl = function(track) {
        return box(
            types.stbl,
            stsd(track),
            box(types.stts, STTS),
            box(types.stsc, STSC),
            box(types.stsz, STSZ),
            box(types.stco, STCO)
        );
    };

    avc1 = function(track) {
        var sequenceParameterSets = [],
            pictureParameterSets = [],
            i;
        // assemble the SPSs
        for (i = 0; i < track.sps.length; i++) {
            sequenceParameterSets.push(
                (track.sps[i].byteLength & 0xff00) >>> 8
            );
            sequenceParameterSets.push(track.sps[i].byteLength & 0xff); // sequenceParameterSetLength
            sequenceParameterSets = sequenceParameterSets.concat(
                Array.prototype.slice.call(track.sps[i])
            ); // SPS
        }

        // assemble the PPSs
        for (i = 0; i < track.pps.length; i++) {
            pictureParameterSets.push((track.pps[i].byteLength & 0xff00) >>> 8);
            pictureParameterSets.push(track.pps[i].byteLength & 0xff);
            pictureParameterSets = pictureParameterSets.concat(
                Array.prototype.slice.call(track.pps[i])
            );
        }

        return box(
            types.avc1,
            new Uint8Array([
                0x00,
                0x00,
                0x00, // reserved
                0x00,
                0x00,
                0x00, // reserved
                0x00,
                0x01, // data_reference_index
                0x00,
                0x00, // pre_defined
                0x00,
                0x00, // reserved
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00, // pre_defined
                (track.width & 0xff00) >> 8,
                track.width & 0xff, // width
                (track.height & 0xff00) >> 8,
                track.height & 0xff, // height
                0x00,
                0x48,
                0x00,
                0x00, // horizresolution
                0x00,
                0x48,
                0x00,
                0x00, // vertresolution
                0x00,
                0x00,
                0x00,
                0x00, // reserved
                0x00,
                0x01, // frame_count
                0x13,
                0x76,
                0x69,
                0x64,
                0x65,
                0x6f,
                0x6a,
                0x73,
                0x2d,
                0x63,
                0x6f,
                0x6e,
                0x74,
                0x72,
                0x69,
                0x62,
                0x2d,
                0x68,
                0x6c,
                0x73,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00, // compressorname
                0x00,
                0x18, // depth = 24
                0x11,
                0x11
            ]), // pre_defined = -1
            box(
                types.avcC,
                new Uint8Array(
                    [
                        0x01, // configurationVersion
                        track.profileIdc, // AVCProfileIndication
                        track.profileCompatibility, // profile_compatibility
                        track.levelIdc, // AVCLevelIndication
                        0xff // lengthSizeMinusOne, hard-coded to 4 bytes
                    ]
                        .concat([
                            track.sps.length // numOfSequenceParameterSets
                        ])
                        .concat(sequenceParameterSets)
                        .concat([
                            track.pps.length // numOfPictureParameterSets
                        ])
                        .concat(pictureParameterSets)
                )
            ), // "PPS"
            box(
                types.btrt,
                new Uint8Array([
                    0x00,
                    0x1c,
                    0x9c,
                    0x80, // bufferSizeDB
                    0x00,
                    0x2d,
                    0xc6,
                    0xc0, // maxBitrate
                    0x00,
                    0x2d,
                    0xc6,
                    0xc0
                ])
            ) // avgBitrate
        );
    };

    esds = function(track) {
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

        return new Uint8Array([
            0x00, // version 0
            0x00,
            0x00,
            0x00, // flags

            0x03, // descriptor_type
            0x19, // length
            0x00,
            0x01, //es_id
            0x00, // stream_priority

            0x04, // descriptor_type
            0x11, // length
            0x40, //codec : mpeg4_audio
            0x15, // stream_type
            0x00,
            0x00,
            0x00, // buffer_size
            0x00,
            0x00,
            0x00,
            0x00, // maxBitrate
            0x00,
            0x00,
            0x00,
            0x00, // avgBitrate

            0x05, // descriptor_type
            0x02, // length
            (audioSpecificConfig & 0xff00) >> 8,
            audioSpecificConfig & 0xff
            //0x12,0x10 //audio_profile(5 bits/sampling freq 4 bits/channel config 4bits/frameLength 1bit/dependsOnCoreCoder 1 bit/extensionFlag 1 bit)
        ]);
    };

    mp4a = function(track) {
        return box(
            types.mp4a,
            new Uint8Array([
                0x00,
                0x00,
                0x00, // reserved
                0x00,
                0x00,
                0x00, // reserved
                0x00,
                0x01, // data_reference_index
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00, // reserved
                0x00,
                0x02, // channelcount:2 channels
                0x00,
                0x10, // sampleSize:16bits
                0x00,
                0x00,
                0x00,
                0x00, // reserved2
                0xbb,
                0x80,
                0x00,
                0x00
            ]), // Rate=48000
            box(types.esds, esds(track))
        );
    };

    stsd = function(track) {
        if (track.type === 'audio') {
            return box(types.stsd, STSD, mp4a(track));
        } else {
            return box(types.stsd, STSD, avc1(track));
        }
    };

    styp = function() {
        return box(types.styp, MAJOR_BRAND, MINOR_VERSION, MAJOR_BRAND);
    };

    tkhd = function(track) {
        return box(
            types.tkhd,
            new Uint8Array([
                0x00, // version 0
                0x00,
                0x00,
                0x07, // flags
                0x00,
                0x00,
                0x00,
                0x00, // creation_time
                0x00,
                0x00,
                0x00,
                0x00, // modification_time
                (track.id & 0xff000000) >> 24,
                (track.id & 0xff0000) >> 16,
                (track.id & 0xff00) >> 8,
                track.id & 0xff, // track_ID
                0x00,
                0x00,
                0x00,
                0x00, // reserved
                (track.duration & 0xff000000) >> 24,
                (track.duration & 0xff0000) >> 16,
                (track.duration & 0xff00) >> 8,
                track.duration & 0xff, // duration
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00, // reserved
                0x00,
                0x00, // layer
                0x00,
                0x00, // alternate_group
                0x00,
                0x00, // non-audio track volume
                0x00,
                0x00, // reserved
                0x00,
                0x01,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x01,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x40,
                0x00,
                0x00,
                0x00, // transformation: unity matrix
                (track.width & 0xff00) >> 8,
                track.width & 0xff,
                0x00,
                0x00, // width
                (track.height & 0xff00) >> 8,
                track.height & 0xff,
                0x00,
                0x00 // height
            ])
        );
    };

    traf = function(track, baseMediaDecodeTime) {
        var sampleDependencyTable = sdtp(track);
        return box(
            types.traf,
            box(
                types.tfhd,
                new Uint8Array([
                    0x00, // version 0
                    0x00,
                    0x00,
                    0x00, // flags
                    (track.id & 0xff000000) >> 24,
                    (track.id & 0xff0000) >> 16,
                    (track.id & 0xff00) >> 8,
                    track.id & 0xff // track_ID
                ])
            ),
            box(
                types.tfdt,
                new Uint8Array([
                    0x00, // version 0
                    0x00,
                    0x00,
                    0x00, // flags
                    (baseMediaDecodeTime & 0xff000000) >> 24,
                    (baseMediaDecodeTime & 0xff0000) >> 16,
                    (baseMediaDecodeTime & 0xff00) >> 8,
                    baseMediaDecodeTime & 0xff // baseMediaDecodeTime
                ])
            ),
            trun(
                track,
                sampleDependencyTable.length +
                16 + // tfhd
                16 + // tfdt
                8 + // traf header
                16 + // mfhd
                8 + // moof header
                    8
            ), // mdat header
            sampleDependencyTable
        );
    };

    /**
     * Generate a track box.
     * @param track {object} a track definition
     * @return {Uint8Array} the track box
     */
    trak = function(track) {
        track.duration = track.duration || 0xffffffff;
        return box(types.trak, tkhd(track), mdia(track));
    };

    trex = function(track) {
        return box(
            types.trex,
            new Uint8Array([
                0x00, // version 0
                0x00,
                0x00,
                0x00, // flags
                (track.id & 0xff000000) >> 24,
                (track.id & 0xff0000) >> 16,
                (track.id & 0xff00) >> 8,
                track.id & 0xff, // track_ID
                0x00,
                0x00,
                0x00,
                0x01, // default_sample_description_index
                0x00,
                0x00,
                0x00,
                0x00, // default_sample_duration
                0x00,
                0x00,
                0x00,
                0x00, // default_sample_size
                0x00,
                0x01,
                0x00,
                0x01 // default_sample_flags
            ])
        );
    };

    trun = function(track, offset) {
        var bytes, samples, sample, i;

        samples = track.samples || [];
        offset += 8 + 12 + 16 * samples.length;

        bytes = [
            0x00, // version 0
            0x00,
            0x0f,
            0x01, // flags
            (samples.length & 0xff000000) >>> 24,
            (samples.length & 0xff0000) >>> 16,
            (samples.length & 0xff00) >>> 8,
            samples.length & 0xff, // sample_count
            (offset & 0xff000000) >>> 24,
            (offset & 0xff0000) >>> 16,
            (offset & 0xff00) >>> 8,
            offset & 0xff // data_offset
        ];

        for (i = 0; i < samples.length; i++) {
            sample = samples[i];
            bytes = bytes.concat([
                (sample.duration & 0xff000000) >>> 24,
                (sample.duration & 0xff0000) >>> 16,
                (sample.duration & 0xff00) >>> 8,
                sample.duration & 0xff, // sample_duration
                (sample.size & 0xff000000) >>> 24,
                (sample.size & 0xff0000) >>> 16,
                (sample.size & 0xff00) >>> 8,
                sample.size & 0xff, // sample_size
                (sample.flags.isLeading << 2) | sample.flags.dependsOn,
                (sample.flags.isDependedOn << 6) |
                    (sample.flags.hasRedundancy << 4) |
                    (sample.flags.paddingValue << 1) |
                    sample.flags.isNonSyncSample,
                sample.flags.degradationPriority & (0xf0 << 8),
                sample.flags.degradationPriority & 0x0f, // sample_flags
                (sample.compositionTimeOffset & 0xff000000) >>> 24,
                (sample.compositionTimeOffset & 0xff0000) >>> 16,
                (sample.compositionTimeOffset & 0xff00) >>> 8,
                sample.compositionTimeOffset & 0xff // sample_composition_time_offset
            ]);
        }
        return box(types.trun, new Uint8Array(bytes));
    };

    window.mseHls.mp4 = {
        ftyp: ftyp,
        mdat: mdat,
        moof: moof,
        moov: moov,
        initSegment: function(tracks) {
            var fileType = ftyp(),
                movie = moov(tracks),
                result;

            result = new Uint8Array(fileType.byteLength + movie.byteLength);
            result.set(fileType);
            result.set(movie, fileType.byteLength);
            return result;
        }
    };
})(window, window.mseHls);
