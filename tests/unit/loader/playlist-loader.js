import M3U8Parser from '../../../src/loader/m3u8-parser';
import { AttrList } from '../../../src/utils/attr-list';
import { PlaylistLevelType } from '../../../src/types/loader';

describe('PlaylistLoader', function () {
  it('parses empty manifest returns empty array', function () {
    const result = M3U8Parser.parseMasterPlaylist(
      '',
      'http://www.dailymotion.com'
    );
    expect(result.levels).to.deep.equal([]);
    expect(result.sessionData).to.equal(null);
  });

  it('manifest with broken syntax returns empty array', function () {
    const manifest = `#EXTXSTREAMINF:PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360,NAME="480"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;
    const result = M3U8Parser.parseMasterPlaylist(
      manifest,
      'http://www.dailymotion.com'
    );
    expect(result.levels).to.deep.equal([]);
    expect(result.sessionData).to.equal(null);
  });

  it('parses manifest with one level', function () {
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360,NAME="480"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    const result = M3U8Parser.parseMasterPlaylist(
      manifest,
      'http://www.dailymotion.com'
    );
    expect(result.levels).to.have.lengthOf(1);
    expect(result.levels[0].bitrate).to.equal(836280);
    expect(result.levels[0].audioCodec).to.equal('mp4a.40.2');
    expect(result.levels[0].videoCodec).to.equal('avc1.64001f');
    expect(result.levels[0].width).to.equal(848);
    expect(result.levels[0].height).to.equal(360);
    expect(result.levels[0].name).to.equal('480');
    expect(result.levels[0].url).to.equal(
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core'
    );
    expect(result.sessionData).to.equal(null);
  });

  it('parses manifest containing comment', function () {
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360,NAME="480"
# some comment
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    const result = M3U8Parser.parseMasterPlaylist(
      manifest,
      'http://www.dailymotion.com'
    );
    expect(result.levels).to.have.lengthOf(1);
    expect(result.levels[0].url).to.equal(
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core'
    );
  });

  it('parses manifest without codecs', function () {
    const manifest = `#EXTM3U
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,RESOLUTION=848x360,NAME="480"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    const result = M3U8Parser.parseMasterPlaylist(
      manifest,
      'http://www.dailymotion.com'
    );
    expect(result.levels.length, 1);
    expect(result.levels[0].bitrate).to.equal(836280);
    expect(result.levels[0].audioCodec).to.not.exist;
    expect(result.levels[0].videoCodec).to.not.exist;
    expect(result.levels[0].width).to.equal(848);
    expect(result.levels[0].height).to.equal(360);
    expect(result.levels[0].name).to.equal('480');
    expect(result.levels[0].url).to.equal(
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core'
    );
    expect(result.sessionData).to.equal(null);
  });

  it('does not care about the attribute order', function () {
    let manifest = `#EXTM3U
#EXT-X-STREAM-INF:NAME="480",PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    let result = M3U8Parser.parseMasterPlaylist(
      manifest,
      'http://www.dailymotion.com'
    );
    expect(result.levels.length, 1);
    expect(result.levels[0].bitrate, 836280);
    expect(result.levels[0].audioCodec, 'mp4a.40.2');
    expect(result.levels[0].videoCodec, 'avc1.64001f');
    expect(result.levels[0].width, 848);
    expect(result.levels[0].height, 360);
    expect(result.levels[0].name, '480');
    expect(
      result.levels[0].url,
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core'
    );
    expect(result.sessionData).to.equal(null);

    manifest = `#EXTM3U
#EXT-X-STREAM-INF:NAME="480",RESOLUTION=848x360,PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    result = M3U8Parser.parseMasterPlaylist(
      manifest,
      'http://www.dailymotion.com'
    );
    expect(result.levels.length, 1);
    expect(result.levels[0].bitrate).to.equal(836280);
    expect(result.levels[0].audioCodec).to.equal('mp4a.40.2');
    expect(result.levels[0].videoCodec).to.equal('avc1.64001f');
    expect(result.levels[0].width).to.equal(848);
    expect(result.levels[0].height).to.equal(360);
    expect(result.levels[0].name).to.equal('480');
    expect(result.levels[0].url).to.equal(
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core'
    );
    expect(result.sessionData).to.equal(null);

    manifest = `#EXTM3U
#EXT-X-STREAM-INF:CODECS="mp4a.40.2,avc1.64001f",NAME="480",RESOLUTION=848x360,PROGRAM-ID=1,BANDWIDTH=836280
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    result = M3U8Parser.parseMasterPlaylist(
      manifest,
      'http://www.dailymotion.com'
    );
    expect(result.levels).to.have.lengthOf(1);
    expect(result.levels[0].bitrate).to.equal(836280);
    expect(result.levels[0].audioCodec).to.equal('mp4a.40.2');
    expect(result.levels[0].videoCodec).to.equal('avc1.64001f');
    expect(result.levels[0].width).to.equal(848);
    expect(result.levels[0].height).to.equal(360);
    expect(result.levels[0].name).to.equal('480');
    expect(result.levels[0].url).to.equal(
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core'
    );
    expect(result.sessionData).to.equal(null);
  });

  it('parses manifest with 10 levels', function () {
    const manifest = `#EXTM3U
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

    const result = M3U8Parser.parseMasterPlaylist(
      manifest,
      'http://www.dailymotion.com'
    );
    expect(result.levels.length, 10);
    expect(result.levels[0].bitrate).to.equal(836280);
    expect(result.levels[1].bitrate).to.equal(836280);
    expect(result.levels[2].bitrate).to.equal(246440);
    expect(result.levels[3].bitrate).to.equal(246440);
    expect(result.levels[4].bitrate).to.equal(460560);
    expect(result.levels[5].bitrate).to.equal(460560);
    expect(result.levels[6].bitrate).to.equal(2149280);
    expect(result.levels[7].bitrate).to.equal(2149280);
    expect(result.levels[8].bitrate).to.equal(6221600);
    expect(result.levels[9].bitrate).to.equal(6221600);
    expect(result.sessionData).to.equal(null);
  });

  it('parses manifest with EXT-X-SESSION-DATA', function () {
    const manifest = `#EXTM3U
#EXT-X-SESSION-DATA:DATA-ID="com.dailymotion.sessiondata.test",VALUE="some data"
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360,NAME="480"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    const result = M3U8Parser.parseMasterPlaylist(
      manifest,
      'http://www.dailymotion.com'
    );
    const expected = {
      'com.dailymotion.sessiondata.test': new AttrList({
        'DATA-ID': 'com.dailymotion.sessiondata.test',
        VALUE: 'some data',
      }),
    };
    expect(result.sessionData).to.deep.equal(expected);
    expect(result.levels.length, 1);
  });

  it('parses manifest with EXT-X-SESSION-DATA and 10 levels', function () {
    const manifest = `#EXTM3U
#EXT-X-SESSION-DATA:DATA-ID="com.dailymotion.sessiondata.test",VALUE="some data"
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

    const result = M3U8Parser.parseMasterPlaylist(
      manifest,
      'http://www.dailymotion.com'
    );
    const expected = {
      'com.dailymotion.sessiondata.test': new AttrList({
        'DATA-ID': 'com.dailymotion.sessiondata.test',
        VALUE: 'some data',
      }),
    };
    expect(result.sessionData).to.deep.equal(expected);
    expect(result.levels.length, 10);
  });

  it('parses manifest with multiple EXT-X-SESSION-DATA', function () {
    const manifest = `#EXTM3U
#EXT-X-SESSION-DATA:DATA-ID="com.dailymotion.sessiondata.test",VALUE="some data"
#EXT-X-SESSION-DATA:DATA-ID="com.dailymotion.sessiondata.test2",VALUE="different data"
#EXT-X-SESSION-DATA:DATA-ID="com.dailymotion.sessiondata.test3",VALUE="more different data",URI="http://www.dailymotion.com/"
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360,NAME="480"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    const { sessionData } = M3U8Parser.parseMasterPlaylist(
      manifest,
      'http://www.dailymotion.com'
    );
    const expected = {
      'com.dailymotion.sessiondata.test': new AttrList({
        'DATA-ID': 'com.dailymotion.sessiondata.test',
        VALUE: 'some data',
      }),
      'com.dailymotion.sessiondata.test2': new AttrList({
        'DATA-ID': 'com.dailymotion.sessiondata.test2',
        VALUE: 'different data',
      }),
      'com.dailymotion.sessiondata.test3': new AttrList({
        'DATA-ID': 'com.dailymotion.sessiondata.test3',
        VALUE: 'more different data',
        URI: 'http://www.dailymotion.com/',
      }),
    };
    expect(sessionData).to.deep.equal(expected);
  });

  it('parses empty levels returns empty fragment array', function () {
    const level = '';
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core',
      0
    );
    expect(result.fragments).to.have.lengthOf(0);
    expect(result.totalduration).to.equal(0);
  });

  it('level with 0 frag returns empty fragment array', function () {
    const level = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:14`;
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core',
      0
    );
    expect(result.fragments).to.have.lengthOf(0);
    expect(result.totalduration).to.equal(0);
  });

  it('parse level with several fragments', function () {
    const level = `#EXTM3U
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
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core',
      0
    );
    expect(result.totalduration).to.equal(51.24);
    expect(result.startSN).to.equal(0);
    expect(result.version).to.equal(3);
    expect(result.type).to.equal('VOD');
    expect(result.targetduration).to.equal(14);
    expect(result.live).to.be.false;
    expect(result.fragments).to.have.lengthOf(5);
    expect(result.fragments[0].cc).to.equal(0);
    expect(result.fragments[0].duration).to.equal(11.36);
    expect(result.fragments[1].duration).to.equal(11.32);
    expect(result.fragments[2].duration).to.equal(13.48);
    expect(result.fragments[4].sn).to.equal(4);
    expect(result.fragments[0].level).to.equal(0);
    expect(result.fragments[4].cc).to.equal(0);
    expect(result.fragments[4].sn).to.equal(4);
    expect(result.fragments[4].start).to.equal(47.36);
    expect(result.fragments[4].duration).to.equal(3.88);
    expect(result.fragments[4].url).to.equal(
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(5)/video/107/282/158282701_mp4_h264_aac_hq.ts'
    );
  });

  it('handles a missing init segment for mp4 segment urls', function () {
    const level = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:14
#EXTINF:11.360,
/something.mp4?abc
#EXT-X-ENDLIST`;
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://example.invalid/playlist.m3u8',
      0,
      PlaylistLevelType.MAIN,
      0
    );
    const initSegment = result.fragments[0].initSegment;
    expect(initSegment).to.be.ok;
    expect(initSegment.relurl).to.equal('/something.mp4?abc');
  });

  it('parse level with single char fragment URI', function () {
    const level = `#EXTM3U
#EXT-X-ALLOW-CACHE:NO
#EXT-X-TARGETDURATION:2
#EXTINF:2,
0
#EXTINF:2,
1
#EXT-X-ENDLIST`;
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(5)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core',
      0
    );
    expect(result.totalduration).to.equal(4);
    expect(result.startSN).to.equal(0);
    expect(result.targetduration).to.equal(2);
    expect(result.live).to.be.false;
    expect(result.fragments).to.have.lengthOf(2);
    expect(result.fragments[0].cc).to.equal(0);
    expect(result.fragments[0].duration).to.equal(2);
    expect(result.fragments[0].sn).to.equal(0);
    expect(result.fragments[0].relurl).to.equal('0');
    expect(result.fragments[1].cc).to.equal(0);
    expect(result.fragments[1].duration).to.equal(2);
    expect(result.fragments[1].sn).to.equal(1);
    expect(result.fragments[1].relurl).to.equal('1');
  });

  it('parse level with EXTINF line without comma', function () {
    const level = `#EXTM3U
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
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(5)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core',
      0
    );
    expect(result.totalduration).to.equal(30);
    expect(result.startSN).to.equal(0);
    expect(result.version).to.equal(3);
    expect(result.targetduration).to.equal(6);
    expect(result.live).to.be.false;
    expect(result.fragments).to.have.lengthOf(5);
    expect(result.fragments[0].cc).to.equal(0);
    expect(result.fragments[0].duration).to.equal(6);
    expect(result.fragments[4].sn).to.equal(4);
    expect(result.fragments[0].level).to.equal(0);
    expect(result.fragments[4].cc).to.equal(0);
    expect(result.fragments[4].sn).to.equal(4);
    expect(result.fragments[4].start).to.equal(24);
    expect(result.fragments[4].duration).to.equal(6);
    expect(result.fragments[4].url).to.equal(
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(5)/video/107/282/chop/segment-5.ts'
    );
  });

  it('parse level with start time offset', function () {
    const level = `#EXTM3U
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
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core',
      0
    );
    expect(result.totalduration).to.equal(51.24);
    expect(result.startSN).to.equal(0);
    expect(result.targetduration).to.equal(14);
    expect(result.live).to.be.false;
    expect(result.startTimeOffset).to.equal(10.3);
  });

  it('parse AES encrypted URLS, with a com.apple.streamingkeydelivery KEYFORMAT', function () {
    const level = `#EXTM3U
#EXT-X-VERSION:1
## Created with Unified Streaming Platform(version=1.6.7)
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-ALLOW-CACHE:NO
#EXT-X-TARGETDURATION:11
#EXT-X-KEY:METHOD=AES-128,URI="skd://assetid?keyId=1234",KEYFORMAT="com.apple.streamingkeydelivery"
#EXTINF:11,no desc
oceans_aes-audio=65000-video=236000-1.ts
#EXTINF:7,no desc
oceans_aes-audio=65000-video=236000-2.ts
#EXTINF:7,no desc
oceans_aes-audio=65000-video=236000-3.ts
#EXT-X-ENDLIST`;
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://foo.com/adaptive/oceans_aes/oceans_aes.m3u8',
      0
    );
    expect(result.totalduration).to.equal(25);
    expect(result.startSN).to.equal(1);
    expect(result.targetduration).to.equal(11);
    expect(result.live).to.be.false;
    expect(result.fragments).to.have.lengthOf(3);
    expect(result.fragments[0].cc).to.equal(0);
    expect(result.fragments[0].duration).to.equal(11);
    expect(result.fragments[0].title).to.equal('no desc');
    expect(result.fragments[0].level).to.equal(0);
    expect(result.fragments[0].url).to.equal(
      'http://foo.com/adaptive/oceans_aes/oceans_aes-audio=65000-video=236000-1.ts'
    );
    expect(result.fragments[0].decryptdata).to.be.null;
  });

  it('parse AES encrypted URLs, with implicit IV', function () {
    const level = `#EXTM3U
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
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://foo.com/adaptive/oceans_aes/oceans_aes.m3u8',
      0
    );
    expect(result.totalduration).to.equal(25);
    expect(result.startSN).to.equal(1);
    expect(result.targetduration).to.equal(11);
    expect(result.live).to.be.false;
    expect(result.fragments).to.have.lengthOf(3);
    expect(result.fragments[0].cc).to.equal(0);
    expect(result.fragments[0].duration).to.equal(11);
    expect(result.fragments[0].title).to.equal('no desc');
    expect(result.fragments[0].level).to.equal(0);
    expect(result.fragments[0].url).to.equal(
      'http://foo.com/adaptive/oceans_aes/oceans_aes-audio=65000-video=236000-1.ts'
    );
    expect(result.fragments[0].decryptdata.uri).to.equal(
      'http://foo.com/adaptive/oceans_aes/oceans.key'
    );
    expect(result.fragments[0].decryptdata.method).to.equal('AES-128');
    let sn = 1;
    let uint8View = new Uint8Array(16);
    for (let i = 12; i < 16; i++) {
      uint8View[i] = (sn >> (8 * (15 - i))) & 0xff;
    }

    expect(result.fragments[0].decryptdata.iv.buffer).to.deep.equal(
      uint8View.buffer
    );

    sn = 3;
    uint8View = new Uint8Array(16);
    for (let i = 12; i < 16; i++) {
      uint8View[i] = (sn >> (8 * (15 - i))) & 0xff;
    }

    expect(result.fragments[2].decryptdata.iv.buffer).to.deep.equal(
      uint8View.buffer
    );
  });

  it('parse level with #EXT-X-BYTERANGE before #EXTINF', function () {
    const level = `#EXTM3U
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

    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://dummy.com/playlist.m3u8',
      0
    );
    expect(result.fragments.length, 10);
    expect(result.fragments[0].url).to.equal('http://dummy.com/lo007ts');
    expect(result.fragments[0].byteRangeStartOffset).to.equal(803136);
    expect(result.fragments[0].byteRangeEndOffset).to.equal(943196);
    expect(result.fragments[1].byteRangeStartOffset).to.equal(943196);
    expect(result.fragments[1].byteRangeEndOffset).to.equal(1039452);
    expect(result.fragments[9].url).to.equal('http://dummy.com/lo008ts');
    expect(result.fragments[9].byteRangeStartOffset).to.equal(684508);
    expect(result.fragments[9].byteRangeEndOffset).to.equal(817988);
  });

  it('parse level with #EXT-X-BYTERANGE after #EXTINF', function () {
    const level = `#EXTM3U
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

    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://dummy.com/playlist.m3u8',
      0
    );
    expect(result.fragments).to.have.lengthOf(10);
    expect(result.fragments[0].url).to.equal('http://dummy.com/lo007ts');
    expect(result.fragments[0].byteRangeStartOffset).to.equal(803136);
    expect(result.fragments[0].byteRangeEndOffset).to.equal(943196);
    expect(result.fragments[1].byteRangeStartOffset).to.equal(943196);
    expect(result.fragments[1].byteRangeEndOffset).to.equal(1039452);
    expect(result.fragments[9].url).to.equal('http://dummy.com/lo008ts');
    expect(result.fragments[9].byteRangeStartOffset).to.equal(684508);
    expect(result.fragments[9].byteRangeEndOffset).to.equal(817988);
  });

  it('parse level with #EXT-X-BYTERANGE without offset', function () {
    const level = `#EXTM3U
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

    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://dummy.com/playlist.m3u8',
      0
    );
    expect(result.fragments.length, 3);
    expect(result.fragments[0].url).to.equal('http://dummy.com/lo007ts');
    expect(result.fragments[0].byteRangeStartOffset).to.equal(803136);
    expect(result.fragments[0].byteRangeEndOffset).to.equal(943196);
    expect(result.fragments[1].byteRangeStartOffset).to.equal(943196);
    expect(result.fragments[1].byteRangeEndOffset).to.equal(1039452);
    expect(result.fragments[2].byteRangeStartOffset).to.equal(1039452);
    expect(result.fragments[2].byteRangeEndOffset).to.equal(1182520);
  });

  it('parses discontinuity and maintains continuity counter', function () {
    const level = `#EXTM3U
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
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://video.example.com/disc.m3u8',
      0
    );
    expect(result.fragments).to.have.lengthOf(5);
    expect(result.totalduration).to.equal(45);
    expect(result.fragments[2].cc).to.equal(0);
    expect(result.fragments[3].cc).to.equal(1); // continuity counter should increase around discontinuity
  });

  it('parses correctly EXT-X-DISCONTINUITY-SEQUENCE and increases continuity counter', function () {
    const level = `#EXTM3U
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
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://video.example.com/disc.m3u8',
      0
    );
    expect(result.fragments).to.have.lengthOf(5);
    expect(result.totalduration).to.equal(45);
    expect(result.fragments[0].cc).to.equal(20);
    expect(result.fragments[2].cc).to.equal(20);
    expect(result.fragments[3].cc).to.equal(21); // continuity counter should increase around discontinuity
  });

  it('parses manifest with one audio track', function () {
    const manifest = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="600k",LANGUAGE="eng",NAME="Audio",AUTOSELECT=YES,DEFAULT=YES,URI="/videos/ZakEbrahim_2014/audio/600k.m3u8?qr=true&preroll=Blank",BANDWIDTH=614400`;
    const result = M3U8Parser.parseMasterPlaylistMedia(
      manifest,
      'https://hls.ted.com/',
      'AUDIO'
    );
    expect(result.length, 1);
    expect(result[0].autoselect).to.be.true;
    expect(result[0].default).to.be.true;
    expect(result[0].forced).to.be.false;
    expect(result[0].groupId).to.equal('600k');
    expect(result[0].lang).to.equal('eng');
    expect(result[0].name).to.equal('Audio');
    expect(result[0].url).to.equal(
      'https://hls.ted.com/videos/ZakEbrahim_2014/audio/600k.m3u8?qr=true&preroll=Blank'
    );
  });
  // issue #425 - first fragment has null url and no decryptdata if EXT-X-KEY follows EXTINF
  it('parse level with #EXT-X-KEY after #EXTINF', function () {
    const level = `#EXTM3U
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
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://dummy.com/playlist.m3u8',
      0
    );
    expect(result.fragments).to.have.lengthOf(8);
    expect(result.totalduration).to.equal(80);

    let fragdecryptdata,
      decryptdata = result.fragments[0].decryptdata,
      sn = 0;

    result.fragments.forEach(function (fragment, idx) {
      sn = idx + 1;

      expect(fragment.url, 'http://dummy.com/000' + sn + '.ts');

      // decryptdata should persist across all fragments
      fragdecryptdata = fragment.decryptdata;
      expect(fragdecryptdata.method).to.equal(decryptdata.method);
      expect(fragdecryptdata.uri).to.equal(decryptdata.uri);
      expect(fragdecryptdata.key).to.equal(decryptdata.key);

      // initialization vector is correctly generated since it wasn't declared in the playlist
      const iv = fragdecryptdata.iv;
      expect(iv[15]).to.equal(idx);

      // hold this decrypt data to compare to the next fragment's decrypt data
      decryptdata = fragment.decryptdata;
    });
  });

  // PR #454 - Add support for custom tags in fragment object
  it('return custom tags in fragment object', function () {
    const level = `#EXTM3U
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
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://dummy.url.com/playlist.m3u8',
      0
    );
    expect(result.fragments).to.have.lengthOf(10);
    expect(result.totalduration).to.equal(84.94);
    expect(result.targetduration).to.equal(10);
    expect(result.fragments[0].url).to.equal(
      'http://dummy.url.com/hls/live/segment/segment_022916_164500865_719926.ts'
    );
    expect(result.fragments[0].tagList).to.have.lengthOf(1);
    expect(result.fragments[2].tagList[0][0]).to.equal('EXT-X-CUE-OUT');
    expect(result.fragments[2].tagList[0][1]).to.equal(
      'DURATION=150,BREAKID=0x0'
    );
    expect(result.fragments[3].tagList[0][1]).to.equal('0.50');
    expect(result.fragments[4].tagList).to.have.lengthOf(2);
    expect(result.fragments[4].tagList[0][0]).to.equal('EXT-X-CUE-IN');
    expect(result.fragments[7].tagList[0][0]).to.equal('INF');
    expect(result.fragments[8].url).to.equal(
      'http://dummy.url.com/hls/live/segment/segment_022916_164500865_719934.ts'
    );
  });

  it('parses playlists with #EXT-X-PROGRAM-DATE-TIME after #EXTINF before fragment URL', function () {
    const level = `#EXTM3U
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
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://video.example.com/disc.m3u8',
      0
    );
    expect(result.fragments).to.have.lengthOf(3);
    expect(result.hasProgramDateTime).to.be.true;
    expect(result.totalduration).to.equal(30);
    expect(result.fragments[0].url).to.equal(
      'http://video.example.com/Rollover38803/20160525T064049-01-69844067.ts'
    );
    expect(result.fragments[0].programDateTime).to.equal(1464366884000);
    expect(result.fragments[1].url).to.equal(
      'http://video.example.com/Rollover38803/20160525T064049-01-69844068.ts'
    );
    expect(result.fragments[1].programDateTime).to.equal(1464366894000);
    expect(result.fragments[2].url).to.equal(
      'http://video.example.com/Rollover38803/20160525T064049-01-69844069.ts'
    );
    expect(result.fragments[2].programDateTime).to.equal(1464366904000);
  });

  it('parses #EXTINF without a leading digit', function () {
    const level = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:14
#EXTINF:.360,
/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(1)/video/107/282/158282701_mp4_h264_aac_hq.ts
#EXT-X-ENDLIST`;
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core',
      0
    );
    expect(result.fragments).to.have.lengthOf(1);
    expect(result.fragments[0].duration).to.equal(0.36);
  });

  it('parses #EXT-X-MAP URI', function () {
    const level = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:7
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MAP:URI="main.mp4",BYTERANGE="718@0"
#EXTINF:6.00600,
#EXT-X-BYTERANGE:1543597@718
main.mp4`;
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core',
      0
    );
    const initSegment = result.fragments[0].initSegment;
    expect(initSegment.url).to.equal(
      'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/main.mp4'
    );
    expect(initSegment.byteRangeStartOffset).to.equal(0);
    expect(initSegment.byteRangeEndOffset).to.equal(718);
    expect(initSegment.sn).to.equal('initSegment');
  });

  it('parses multiple #EXT-X-MAP URI', function () {
    const level = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:7
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-MAP:URI="main.mp4"
#EXTINF:6.00600,
frag1.mp4
#EXT-X-DISCONTINUITY
#EXT-X-MAP:URI="alt.mp4"
#EXTINF:4.0
frag2.mp4
`;
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://video.example.com/disc.m3u8',
      0
    );
    expect(result.fragments[0].initSegment.url).to.equal(
      'http://video.example.com/main.mp4'
    );
    expect(result.fragments[0].initSegment.sn).to.equal('initSegment');
    expect(result.fragments[1].initSegment.url).to.equal(
      'http://video.example.com/alt.mp4'
    );
    expect(result.fragments[1].initSegment.sn).to.equal('initSegment');
  });

  describe('PDT calculations', function () {
    it('if playlists contains #EXT-X-PROGRAM-DATE-TIME switching will be applied by PDT', function () {
      const level = `#EXTM3U
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
      const result = M3U8Parser.parseLevelPlaylist(
        level,
        'http://video.example.com/disc.m3u8',
        0
      );
      expect(result.hasProgramDateTime).to.be.true;
      expect(result.fragments[0].rawProgramDateTime).to.equal(
        '2016-05-27T16:34:44Z'
      );
      expect(result.fragments[0].programDateTime).to.equal(1464366884000);
      expect(result.fragments[1].rawProgramDateTime).to.equal(
        '2016-05-27T16:34:54Z'
      );
      expect(result.fragments[1].programDateTime).to.equal(1464366894000);
      expect(result.fragments[2].rawProgramDateTime).to.equal(
        '2016-05-27T16:35:04Z'
      );
      expect(result.fragments[2].programDateTime).to.equal(1464366904000);
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

      const result = M3U8Parser.parseLevelPlaylist(
        level,
        'http://video.example.com/disc.m3u8',
        0
      );
      expect(result.hasProgramDateTime).to.be.true;
      expect(result.fragments[2].rawProgramDateTime).to.equal(
        '2016-05-27T16:35:04Z'
      );
      expect(result.fragments[1].programDateTime).to.equal(1464366894000);
      expect(result.fragments[0].programDateTime).to.equal(1464366884000);
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

      const result = M3U8Parser.parseLevelPlaylist(
        level,
        'http://video.example.com/disc.m3u8',
        0
      );
      expect(result.hasProgramDateTime).to.be.true;
      expect(result.fragments[0].rawProgramDateTime).to.equal(
        '2016-05-27T16:35:04Z'
      );
      expect(result.fragments[1].programDateTime).to.equal(1464366914000);
      expect(result.fragments[2].programDateTime).to.equal(1464366924000);
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

      const result = M3U8Parser.parseLevelPlaylist(
        level,
        'http://video.example.com/disc.m3u8',
        0
      );
      expect(result.hasProgramDateTime).to.be.true;
      expect(result.fragments[0].programDateTime).to.equal(1464366904000);
      expect(result.fragments[0].rawProgramDateTime).to.equal(
        '2016-05-27T16:35:04Z'
      );
      expect(result.fragments[1].programDateTime).to.equal(1464366914000);
      expect(result.fragments[2].programDateTime).to.equal(1495902904000);
      expect(result.fragments[2].rawProgramDateTime).to.equal(
        '2017-05-27T16:35:04Z'
      );
      expect(result.fragments[3].programDateTime).to.equal(1495902914000);
      expect(result.fragments[4].programDateTime).to.equal(1432726923000);
      expect(result.fragments[4].rawProgramDateTime).to.equal(
        '2015-05-27T11:42:03Z'
      );
      expect(result.fragments[5].programDateTime).to.equal(1432726933000);
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
      const result = M3U8Parser.parseLevelPlaylist(
        level,
        'http://video.example.com/disc.m3u8',
        0
      );
      expect(result.hasProgramDateTime).to.be.true;
      expect(result.sn).to.not.equal('initSegment');
      expect(result.fragments[0].rawProgramDateTime).to.equal(
        '2016-05-27T16:35:04Z'
      );
      expect(result.fragments[0].programDateTime).to.equal(1464366904000);
    });

    it('ignores bad PDT values', function () {
      const level = `
#EXTINF:10
#EXT-X-PROGRAM-DATE-TIME:foo
frag0.ts
#EXTINF:10
frag1.ts
    `;
      const result = M3U8Parser.parseLevelPlaylist(
        level,
        'http://video.example.com/disc.m3u8',
        0
      );
      expect(result.hasProgramDateTime).to.be.false;
      expect(result.fragments[0].rawProgramDateTime).to.not.exist;
      expect(result.fragments[0].programDateTime).to.not.exist;
    });
  });

  describe('Low-Latency HLS Manifest Parsing', function () {
    const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXT-X-VERSION:3
#EXT-X-PART-INF:PART-TARGET=1.004000
#EXT-X-MEDIA-SEQUENCE:1151226
#EXTINF:4.00000,
fileSequence1151226.ts
#EXT-X-PROGRAM-DATE-TIME:2020-08-11T23:02:18.003Z
#EXTINF:4.00000,
fileSequence1151227.ts
#EXTINF:4.00000,
fileSequence1151228.ts
#EXTINF:4.00000,
fileSequence1151229.ts
#EXTINF:4.00000,
fileSequence1151230.ts
#EXTINF:4.00000,
fileSequence1151231.ts
#EXT-X-PROGRAM-DATE-TIME:2020-08-11T23:02:38.003Z
#EXT-X-PART:DURATION=1.00000,INDEPENDENT=YES,URI="lowLatencyHLS.php?segment=filePart1151232.1.ts"
#EXT-X-PART:DURATION=1.00001,INDEPENDENT=NO,URI="lowLatencyHLS.php?segment=filePart1151232.2.ts"
#EXT-X-PART:DURATION=1.00000,INDEPENDENT=YES,URI="lowLatencyHLS.php?segment=filePart1151232.3.ts"
#EXT-X-PART:DURATION=1.00000,INDEPENDENT=YES,URI="lowLatencyHLS.php?segment=filePart1151232.4.ts"
#EXTINF:4.00000,
fileSequence1151232.ts
#EXT-X-PART:DURATION=1.00000,INDEPENDENT=YES,URI="lowLatencyHLS.php?segment=filePart1151233.1.ts"
#EXT-X-PART:DURATION=0.99999,INDEPENDENT=YES,URI="lowLatencyHLS.php?segment=filePart1151233.2.ts"
#EXT-X-PART:DURATION=1.00000,URI="lowLatencyHLS.php?segment=filePart1151233.3.ts"
#EXT-X-PART:DURATION=1.00000,GAP=YES,INDEPENDENT=YES,URI="lowLatencyHLS.php?segment=filePart1151233.4.ts"
#EXTINF:4.00000,
fileSequence1151233.ts
#EXT-X-PRELOAD-HINT:TYPE=PART,URI="lowLatencyHLS.php?segment=filePart1151234.1.ts"
#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,CAN-SKIP-UNTIL=24,PART-HOLD-BACK=3.012
#EXT-X-RENDITION-REPORT:URI="/media0/lowLatencyHLS.php",LAST-MSN=1151201,LAST-PART=3,LAST-I-MSN=1151201,LAST-I-PART=3
#EXT-X-RENDITION-REPORT:URI="/media2/lowLatencyHLS.php",LAST-MSN=1151201,LAST-PART=3,LAST-I-MSN=1151201,LAST-I-PART=3`;

    it('Parses the SERVER-CONTROL tag', function () {
      const details = M3U8Parser.parseLevelPlaylist(
        playlist,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0
      );
      expect(details.canBlockReload).to.be.true;
      expect(details.canSkipUntil).to.equal(24);
      expect(details.partHoldBack).to.equal(3.012);
      // defaults:
      expect(details.holdBack).to.equal(0);
      expect(details.canSkipDateRanges).to.be.false;
    });

    it('Parses the SERVER-CONTROL CAN-SKIP-DATERANGES and HOLD-BACK attributes', function () {
      const details = M3U8Parser.parseLevelPlaylist(
        `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXT-X-VERSION:3
#EXT-X-SERVER-CONTROL:CAN-SKIP-UNTIL=20,CAN-SKIP-DATERANGES=YES,HOLD-BACK=15.1
#EXTINF:4.00000,
fileSequence1151226.ts`,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0
      );
      expect(details.canSkipUntil).to.equal(20);
      expect(details.holdBack).to.equal(15.1);
      expect(details.canSkipDateRanges).to.be.true;
      // defaults:
      expect(details.canBlockReload).to.be.false;
      expect(details.partHoldBack).to.equal(0);
      expect(details.partTarget).to.equal(0);
    });

    it('Parses the PART-INF tag', function () {
      const details = M3U8Parser.parseLevelPlaylist(
        playlist,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0
      );
      expect(details.partTarget).to.equal(1.004);
    });

    it('Parses the PART tags', function () {
      const details = M3U8Parser.parseLevelPlaylist(
        playlist,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0
      );
      // TODO: Partial Segments for a yet to be appended EXT-INF entry will be added to the fragments list
      //  once PartLoader is implemented to abstract away part loading complexity using progressive loader events
      expect(details.fragments).to.have.lengthOf(8);
      expect(details.partList).to.be.an('array').which.has.lengthOf(8);
      expect(details.partList[0].fragment).to.equal(details.fragments[6]);
      expect(details.partList[1].fragment).to.equal(details.fragments[6]);
      expect(details.partList[2].fragment).to.equal(details.fragments[6]);
      expect(details.partList[3].fragment).to.equal(details.fragments[6]);
      expect(details.partList[4].fragment).to.equal(details.fragments[7]);
      expect(details.partList[5].fragment).to.equal(details.fragments[7]);
      expect(details.partList[6].fragment).to.equal(details.fragments[7]);
      expect(details.partList[7].fragment).to.equal(details.fragments[7]);
      expectWithJSONMessage(details.partList[0], '6-0').to.deep.include({
        duration: 1,
        gap: false,
        independent: true,
        index: 0,
        relurl: 'lowLatencyHLS.php?segment=filePart1151232.1.ts',
      });
      expectWithJSONMessage(details.partList[1], '6-1').to.deep.include({
        duration: 1.00001,
        gap: false,
        independent: false,
        index: 1,
        relurl: 'lowLatencyHLS.php?segment=filePart1151232.2.ts',
      });
      expectWithJSONMessage(details.partList[2], '6-2').to.deep.include({
        duration: 1,
        gap: false,
        independent: true,
        index: 2,
        relurl: 'lowLatencyHLS.php?segment=filePart1151232.3.ts',
      });
      expectWithJSONMessage(details.partList[3], '6-3').to.deep.include({
        duration: 1,
        gap: false,
        independent: true,
        index: 3,
        relurl: 'lowLatencyHLS.php?segment=filePart1151232.4.ts',
      });
      expectWithJSONMessage(details.partList[4], '7-0').to.deep.include({
        duration: 1,
        gap: false,
        independent: true,
        index: 0,
        relurl: 'lowLatencyHLS.php?segment=filePart1151233.1.ts',
      });
      expectWithJSONMessage(details.partList[5], '7-1').to.deep.include({
        duration: 0.99999,
        gap: false,
        independent: true,
        index: 1,
        relurl: 'lowLatencyHLS.php?segment=filePart1151233.2.ts',
      });
      expectWithJSONMessage(details.partList[6], '7-2').to.deep.include({
        duration: 1,
        gap: false,
        independent: false,
        index: 2,
        relurl: 'lowLatencyHLS.php?segment=filePart1151233.3.ts',
      });
      expectWithJSONMessage(details.partList[7], '7-3').to.deep.include({
        duration: 1,
        gap: true,
        independent: true,
        index: 3,
        relurl: 'lowLatencyHLS.php?segment=filePart1151233.4.ts',
      });
    });

    it('Parses the PRELOAD-HINT tag', function () {
      const details = M3U8Parser.parseLevelPlaylist(
        playlist,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0
      );
      expect(details.preloadHint).to.be.an('object');
      expect(details.preloadHint.TYPE).to.equal('PART');
      expect(details.preloadHint.URI).to.equal(
        'lowLatencyHLS.php?segment=filePart1151234.1.ts'
      );
    });

    it('Parses the RENDITION-REPORT tag', function () {
      const details = M3U8Parser.parseLevelPlaylist(
        playlist,
        'http://dummy.url.com/playlist.m3u8',
        0,
        PlaylistLevelType.MAIN,
        0
      );
      expect(details.renditionReports).to.be.an('array').which.has.lengthOf(2);
      expect(details.renditionReports[0].URI).to.equal(
        '/media0/lowLatencyHLS.php'
      );
      expect(details.renditionReports[0]['LAST-MSN']).to.equal('1151201');
      expect(details.renditionReports[0]['LAST-PART']).to.equal('3');
      expect(details.renditionReports[0]['LAST-I-MSN']).to.equal('1151201');
      expect(details.renditionReports[0]['LAST-I-PART']).to.equal('3');
    });
  });

  it('adds BITRATE to fragment.tagList', function () {
    const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:5.97263,\t
#EXT-X-BITRATE:5083
fileSequence0.ts
#EXTINF:5.97263,\t
#EXT-X-BITRATE:5453
fileSequence1.ts
#EXTINF:5.97263,\t
#EXT-X-BITRATE:4802
fileSequence2.ts
`;
    const details = M3U8Parser.parseLevelPlaylist(
      playlist,
      'http://dummy.url.com/playlist.m3u8',
      0,
      PlaylistLevelType.MAIN,
      0
    );
    expectWithJSONMessage(details.fragments[0].tagList).to.deep.equal([
      ['INF', '5.97263', '\t'],
      ['BITRATE', '5083'],
    ]);
    expectWithJSONMessage(details.fragments[1].tagList).to.deep.equal([
      ['INF', '5.97263', '\t'],
      ['BITRATE', '5453'],
    ]);
    expectWithJSONMessage(details.fragments[2].tagList).to.deep.equal([
      ['INF', '5.97263', '\t'],
      ['BITRATE', '4802'],
    ]);
  });

  it('adds GAP to fragment.tagList', function () {
    const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:5
#EXT-X-VERSION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:5,title
fileSequence0.ts
#EXTINF:5,
#EXT-X-GAP
fileSequence1.ts
#EXTINF:5,
fileSequence2.ts
`;
    const details = M3U8Parser.parseLevelPlaylist(
      playlist,
      'http://dummy.url.com/playlist.m3u8',
      0,
      PlaylistLevelType.MAIN,
      0
    );
    expectWithJSONMessage(details.fragments[0].tagList).to.deep.equal([
      ['INF', '5', 'title'],
    ]);
    expectWithJSONMessage(details.fragments[1].tagList).to.deep.equal([
      ['INF', '5'],
      ['GAP'],
    ]);
    expectWithJSONMessage(details.fragments[2].tagList).to.deep.equal([
      ['INF', '5'],
    ]);
  });

  it('adds unhandled tags (DATERANGE) and comments to fragment.tagList', function () {
    const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-VERSION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-PROGRAM-DATE-TIME:2018-09-28T16:50:26Z
#EXTINF:10,
main1.aac
#EXT-X-PROGRAM-DATE-TIME:2018-09-28T16:50:36Z
#EXT-X-DATERANGE:ID="splice-6FFFFFF0",START-DATE="2018-09-28T16:50:48Z",PLANNED-DURATION=20.0,X-CUSTOM="Hi!",SCTE35-OUT=0xFC002F0000000000FF
#EXTINF:10,
main2.aac
#EXTINF:10,
main3.aac
#EXT-X-PROGRAM-DATE-TIME:2018-09-28T16:50:56Z
#EXT-X-DATERANGE:ID="splice-6FFFFFF0",START-DATE="2018-09-28T16:51:18Z",DURATION=30.0,SCTE35-IN=0xFC002F0000000000FF
#EXTINF:9.9846,
main4.aac
`;
    const details = M3U8Parser.parseLevelPlaylist(
      playlist,
      'http://dummy.url.com/playlist.m3u8',
      0,
      PlaylistLevelType.MAIN,
      0
    );
    expectWithJSONMessage(details.fragments[0].tagList).to.deep.equal([
      ['PROGRAM-DATE-TIME', '2018-09-28T16:50:26Z'],
      ['INF', '10'],
    ]);
    expectWithJSONMessage(details.fragments[1].tagList).to.deep.equal([
      ['PROGRAM-DATE-TIME', '2018-09-28T16:50:36Z'],
      [
        'EXT-X-DATERANGE',
        'ID="splice-6FFFFFF0",START-DATE="2018-09-28T16:50:48Z",PLANNED-DURATION=20.0,X-CUSTOM="Hi!",SCTE35-OUT=0xFC002F0000000000FF',
      ],
      ['INF', '10'],
    ]);
    expectWithJSONMessage(details.fragments[2].tagList).to.deep.equal([
      ['INF', '10'],
    ]);
    expectWithJSONMessage(details.fragments[3].tagList).to.deep.equal([
      ['PROGRAM-DATE-TIME', '2018-09-28T16:50:56Z'],
      [
        'EXT-X-DATERANGE',
        'ID="splice-6FFFFFF0",START-DATE="2018-09-28T16:51:18Z",DURATION=30.0,SCTE35-IN=0xFC002F0000000000FF',
      ],
      ['INF', '9.9846'],
    ]);
  });

  it('tests : at end of tag name is used to divide custom tags', function () {
    const level = `#EXTM3U
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
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://dummy.url.com/playlist.m3u8',
      0
    );
    expect(result.fragments[2].tagList[0][0]).to.equal('EXT-X-CUSTOM-DATE');
    expect(result.fragments[2].tagList[0][1]).to.equal('2016-05-27T16:34:44Z');
    expect(result.fragments[2].tagList[1][0]).to.equal('EXT-X-CUSTOM-JSON');
    expect(result.fragments[2].tagList[1][1]).to.equal('{"key":"value"}');
    expect(result.fragments[2].tagList[2][0]).to.equal('EXT-X-CUSTOM-URI');
    expect(result.fragments[2].tagList[2][1]).to.equal(
      'http://dummy.url.com/hls/moreinfo.json'
    );
  });

  it('allows spaces in the fragment files', function () {
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
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://dummy.url.com/playlist.m3u8',
      0
    );
    expect(result.fragments.length).to.equal(2);
    expect(result.totalduration).to.equal(12.012);
    expect(result.targetduration).to.equal(7);
    expect(result.fragments[0].url).to.equal(
      'http://dummy.url.com/180724_Allison VLOG-v3_00001.ts'
    );
    expect(result.fragments[1].url).to.equal(
      'http://dummy.url.com/180724_Allison VLOG-v3_00002.ts'
    );
  });

  it('deals with spaces after fragment files', function () {
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
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://dummy.url.com/playlist.m3u8',
      0
    );
    expect(result.fragments.length).to.equal(2);
    expect(result.totalduration).to.equal(12.012);
    expect(result.targetduration).to.equal(7);
    expect(result.fragments[0].url).to.equal(
      'http://dummy.url.com/180724_Allison VLOG v3_00001.ts'
    );
    expect(result.fragments[1].url).to.equal(
      'http://dummy.url.com/180724_Allison VLOG v3_00002.ts'
    );
  });

  it('parse fmp4 level with discontinuities and program date time', function () {
    const level = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:1638262
#EXT-X-DISCONTINUITY-SEQUENCE:28141

#EXT-X-KEY:METHOD=NONE
#EXTINF:5.005,
#EXT-X-MAP:URI="init.mp4"
#EXT-X-PROGRAM-DATE-TIME:2021-11-10T03:25:49.015Z
3.mp4
#EXTINF:5.005,
4.mp4
#EXTINF:1.961,
5.mp4
#EXT-X-DISCONTINUITY
#EXTINF:5.005,
0.mp4
#EXTINF:5.005,
1.mp4
#EXTINF:5.005,
2.mp4
#EXTINF:5.005,
3.mp4
#EXTINF:5.005,
4.mp4
#EXTINF:1.961,
5.mp4
#EXT-X-DISCONTINUITY
#EXTINF:5.005,
0.mp4
#EXTINF:5.005,
1.mp4
#EXTINF:5.005,
2.mp4
#EXTINF:5.005,
3.mp4
#EXTINF:5.005,
4.mp4
#EXTINF:1.961,
5.mp4
#EXT-X-DISCONTINUITY
#EXTINF:5.005,
0.mp4
#EXTINF:4.037,
1.mp4
#EXT-X-PROGRAM-DATE-TIME:2021-11-10T03:27:04Z
#EXT-X-CUE-IN
#EXT-X-MAP:URI="init_960719739.mp4"
#EXT-X-DISCONTINUITY
#EXTINF:6.0,
media_1638274.m4s
#EXTINF:6.0,
media_1638275.m4s
#EXTINF:6.0,
media_1638276.m4s
#EXTINF:6.0,
media_1638277.m4s
#EXTINF:6.0,
media_1638278.m4s`;
    const result = M3U8Parser.parseLevelPlaylist(
      level,
      'http://foo.com/adaptive/test.m3u8',
      0
    );
    expect(result.fragments.length).to.equal(22);
    let pdt = 1636514824000;
    for (let i = 17; i < result.fragments.length; i++) {
      const frag = result.fragments[i];
      expect(frag.programDateTime).to.equal(pdt);
      pdt += frag.duration * 1000;
    }
  });
});

function expectWithJSONMessage(value, msg) {
  return expect(value, `${msg || 'actual:'} ${JSON.stringify(value, null, 2)}`);
}
