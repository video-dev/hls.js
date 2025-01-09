import { CmcdHeaderField } from '@svta/common-media-library/cmcd/CmcdHeaderField';
import chai from 'chai';
import CMCDController from '../../../src/controller/cmcd-controller';
import Hls from '../../../src/hls';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { PlaylistLevelType } from '../../../src/types/loader';
import type { CMCDControllerConfig } from '../../../src/config';
import type { Fragment, Part } from '../../../src/loader/fragment';

const expect = chai.expect;

let cmcdController;

const url = 'https://dummy.url.com/playlist.m3u8';
const playlist = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-TARGETDURATION:2
#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=2.171
#EXT-X-PART-INF:PART-TARGET=1.034
#EXT-X-MAP:URI="https://dummy.url.com/18446744073709551615.m4s"
#EXT-X-MEDIA-SEQUENCE:10902
#EXT-X-PROGRAM-DATE-TIME:2024-05-02T18:03:57.020+00:00
#EXTINF:2,
https://dummy.url.com/10902.m4s
#EXT-X-PROGRAM-DATE-TIME:2024-05-02T18:03:59.020+00:00
#EXTINF:2,
https://dummy.url.com/10903.m4s
#EXT-X-PROGRAM-DATE-TIME:2024-05-02T18:04:01.020+00:00
#EXT-X-PART:DURATION=1,URI="https://dummy.url.com/10904.0.m4s"
#EXT-X-PART:DURATION=1,URI="https://dummy.url.com/10904.1.m4s"
#EXTINF:2,
https://dummy.url.com/10904.m4s
#EXT-X-PROGRAM-DATE-TIME:2024-05-02T18:04:03.020+00:00
#EXT-X-PART:DURATION=1,URI="https://dummy.url.com/10905.0.m4s",INDEPENDENT=YES
#EXT-X-PART:DURATION=1,URI="https://dummy.url.com/10905.1.m4s"
#EXTINF:2,
https://dummy.url.com/10905.m4s
#EXT-X-PROGRAM-DATE-TIME:2024-05-02T18:04:05.020+00:00
#EXT-X-PART:DURATION=1,URI="https://dummy.url.com/10906.0.m4s",INDEPENDENT=YES
#EXT-X-PART:DURATION=1,URI="https://dummy.url.com/10906.1.m4s"
#EXTINF:2,
https://dummy.url.com/10906.m4s`;

const uuidRegex =
  /[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}/;

const setupEach = (cmcd?: CMCDControllerConfig) => {
  const details = M3U8Parser.parseLevelPlaylist(
    playlist,
    url,
    0,
    PlaylistLevelType.MAIN,
    0,
    null,
  );

  const level = {
    bitrate: 1000,
    details,
  };

  const hls = new Hls({ cmcd }) as any;
  hls.networkControllers.forEach((component) => component.destroy());
  hls.networkControllers.length = 0;
  hls.coreComponents.forEach((component) => component.destroy());
  hls.coreComponents.length = 0;
  hls.levelController = {
    levels: [level],
    level: 0,
  };
  // hls.audioTracks = [];

  cmcdController = new CMCDController(hls);

  return details;
};

const base = {
  url,
  headers: undefined,
};

const applyPlaylistData = (data = {}) => {
  const context = Object.assign(data, base);
  cmcdController.applyPlaylistData(context);
  return context;
};

const applyFragmentData = (frag: Fragment, part?: Part | undefined) => {
  const context = Object.assign({ url: frag.url, frag, part });
  cmcdController.applyFragmentData(context);
  return context;
};

const expectField = (result, expected) => {
  const regex = new RegExp(expected);
  expect(regex.test(result)).to.equal(true);
};

describe('CMCDController', function () {
  describe('cmcdController instance', function () {
    describe('configuration', function () {
      it('does not modify requests when disabled', function () {
        setupEach();

        const { config } = cmcdController.hls;
        expect(config.pLoader).to.equal(undefined);
        expect(config.fLoader).to.equal(undefined);
      });

      it('uses the session id if provided', function () {
        const sessionId = 'SESSION_ID';
        setupEach({ sessionId });

        const { url } = applyPlaylistData();
        expectField(url, `sid%3D%22${sessionId}%22`);
      });

      it('uses the Hls instance session id if not provided', function () {
        setupEach({});

        const sessionId = cmcdController.hls.sessionId;
        const { url } = applyPlaylistData();
        expectField(url, `sid%3D%22${sessionId}%22`);
        expect(sessionId).to.match(uuidRegex);
      });

      it('uses the content id if provided', function () {
        const contentId = 'CONTENT_ID';
        setupEach({ contentId });

        const { url } = applyPlaylistData();
        expectField(url, `cid%3D%22${contentId}%22`);
      });

      it('uses headers if configured', function () {
        const contentId = 'CONTENT_ID';
        setupEach({ contentId, useHeaders: true });

        const { url, headers = {} } = applyPlaylistData();

        expect(url).to.equal(base.url);
        expectField(headers[CmcdHeaderField.SESSION], `cid="${contentId}"`);
      });

      it('uses includeKeys if configured', function () {
        const contentId = 'CONTENT_ID';
        setupEach({ includeKeys: ['cid'], contentId });

        const { url } = applyPlaylistData();

        expect(url).to.equal(`${base.url}?CMCD=cid%3D%22${contentId}%22`);
      });

      it('uses fragment data', function () {
        const details = setupEach({});

        const { url } = applyFragmentData(details.fragments[0]);

        expectField(url, `nor%3D%2210903.m4s%22`);
        expectField(url, `br%3D1`);
        expectField(url, `d%3D2000`);
        expectField(url, `ot%3Dav`);
      });

      it('uses part data when available', function () {
        const details = setupEach({});

        const { url } = applyFragmentData(
          details.fragments[2],
          details.partList?.[0],
        );

        expectField(url, `nor%3D%2210904.1.m4s%22`);
        expectField(url, `br%3D1`);
        expectField(url, `d%3D1000`);
        expectField(url, `ot%3Dav`);
      });
    });
  });
});
