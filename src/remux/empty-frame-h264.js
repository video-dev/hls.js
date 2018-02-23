// 16x16 black square
// convert -size 16x16 xc:black black1616.png
// ffmpeg -i black1616.png -an -vcodec h264 output1616.mp4

'use strict';
import ExpGolomb from '../demux/exp-golomb';

const sps = new Uint8Array([0x67,0xf4,0x00,0x0a,0x91,0x9b,0x2b,0xd3,0x64,0x00,0x00,0x03,0x00,0x04,0x00,0x00,0x03,0x00,0xc8,0x3c,0x48,0x96,0x58]);
const pps = new Uint8Array([0x68,0xeb,0xe3,0xc4,0x48,0x44]);
const idr = new Uint8Array([0x65,0x88,0x84,0x00,0x2b,0xff,0xfe,0xf5,0xdb,0xf3,0x2c,0xae,0x6e,0x9f,0xff]);

function getTrack() {
  let track = {
                container : 'video/mp4',
                type: 'video',
                id :0,
                sequenceNumber: 0,
                samples : [],
                dropped : 0,
                sps : [sps],
                pps : [pps]
              };
  let expGolombDecoder = new ExpGolomb(sps);
  const config = expGolombDecoder.readSPS();
  track.width = config.width;
  track.height = config.height;
  track.pixelRatio = config.pixelRatio;
  return track;
}

function getFrame() {
  return [
    { type : 7 /*SPS*/, data : sps},
    { type : 8 /*PPS*/, data : pps},
    { type : 5 /*IDR*/, data : idr}
  ];
}

const EmptyFrameH264 = {
  getTrack : getTrack,
  getFrame : getFrame
};


module.exports=EmptyFrameH264;
