const assert = require('assert');
const bufferIsEqual = require('arraybuffer-equal');

import PlaylistLoader from '../../../src/loader/playlist-loader';

describe('PlaylistLoader', () => {
  it('parses empty manifest returns empty array', () => {
    assert.deepEqual(new PlaylistLoader({on : function() { }}).parseMasterPlaylist("", 'http://www.dailymotion.com'), []);
  });

  it('manifest with broken syntax returns empty array', () => {
    var manifest = `#EXTXSTREAMINF:PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360,NAME="480"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;
    assert.deepEqual(new PlaylistLoader({on : function() { }}).parseMasterPlaylist(manifest, 'http://www.dailymotion.com'), []);
  });

  it('parses manifest with one level', () => {
    var manifest = `#EXTM3U
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360,NAME="480"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    var result = new PlaylistLoader({on : function() { }}).parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    assert.strictEqual(result.length,1);
    assert.strictEqual(result[0]['bitrate'],836280);
    assert.strictEqual(result[0]['audioCodec'],'mp4a.40.2');
    assert.strictEqual(result[0]['videoCodec'],'avc1.64001f');
    assert.strictEqual(result[0]['width'],848);
    assert.strictEqual(result[0]['height'],360);
    assert.strictEqual(result[0]['name'],'480');
    assert.strictEqual(result[0]['url'],'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core');
  });

  it('parses manifest without codecs', () => {
    var manifest = `#EXTM3U
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,RESOLUTION=848x360,NAME="480"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    var result = new PlaylistLoader({on : function() { }}).parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    assert.strictEqual(result.length,1);
    assert.strictEqual(result[0]['bitrate'],836280);
    assert.strictEqual(result[0]['audioCodec'],undefined);
    assert.strictEqual(result[0]['videoCodec'],undefined);
    assert.strictEqual(result[0]['width'],848);
    assert.strictEqual(result[0]['height'],360);
    assert.strictEqual(result[0]['name'],'480');
    assert.strictEqual(result[0]['url'],'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core');
  });


  it('does not care about the attribute order', () => {
    var manifest = `#EXTM3U
#EXT-X-STREAM-INF:NAME="480",PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    var result = new PlaylistLoader({on : function() { }}).parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    assert.strictEqual(result.length,1);
    assert.strictEqual(result[0]['bitrate'],836280);
    assert.strictEqual(result[0]['audioCodec'],'mp4a.40.2');
    assert.strictEqual(result[0]['videoCodec'],'avc1.64001f');
    assert.strictEqual(result[0]['width'],848);
    assert.strictEqual(result[0]['height'],360);
    assert.strictEqual(result[0]['name'],'480');
    assert.strictEqual(result[0]['url'],'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core');

    manifest = `#EXTM3U
#EXT-X-STREAM-INF:NAME="480",RESOLUTION=848x360,PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    result = new PlaylistLoader({on : function() { }}).parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    assert.strictEqual(result.length,1);
    assert.strictEqual(result[0]['bitrate'],836280);
    assert.strictEqual(result[0]['audioCodec'],'mp4a.40.2');
    assert.strictEqual(result[0]['videoCodec'],'avc1.64001f');
    assert.strictEqual(result[0]['width'],848);
    assert.strictEqual(result[0]['height'],360);
    assert.strictEqual(result[0]['name'],'480');
    assert.strictEqual(result[0]['url'],'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core');

    manifest = `#EXTM3U
#EXT-X-STREAM-INF:CODECS="mp4a.40.2,avc1.64001f",NAME="480",RESOLUTION=848x360,PROGRAM-ID=1,BANDWIDTH=836280
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    result = new PlaylistLoader({on : function() { }}).parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    assert.strictEqual(result.length,1);
    assert.strictEqual(result[0]['bitrate'],836280);
    assert.strictEqual(result[0]['audioCodec'],'mp4a.40.2');
    assert.strictEqual(result[0]['videoCodec'],'avc1.64001f');
    assert.strictEqual(result[0]['width'],848);
    assert.strictEqual(result[0]['height'],360);
    assert.strictEqual(result[0]['name'],'480');
    assert.strictEqual(result[0]['url'],'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core');
  });

  it('parses manifest with 10 levels', () => {
    var manifest = `#EXTM3U
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

    var result = new PlaylistLoader({on : function() { }}).parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    assert.strictEqual(result.length,10);
    assert.strictEqual(result[0]['bitrate'],836280);
    assert.strictEqual(result[1]['bitrate'],836280);
    assert.strictEqual(result[2]['bitrate'],246440);
    assert.strictEqual(result[3]['bitrate'],246440);
    assert.strictEqual(result[4]['bitrate'],460560);
    assert.strictEqual(result[5]['bitrate'],460560);
    assert.strictEqual(result[6]['bitrate'],2149280);
    assert.strictEqual(result[7]['bitrate'],2149280);
    assert.strictEqual(result[8]['bitrate'],6221600);
    assert.strictEqual(result[9]['bitrate'],6221600);
  });

  it('parses empty levels returns empty fragment array', () => {
    var level = "";
    var result = new PlaylistLoader({on : function() { }}).parseLevelPlaylist(level, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core',0);
    assert.strictEqual(result.fragments.length, 0);
    assert.strictEqual(result.totalduration,0);
  });

  it('level with 0 frag returns empty fragment array', () => {
    var level = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:14
#EXTINF:11.360,`;
    var result = new PlaylistLoader({on : function() { }}).parseLevelPlaylist(level, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core',0);
    assert.strictEqual(result.fragments.length, 0);
    assert.strictEqual(result.totalduration,0);
  });

  it('parse level with several fragments', () => {
    var level = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:14
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
    var result = new PlaylistLoader({on : function() { }}).parseLevelPlaylist(level, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core',0);
    assert.strictEqual(result.totalduration, 51.24);
    assert.strictEqual(result.startSN, 0);
    assert.strictEqual(result.targetduration, 14);
    assert.strictEqual(result.live, false);
    assert.strictEqual(result.fragments.length, 5);
    assert.strictEqual(result.fragments[0].cc, 0);
    assert.strictEqual(result.fragments[0].duration, 11.36);
    assert.strictEqual(result.fragments[4].sn, 4);
    assert.strictEqual(result.fragments[0].level, 0);
    assert.strictEqual(result.fragments[4].cc, 0);
    assert.strictEqual(result.fragments[4].sn, 4);
    assert.strictEqual(result.fragments[4].start, 47.36);
    assert.strictEqual(result.fragments[4].duration, 3.88);
    assert.strictEqual(result.fragments[4].url, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(5)/video/107/282/158282701_mp4_h264_aac_hq.ts');
  });


  it('parse AES encrypted URLs, with implicit IV', () => {
    var level = `#EXTM3U
#EXT-X-VERSION:1
## Created with Unified Streaming Platform(version=1.6.7)
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-ALLOW-CACHE:NO
#EXT-X-TARGETDURATION:11
#EXT-X-KEY:METHOD=AES-128,URI="oceans.key"
#EXTINF:11, no desc
oceans_aes-audio=65000-video=236000-1.ts
#EXTINF:7, no desc
oceans_aes-audio=65000-video=236000-2.ts
#EXTINF:7, no desc
oceans_aes-audio=65000-video=236000-3.ts
#EXT-X-ENDLIST`;
    var result = new PlaylistLoader({on : function() { }}).parseLevelPlaylist(level, 'http://foo.com/adaptive/oceans_aes/oceans_aes.m3u8',0);
    assert.strictEqual(result.totalduration, 25);
    assert.strictEqual(result.startSN, 1);
    assert.strictEqual(result.targetduration, 11);
    assert.strictEqual(result.live, false);
    assert.strictEqual(result.fragments.length, 3);
    assert.strictEqual(result.fragments[0].cc, 0);
    assert.strictEqual(result.fragments[0].duration, 11);
    assert.strictEqual(result.fragments[0].level, 0);
    assert.strictEqual(result.fragments[0].url, 'http://foo.com/adaptive/oceans_aes/oceans_aes-audio=65000-video=236000-1.ts');
    assert.strictEqual(result.fragments[0].decryptdata.uri, 'http://foo.com/adaptive/oceans_aes/oceans.key');
    assert.strictEqual(result.fragments[0].decryptdata.method, 'AES-128');
    var sn = 1;
    var uint8View = new Uint8Array(16);
    for (var i = 12; i < 16; i++) {
      uint8View[i] = (sn >> 8*(15-i)) & 0xff;
    }
    assert(bufferIsEqual(result.fragments[0].decryptdata.iv.buffer, uint8View.buffer));

    sn = 3;
    uint8View = new Uint8Array(16);
    for (var i = 12; i < 16; i++) {
      uint8View[i] = (sn >> 8*(15-i)) & 0xff;
    }
    assert(bufferIsEqual(result.fragments[2].decryptdata.iv.buffer, uint8View.buffer));
  });


  it('parse level with #EXT-X-BYTERANGE before #EXTINF', () => {
    var level = `#EXTM3U
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

    var result = new PlaylistLoader({on : function() { }}).parseLevelPlaylist(level, 'http://dummy.com/playlist.m3u8',0);
    assert.strictEqual(result.fragments.length, 10);
    assert.strictEqual(result.fragments[0].url, 'http://dummy.com/lo007ts');
    assert.strictEqual(result.fragments[0].byteRangeStartOffset,803136);
    assert.strictEqual(result.fragments[0].byteRangeEndOffset,943196);
    assert.strictEqual(result.fragments[1].byteRangeStartOffset,943196);
    assert.strictEqual(result.fragments[1].byteRangeEndOffset,1039452);
    assert.strictEqual(result.fragments[9].url, 'http://dummy.com/lo008ts');
    assert.strictEqual(result.fragments[9].byteRangeStartOffset,684508);
    assert.strictEqual(result.fragments[9].byteRangeEndOffset,817988);
  });

  it('parse level with #EXT-X-BYTERANGE after #EXTINF', () => {
    var level = `#EXTM3U
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

    var result = new PlaylistLoader({on : function() { }}).parseLevelPlaylist(level, 'http://dummy.com/playlist.m3u8',0);
    assert.strictEqual(result.fragments.length, 10);
    assert.strictEqual(result.fragments[0].url, 'http://dummy.com/lo007ts');
    assert.strictEqual(result.fragments[0].byteRangeStartOffset,803136);
    assert.strictEqual(result.fragments[0].byteRangeEndOffset,943196);
    assert.strictEqual(result.fragments[1].byteRangeStartOffset,943196);
    assert.strictEqual(result.fragments[1].byteRangeEndOffset,1039452);
    assert.strictEqual(result.fragments[9].url, 'http://dummy.com/lo008ts');
    assert.strictEqual(result.fragments[9].byteRangeStartOffset,684508);
    assert.strictEqual(result.fragments[9].byteRangeEndOffset,817988);
  });

  it('parses discontinuity and maintains continuity counter', () => {
    var level = `#EXTM3U
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
    var result = new PlaylistLoader({on : function() { }}).parseLevelPlaylist(level, 'http://video.example.com/disc.m3u8',0);
    assert.strictEqual(result.fragments.length, 5);
    assert.strictEqual(result.totalduration, 45);
    assert.strictEqual(result.fragments[2].cc, 0);
    assert.strictEqual(result.fragments[3].cc, 1); //continuity counter should increase around discontinuity
  });

});
