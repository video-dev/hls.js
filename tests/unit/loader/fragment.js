import { Fragment } from '../../../src/loader/fragment';
import { LevelKey } from '../../../src/loader/level-key';
import { PlaylistLevelType } from '../../../src/types/loader';

describe('Fragment class tests', function () {
  /**
   * @type {Fragment}
   */
  let frag;
  beforeEach(function () {
    frag = new Fragment(PlaylistLevelType.MAIN, '');
  });

  describe('encrypted', function () {
    it('returns true if an EXT-X-KEY is associated with the fragment', function () {
      // From https://docs.microsoft.com/en-us/azure/media-services/previous/media-services-protect-with-aes128

      const key = LevelKey.fromURL(
        'https://wamsbayclus001kd-hs.cloudapp.net',
        './HlsHandler.ashx?kid=da3813af-55e6-48e7-aa9f-a4d6031f7b4d'
      );
      key.method = 'AES-128';
      key.iv = '0XD7D7D7D7D7D7D7D7D7D7D7D7D7D7D7D7';
      key.keyFormat = 'identity';
      frag.levelkey = key;
      expect(frag.decryptdata.uri).to.equal(
        'https://wamsbayclus001kd-hs.cloudapp.net/HlsHandler.ashx?kid=da3813af-55e6-48e7-aa9f-a4d6031f7b4d'
      );
      expect(frag.encrypted).to.equal(true);
    });

    it('returns true for widevine v2 manifest signalled encryption', function () {
      // #EXT-X-KEY:METHOD=SAMPLE-AES,URI=”data:text/plain;base64,AAAAPXBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB0aDXdpZGV2aW5lX3Rlc3QiDHRlc3QgY29udGVudA==”,KEYID=0x112233445566778899001122334455,KEYFORMAT=”urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed”,KEYFORMATVERSION=”1”
      // From https://www.academia.edu/36030972/Widevine_DRM_for_HLS

      const key = LevelKey.fromURI(
        'data:text/plain;base64,AAAAPXBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB0aDXdpZGV2aW5lX3Rlc3QiDHRlc3QgY29udGVudA=='
      );
      key.method = 'SAMPLE-AES';
      key.keyFormat = 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed';
      key.keyFormatVersions = '1';
      frag.levelkey = key;
      expect(frag.decryptdata.uri).to.equal(
        'data:text/plain;base64,AAAAPXBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB0aDXdpZGV2aW5lX3Rlc3QiDHRlc3QgY29udGVudA=='
      );
      expect(frag.encrypted).to.equal(true);
    });

    it('returns true for widevine v1 manifest signalled encryption', function () {
      // #EXT-X-KEY:METHOD=SAMPLE-AES,URI=”data:text/plain;base64,eyAKICAgInByb3ZpZGVyIjoibWxiYW1oYm8iLAogICAiY29udGVudF9pZCI6Ik1qQXhOVjlVWldGeWN3PT0iLAogICAia2V5X2lkcyI6CiAgIFsKICAgICAgIjM3MWUxMzVlMWE5ODVkNzVkMTk4YTdmNDEwMjBkYzIzIgogICBdCn0=",IV=0x6df49213a781e338628d0e9c812d328e,KEYFORMAT=”com.widevine”,KEYFORMATVERSIONS=”1”
      // From https://www.academia.edu/36030972/Widevine_DRM_for_HLS

      const key = LevelKey.fromURI(
        'data:text/plain;base64,eyAKICAgInByb3ZpZGVyIjoibWxiYW1oYm8iLAogICAiY29udGVudF9pZCI6Ik1qQXhOVjlVWldGeWN3PT0iLAogICAia2V5X2lkcyI6CiAgIFsKICAgICAgIjM3MWUxMzVlMWE5ODVkNzVkMTk4YTdmNDEwMjBkYzIzIgogICBdCn0='
      );
      key.method = 'SAMPLE-AES';
      key.keyFormat = 'com.widevine';
      key.keyFormatVersions = '1';
      frag.levelkey = key;
      expect(frag.decryptdata.uri).to.equal(
        'data:text/plain;base64,eyAKICAgInByb3ZpZGVyIjoibWxiYW1oYm8iLAogICAiY29udGVudF9pZCI6Ik1qQXhOVjlVWldGeWN3PT0iLAogICAia2V5X2lkcyI6CiAgIFsKICAgICAgIjM3MWUxMzVlMWE5ODVkNzVkMTk4YTdmNDEwMjBkYzIzIgogICBdCn0='
      );
      expect(frag.encrypted).to.equal(true);
    });

    it('returns true for a playready manifest signalled encryption', function () {
      // #EXT-X-KEY:METHOD=SAMPLE-AES,KEYFORMAT="com.microsoft.playready",KEYFORMATVERSIONS="1",URI="data:text/plain;charset=UTF-16;base64,xAEAAAEAAQC6ATwAVwBSAE0ASABFAEEARABFAFIAIAB4AG0AbABuAHMAPQAiAGgAdAB0AHAAOgAvAC8AcwBjAGgAZQBtAGEAcwAuAG0AaQBjAHIAbwBzAG8AZgB0AC4AYwBvAG0ALwBEAFIATQAvADIAMAAwADcALwAwADMALwBQAGwAYQB5AFIAZQBhAGQAeQBIAGUAYQBkAGUAcgAiACAAdgBlAHIAcwBpAG8AbgA9ACIANAAuADAALgAwAC4AMAAiAD4APABEAEEAVABBAD4APABQAFIATwBUAEUAQwBUAEkATgBGAE8APgA8AEsARQBZAEwARQBOAD4AMQA2ADwALwBLAEUAWQBMAEUATgA+ADwAQQBMAEcASQBEAD4AQQBFAFMAQwBUAFIAPAAvAEEATABHAEkARAA+ADwALwBQAFIATwBUAEUAQwBUAEkATgBGAE8APgA8AEsASQBEAD4AdgBHAFYAagBOAEsAZwBZAE0ARQBxAHAATwBMAGgAMQBWAGQAUgBUADAAQQA9AD0APAAvAEsASQBEAD4APAAvAEQAQQBUAEEAPgA8AC8AVwBSAE0ASABFAEEARABFAFIAPgA="
      // From https://docs.microsoft.com/en-us/playready/packaging/mp4-based-formats-supported-by-playready-clients?tabs=case4

      const key = LevelKey.fromURI(
        'data:text/plain;charset=UTF-16;base64,xAEAAAEAAQC6ATwAVwBSAE0ASABFAEEARABFAFIAIAB4AG0AbABuAHMAPQAiAGgAdAB0AHAAOgAvAC8AcwBjAGgAZQBtAGEAcwAuAG0AaQBjAHIAbwBzAG8AZgB0AC4AYwBvAG0ALwBEAFIATQAvADIAMAAwADcALwAwADMALwBQAGwAYQB5AFIAZQBhAGQAeQBIAGUAYQBkAGUAcgAiACAAdgBlAHIAcwBpAG8AbgA9ACIANAAuADAALgAwAC4AMAAiAD4APABEAEEAVABBAD4APABQAFIATwBUAEUAQwBUAEkATgBGAE8APgA8AEsARQBZAEwARQBOAD4AMQA2ADwALwBLAEUAWQBMAEUATgA+ADwAQQBMAEcASQBEAD4AQQBFAFMAQwBUAFIAPAAvAEEATABHAEkARAA+ADwALwBQAFIATwBUAEUAQwBUAEkATgBGAE8APgA8AEsASQBEAD4AdgBHAFYAagBOAEsAZwBZAE0ARQBxAHAATwBMAGgAMQBWAGQAUgBUADAAQQA9AD0APAAvAEsASQBEAD4APAAvAEQAQQBUAEEAPgA8AC8AVwBSAE0ASABFAEEARABFAFIAPgA='
      );
      key.method = 'SAMPLE-AES';
      key.keyFormat = 'com.microsoft.playready';
      key.keyFormatVersions = '1';
      frag.levelkey = key;
      expect(frag.decryptdata.uri).to.equal(
        'data:text/plain;charset=UTF-16;base64,xAEAAAEAAQC6ATwAVwBSAE0ASABFAEEARABFAFIAIAB4AG0AbABuAHMAPQAiAGgAdAB0AHAAOgAvAC8AcwBjAGgAZQBtAGEAcwAuAG0AaQBjAHIAbwBzAG8AZgB0AC4AYwBvAG0ALwBEAFIATQAvADIAMAAwADcALwAwADMALwBQAGwAYQB5AFIAZQBhAGQAeQBIAGUAYQBkAGUAcgAiACAAdgBlAHIAcwBpAG8AbgA9ACIANAAuADAALgAwAC4AMAAiAD4APABEAEEAVABBAD4APABQAFIATwBUAEUAQwBUAEkATgBGAE8APgA8AEsARQBZAEwARQBOAD4AMQA2ADwALwBLAEUAWQBMAEUATgA+ADwAQQBMAEcASQBEAD4AQQBFAFMAQwBUAFIAPAAvAEEATABHAEkARAA+ADwALwBQAFIATwBUAEUAQwBUAEkATgBGAE8APgA8AEsASQBEAD4AdgBHAFYAagBOAEsAZwBZAE0ARQBxAHAATwBMAGgAMQBWAGQAUgBUADAAQQA9AD0APAAvAEsASQBEAD4APAAvAEQAQQBUAEEAPgA8AC8AVwBSAE0ASABFAEEARABFAFIAPgA='
      );
      expect(frag.encrypted).to.equal(true);
    });
  });

  describe('setByteRange', function () {
    it('set byte range with length@offset', function () {
      frag.setByteRange('1000@10000');
      expect(frag.byteRangeStartOffset).to.equal(10000);
      expect(frag.byteRangeEndOffset).to.equal(11000);
    });

    it('set byte range with no offset and uses 0 as offset', function () {
      frag.setByteRange('5000');
      expect(frag.byteRangeStartOffset).to.equal(0);
      expect(frag.byteRangeEndOffset).to.equal(5000);
    });

    it('set byte range with no offset and uses 0 as offset', function () {
      const prevFrag = new Fragment(PlaylistLevelType.MAIN, '');
      prevFrag.setByteRange('1000@10000');
      frag.setByteRange('5000', prevFrag);
      expect(frag.byteRangeStartOffset).to.equal(11000);
      expect(frag.byteRangeEndOffset).to.equal(16000);
    });
  });

  describe('endProgramDateTime getter', function () {
    it('computes endPdt when pdt and duration are valid', function () {
      frag.programDateTime = 1000;
      frag.duration = 1;
      expect(frag.endProgramDateTime).to.equal(2000);
    });

    it('considers 0 a valid pdt', function () {
      frag.programDateTime = 0;
      frag.duration = 1;
      expect(frag.endProgramDateTime).to.equal(1000);
    });

    it('returns null if pdt is NaN', function () {
      frag.programDateTime = 'foo';
      frag.duration = 1;
      expect(frag.endProgramDateTime).to.equal(null);
    });

    it('defaults duration to 0 if duration is NaN', function () {
      frag.programDateTime = 1000;
      frag.duration = 'foo';
      expect(frag.endProgramDateTime).to.equal(1000);
    });
  });
});
