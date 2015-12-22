const assert = require('assert');

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
});
