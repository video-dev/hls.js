import PlaylistLoader from '../../../src/loader/playlist-loader';
import M3U8Parser from '../../../src/loader/m3u8-parser';

describe('PlaylistLoader', function () {
  it('parses empty manifest returns empty array', function () {
    expect(M3U8Parser.parseMasterPlaylist('', 'http://www.dailymotion.com')).to.deep.equal([]);
  });

  it('manifest with broken syntax returns empty array', function () {
    let manifest = `#EXTXSTREAMINF:PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360,NAME="480"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;
    expect(M3U8Parser.parseMasterPlaylist(manifest, 'http://www.dailymotion.com')).to.deep.equal([]);
  });

  it('parses manifest with one level', function () {
    let manifest = `#EXTM3U
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360,NAME="480"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    let result = M3U8Parser.parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    expect(result).to.have.lengthOf(1);
    expect(result[0]['bitrate']).to.equal(836280);
    expect(result[0]['audioCodec']).to.equal('mp4a.40.2');
    expect(result[0]['videoCodec']).to.equal('avc1.64001f');
    expect(result[0]['width']).to.equal(848);
    expect(result[0]['height']).to.equal(360);
    expect(result[0]['name']).to.equal('480');
    expect(result[0]['url']).to.equal('http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core');
  });

  it('parses manifest without codecs', function () {
    let manifest = `#EXTM3U
#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,RESOLUTION=848x360,NAME="480"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    let result = M3U8Parser.parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    expect(result.length, 1);
    expect(result[0]['bitrate']).to.equal(836280);
    expect(result[0]['audioCodec']).to.not.exist;
    expect(result[0]['videoCodec']).to.not.exist;
    expect(result[0]['width']).to.equal(848);
    expect(result[0]['height']).to.equal(360);
    expect(result[0]['name']).to.equal('480');
    expect(result[0]['url']).to.equal('http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core');
  });

  it('does not care about the attribute order', function () {
    let manifest = `#EXTM3U
#EXT-X-STREAM-INF:NAME="480",PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f",RESOLUTION=848x360
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    let result = M3U8Parser.parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    expect(result.length, 1);
    expect(result[0]['bitrate'], 836280);
    expect(result[0]['audioCodec'], 'mp4a.40.2');
    expect(result[0]['videoCodec'], 'avc1.64001f');
    expect(result[0]['width'], 848);
    expect(result[0]['height'], 360);
    expect(result[0]['name'], '480');
    expect(result[0]['url'], 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core');

    manifest = `#EXTM3U
#EXT-X-STREAM-INF:NAME="480",RESOLUTION=848x360,PROGRAM-ID=1,BANDWIDTH=836280,CODECS="mp4a.40.2,avc1.64001f"
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    result = M3U8Parser.parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    expect(result.length, 1);
    expect(result[0]['bitrate']).to.equal(836280);
    expect(result[0]['audioCodec']).to.equal('mp4a.40.2');
    expect(result[0]['videoCodec']).to.equal('avc1.64001f');
    expect(result[0]['width']).to.equal(848);
    expect(result[0]['height']).to.equal(360);
    expect(result[0]['name']).to.equal('480');
    expect(result[0]['url']).to.equal('http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core');

    manifest = `#EXTM3U
#EXT-X-STREAM-INF:CODECS="mp4a.40.2,avc1.64001f",NAME="480",RESOLUTION=848x360,PROGRAM-ID=1,BANDWIDTH=836280
http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`;

    result = M3U8Parser.parseMasterPlaylist(manifest, 'http://www.dailymotion.com');
    expect(result).to.have.lengthOf(1);
    expect(result[0]['bitrate']).to.equal(836280);
    expect(result[0]['audioCodec']).to.equal('mp4a.40.2');
    expect(result[0]['videoCodec']).to.equal('avc1.64001f');
    expect(result[0]['width']).to.equal(848);
    expect(result[0]['height']).to.equal(360);
    expect(result[0]['name']).to.equal('480');
    expect(result[0]['url']).to.equal('http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core');
  });

  it('parses manifest with 10 levels', function () {
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
    expect(result.length, 10);
    expect(result[0]['bitrate']).to.equal(836280);
    expect(result[1]['bitrate']).to.equal(836280);
    expect(result[2]['bitrate']).to.equal(246440);
    expect(result[3]['bitrate']).to.equal(246440);
    expect(result[4]['bitrate']).to.equal(460560);
    expect(result[5]['bitrate']).to.equal(460560);
    expect(result[6]['bitrate']).to.equal(2149280);
    expect(result[7]['bitrate']).to.equal(2149280);
    expect(result[8]['bitrate']).to.equal(6221600);
    expect(result[9]['bitrate']).to.equal(6221600);
  });

  it('parses empty levels returns empty fragment array', function () {
    let level = '';
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core', 0);
    expect(result.fragments).to.have.lengthOf(0);
    expect(result.totalduration).to.equal(0);
  });

  it('level with 0 frag returns empty fragment array', function () {
    let level = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:14`;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core', 0);
    expect(result.fragments).to.have.lengthOf(0);
    expect(result.totalduration).to.equal(0);
  });

  it('parse level with several fragments', function () {
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
    expect(result.fragments[4].url).to.equal('http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(5)/video/107/282/158282701_mp4_h264_aac_hq.ts');
  });

  it('parse level with single char fragment URI', function () {
    let level = `#EXTM3U
#EXT-X-ALLOW-CACHE:NO
#EXT-X-TARGETDURATION:2
#EXTINF:2,
0
#EXTINF:2,
1
#EXT-X-ENDLIST`;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(5)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core', 0);
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
    expect(result.fragments[4].url).to.equal('http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(5)/video/107/282/chop/segment-5.ts');
  });

  it('parse level with start time offset', function () {
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
    expect(result.totalduration).to.equal(51.24);
    expect(result.startSN).to.equal(0);
    expect(result.targetduration).to.equal(14);
    expect(result.live).to.be.false;
    expect(result.startTimeOffset).to.equal(10.3);
  });

  it('parse AES encrypted URLs, with implicit IV', function () {
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
    expect(result.totalduration).to.equal(25);
    expect(result.startSN).to.equal(1);
    expect(result.targetduration).to.equal(11);
    expect(result.live).to.be.false;
    expect(result.fragments).to.have.lengthOf(3);
    expect(result.fragments[0].cc).to.equal(0);
    expect(result.fragments[0].duration).to.equal(11);
    expect(result.fragments[0].title).to.equal('no desc');
    expect(result.fragments[0].level).to.equal(0);
    expect(result.fragments[0].url).to.equal('http://foo.com/adaptive/oceans_aes/oceans_aes-audio=65000-video=236000-1.ts');
    expect(result.fragments[0].decryptdata.uri).to.equal('http://foo.com/adaptive/oceans_aes/oceans.key');
    expect(result.fragments[0].decryptdata.method).to.equal('AES-128');
    let sn = 1;
    let uint8View = new Uint8Array(16);
    for (let i = 12; i < 16; i++) {
      uint8View[i] = (sn >> 8 * (15 - i)) & 0xff;
    }

    expect(result.fragments[0].decryptdata.iv.buffer).to.deep.equal(uint8View.buffer);

    sn = 3;
    uint8View = new Uint8Array(16);
    for (let i = 12; i < 16; i++) {
      uint8View[i] = (sn >> 8 * (15 - i)) & 0xff;
    }

    expect(result.fragments[2].decryptdata.iv.buffer).to.deep.equal(uint8View.buffer);
  });

  it('parse level with #EXT-X-BYTERANGE before #EXTINF', function () {
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
    expect(result.fragments).to.have.lengthOf(5);
    expect(result.totalduration).to.equal(45);
    expect(result.fragments[2].cc).to.equal(0);
    expect(result.fragments[3].cc).to.equal(1); // continuity counter should increase around discontinuity
  });

  it('parses correctly EXT-X-DISCONTINUITY-SEQUENCE and increases continuity counter', function () {
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
    expect(result.fragments).to.have.lengthOf(5);
    expect(result.totalduration).to.equal(45);
    expect(result.fragments[0].cc).to.equal(20);
    expect(result.fragments[2].cc).to.equal(20);
    expect(result.fragments[3].cc).to.equal(21); // continuity counter should increase around discontinuity
  });

  it('parses manifest with one audio track', function () {
    let manifest = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="600k",LANGUAGE="eng",NAME="Audio",AUTOSELECT=YES,DEFAULT=YES,URI="/videos/ZakEbrahim_2014/audio/600k.m3u8?qr=true&preroll=Blank",BANDWIDTH=614400`;
    let result = M3U8Parser.parseMasterPlaylistMedia(manifest, 'https://hls.ted.com/', 'AUDIO');
    expect(result.length, 1);
    expect(result[0]['autoselect']).to.be.true;
    expect(result[0]['default']).to.be.true;
    expect(result[0]['forced']).to.be.false;
    expect(result[0]['groupId']).to.equal('600k');
    expect(result[0]['lang']).to.equal('eng');
    expect(result[0]['name']).to.equal('Audio');
    expect(result[0]['url']).to.equal('https://hls.ted.com/videos/ZakEbrahim_2014/audio/600k.m3u8?qr=true&preroll=Blank');
  });
  // issue #425 - first fragment has null url and no decryptdata if EXT-X-KEY follows EXTINF
  it('parse level with #EXT-X-KEY after #EXTINF', function () {
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
    expect(result.fragments).to.have.lengthOf(8);
    expect(result.totalduration).to.equal(80);

    let fragdecryptdata, decryptdata = result.fragments[0].decryptdata, sn = 0;

    result.fragments.forEach(function (fragment, idx) {
      sn = idx + 1;

      expect(fragment.url, 'http://dummy.com/000' + sn + '.ts');

      // decryptdata should persist across all fragments
      fragdecryptdata = fragment.decryptdata;
      expect(fragdecryptdata.method).to.equal(decryptdata.method);
      expect(fragdecryptdata.uri).to.equal(decryptdata.uri);
      expect(fragdecryptdata.key).to.equal(decryptdata.key);

      // initialization vector is correctly generated since it wasn't declared in the playlist
      let iv = fragdecryptdata.iv;
      expect(iv[15]).to.equal(idx);

      // hold this decrypt data to compare to the next fragment's decrypt data
      decryptdata = fragment.decryptdata;
    });
  });

  // PR #454 - Add support for custom tags in fragment object
  it('return custom tags in fragment object', function () {
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
    expect(result.fragments).to.have.lengthOf(10);
    expect(result.totalduration).to.equal(84.94);
    expect(result.targetduration).to.equal(10);
    expect(result.fragments[0].url).to.equal('http://dummy.url.com/hls/live/segment/segment_022916_164500865_719926.ts');
    expect(result.fragments[0].tagList).to.have.lengthOf(1);
    expect(result.fragments[2].tagList[0][0]).to.equal('EXT-X-CUE-OUT');
    expect(result.fragments[2].tagList[0][1]).to.equal('DURATION=150,BREAKID=0x0');
    expect(result.fragments[3].tagList[0][1]).to.equal('0.50');
    expect(result.fragments[4].tagList).to.have.lengthOf(2);
    expect(result.fragments[4].tagList[0][0]).to.equal('EXT-X-CUE-IN');
    expect(result.fragments[7].tagList[0][0]).to.equal('INF');
    expect(result.fragments[8].url).to.equal('http://dummy.url.com/hls/live/segment/segment_022916_164500865_719934.ts');
  });

  it('parses playlists with #EXT-X-PROGRAM-DATE-TIME after #EXTINF before fragment URL', function () {
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
    expect(result.fragments).to.have.lengthOf(3);
    expect(result.hasProgramDateTime).to.be.true;
    expect(result.totalduration).to.equal(30);
    expect(result.fragments[0].url).to.equal('http://video.example.com/Rollover38803/20160525T064049-01-69844067.ts');
    expect(result.fragments[0].programDateTime).to.equal(1464366884000);
    expect(result.fragments[1].url).to.equal('http://video.example.com/Rollover38803/20160525T064049-01-69844068.ts');
    expect(result.fragments[1].programDateTime).to.equal(1464366894000);
    expect(result.fragments[2].url).to.equal('http://video.example.com/Rollover38803/20160525T064049-01-69844069.ts');
    expect(result.fragments[2].programDateTime).to.equal(1464366904000);
  });

  it('parses #EXTINF without a leading digit', function () {
    let level = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:14
#EXTINF:.360,
/sec(3ae40f708f79ca9471f52b86da76a3a8)/frag(1)/video/107/282/158282701_mp4_h264_aac_hq.ts
#EXT-X-ENDLIST`;
    let result = M3U8Parser.parseLevelPlaylist(level, 'http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core', 0);
    expect(result.fragments).to.have.lengthOf(1);
    expect(result.fragments[0].duration).to.equal(0.360);
  });

  it('parses #EXT-X-MAP URI', function () {
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
    expect(result.initSegment.url).to.equal('http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/main.mp4');
    expect(result.initSegment.byteRangeStartOffset).to.equal(0);
    expect(result.initSegment.byteRangeEndOffset).to.equal(718);
    expect(result.initSegment.sn).to.equal('initSegment');
  });

  describe('PDT calculations', function () {
    it('if playlists contains #EXT-X-PROGRAM-DATE-TIME switching will be applied by PDT', function () {
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
      expect(result.hasProgramDateTime).to.be.true;
      expect(result.fragments[0].rawProgramDateTime).to.equal('2016-05-27T16:34:44Z');
      expect(result.fragments[0].programDateTime).to.equal(1464366884000);
      expect(result.fragments[1].rawProgramDateTime).to.equal('2016-05-27T16:34:54Z');
      expect(result.fragments[1].programDateTime).to.equal(1464366894000);
      expect(result.fragments[2].rawProgramDateTime).to.equal('2016-05-27T16:35:04Z');
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

      const result = M3U8Parser.parseLevelPlaylist(level, 'http://video.example.com/disc.m3u8', 0);
      expect(result.hasProgramDateTime).to.be.true;
      expect(result.fragments[2].rawProgramDateTime).to.equal('2016-05-27T16:35:04Z');
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

      const result = M3U8Parser.parseLevelPlaylist(level, 'http://video.example.com/disc.m3u8', 0);
      expect(result.hasProgramDateTime).to.be.true;
      expect(result.fragments[0].rawProgramDateTime).to.equal('2016-05-27T16:35:04Z');
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

      const result = M3U8Parser.parseLevelPlaylist(level, 'http://video.example.com/disc.m3u8', 0);
      expect(result.hasProgramDateTime).to.be.true;
      expect(result.fragments[0].programDateTime).to.equal(1464366904000);
      expect(result.fragments[0].rawProgramDateTime).to.equal('2016-05-27T16:35:04Z');
      expect(result.fragments[1].programDateTime).to.equal(1464366914000);
      expect(result.fragments[2].programDateTime).to.equal(1495902904000);
      expect(result.fragments[2].rawProgramDateTime).to.equal('2017-05-27T16:35:04Z');
      expect(result.fragments[3].programDateTime).to.equal(1495902914000);
      expect(result.fragments[4].programDateTime).to.equal(1432726923000);
      expect(result.fragments[4].rawProgramDateTime).to.equal('2015-05-27T11:42:03Z');
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
      const result = M3U8Parser.parseLevelPlaylist(level, 'http://video.example.com/disc.m3u8', 0);
      expect(result.hasProgramDateTime).to.be.true;
      expect(result.sn === 'initSegment').to.be.false;
      expect(result.fragments[0].rawProgramDateTime).to.equal('2016-05-27T16:35:04Z');
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
      const result = M3U8Parser.parseLevelPlaylist(level, 'http://video.example.com/disc.m3u8', 0);
      expect(result.hasProgramDateTime).to.be.false;
      expect(result.fragments[0].rawProgramDateTime).to.not.exist;
      expect(result.fragments[0].programDateTime).to.not.exist;
    });
  });

  it('tests : at end of tag name is used to divide custom tags', function () {
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
    expect(result.fragments[2].tagList[0][0]).to.equal('EXT-X-CUSTOM-DATE');
    expect(result.fragments[2].tagList[0][1]).to.equal('2016-05-27T16:34:44Z');
    expect(result.fragments[2].tagList[1][0]).to.equal('EXT-X-CUSTOM-JSON');
    expect(result.fragments[2].tagList[1][1]).to.equal('{"key":"value"}');
    expect(result.fragments[2].tagList[2][0]).to.equal('EXT-X-CUSTOM-URI');
    expect(result.fragments[2].tagList[2][1]).to.equal('http://dummy.url.com/hls/moreinfo.json');
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
    const result = M3U8Parser.parseLevelPlaylist(level, 'http://dummy.url.com/playlist.m3u8', 0);
    expect(result.fragments.length).to.equal(2);
    expect(result.totalduration).to.equal(12.012);
    expect(result.targetduration).to.equal(7);
    expect(result.fragments[0].url).to.equal('http://dummy.url.com/180724_Allison VLOG-v3_00001.ts');
    expect(result.fragments[1].url).to.equal('http://dummy.url.com/180724_Allison VLOG-v3_00002.ts');
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
    const result = M3U8Parser.parseLevelPlaylist(level, 'http://dummy.url.com/playlist.m3u8', 0);
    expect(result.fragments.length).to.equal(2);
    expect(result.totalduration).to.equal(12.012);
    expect(result.targetduration).to.equal(7);
    expect(result.fragments[0].url).to.equal('http://dummy.url.com/180724_Allison VLOG v3_00001.ts');
    expect(result.fragments[1].url).to.equal('http://dummy.url.com/180724_Allison VLOG v3_00002.ts');
  });
});
