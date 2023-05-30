import { Fragment } from '../../../src/loader/fragment';
import { LevelKey } from '../../../src/loader/level-key';
import { PlaylistLevelType } from '../../../src/types/loader';

import chai from 'chai';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);
const expect = chai.expect;

describe('Fragment class tests', function () {
  let frag: Fragment;
  beforeEach(function () {
    frag = new Fragment(PlaylistLevelType.MAIN, '');
  });

  describe('encrypted', function () {
    it('returns true if an EXT-X-KEY is associated with the fragment', function () {
      // From https://docs.microsoft.com/en-us/azure/media-services/previous/media-services-protect-with-aes128

      const key = new LevelKey(
        'AES-128',
        'https://wamsbayclus001kd-hs.cloudapp.net/HlsHandler.ashx?kid=da3813af-55e6-48e7-aa9f-a4d6031f7b4d',
        'identity'
      );
      frag.levelkeys = { identity: key };
      expect(frag.encrypted).to.equal(true);
    });

    it('returns true for fairplay manifest signalled encryption', function () {
      const key = new LevelKey(
        'SAMPLE-AES',
        'skd://one',
        'com.apple.streamingkeydelivery',
        [1]
      );
      frag.levelkeys = { 'com.apple.streamingkeydelivery': key };
      expect(frag.encrypted).to.equal(true);
    });

    it('returns true for widevine v2 manifest signalled encryption', function () {
      // #EXT-X-KEY:METHOD=SAMPLE-AES,URI=”data:text/plain;base64,AAAAPXBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB0aDXdpZGV2aW5lX3Rlc3QiDHRlc3QgY29udGVudA==”,KEYID=0x112233445566778899001122334455,KEYFORMAT=”urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed”,KEYFORMATVERSION=”1”
      // From https://www.academia.edu/36030972/Widevine_DRM_for_HLS

      const key = new LevelKey(
        'SAMPLE-AES',
        'data:text/plain;base64,AAAAPXBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB0aDXdpZGV2aW5lX3Rlc3QiDHRlc3QgY29udGVudA==',
        'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed',
        [1]
      );
      frag.levelkeys = { 'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed': key };
      expect(frag.encrypted).to.equal(true);
    });

    it('returns true for a playready manifest signalled encryption', function () {
      // #EXT-X-KEY:METHOD=SAMPLE-AES,KEYFORMAT="com.microsoft.playready",KEYFORMATVERSIONS="1",URI="data:text/plain;charset=UTF-16;base64,xAEAAAEAAQC6ATwAVwBSAE0ASABFAEEARABFAFIAIAB4AG0AbABuAHMAPQAiAGgAdAB0AHAAOgAvAC8AcwBjAGgAZQBtAGEAcwAuAG0AaQBjAHIAbwBzAG8AZgB0AC4AYwBvAG0ALwBEAFIATQAvADIAMAAwADcALwAwADMALwBQAGwAYQB5AFIAZQBhAGQAeQBIAGUAYQBkAGUAcgAiACAAdgBlAHIAcwBpAG8AbgA9ACIANAAuADAALgAwAC4AMAAiAD4APABEAEEAVABBAD4APABQAFIATwBUAEUAQwBUAEkATgBGAE8APgA8AEsARQBZAEwARQBOAD4AMQA2ADwALwBLAEUAWQBMAEUATgA+ADwAQQBMAEcASQBEAD4AQQBFAFMAQwBUAFIAPAAvAEEATABHAEkARAA+ADwALwBQAFIATwBUAEUAQwBUAEkATgBGAE8APgA8AEsASQBEAD4AdgBHAFYAagBOAEsAZwBZAE0ARQBxAHAATwBMAGgAMQBWAGQAUgBUADAAQQA9AD0APAAvAEsASQBEAD4APAAvAEQAQQBUAEEAPgA8AC8AVwBSAE0ASABFAEEARABFAFIAPgA="
      // From https://docs.microsoft.com/en-us/playready/packaging/mp4-based-formats-supported-by-playready-clients?tabs=case4

      const key = new LevelKey(
        'SAMPLE-AES',
        'data:text/plain;charset=UTF-16;base64,xAEAAAEAAQC6ATwAVwBSAE0ASABFAEEARABFAFIAIAB4AG0AbABuAHMAPQAiAGgAdAB0AHAAOgAvAC8AcwBjAGgAZQBtAGEAcwAuAG0AaQBjAHIAbwBzAG8AZgB0AC4AYwBvAG0ALwBEAFIATQAvADIAMAAwADcALwAwADMALwBQAGwAYQB5AFIAZQBhAGQAeQBIAGUAYQBkAGUAcgAiACAAdgBlAHIAcwBpAG8AbgA9ACIANAAuADAALgAwAC4AMAAiAD4APABEAEEAVABBAD4APABQAFIATwBUAEUAQwBUAEkATgBGAE8APgA8AEsARQBZAEwARQBOAD4AMQA2ADwALwBLAEUAWQBMAEUATgA+ADwAQQBMAEcASQBEAD4AQQBFAFMAQwBUAFIAPAAvAEEATABHAEkARAA+ADwALwBQAFIATwBUAEUAQwBUAEkATgBGAE8APgA8AEsASQBEAD4AdgBHAFYAagBOAEsAZwBZAE0ARQBxAHAATwBMAGgAMQBWAGQAUgBUADAAQQA9AD0APAAvAEsASQBEAD4APAAvAEQAQQBUAEEAPgA8AC8AVwBSAE0ASABFAEEARABFAFIAPgA=',
        'com.microsoft.playready',
        [1]
      );
      frag.levelkeys = { 'com.microsoft.playready': key };
      expect(frag.encrypted).to.equal(true);
    });

    it('returns false when key method is NONE', function () {
      const key = new LevelKey('NONE', 'plain-text', 'org.w3.clearkey', [1]);
      frag.levelkeys = { NONE: key };
      expect(frag.encrypted).to.equal(false);
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
      frag.programDateTime = NaN;
      frag.duration = 1;
      expect(frag.endProgramDateTime).to.equal(null);
    });

    it('defaults duration to 0 if duration is NaN', function () {
      frag.programDateTime = 1000;
      frag.duration = NaN;
      expect(frag.endProgramDateTime).to.equal(1000);
    });
  });
});
