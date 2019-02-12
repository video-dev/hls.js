import PlaylistLoader from '../../../src/loader/playlist-loader';
import M3U8Parser from '../../../src/loader/m3u8-parser';

const assert = require('assert');
const bufferIsEqual = require('arraybuffer-equal');

describe('PlaylistLoader', () => {
  it('parses empty manifest returns empty array', () => {
    assert.deepEqual(M3U8Parser.parseMasterPlaylist('', 'http://www.dailymotion.com'), []);
  });

  it('manifest with broken syntax returns empty array', () => {
    let manifest = `#EXTXSTREAMINF:PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360,NAME="480"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;
    assert.deepEqual(M3U8Parser.parseMasterPlaylist(manifest, 'http://www.dailymotion.com'), []);
  });

  it('parses manifest with one level', () => {
    let manifest = `#EXTM3U
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360,NAME="480"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    let result = M3U8Parser.parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]['bitrate'], 836280);
    assert.strictEqual(result[0]['audioCodec'], 'mp4a.40.2');
    assert.strictEqual(result[0]['videoCodec'], 'avc1.64001f');
    assert.strictEqual(result[0]['width'], 848);
    assert.strictEqual(result[0]['height'], 360);
    assert.strictEqual(result[0]['name'], '480');
    assert.strictEqual(result[0]['url'], 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core');
  });

  it('parses manifest without codecs', () => {
    let manifest = `#EXTM3U
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,RESOLUTION=848x360,NAME="480"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    let result = M3U8Parser.parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]['bitrate'], 836280);
    assert.strictEqual(result[0]['audioCodec'], undefined);
    assert.strictEqual(result[0]['videoCodec'], undefined);
    assert.strictEqual(result[0]['width'], 848);
    assert.strictEqual(result[0]['height'], 360);
    assert.strictEqual(result[0]['name'], '480');
    assert.strictEqual(result[0]['url'], 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core');
  });

  it('does not care about the attribute order', () => {
    let manifest = `#EXTM3U
#EXT-X-STREAM-INF:NAME="480",PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    let result = M3U8Parser.parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]['bitrate'], 836280);
    assert.strictEqual(result[0]['audioCodec'], 'mp4a.40.2');
    assert.strictEqual(result[0]['videoCodec'], 'avc1.64001f');
    assert.strictEqual(result[0]['width'], 848);
    assert.strictEqual(result[0]['height'], 360);
    assert.strictEqual(result[0]['name'], '480');
    assert.strictEqual(result[0]['url'], 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core');

    manifest = `#EXTM3U
#EXT-X-STREAM-INF:NAME="480",RESOLUTION=848x360,PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    result = M3U8Parser.parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]['bitrate'], 836280);
    assert.strictEqual(result[0]['audioCodec'], 'mp4a.40.2');
    assert.strictEqual(result[0]['videoCodec'], 'avc1.64001f');
    assert.strictEqual(result[0]['width'], 848);
    assert.strictEqual(result[0]['height'], 360);
    assert.strictEqual(result[0]['name'], '480');
    assert.strictEqual(result[0]['url'], 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core');

    manifest = `#EXTM3U
#EXT-X-STREAM-INF:CODECS="mp4a.40.2,avc1.64001f",NAME="480",RESOLUTION=848x360,PROGRAM-ID=1,BANDWIDTH=836280
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    result = M3U8Parser.parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]['bitrate'], 836280);
    assert.strictEqual(result[0]['audioCodec'], 'mp4a.40.2');
    assert.strictEqual(result[0]['videoCodec'], 'avc1.64001f');
    assert.strictEqual(result[0]['width'], 848);
    assert.strictEqual(result[0]['height'], 360);
    assert.strictEqual(result[0]['name'], '480');
    assert.strictEqual(result[0]['url'], 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core');
  });

  it('parses manifest with 10 levels', () => {
    let manifest = `#EXTM3U
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360,NAME="480"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360,NAME="480"
http://proxy-21.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=246440,CODECS="mp4a.40.5,avc1.42000d",RESOLUTION=320x136,NAME="240"
http://proxy-62.dailymotion.com/sec(65b989b17536b5158360dfc008542daa)/video/107/282/158282701_mp4_h264_aac_ld.m3u8#cell=core
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=246440,CODECS="mp4a.40.5,avc1.42000d",RESOLUTION=320x136,NAME="240"
http://proxy-21.dailymotion.com/sec(65b989b17536b5158360dfc008542daa)/video/107/282/158282701_mp4_h264_aac_ld.m3u8#cell=core
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=460560,CODECS="mp4a.40.5,avc1.420016",RESOLUTION=512x216,NAME="380"
http://proxy-62.dailymotion.com/sec(b90a363ba42fd9eab9313f0cd2e4d38b)/video/107/282/158282701_mp4_h264_aac.m3u8#cell=core
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=460560,CODECS="mp4a.40.5,avc1.420016",RESOLUTION=512x216,NAME="380"
http://proxy-21.dailymotion.com/sec(b90a363ba42fd9eab9313f0cd2e4d38b)/video/107/282/158282701_mp4_h264_aac.m3u8#cell=core
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=2149280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=1280x544,NAME="720"
http://proxy-62.dailymotion.com/sec(c16ad76fb8641c41d759e20880043e47)/video/107/282/158282701_mp4_h264_aac_hd.m3u8#cell=core
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=2149280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=1280x544,NAME="720"
http://proxy-21.dailymotion.com/sec(c16ad76fb8641c41d759e20880043e47)/video/107/282/158282701_mp4_h264_aac_hd.m3u8#cell=core
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=6221600,CODECS="mp4a.40.2,avc1.640028",RESOLUTION=1920x816,NAME="1080"
http://proxy-62.dailymotion.com/sec(2a991e17f08fcd94f95637a6dd718ddd)/video/107/282/158282701_mp4_h264_aac_fhd.m3u8#cell=core
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=6221600,CODECS="mp4a.40.2,avc1.640028",RESOLUTION=1920x816,NAME="1080"
http://proxy-21.dailymotion.com/sec(2a991e17f08fcd94f95637a6dd718ddd)/video/107/282/158282701_mp4_h264_aac_fhd.m3u8#cell=core`;

    let result = M3U8Parser.parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    assert.strictEqual(result.length, 10);
    assert.strictEqual(result[0]['bitrate'], 836280);
    assert.strictEqual(result[1]['bitrate'], 836280);
    assert.strictEqual(result[2]['bitrate'], 246440);
    assert.strictEqual(result[3]['bitrate'], 246440);
    assert.strictEqual(result[4]['bitrate'], 460560);
    assert.strictEqual(result[5]['bitrate'], 460560);
    assert.strictEqual(result[6]['bitrate'], 2149280);
    assert.strictEqual(result[7]['bitrate'], 2149280);
    assert.strictEqual(result[8]['bitrate'], 6221600);
    assert.strictEqual(result[9]['bitrate'], 6221600);
  });

  it('parses empty levels returns empty fragment array', () => {
    let level = '';
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core', 0);
    assert.strictEqual(result.fragments.length, 0);
    assert.strictEqual(result.totalduration, 0);
  });

  it('level with 0 frag returns empty fragment array', () => {
    let level = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:14`;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core', 0);
    assert.strictEqual(result.fragments.length, 0);
    assert.strictEqual(result.totalduration, 0);
  });

  it('parse level with several fragments', () => {
    let level = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:14
#EXTINF:11.360,
/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(1)/video/107/282/158282701_mp4_h264_aac_hq.ts
#EXTINF: 11.320,
/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(2)/video/107/282/158282701_mp4_h264_aac_hq.ts
#EXTINF: 13.480,
# general comment
/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(3)/video/107/282/158282701_mp4_h264_aac_hq.ts
#EXTINF:11.200,
/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(4)/video/107/282/158282701_mp4_h264_aac_hq.ts
#EXTINF:3.880,
/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(5)/video/107/282/158282701_mp4_h264_aac_hq.ts
#EXT-X-ENDLIST`;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core', 0);
    assert.strictEqual(result.totalduration, 51.24);
    assert.strictEqual(result.startSN, 0);
    assert.strictEqual(result.version, 3);
    assert.strictEqual(result.type, 'VOD');
    assert.strictEqual(result.targetduration, 14);
    assert.strictEqual(result.live, false);
    assert.strictEqual(result.fragments.length, 5);
    assert.strictEqual(result.fragments[0].cc, 0);
    assert.strictEqual(result.fragments[0].duration, 11.36);
    assert.strictEqual(result.fragments[1].duration, 11.32);
    assert.strictEqual(result.fragments[2].duration, 13.48);
    assert.strictEqual(result.fragments[4].sn, 4);
    assert.strictEqual(result.fragments[0].level, 0);
    assert.strictEqual(result.fragments[4].cc, 0);
    assert.strictEqual(result.fragments[4].sn, 4);
    assert.strictEqual(result.fragments[4].start, 47.36);
    assert.strictEqual(result.fragments[4].duration, 3.88);
    assert.strictEqual(result.fragments[4].url, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(5)/video/107/282/158282701_mp4_h264_aac_hq.ts');
  });

  it('parse level with single char fragment URI', () => {
    let level = `#EXTM3U
#EXT-X-ALLOW-CACHE:NO
#EXT-X-TARGETDURATION:2
#EXTINF:2,
0
#EXTINF:2,
1
#EXT-X-ENDLIST`;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(5)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core', 0);
    assert.strictEqual(result.totalduration, 4);
    assert.strictEqual(result.startSN, 0);
    assert.strictEqual(result.targetduration, 2);
    assert.strictEqual(result.live, false);
    assert.strictEqual(result.fragments.length, 2);
    assert.strictEqual(result.fragments[0].cc, 0);
    assert.strictEqual(result.fragments[0].duration, 2);
    assert.strictEqual(result.fragments[0].sn, 0);
    assert.strictEqual(result.fragments[0].relurl, '0');
    assert.strictEqual(result.fragments[1].cc, 0);
    assert.strictEqual(result.fragments[1].duration, 2);
    assert.strictEqual(result.fragments[1].sn, 1);
    assert.strictEqual(result.fragments[1].relurl, '1');
  });

  it('parse level with EXTINF line without comma', () => {
    let level = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-TARGETDURATION:6
#EXT-X-INDEPENDENT-SEGMENTS
#EXTINF:6.000000
chop/segment-1.ts
#EXTINF:6.000000
chop/segment-2.ts
#EXTINF:6.000000
chop/segment-3.ts
#EXTINF:6.000000
chop/segment-4.ts
#EXTINF:6.000000
chop/segment-5.ts
#EXTINF:6.000000
#EXT-X-ENDLIST`;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(5)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core', 0);
    assert.strictEqual(result.totalduration, 30);
    assert.strictEqual(result.startSN, 0);
    assert.strictEqual(result.version, 3);
    assert.strictEqual(result.targetduration, 6);
    assert.strictEqual(result.live, false);
    assert.strictEqual(result.fragments.length, 5);
    assert.strictEqual(result.fragments[0].cc, 0);
    assert.strictEqual(result.fragments[0].duration, 6);
    assert.strictEqual(result.fragments[4].sn, 4);
    assert.strictEqual(result.fragments[0].level, 0);
    assert.strictEqual(result.fragments[4].cc, 0);
    assert.strictEqual(result.fragments[4].sn, 4);
    assert.strictEqual(result.fragments[4].start, 24);
    assert.strictEqual(result.fragments[4].duration, 6);
    assert.strictEqual(result.fragments[4].url, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(5)/video/107/282/chop/segment-5.ts');
  });

  it('parse level with start time offset', () => {
    let level = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:14
#EXT-X-START:TIME-OFFSET=10.3
#EXTINF:11.360,
/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(1)/video/107/282/158282701_mp4_h264_aac_hq.ts
#EXTINF:11.320,
/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(2)/video/107/282/158282701_mp4_h264_aac_hq.ts
#EXTINF:13.480,
/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(3)/video/107/282/158282701_mp4_h264_aac_hq.ts
#EXTINF:11.200,
/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(4)/video/107/282/158282701_mp4_h264_aac_hq.ts
#EXTINF:3.880,
/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(5)/video/107/282/158282701_mp4_h264_aac_hq.ts
#EXT-X-ENDLIST`;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core', 0);
    assert.strictEqual(result.totalduration, 51.24);
    assert.strictEqual(result.startSN, 0);
    assert.strictEqual(result.targetduration, 14);
    assert.strictEqual(result.live, false);
    assert.strictEqual(result.startTimeOffset, 10.3);
  });

  it('parse AES encrypted URLs, with implicit IV', () => {
    let level = `#EXTM3U
#EXT-X-VERSION:1
## Created with Unified Streaming Platform(version=1.6.7)
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-ALLOW-CACHE:NO
#EXT-X-TARGETDURATION:11
#EXT-X-KEY:METHOD=AES-128,URI="oceans.key"
#EXTINF:11,no desc
oceans_aes-audio=65000-video=236000-1.ts
#EXTINF:7,no desc
oceans_aes-audio=65000-video=236000-2.ts
#EXTINF:7,no desc
oceans_aes-audio=65000-video=236000-3.ts
#EXT-X-ENDLIST`;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://foo.com/adaptive/oceans_aes/oceans_aes.m3u8', 0);
    assert.strictEqual(result.totalduration, 25);
    assert.strictEqual(result.startSN, 1);
    assert.strictEqual(result.targetduration, 11);
    assert.strictEqual(result.live, false);
    assert.strictEqual(result.fragments.length, 3);
    assert.strictEqual(result.fragments[0].cc, 0);
    assert.strictEqual(result.fragments[0].duration, 11);
    assert.strictEqual(result.fragments[0].title, 'no desc');
    assert.strictEqual(result.fragments[0].level, 0);
    assert.strictEqual(result.fragments[0].url, 'http://foo.com/adaptive/oceans_aes/oceans_aes-audio=65000-video=236000-1.ts');
    assert.strictEqual(result.fragments[0].decryptdata.uri, 'http://foo.com/adaptive/oceans_aes/oceans.key');
    assert.strictEqual(result.fragments[0].decryptdata.method, 'AES-128');
    let sn = 1;
    let uint8View = new Uint8Array(16);
    for (let i = 12; i < 16; i++) {
      uint8View[i] = (sn >> 8 * (15 - i)) & 0xff;
    }

    assert(bufferIsEqual(result.fragments[0].decryptdata.iv.buffer, uint8View.buffer));

    sn = 3;
    uint8View = new Uint8Array(16);
    for (let i = 12; i < 16; i++) {
      uint8View[i] = (sn >> 8 * (15 - i)) & 0xff;
    }

    assert(bufferIsEqual(result.fragments[2].decryptdata.iv.buffer, uint8View.buffer));
  });

  it('parse level with #EXT-X-BYTERANGE before #EXTINF', () => {
    let level = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-ALLOW-CACHE:YES
#EXT-X-TARGETDURATION:1
#EXT-X-MEDIA-SEQUENCE:7478
#EXT-X-BYTERANGE:140060@803136
#EXTINF:1000000,
lo007ts
#EXT-X-BYTERANGE:96256@943196
#EXTINF:1000000,
lo007ts
#EXT-X-BYTERANGE:143068@1039452
#EXTINF:1000000,
lo007ts
#EXT-X-BYTERANGE:124080@0
#EXTINF:1000000,
lo008ts
#EXT-X-BYTERANGE:117688@124080
#EXTINF:1000000,
lo008ts
#EXT-X-BYTERANGE:102272@241768
#EXTINF:1000000,
lo008ts
#EXT-X-BYTERANGE:100580@344040
#EXTINF:1000000,
lo008ts
#EXT-X-BYTERANGE:113740@444620
#EXTINF:1000000,
lo008ts
#EXT-X-BYTERANGE:126148@558360
#EXTINF:1000000,
lo008ts
#EXT-X-BYTERANGE:133480@684508
#EXTINF:1000000,
lo008ts`;

    let result = M3U8Parser.parseLevelPlaylist(level, 'http://dummy.com/playlist.m3u8', 0);
    assert.strictEqual(result.fragments.length, 10);
    assert.strictEqual(result.fragments[0].url, 'http://dummy.com/lo007ts');
    assert.strictEqual(result.fragments[0].byteRangeStartOffset, 803136);
    assert.strictEqual(result.fragments[0].byteRangeEndOffset, 943196);
    assert.strictEqual(result.fragments[1].byteRangeStartOffset, 943196);
    assert.strictEqual(result.fragments[1].byteRangeEndOffset, 1039452);
    assert.strictEqual(result.fragments[9].url, 'http://dummy.com/lo008ts');
    assert.strictEqual(result.fragments[9].byteRangeStartOffset, 684508);
    assert.strictEqual(result.fragments[9].byteRangeEndOffset, 817988);
  });

  it('parse level with #EXT-X-BYTERANGE after #EXTINF', () => {
    let level = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-ALLOW-CACHE:YES
#EXT-X-TARGETDURATION:1
#EXT-X-MEDIA-SEQUENCE:7478
#EXTINF:1000000,
#EXT-X-BYTERANGE:140060@803136
lo007ts
#EXTINF:1000000,
#EXT-X-BYTERANGE:96256@943196
lo007ts
#EXTINF:1000000,
#EXT-X-BYTERANGE:143068@1039452
lo007ts
#EXTINF:1000000,
#EXT-X-BYTERANGE:124080@0
lo008ts
#EXTINF:1000000,
#EXT-X-BYTERANGE:117688@124080
lo008ts
#EXTINF:1000000,
#EXT-X-BYTERANGE:102272@241768
lo008ts
#EXTINF:1000000,
#EXT-X-BYTERANGE:100580@344040
lo008ts
#EXTINF:1000000,
#EXT-X-BYTERANGE:113740@444620
lo008ts
#EXTINF:1000000,
#EXT-X-BYTERANGE:126148@558360
lo008ts
#EXTINF:1000000,
#EXT-X-BYTERANGE:133480@684508
lo008ts`;

    let result = M3U8Parser.parseLevelPlaylist(level, 'http://dummy.com/playlist.m3u8', 0);
    assert.strictEqual(result.fragments.length, 10);
    assert.strictEqual(result.fragments[0].url, 'http://dummy.com/lo007ts');
    assert.strictEqual(result.fragments[0].byteRangeStartOffset, 803136);
    assert.strictEqual(result.fragments[0].byteRangeEndOffset, 943196);
    assert.strictEqual(result.fragments[1].byteRangeStartOffset, 943196);
    assert.strictEqual(result.fragments[1].byteRangeEndOffset, 1039452);
    assert.strictEqual(result.fragments[9].url, 'http://dummy.com/lo008ts');
    assert.strictEqual(result.fragments[9].byteRangeStartOffset, 684508);
    assert.strictEqual(result.fragments[9].byteRangeEndOffset, 817988);
  });

  it('parse level with #EXT-X-BYTERANGE without offset', () => {
    let level = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-ALLOW-CACHE:YES
#EXT-X-TARGETDURATION:1
#EXT-X-MEDIA-SEQUENCE:7478
#EXTINF:1000000,
#EXT-X-BYTERANGE:140060@803136
lo007ts
#EXTINF:1000000,
#EXT-X-BYTERANGE:96256
lo007ts
#EXTINF:1000000,
#EXT-X-BYTERANGE:143068
lo007ts`;

    let result = M3U8Parser.parseLevelPlaylist(level, 'http://dummy.com/playlist.m3u8', 0);
    assert.strictEqual(result.fragments.length, 3);
    assert.strictEqual(result.fragments[0].url, 'http://dummy.com/lo007ts');
    assert.strictEqual(result.fragments[0].byteRangeStartOffset, 803136);
    assert.strictEqual(result.fragments[0].byteRangeEndOffset, 943196);
    assert.strictEqual(result.fragments[1].byteRangeStartOffset, 943196);
    assert.strictEqual(result.fragments[1].byteRangeEndOffset, 1039452);
    assert.strictEqual(result.fragments[2].byteRangeStartOffset, 1039452);
    assert.strictEqual(result.fragments[2].byteRangeEndOffset, 1182520);
  });

  it('parses discontinuity and maintains continuity counter', () => {
    let level = `#EXTM3U
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10,
0001.ts
#EXTINF:10,
0002.ts
#EXTINF:5,
0003.ts
#EXT-X-DISCONTINUITY
#EXTINF:10,
0005.ts
#EXTINF:10,
0006.ts
#EXT-X-ENDLIST
    `;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://video.example.com/disc.m3u8', 0);
    assert.strictEqual(result.fragments.length, 5);
    assert.strictEqual(result.totalduration, 45);
    assert.strictEqual(result.fragments[2].cc, 0);
    assert.strictEqual(result.fragments[3].cc, 1); // continuity counter should increase around discontinuity
  });

  it('parses correctly EXT-X-DISCONTINUITY-SEQUENCE and increases continuity counter', () => {
    let level = `#EXTM3U
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-DISCONTINUITY-SEQUENCE:20
#EXTINF:10,
0001.ts
#EXTINF:10,
0002.ts
#EXTINF:5,
0003.ts
#EXT-X-DISCONTINUITY
#EXTINF:10,
0005.ts
#EXTINF:10,
0006.ts
#EXT-X-ENDLIST
    `;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://video.example.com/disc.m3u8', 0);
    assert.strictEqual(result.fragments.length, 5);
    assert.strictEqual(result.totalduration, 45);
    assert.strictEqual(result.fragments[0].cc, 20);
    assert.strictEqual(result.fragments[2].cc, 20);
    assert.strictEqual(result.fragments[3].cc, 21); // continuity counter should increase around discontinuity
  });

  it('parses manifest with one audio track', () => {
    let manifest = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="600k",LANGUAGE="eng",NAME="Audio",AUTOSELECT=YES,DEFAULT=YES,URI="/videos/ZakEbrahim_2014/audio/600k.m3u8?qr=true&preroll=Blank",BANDWIDTH=614400`;
    let result = M3U8Parser.parseMasterPlaylistMedia(manifest, 'https://hls.ted.com/', 'AUDIO');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0]['autoselect'], true);
    assert.strictEqual(result[0]['default'], true);
    assert.strictEqual(result[0]['forced'], false);
    assert.strictEqual(result[0]['groupId'], '600k');
    assert.strictEqual(result[0]['lang'], 'eng');
    assert.strictEqual(result[0]['name'], 'Audio');
    assert.strictEqual(result[0]['url'], 'https://hls.ted.com/videos/ZakEbrahim_2014/audio/600k.m3u8?qr=true&preroll=Blank');
  });
  // issue #425 - first fragment has null url and no decryptdata if EXT-X-KEY follows EXTINF
  it('parse level with #EXT-X-KEY after #EXTINF', () => {
    let level = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-VERSION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:10,
#EXT-X-KEY:METHOD=AES-128,URI="https://dummy.com/crypt-0.key"
0001.ts
#EXTINF:10,
0002.ts
#EXTINF:10,
0003.ts
#EXTINF:10,
0004.ts
#EXTINF:10,
0005.ts
#EXTINF:10,
0006.ts
#EXTINF:10,
0007.ts
#EXTINF:10,
0008.ts`;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://dummy.com/playlist.m3u8', 0);
    assert.strictEqual(result.fragments.length, 8);
    assert.strictEqual(result.totalduration, 80);

    let fragdecryptdata, decryptdata = result.fragments[0].decryptdata, sn = 0;

    result.fragments.forEach(function (fragment, idx) {
      sn = idx + 1;

      assert.strictEqual(fragment.url, 'http://dummy.com/000' + sn + '.ts');

      // decryptdata should persist across all fragments
      fragdecryptdata = fragment.decryptdata;
      assert.strictEqual(fragdecryptdata.method, decryptdata.method);
      assert.strictEqual(fragdecryptdata.uri, decryptdata.uri);
      assert.strictEqual(fragdecryptdata.key, decryptdata.key);

      // initialization vector is correctly generated since it wasn't declared in the playlist
      let iv = fragdecryptdata.iv;
      assert.strictEqual(iv[15], idx);

      // hold this decrypt data to compare to the next fragment's decrypt data
      decryptdata = fragment.decryptdata;
    });
  });

  // PR #454 - Add support for custom tags in fragment object
  it('return custom tags in fragment object', () => {
    let level = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:719926
#EXTINF:9.40,
http://dummy.url.com/hls/live/segment/segment_022916_164500865_719926.ts
#EXTINF:9.56,
http://dummy.url.com/hls/live/segment/segment_022916_164500865_719927.ts
#EXT-X-CUE-OUT:DURATION=150,BREAKID=0x0
#EXTINF:9.23,
http://dummy.url.com/hls/live/segment/segment_022916_164500865_719928.ts
#EXTINF:0.50,
http://dummy.url.com/hls/live/segment/segment_022916_164500865_719929.ts
#EXT-X-CUE-IN
#EXTINF:8.50,
http://dummy.url.com/hls/live/segment/segment_022916_164500865_719930.ts
#EXTINF:9.43,
http://dummy.url.com/hls/live/segment/segment_022916_164500865_719931.ts
#EXTINF:9.78,
http://dummy.url.com/hls/live/segment/segment_022916_164500865_719932.ts
#EXTINF:9.31,
http://dummy.url.com/hls/live/segment/segment_022916_164500865_719933.ts
#EXTINF:9.98,
http://dummy.url.com/hls/live/segment/segment_022916_164500865_719934.ts
#EXTINF:9.25,
http://dummy.url.com/hls/live/segment/segment_022916_164500865_719935.ts`;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://dummy.url.com/playlist.m3u8', 0);
    assert.strictEqual(result.fragments.length, 10);
    assert.strictEqual(result.totalduration, 84.94);
    assert.strictEqual(result.targetduration, 10);
    assert.strictEqual(result.fragments[0].url, 'http://dummy.url.com/hls/live/segment/segment_022916_164500865_719926.ts');
    assert.strictEqual(result.fragments[0].tagList.length, 1);
    assert.strictEqual(result.fragments[2].tagList[0][0], 'EXT-X-CUE-OUT');
    assert.strictEqual(result.fragments[2].tagList[0][1], 'DURATION=150,BREAKID=0x0');
    assert.strictEqual(result.fragments[3].tagList[0][1], '0.50');
    assert.strictEqual(result.fragments[4].tagList.length, 2);
    assert.strictEqual(result.fragments[4].tagList[0][0], 'EXT-X-CUE-IN');
    assert.strictEqual(result.fragments[7].tagList[0][0], 'INF');
    assert.strictEqual(result.fragments[8].url, 'http://dummy.url.com/hls/live/segment/segment_022916_164500865_719934.ts');
  });

  it('parses playlists with #EXT-X-PROGRAM-DATE-TIME after #EXTINF before fragment URL', () => {
    let level = `#EXTM3U
#EXT-X-VERSION:2
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:69844067
#EXTINF:10, no desc
#EXT-X-PROGRAM-DATE-TIME:2016-05-27T16:34:44Z
Rollover38803/20160525T064049-01-69844067.ts
#EXTINF:10, no desc
#EXT-X-PROGRAM-DATE-TIME:2016-05-27T16:34:54Z
Rollover38803/20160525T064049-01-69844068.ts
#EXTINF:10, no desc
#EXT-X-PROGRAM-DATE-TIME:2016-05-27T16:35:04Z
Rollover38803/20160525T064049-01-69844069.ts
    `;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://video.example.com/disc.m3u8', 0);
    assert.strictEqual(result.fragments.length, 3);
    assert.strictEqual(result.hasProgramDateTime, true);
    assert.strictEqual(result.totalduration, 30);
    assert.strictEqual(result.fragments[0].url, 'http://video.example.com/Rollover38803/20160525T064049-01-69844067.ts');
    assert.strictEqual(result.fragments[0].programDateTime, 1464366884000);
    assert.strictEqual(result.fragments[1].url, 'http://video.example.com/Rollover38803/20160525T064049-01-69844068.ts');
    assert.strictEqual(result.fragments[1].programDateTime, 1464366894000);
    assert.strictEqual(result.fragments[2].url, 'http://video.example.com/Rollover38803/20160525T064049-01-69844069.ts');
    assert.strictEqual(result.fragments[2].programDateTime, 1464366904000);
  });

  it('parses #EXTINF without a leading digit', () => {
    let level = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:14
#EXTINF:.360,
/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(1)/video/107/282/158282701_mp4_h264_aac_hq.ts
#EXT-X-ENDLIST`;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core', 0);
    assert.strictEqual(result.fragments.length, 1);
    assert.strictEqual(result.fragments[0].duration, 0.360);
  });

  it('parses #EXT-X-MAP URI', () => {
    let level = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:7
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MAP:URI="main.mp4",BYTERANGE="718@0"
#EXTINF:6.00600,
#EXT-X-BYTERANGE:1543597@718
main.mp4`;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core', 0);
    assert.strictEqual(result.initSegment.url, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/main.mp4');
    assert.strictEqual(result.initSegment.byteRangeStartOffset, 0);
    assert.strictEqual(result.initSegment.byteRangeEndOffset, 718);
    assert.strictEqual(result.initSegment.sn, 'initSegment');
  });

  describe('PDT calculations', function () {
    it('if playlists contains #EXT-X-PROGRAM-DATE-TIME switching will be applied by PDT', () => {
      let level = `#EXTM3U
#EXT-X-VERSION:2
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:69844067
#EXTINF:10, no desc
#EXT-X-PROGRAM-DATE-TIME:2016-05-27T16:34:44Z
Rollover38803/20160525T064049-01-69844067.ts
#EXTINF:10, no desc
#EXT-X-PROGRAM-DATE-TIME:2016-05-27T16:34:54Z
Rollover38803/20160525T064049-01-69844068.ts
#EXTINF:10, no desc
#EXT-X-PROGRAM-DATE-TIME:2016-05-27T16:35:04Z
Rollover38803/20160525T064049-01-69844069.ts
    `;
      let result = M3U8Parser.parseLevelPlaylist(level, 'http://video.example.com/disc.m3u8', 0);
      assert.strictEqual(result.hasProgramDateTime, true);
      assert.strictEqual(result.fragments[0].rawProgramDateTime, '2016-05-27T16:34:44Z');
      assert.strictEqual(result.fragments[0].programDateTime, 1464366884000);
      assert.strictEqual(result.fragments[1].rawProgramDateTime, '2016-05-27T16:34:54Z');
      assert.strictEqual(result.fragments[1].programDateTime, 1464366894000);
      assert.strictEqual(result.fragments[2].rawProgramDateTime, '2016-05-27T16:35:04Z');
      assert.strictEqual(result.fragments[2].programDateTime, 1464366904000);
    });

    it('backfills PDT values if the first segment does not start with PDT', function () {
      const level = `
#EXTINF:10
frag0.ts
#EXTINF:10
frag1.ts
#EXTINF:10
#EXT-X-PROGRAM-DATE-TIME:2016-05-27T16:35:04Z
frag2.ts
    `;

      const result = M3U8Parser.parseLevelPlaylist(level, 'http://video.example.com/disc.m3u8', 0);
      assert.strictEqual(result.hasProgramDateTime, true);
      assert.strictEqual(result.fragments[2].rawProgramDateTime, '2016-05-27T16:35:04Z');
      assert.strictEqual(result.fragments[1].programDateTime, 1464366894000);
      assert.strictEqual(result.fragments[0].programDateTime, 1464366884000);
    });

    it('extrapolates PDT forward when subsequent fragments do not have a raw programDateTime', function () {
      const level = `
#EXTINF:10
#EXT-X-PROGRAM-DATE-TIME:2016-05-27T16:35:04Z
frag0.ts
#EXTINF:10
frag1.ts
#EXTINF:10
frag2.ts
    `;

      const result = M3U8Parser.parseLevelPlaylist(level, 'http://video.example.com/disc.m3u8', 0);
      assert.strictEqual(result.hasProgramDateTime, true);
      assert.strictEqual(result.fragments[0].rawProgramDateTime, '2016-05-27T16:35:04Z');
      assert.strictEqual(result.fragments[1].programDateTime, 1464366914000);
      assert.strictEqual(result.fragments[2].programDateTime, 1464366924000);
    });

    it('recomputes PDT extrapolation whenever a new raw programDateTime is hit', function () {
      const level = `
#EXTM3U
#EXT-X-DISCONTINUITY
#EXT-X-PROGRAM-DATE-TIME:2016-05-27T16:35:04Z
#EXTINF:10
frag0.ts
#EXTINF:10
frag1.ts
#EXT-X-DISCONTINUITY
#EXT-X-PROGRAM-DATE-TIME:2017-05-27T16:35:04Z
#EXTINF:10
frag2.ts
#EXTINF:10
frag3.ts
#EXT-X-DISCONTINUITY
#EXT-X-PROGRAM-DATE-TIME:2015-05-27T11:42:03Z
#EXTINF:10
frag4.ts
#EXTINF:10
frag5.ts
    `;

      const result = M3U8Parser.parseLevelPlaylist(level, 'http://video.example.com/disc.m3u8', 0);
      assert.strictEqual(result.hasProgramDateTime, true);
      assert.strictEqual(result.fragments[0].programDateTime, 1464366904000);
      assert.strictEqual(result.fragments[0].rawProgramDateTime, '2016-05-27T16:35:04Z');
      assert.strictEqual(result.fragments[1].programDateTime, 1464366914000);
      assert.strictEqual(result.fragments[2].programDateTime, 1495902904000);
      assert.strictEqual(result.fragments[2].rawProgramDateTime, '2017-05-27T16:35:04Z');
      assert.strictEqual(result.fragments[3].programDateTime, 1495902914000);
      assert.strictEqual(result.fragments[4].programDateTime, 1432726923000);
      assert.strictEqual(result.fragments[4].rawProgramDateTime, '2015-05-27T11:42:03Z');
      assert.strictEqual(result.fragments[5].programDateTime, 1432726933000);
    });

    it('propagates the raw programDateTime to the fragment following the init segment', function () {
      const level = `
#EXTINF:10
#EXT-X-PROGRAM-DATE-TIME:2016-05-27T16:35:04Z
#EXT-X-MAP
frag0.ts
#EXTINF:10
frag1.ts
    `;
      const result = M3U8Parser.parseLevelPlaylist(level, 'http://video.example.com/disc.m3u8', 0);
      assert.strictEqual(result.hasProgramDateTime, true);
      assert.strictEqual(result.sn === 'initSegment', false);
      assert.strictEqual(result.fragments[0].rawProgramDateTime, '2016-05-27T16:35:04Z');
      assert.strictEqual(result.fragments[0].programDateTime, 1464366904000);
    });

    it('ignores bad PDT values', function () {
      const level = `
#EXTINF:10
#EXT-X-PROGRAM-DATE-TIME:foo
frag0.ts
#EXTINF:10
frag1.ts
    `;
      const result = M3U8Parser.parseLevelPlaylist(level, 'http://video.example.com/disc.m3u8', 0);
      assert.strictEqual(result.hasProgramDateTime, false);
      assert.strictEqual(result.fragments[0].rawProgramDateTime, null);
      assert.strictEqual(result.fragments[0].programDateTime, null);
    });
  });

  it('tests : at end of tag name is used to divide custom tags', () => {
    let level = `#EXTM3U
#EXT-X-VERSION:2
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:69844067
#EXTINF:9.40,
http://dummy.url.com/hls/live/segment/segment_022916_164500865_719926.ts
#EXTINF:9.56,
http://dummy.url.com/hls/live/segment/segment_022916_164500865_719927.ts
#EXT-X-CUSTOM-DATE:2016-05-27T16:34:44Z
#EXT-X-CUSTOM-JSON:{"key":"value"}
#EXT-X-CUSTOM-URI:http://dummy.url.com/hls/moreinfo.json
#EXTINF:10, no desc
http://dummy.url.com/hls/live/segment/segment_022916_164500865_719928.ts
    `;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://dummy.url.com/playlist.m3u8', 0);
    assert.strictEqual(result.fragments[2].tagList[0][0], 'EXT-X-CUSTOM-DATE');
    assert.strictEqual(result.fragments[2].tagList[0][1], '2016-05-27T16:34:44Z');
    assert.strictEqual(result.fragments[2].tagList[1][0], 'EXT-X-CUSTOM-JSON');
    assert.strictEqual(result.fragments[2].tagList[1][1], '{"key":"value"}');
    assert.strictEqual(result.fragments[2].tagList[2][0], 'EXT-X-CUSTOM-URI');
    assert.strictEqual(result.fragments[2].tagList[2][1], 'http://dummy.url.com/hls/moreinfo.json');
  });

  it('allows spaces in the fragment files', () => {
    const level = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-TARGETDURATION:7
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:6.006,
180724_Allison VLOG-v3_00001.ts
#EXTINF:6.006,
180724_Allison VLOG-v3_00002.ts
#EXT-X-ENDLIST
    `;
    const result = M3U8Parser.parseLevelPlaylist(level, 'http://dummy.url.com/playlist.m3u8', 0);
    assert.strictEqual(result.fragments.length, 2);
    assert.strictEqual(result.totalduration, 12.012);
    assert.strictEqual(result.targetduration, 7);
    assert.strictEqual(result.fragments[0].url, 'http://dummy.url.com/180724_Allison VLOG-v3_00001.ts');
    assert.strictEqual(result.fragments[1].url, 'http://dummy.url.com/180724_Allison VLOG-v3_00002.ts');
  });

  it('deals with spaces after fragment files', () => {
    // You can't see them, but there should be spaces directly after the .ts
    const level = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-TARGETDURATION:7
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:6.006,
180724_Allison VLOG v3_00001.ts 
#EXTINF:6.006,
180724_Allison VLOG v3_00002.ts 
#EXT-X-ENDLIST
    `;
    const result = M3U8Parser.parseLevelPlaylist(level, 'http://dummy.url.com/playlist.m3u8', 0);
    assert.strictEqual(result.fragments.length, 2);
    assert.strictEqual(result.totalduration, 12.012);
    assert.strictEqual(result.targetduration, 7);
    assert.strictEqual(result.fragments[0].url, 'http://dummy.url.com/180724_Allison VLOG v3_00001.ts');
    assert.strictEqual(result.fragments[1].url, 'http://dummy.url.com/180724_Allison VLOG v3_00002.ts');
  });
});
