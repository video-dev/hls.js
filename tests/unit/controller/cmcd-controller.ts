import { CmcdHeaderField } from '@svta/cml-cmcd';
import { expect } from 'chai';
import CMCDController from '../../../src/controller/cmcd-controller';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { PlaylistLevelType } from '../../../src/types/loader';
import type { CMCDControllerConfig } from '../../../src/config';
import type { Fragment, Part } from '../../../src/loader/fragment';

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

    describe('v2 configuration', function () {
      it('defaults to version 1', function () {
        setupEach({});

        const { url } = applyPlaylistData();
        // v=1 is the default and is omitted per CMCD spec
        expect(url).to.not.include('v%3D');
        // st is a v1 key and should be included when available
        expectField(url, `st%3D`);
        // sta is NOT a v1 key and should not be included
        expect(url).to.not.include('sta%3D');
      });

      it('uses version 2 when configured', function () {
        setupEach({ version: 2 });

        const { url } = applyPlaylistData();
        expectField(url, `v%3D2`);
      });

      it('includes player state (sta) for v2', function () {
        setupEach({ version: 2 });

        const { url } = applyPlaylistData();
        // Initial state is STARTING ("s")
        expectField(url, `sta%3Ds`);
      });

      it('includes stream type (st) for v2 when level details are available', function () {
        setupEach({ version: 2 });
        // The test playlist has EXT-X-SERVER-CONTROL which makes it live with LL features
        // but details.live defaults to true from parsing

        const { url } = applyPlaylistData();
        // Should include st field (live since playlist has no ENDLIST)
        expectField(url, `st%3D`);
      });

      it('detects VOD stream type', function () {
        const details = setupEach({ version: 2 });
        // Mark level details as VOD
        details.live = false;

        const { url } = applyPlaylistData();
        // VOD = "v"
        expectField(url, `st%3Dv`);
      });

      it('detects low-latency stream type', function () {
        const details = setupEach({ version: 2 });
        details.live = true;
        details.canBlockReload = true;

        const { url } = applyPlaylistData();
        // LOW_LATENCY = "ll"
        expectField(url, `st%3Dll`);
      });

      it('detects live stream type', function () {
        const details = setupEach({ version: 2 });
        details.live = true;
        details.canBlockReload = false;
        details.canSkipUntil = 0;

        const { url } = applyPlaylistData();
        // LIVE = "l" (negative lookahead to avoid matching "ll")
        expectField(url, `st%3Dl(?!l)`);
      });

      it('includes v2 fields in fragment data', function () {
        const details = setupEach({ version: 2 });
        details.live = false;

        const { url } = applyFragmentData(details.fragments[0]);
        // Should contain v2 version, stream type, and player state
        expectField(url, `v%3D2`);
        expectField(url, `st%3Dv`);
        expectField(url, `sta%3Ds`);
        // Standard fragment fields still present (inner list format in v2)
        expectField(url, `br%3D%281%29`);
        expectField(url, `ot%3Dav`);
      });

      it('includes v2 fields in headers mode', function () {
        const details = setupEach({ version: 2, useHeaders: true });
        details.live = false;

        const { url, headers = {} } = applyPlaylistData();
        expect(url).to.equal(base.url);
        // v2 fields should appear in appropriate CMCD headers
        const allHeaders = Object.values(headers).join(',');
        expect(allHeaders).to.include('v=2');
        expect(allHeaders).to.include('st=v');
        expect(allHeaders).to.include('sta=s');
      });
    });

    describe('v2 event reporting', function () {
      it('creates reporter without eventTargets (no event reporting)', function () {
        setupEach({ version: 2 });
        expect((cmcdController as any).reporter).to.not.equal(undefined);
      });

      it('creates reporter for v1 (without event targets)', function () {
        setupEach({
          version: 1,
          eventTargets: [{ url: 'https://analytics.example.com/cmcd' }],
        });
        expect((cmcdController as any).reporter).to.not.equal(undefined);
      });

      it('creates reporter with v2 and eventTargets', function () {
        setupEach({
          version: 2,
          eventTargets: [{ url: 'https://analytics.example.com/cmcd' }],
        });
        expect((cmcdController as any).reporter).to.not.equal(undefined);
      });

      it('stops reporter on destroy', function () {
        setupEach({
          version: 2,
          eventTargets: [{ url: 'https://analytics.example.com/cmcd' }],
        });
        const reporter = (cmcdController as any).reporter;
        const stopCalls: any[][] = [];
        const origStop = reporter.stop.bind(reporter);
        reporter.stop = (...args: any[]) => {
          stopCalls.push(args);
          return origStop(...args);
        };

        cmcdController.destroy();

        expect(stopCalls).to.have.lengthOf(1);
        expect(stopCalls[0][0]).to.equal(true);
        expect((cmcdController as any).reporter).to.equal(undefined);
      });

      it('records play state events on state transitions', function () {
        setupEach({
          version: 2,
          eventTargets: [{ url: 'https://analytics.example.com/cmcd' }],
        });

        // Simulate playing event via the arrow function
        (cmcdController as any).onPlaying();

        // Player state should transition to PLAYING
        expect((cmcdController as any).playerState).to.equal('p');

        // Verify sta=p appears in subsequent CMCD data
        const { url } = applyPlaylistData();
        expectField(url, `sta%3Dp`);

        cmcdController.destroy();
      });

      it('records error events on fatal errors', function () {
        setupEach({
          version: 2,
          eventTargets: [{ url: 'https://analytics.example.com/cmcd' }],
        });

        // Trigger fatal error via hls event
        (cmcdController as any).hls.trigger(Events.ERROR, {
          type: 'networkError',
          details: 'fragLoadError',
          fatal: true,
          error: new Error('test'),
        });

        // Player state should transition to FATAL_ERROR
        expect((cmcdController as any).playerState).to.equal('f');

        cmcdController.destroy();
      });

      it('does not record duplicate play state events', function () {
        setupEach({
          version: 2,
          eventTargets: [{ url: 'https://analytics.example.com/cmcd' }],
        });
        const reporter = (cmcdController as any).reporter;
        const recordCalls: any[][] = [];
        const origRecord = reporter.recordEvent.bind(reporter);
        reporter.recordEvent = (...args: any[]) => {
          recordCalls.push(args);
          return origRecord(...args);
        };

        // Call onPlaying twice — second call should be deduplicated
        (cmcdController as any).onPlaying();
        (cmcdController as any).onPlaying();

        // Only one recordEvent call for the state change (deduplicated)
        expect(recordCalls).to.have.lengthOf(1);

        cmcdController.destroy();
      });
    });
  });
});
