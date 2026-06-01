import { CmcdEventType, CmcdHeaderField, CmcdObjectType } from '@svta/cml-cmcd';
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

const makeMockMedia = (autoplay: boolean): HTMLMediaElement =>
  ({
    autoplay,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as HTMLMediaElement;

const setupEach = (
  cmcd?: CMCDControllerConfig,
  // Pass `attachBefore` to simulate `hls.attachMedia()` running *before*
  // `hls.loadSource()` — i.e., MEDIA_ATTACHING fires before MANIFEST_LOADING.
  // Omit it for the load-before-attach order (the default in tests).
  attachBefore?: { autoplay: boolean },
) => {
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
    audioCodec: 'mp4a.40.2',
    videoCodec: 'avc1.640028',
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
  hls.streamController = {
    getLevelDetails: () => details,
    // Tests that fire MEDIA_ATTACHING will exercise getBufferLength, which
    // calls hls.mainForwardBufferInfo → streamController.getMainFwdBufferInfo.
    // Default to null (no buffer info known); individual tests override.
    getMainFwdBufferInfo: () => null,
  };
  // hls.audioTracks = [];

  cmcdController = new CMCDController(hls);

  if (attachBefore) {
    hls.trigger(Events.MEDIA_ATTACHING, {
      media: makeMockMedia(attachBefore.autoplay),
    });
  }

  hls.trigger(Events.MANIFEST_LOADING, { url });

  return details;
};

// Trigger MEDIA_ATTACHING after setupEach to simulate `hls.attachMedia()`
// being called *after* `hls.loadSource()`.
const attachMedia = (autoplay = false) => {
  cmcdController.hls.trigger(Events.MEDIA_ATTACHING, {
    media: makeMockMedia(autoplay),
  });
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

      it('emits br/tb/bl for single-rendition main fragments where ot is undefined', function () {
        // Regression: single-rendition streams (e.g. muxed-fmp4 or mp3 audio-only with
        // no master playlist) carry no codec metadata on the variant, and the fragment
        // hasn't been parsed by the time the request fires — so getObjectType returns
        // undefined. The br/tb/bl block must still emit, since the buffer for the
        // segment exists regardless of whether ot resolved.
        const details = setupEach({});
        const hls = cmcdController.hls;
        hls.levelController.levels[0].audioCodec = undefined;
        hls.levelController.levels[0].videoCodec = undefined;
        (cmcdController as any).media = {} as unknown as HTMLMediaElement;
        Object.defineProperty(hls, 'mainForwardBufferInfo', {
          configurable: true,
          get: () => ({ len: 8.0 }),
        });

        const frag = details.fragments[0];
        // Sanity: ot really is undefined for this fragment.
        expect(
          (cmcdController as any).getObjectType(
            frag,
            hls.levelController.levels[0],
          ),
        ).to.equal(undefined);

        const { url } = applyFragmentData(frag);

        // br: level.bitrate / 1000 = 1
        expectField(url, `br%3D1`);
        // tb: top bandwidth from hls.levels (sole level at 1000) = 1
        expectField(url, `tb%3D1`);
        // bl: 8.0s * 1000 = 8000ms
        expectField(url, `bl%3D8000`);
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

      // The first manifest request's `sta` depends on which of attachMedia
      // and loadSource was called first. The 4 combinations below cover the
      // matrix:
      //   attach→load + autoplay=T → STARTING ("s")
      //   attach→load + autoplay=F → PRELOADING ("d")
      //   load→attach (or no attach) → PRELOADING ("d") via the no-media
      //     branch in onManifestLoading; autoplay only affects subsequent
      //     requests after attach completes.
      describe('initial sta matrix (attach order × autoplay)', function () {
        it('attach→load, autoplay=true → STARTING on first manifest', function () {
          setupEach({ version: 2 }, { autoplay: true });

          expect((cmcdController as any).playerState).to.equal('s');
          const { url } = applyPlaylistData();
          expectField(url, `sta%3Ds`);
        });

        it('attach→load, autoplay=false → PRELOADING on first manifest', function () {
          setupEach({ version: 2 }, { autoplay: false });

          expect((cmcdController as any).playerState).to.equal('d');
          const { url } = applyPlaylistData();
          expectField(url, `sta%3Dd`);
        });

        it('load→attach (no media yet at load) → PRELOADING on first manifest', function () {
          setupEach({ version: 2 });

          // onManifestLoading sets PRELOADING because this.media is undefined
          expect((cmcdController as any).playerState).to.equal('d');
          const { url } = applyPlaylistData();
          expectField(url, `sta%3Dd`);
        });

        it('load→attach, autoplay=true → first manifest is PRELOADING, then transitions to STARTING', function () {
          setupEach({ version: 2 });

          const { url: first } = applyPlaylistData();
          expectField(first, `sta%3Dd`);

          attachMedia(true);
          expect((cmcdController as any).playerState).to.equal('s');

          const { url: second } = applyPlaylistData();
          expectField(second, `sta%3Ds`);
        });

        it('load→attach, autoplay=false → stays PRELOADING after attach', function () {
          setupEach({ version: 2 });

          const { url: first } = applyPlaylistData();
          expectField(first, `sta%3Dd`);

          attachMedia(false);
          expect((cmcdController as any).playerState).to.equal('d');

          const { url: second } = applyPlaylistData();
          expectField(second, `sta%3Dd`);
        });
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
        attachMedia(false);
        details.live = false;

        const { url } = applyFragmentData(details.fragments[0]);
        // Should contain v2 version, stream type, and player state
        expectField(url, `v%3D2`);
        expectField(url, `st%3Dv`);
        expectField(url, `sta%3Dd`);
        // Standard fragment fields still present (inner list format in v2)
        expectField(url, `br%3D%281%29`);
        expectField(url, `ot%3Dav`);
      });

      it('includes v2 fields in headers mode', function () {
        const details = setupEach({ version: 2, useHeaders: true });
        attachMedia(false);
        details.live = false;

        const { url, headers = {} } = applyPlaylistData();
        expect(url).to.equal(base.url);
        // v2 fields should appear in appropriate CMCD headers
        const allHeaders = Object.values(headers).join(',');
        expect(allHeaders).to.include('v=2');
        expect(allHeaders).to.include('st=v');
        expect(allHeaders).to.include('sta=d');
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

      it('emits a single TIME_INTERVAL event at session start (no duplicate sn=0)', function () {
        const requests: any[] = [];
        const captureLoader = (req: any) => {
          requests.push(req);
          return Promise.resolve({ status: 204 });
        };
        setupEach({
          version: 2,
          loader: captureLoader as any,
          eventTargets: [
            {
              url: 'https://analytics.example.com/cmcd',
              events: [CmcdEventType.TIME_INTERVAL],
              interval: 30,
            },
          ],
        });

        const tEvents = requests
          .flatMap((r) =>
            String(r.body || '')
              .trim()
              .split('\n'),
          )
          .filter((line) => /(^|,)e=t(,|$)/.test(line));
        expect(tEvents).to.have.lengthOf(1);
        expect(tEvents[0]).to.match(/(^|,)sn=0(,|$)/);
      });

      it('does not create the reporter in the constructor (deferred to MANIFEST_LOADING)', function () {
        const hls = new Hls({ cmcd: { version: 2 } }) as any;
        hls.networkControllers.forEach((c) => c.destroy());
        hls.networkControllers.length = 0;
        hls.coreComponents.forEach((c) => c.destroy());
        hls.coreComponents.length = 0;

        const controller = new CMCDController(hls);
        expect((controller as any).reporter).to.equal(undefined);
      });

      it('creates a fresh reporter on each MANIFEST_LOADING (one per session)', function () {
        const requests: any[] = [];
        const captureLoader = (req: any) => {
          requests.push(req);
          return Promise.resolve({ status: 204 });
        };
        setupEach({
          version: 2,
          loader: captureLoader as any,
          eventTargets: [
            {
              url: 'https://analytics.example.com/cmcd',
              events: [CmcdEventType.TIME_INTERVAL],
              interval: 30,
            },
          ],
        });

        const reporter1 = (cmcdController as any).reporter;
        expect(reporter1).to.not.equal(undefined);

        // Simulate a second loadSource on the same Hls instance.
        cmcdController.hls.trigger(Events.MANIFEST_LOADING, { url });

        const reporter2 = (cmcdController as any).reporter;
        expect(reporter2).to.not.equal(undefined);
        expect(reporter2).to.not.equal(reporter1);

        const tEvents = requests
          .flatMap((r) =>
            String(r.body || '')
              .trim()
              .split('\n'),
          )
          .filter((line) => /(^|,)e=t(,|$)/.test(line));
        expect(tEvents).to.have.lengthOf(2);
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
        const requests: any[] = [];
        const captureLoader = (req: any) => {
          requests.push(req);
          return Promise.resolve({ status: 204 });
        };
        setupEach({
          version: 2,
          loader: captureLoader as any,
          eventTargets: [
            {
              url: 'https://analytics.example.com/cmcd',
              events: [CmcdEventType.ERROR],
            },
          ],
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

        const eventRequests = requests.filter(
          (r) => r.url === 'https://analytics.example.com/cmcd',
        );
        const body = String(eventRequests[0].body || '');
        expect(eventRequests.length).to.be.greaterThan(0);
        expect(body).to.include('e=e');
        expect(body).to.include('ec=("fragLoadError")');
        expect(body).to.include('ts=');

        cmcdController.destroy();
      });

      it('resolves SEEKING to PAUSED via onSeeked when paused', function () {
        setupEach({ version: 2 });

        (cmcdController as any).media = {
          paused: true,
          removeEventListener: () => {},
        } as unknown as HTMLMediaElement;
        (cmcdController as any).initialized = true;
        (cmcdController as any).onSeeking();
        expect((cmcdController as any).playerState).to.equal('k');

        (cmcdController as any).onSeeked();
        expect((cmcdController as any).playerState).to.equal('a');

        cmcdController.destroy();
      });

      it('keeps SEEKING via onSeeked when not paused', function () {
        setupEach({ version: 2 });

        (cmcdController as any).media = {
          paused: false,
          removeEventListener: () => {},
        } as unknown as HTMLMediaElement;
        (cmcdController as any).initialized = true;
        (cmcdController as any).onSeeking();
        expect((cmcdController as any).playerState).to.equal('k');

        (cmcdController as any).onSeeked();
        expect((cmcdController as any).playerState).to.equal('k');

        cmcdController.destroy();
      });

      it('stays in PRELOADING when onSeeking fires before play()', function () {
        // Per CTA-5004-B: SEEKING is for playhead moves "after starting".
        // Before play() the player is PRELOADING; seeks during preload
        // should not transition out of it.
        setupEach({ version: 2 });
        attachMedia(false);

        (cmcdController as any).media = {
          paused: true,
          removeEventListener: () => {},
        } as unknown as HTMLMediaElement;
        expect((cmcdController as any).playerState).to.equal('d');

        (cmcdController as any).onSeeking();
        expect((cmcdController as any).playerState).to.equal('d');

        (cmcdController as any).onSeeked();
        expect((cmcdController as any).playerState).to.equal('d');

        cmcdController.destroy();
      });

      it('transitions PRELOADING to STARTING on first play()', function () {
        setupEach({ version: 2 });
        attachMedia(false);
        expect((cmcdController as any).playerState).to.equal('d');

        (cmcdController as any).onPlay();
        expect((cmcdController as any).playerState).to.equal('s');

        cmcdController.destroy();
      });

      it('does not re-enter STARTING on subsequent play() after PLAYING', function () {
        setupEach({ version: 2 });

        (cmcdController as any).onPlay();
        (cmcdController as any).onPlaying();
        expect((cmcdController as any).playerState).to.equal('p');

        // After pause/play cycle, 'play' fires again but we stay on
        // the prior state until 'playing' resolves to PLAYING.
        (cmcdController as any).media = {
          paused: true,
          ended: false,
          removeEventListener: () => {},
        } as unknown as HTMLMediaElement;
        (cmcdController as any).onPause();
        expect((cmcdController as any).playerState).to.equal('a');

        (cmcdController as any).onPlay();
        // initialized is now true; onPlay must not transition back to STARTING.
        expect((cmcdController as any).playerState).to.equal('a');

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

    describe('getObjectType', function () {
      it('returns MUXED for main fragments when variant has both audio and video codecs', function () {
        const details = setupEach({});
        const frag = details.fragments[0];
        const variant = { audioCodec: 'mp4a.40.2', videoCodec: 'avc1.640028' };
        const result = (cmcdController as any).getObjectType(frag, variant);
        expect(result).to.equal(CmcdObjectType.MUXED);
      });

      it('returns VIDEO for main fragments when variant has only a video codec', function () {
        const details = setupEach({});
        const frag = details.fragments[0];
        const variant = { videoCodec: 'avc1.640028' };
        const result = (cmcdController as any).getObjectType(frag, variant);
        expect(result).to.equal(CmcdObjectType.VIDEO);
      });

      it('returns AUDIO for main fragments when variant has only an audio codec (audio-only main playlist)', function () {
        const details = setupEach({});
        const frag = details.fragments[0];
        const variant = { audioCodec: 'mp4a.40.2' };
        const result = (cmcdController as any).getObjectType(frag, variant);
        expect(result).to.equal(CmcdObjectType.AUDIO);
      });

      it('falls back to fragment.elementaryStreams.audiovideo when variant codecs are absent', function () {
        const details = setupEach({});
        const frag = details.fragments[0];
        frag.elementaryStreams.audiovideo = {
          startPTS: 0,
          endPTS: 2,
          startDTS: 0,
          endDTS: 2,
        };
        const result = (cmcdController as any).getObjectType(frag);
        expect(result).to.equal(CmcdObjectType.MUXED);
      });

      it('falls back to fragment.elementaryStreams.video when only video stream present', function () {
        const details = setupEach({});
        const frag = details.fragments[0];
        frag.elementaryStreams.video = {
          startPTS: 0,
          endPTS: 2,
          startDTS: 0,
          endDTS: 2,
        };
        const result = (cmcdController as any).getObjectType(frag);
        expect(result).to.equal(CmcdObjectType.VIDEO);
      });

      it('falls back to fragment.elementaryStreams.audio when only audio stream present', function () {
        const details = setupEach({});
        const frag = details.fragments[0];
        frag.elementaryStreams.audio = {
          startPTS: 0,
          endPTS: 2,
          startDTS: 0,
          endDTS: 2,
        };
        const result = (cmcdController as any).getObjectType(frag);
        expect(result).to.equal(CmcdObjectType.AUDIO);
      });

      it('returns undefined for main fragments when neither variant codecs nor elementary streams are known', function () {
        const details = setupEach({});
        const frag = details.fragments[0];
        // No variant, no elementary streams populated
        const result = (cmcdController as any).getObjectType(frag);
        expect(result).to.equal(undefined);
      });

      it('does not infer MUXED from hls.audioTracks.length === 0 alone', function () {
        // Regression: previous logic returned MUXED whenever there were no alt audio renditions,
        // misclassifying video-only variants.
        const details = setupEach({});
        const frag = details.fragments[0];
        // hls.audioTracks is empty by default, mimicking a video-only main variant.
        const variant = { videoCodec: 'avc1.640028' };
        const result = (cmcdController as any).getObjectType(frag, variant);
        expect(result).to.equal(CmcdObjectType.VIDEO);
      });

      it('returns VIDEO (not MUXED) when alt audio renditions exist and variant has both codecs', function () {
        // STREAM-INF CODECS describes the variant plus its alternate renditions, so audioCodec
        // here belongs to the alt audio track, not the main variant.
        const details = setupEach({});
        const frag = details.fragments[0];
        Object.defineProperty(cmcdController.hls, 'audioTracks', {
          configurable: true,
          get: () => [{ bitrate: 128000 }],
        });
        const variant = { audioCodec: 'mp4a.40.2', videoCodec: 'avc1.640028' };
        const result = (cmcdController as any).getObjectType(frag, variant);
        expect(result).to.equal(CmcdObjectType.VIDEO);
      });

      it('returns undefined when alt audio renditions exist and variant has only an audio codec', function () {
        // Same reasoning: audioCodec alone is not enough to call the main variant audio-only
        // when alternate audio renditions are present.
        const details = setupEach({});
        const frag = details.fragments[0];
        Object.defineProperty(cmcdController.hls, 'audioTracks', {
          configurable: true,
          get: () => [{ bitrate: 128000 }],
        });
        const variant = { audioCodec: 'mp4a.40.2' };
        const result = (cmcdController as any).getObjectType(frag, variant);
        expect(result).to.equal(undefined);
      });

      it('prefers parsed elementary streams over variant codecs', function () {
        // Elementary streams reflect what was actually parsed; trust them over the variant hint.
        const details = setupEach({});
        const frag = details.fragments[0];
        frag.elementaryStreams.video = {
          startPTS: 0,
          endPTS: 2,
          startDTS: 0,
          endDTS: 2,
        };
        const variant = { audioCodec: 'mp4a.40.2', videoCodec: 'avc1.640028' };
        const result = (cmcdController as any).getObjectType(frag, variant);
        expect(result).to.equal(CmcdObjectType.VIDEO);
      });

      it('uses the fragment loader call site to derive ot from the active level', function () {
        // Audio-only main playlist: level carries only an audioCodec.
        // applyFragmentData should pass the level into getObjectType and produce ot=a (not ot=av).
        const details = setupEach({});
        const hls = cmcdController.hls;
        hls.levelController.levels[0].audioCodec = 'mp4a.40.2';
        hls.levelController.levels[0].videoCodec = undefined;

        const { url } = applyFragmentData(details.fragments[0]);
        // ot=a but not ot=av (negative lookahead, since 'a' is a prefix of 'av').
        expect(url).to.match(/ot%3Da(?!v)/);
        expect(url).not.to.include('ot%3Dav');
      });

      it('derives ot from LevelSwitchingData in the BITRATE_CHANGE event payload', function () {
        // Video-only variant: only videoCodec set. Must resolve to VIDEO, not MUXED.
        const details = setupEach({
          version: 2,
          eventTargets: [{ url: 'https://x' }],
        });
        const reporter = (cmcdController as any).reporter;
        const recordCalls: any[][] = [];
        reporter.recordEvent = (...args: any[]) => {
          recordCalls.push(args);
        };

        (cmcdController as any).hls.trigger(Events.LEVEL_SWITCHING, {
          level: 0,
          bitrate: 2000000,
          details,
          videoCodec: 'avc1.640028',
        });

        const bitrateCalls = recordCalls.filter((c) => c[0] === 'bc');
        expect(bitrateCalls).to.have.lengthOf(1);
        expect(bitrateCalls[0][1]?.ot).to.equal(CmcdObjectType.VIDEO);
      });
    });

    describe('getBufferLength', function () {
      const stubBufferInfo = (
        hls: any,
        prop: 'mainForwardBufferInfo' | 'audioForwardBufferInfo',
        info: { len: number } | null,
      ) => {
        Object.defineProperty(hls, prop, {
          configurable: true,
          get: () => info,
        });
      };

      const fragWithType = (type: PlaylistLevelType): any => ({ type });

      it('uses hls.audioForwardBufferInfo for fragments with type=audio', function () {
        setupEach({});
        const hls = cmcdController.hls;
        (cmcdController as any).media = {
          removeEventListener: () => {},
        } as unknown as HTMLMediaElement;
        stubBufferInfo(hls, 'audioForwardBufferInfo', { len: 12.5 });
        // Set main to a sentinel that would fail the assertion if used by mistake.
        stubBufferInfo(hls, 'mainForwardBufferInfo', { len: 999 });

        const result = (cmcdController as any).getBufferLength(
          fragWithType(PlaylistLevelType.AUDIO),
        );
        expect(result).to.equal(12500);
      });

      it('returns NaN for type=audio when audioForwardBufferInfo is null', function () {
        setupEach({});
        const hls = cmcdController.hls;
        (cmcdController as any).media = {
          removeEventListener: () => {},
        } as unknown as HTMLMediaElement;
        stubBufferInfo(hls, 'audioForwardBufferInfo', null);
        stubBufferInfo(hls, 'mainForwardBufferInfo', { len: 999 });

        const result = (cmcdController as any).getBufferLength(
          fragWithType(PlaylistLevelType.AUDIO),
        );
        expect(Number.isNaN(result)).to.equal(true);
      });

      it('uses hls.mainForwardBufferInfo for fragments with type=main', function () {
        setupEach({});
        const hls = cmcdController.hls;
        (cmcdController as any).media = {
          removeEventListener: () => {},
        } as unknown as HTMLMediaElement;
        stubBufferInfo(hls, 'mainForwardBufferInfo', { len: 8.0 });
        stubBufferInfo(hls, 'audioForwardBufferInfo', { len: 999 });

        expect(
          (cmcdController as any).getBufferLength(
            fragWithType(PlaylistLevelType.MAIN),
          ),
        ).to.equal(8000);
      });

      it('uses hls.mainForwardBufferInfo for audio-only main playlists (type=main, ot=audio)', function () {
        // Regression: previous logic switched on CmcdObjectType, which would have read
        // audioForwardBufferInfo for an audio-only main playlist even though the buffer
        // lives on the main source buffer.
        setupEach({});
        const hls = cmcdController.hls;
        (cmcdController as any).media = {
          removeEventListener: () => {},
        } as unknown as HTMLMediaElement;
        stubBufferInfo(hls, 'mainForwardBufferInfo', { len: 8.0 });
        stubBufferInfo(hls, 'audioForwardBufferInfo', { len: 999 });

        expect(
          (cmcdController as any).getBufferLength(
            fragWithType(PlaylistLevelType.MAIN),
          ),
        ).to.equal(8000);
      });

      it('returns NaN when no media is attached', function () {
        setupEach({});
        const hls = cmcdController.hls;
        (cmcdController as any).media = undefined;
        stubBufferInfo(hls, 'audioForwardBufferInfo', { len: 12.5 });
        stubBufferInfo(hls, 'mainForwardBufferInfo', { len: 8.0 });

        expect(
          Number.isNaN(
            (cmcdController as any).getBufferLength(
              fragWithType(PlaylistLevelType.AUDIO),
            ),
          ),
        ).to.equal(true);
        expect(
          Number.isNaN(
            (cmcdController as any).getBufferLength(
              fragWithType(PlaylistLevelType.MAIN),
            ),
          ),
        ).to.equal(true);
      });
    });

    describe('event bl propagation', function () {
      const stubBufferInfo = (
        hls: any,
        prop: 'mainForwardBufferInfo' | 'audioForwardBufferInfo',
        info: { len: number } | null,
      ) => {
        Object.defineProperty(hls, prop, {
          configurable: true,
          get: () => info,
        });
      };

      it('updates persistent bl on BUFFER_APPENDED', function () {
        setupEach({ version: 2 });
        const hls = cmcdController.hls;
        (cmcdController as any).media = {
          removeEventListener: () => {},
        } as unknown as HTMLMediaElement;
        stubBufferInfo(hls, 'mainForwardBufferInfo', { len: 10 });
        stubBufferInfo(hls, 'audioForwardBufferInfo', null);

        const reporter = (cmcdController as any).reporter;
        expect(reporter.data.bl).to.equal(undefined);

        hls.trigger(Events.BUFFER_APPENDED, {
          type: 'video',
          frag: null,
          part: null,
          chunkMeta: {},
          parent: 'main',
          timeRanges: {},
        });

        expect(reporter.data.bl).to.deep.equal([10000]);

        cmcdController.destroy();
      });

      it('updates persistent bl on BUFFER_FLUSHED (covers seek-to-empty)', function () {
        setupEach({ version: 2 });
        const hls = cmcdController.hls;
        (cmcdController as any).media = {
          removeEventListener: () => {},
        } as unknown as HTMLMediaElement;
        stubBufferInfo(hls, 'mainForwardBufferInfo', { len: 0 });
        stubBufferInfo(hls, 'audioForwardBufferInfo', null);

        const reporter = (cmcdController as any).reporter;
        hls.trigger(Events.BUFFER_FLUSHED, {
          type: 'video',
          start: 0,
          end: 0,
        });

        expect(reporter.data.bl).to.deep.equal([0]);

        cmcdController.destroy();
      });

      it('uses min(main, audio) when both buffer sources are available', function () {
        setupEach({ version: 2 });
        const hls = cmcdController.hls;
        (cmcdController as any).media = {
          removeEventListener: () => {},
        } as unknown as HTMLMediaElement;
        stubBufferInfo(hls, 'mainForwardBufferInfo', { len: 10 });
        stubBufferInfo(hls, 'audioForwardBufferInfo', { len: 7 });

        const reporter = (cmcdController as any).reporter;
        hls.trigger(Events.BUFFER_APPENDED, {
          type: 'audio',
          frag: null,
          part: null,
          chunkMeta: {},
          parent: 'main',
          timeRanges: {},
        });

        expect(reporter.data.bl).to.deep.equal([7000]);

        cmcdController.destroy();
      });

      it('does not update bl when no media is attached', function () {
        setupEach({ version: 2 });
        const hls = cmcdController.hls;
        (cmcdController as any).media = undefined;
        stubBufferInfo(hls, 'mainForwardBufferInfo', { len: 10 });
        stubBufferInfo(hls, 'audioForwardBufferInfo', null);

        const reporter = (cmcdController as any).reporter;
        hls.trigger(Events.BUFFER_APPENDED, {
          type: 'video',
          frag: null,
          part: null,
          chunkMeta: {},
          parent: 'main',
          timeRanges: {},
        });

        expect(reporter.data.bl).to.equal(undefined);

        cmcdController.destroy();
      });

      it('does not update bl when both buffer info sources are null', function () {
        setupEach({ version: 2 });
        const hls = cmcdController.hls;
        (cmcdController as any).media = {
          removeEventListener: () => {},
        } as unknown as HTMLMediaElement;
        stubBufferInfo(hls, 'mainForwardBufferInfo', null);
        stubBufferInfo(hls, 'audioForwardBufferInfo', null);

        const reporter = (cmcdController as any).reporter;
        hls.trigger(Events.BUFFER_APPENDED, {
          type: 'video',
          frag: null,
          part: null,
          chunkMeta: {},
          parent: 'main',
          timeRanges: {},
        });

        expect(reporter.data.bl).to.equal(undefined);

        cmcdController.destroy();
      });

      it('emits bl in queued event payloads after buffer info is known', function () {
        setupEach({
          version: 2,
          eventTargets: [
            {
              url: 'https://analytics.example.com/cmcd',
              events: [CmcdEventType.PLAY_STATE],
              batchSize: 100,
            },
          ],
        });
        const hls = cmcdController.hls;
        (cmcdController as any).media = {
          removeEventListener: () => {},
        } as unknown as HTMLMediaElement;
        stubBufferInfo(hls, 'mainForwardBufferInfo', { len: 10 });
        stubBufferInfo(hls, 'audioForwardBufferInfo', null);

        hls.trigger(Events.BUFFER_APPENDED, {
          type: 'video',
          frag: null,
          part: null,
          chunkMeta: {},
          parent: 'main',
          timeRanges: {},
        });

        (cmcdController as any).onPlaying();

        const reporter = (cmcdController as any).reporter;
        const targetStates = Array.from(
          reporter.eventTargets.values(),
        ) as any[];
        const queue = targetStates[0].queue as any[];
        // The PLAY_STATE event for the PLAYING transition (sta=p) should
        // carry the bl we populated above. Earlier PRELOADING transitions
        // queued by onManifestLoading do not have bl.
        const playingEvents = queue.filter(
          (e: any) => e.e === CmcdEventType.PLAY_STATE && e.sta === 'p',
        );
        expect(playingEvents.length).to.be.greaterThan(0);
        expect(playingEvents[0].bl).to.deep.equal([10000]);

        cmcdController.destroy();
      });
    });

    describe('getTopBandwidth', function () {
      const fragWithType = (type: PlaylistLevelType): any => ({ type });

      const stubAudioTracks = (hls: any, tracks: any[]) => {
        Object.defineProperty(hls, 'audioTracks', {
          configurable: true,
          get: () => tracks,
        });
      };

      it('uses hls.audioTracks for fragments with type=audio', function () {
        setupEach({});
        const hls = cmcdController.hls;
        stubAudioTracks(hls, [{ bitrate: 96000 }, { bitrate: 128000 }]);
        // hls.levels has the test playlist's level at bitrate 1000; should NOT be used here.
        const result = (cmcdController as any).getTopBandwidth(
          fragWithType(PlaylistLevelType.AUDIO),
        );
        expect(result).to.equal(128000);
      });

      it('uses hls.levels for fragments with type=main (including audio-only main playlists)', function () {
        // Regression: previous logic switched on CmcdObjectType, which would have read
        // audioTracks for an audio-only main playlist even though the renditions live in hls.levels.
        setupEach({});
        const hls = cmcdController.hls;
        hls.levelController.levels = [
          { bitrate: 500000 },
          { bitrate: 2000000 },
        ];
        stubAudioTracks(hls, [{ bitrate: 999999 }]);
        const result = (cmcdController as any).getTopBandwidth(
          fragWithType(PlaylistLevelType.MAIN),
        );
        expect(result).to.equal(2000000);
      });
    });
  });

  describe('update and recordEvent', function () {
    it('update applies custom keys to subsequent request URLs when includeKeys is configured', function () {
      setupEach({ includeKeys: ['sid', 'sf', 'com.test-mykey'] as any });
      cmcdController.update({ 'com.test-mykey': 'hello' } as any);
      const { url: result } = applyPlaylistData();
      expectField(result, 'com.test-mykey');
    });

    it('update applies custom key value computed by a function, reflecting state changes across requests', function () {
      setupEach({ includeKeys: ['sid', 'sf', 'com.acme-label'] as any });

      const labels = ['cold', 'warm'];
      let idx = 0;
      const computeLabel = () => labels[idx];

      cmcdController.update({ 'com.acme-label': computeLabel() } as any);
      const { url: first } = applyPlaylistData();
      expectField(first, 'com.acme-label%3D%22cold%22');

      idx = 1;
      cmcdController.update({ 'com.acme-label': computeLabel() } as any);
      const { url: second } = applyPlaylistData();
      expectField(second, 'com.acme-label%3D%22warm%22');
    });

    it('recordEvent delegates to reporter.recordEvent and emits a POST to the event target', function () {
      const requests: any[] = [];
      const captureLoader = (req: any) => {
        requests.push(req);
        return Promise.resolve({ status: 204 });
      };
      setupEach({
        version: 2,
        loader: captureLoader as any,
        eventTargets: [
          {
            url: 'https://analytics.example.com/cmcd',
            events: [CmcdEventType.CUSTOM_EVENT],
          },
        ],
      });

      cmcdController.recordEvent(CmcdEventType.CUSTOM_EVENT, {
        cen: 'test-event',
      } as any);

      const eventRequests = requests.filter(
        (r) => r.url === 'https://analytics.example.com/cmcd',
      );
      expect(eventRequests.length).to.be.greaterThan(0);
    });

    it('recordEvent includes custom keys when the event target includeKeys lists them', function () {
      const requests: any[] = [];
      const captureLoader = (req: any) => {
        requests.push(req);
        return Promise.resolve({ status: 204 });
      };
      setupEach({
        version: 2,
        loader: captureLoader as any,
        eventTargets: [
          {
            url: 'https://analytics.example.com/cmcd',
            events: [CmcdEventType.CUSTOM_EVENT],
            includeKeys: ['cen', 'com.myco-chapterid'] as any,
          },
        ],
      });

      cmcdController.recordEvent(CmcdEventType.CUSTOM_EVENT, {
        cen: 'chapter-change',
        'com.myco-chapterid': '3',
      } as any);

      const eventRequests = requests.filter(
        (r) => r.url === 'https://analytics.example.com/cmcd',
      );
      expect(eventRequests.length).to.be.greaterThan(0);
      const body = String(eventRequests[0].body || '');
      expect(body).to.include('cen="chapter-change"');
      expect(body).to.include('com.myco-chapterid="3"');
    });

    it('recordEvent does nothing when reporter is not initialized', function () {
      const hls = new Hls({ cmcd: { version: 2 } }) as any;
      hls.networkControllers.forEach((c) => c.destroy());
      hls.networkControllers.length = 0;
      hls.coreComponents.forEach((c) => c.destroy());
      hls.coreComponents.length = 0;

      const controller = new CMCDController(hls);
      // reporter is not yet created (no MANIFEST_LOADING fired)
      expect(() =>
        controller.recordEvent(CmcdEventType.CUSTOM_EVENT),
      ).to.not.throw();
      controller.destroy();
    });
  });
});
