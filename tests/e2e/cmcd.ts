import {
  CmcdEventType,
  CmcdReportRecorder,
  validateCmcdEvents,
  validateCmcdRequest,
} from '@svta/cml-cmcd';
import { assert, expect } from 'chai';
import { Events } from '../../src/events';
import Hls from '../../src/hls';
import FetchLoader from '../../src/utils/fetch-loader';
import type { CmcdRecordedReport } from '@svta/cml-cmcd';

const TEST_STREAM = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
const SESSION_ID = 'e2e-test-session';
const CONTENT_ID = 'e2e-test-content';
const EVENT_TARGET_URL = 'https://httpbin.org/post';
const REQUEST_TIMEOUT = 30000;

function createVideoElement(): HTMLVideoElement {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  document.body.appendChild(video);
  return video;
}

function destroyVideoElement(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute('src');
  video.load();
  if (video.parentNode) {
    video.parentNode.removeChild(video);
  }
}

function waitForPlayback(
  hls: Hls,
  video: HTMLVideoElement,
  timeout: number = REQUEST_TIMEOUT,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      settled = true;
      self.clearTimeout(timer);
      self.clearInterval(interval);
      hls.off(Events.FRAG_CHANGED, onFragChanged);
    };

    const timer = self.setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(
          new Error(
            `Timeout waiting for playback (currentTime=${video.currentTime})`,
          ),
        );
      }
    }, timeout);

    const onFragChanged = () => {
      if (!settled && video.currentTime > 0) {
        cleanup();
        resolve();
      }
    };

    hls.on(Events.FRAG_CHANGED, onFragChanged);

    // Also check periodically in case FRAG_CHANGED already fired
    const interval = self.setInterval(() => {
      if (!settled && video.currentTime > 0) {
        cleanup();
        resolve();
      }
    }, 200);
  });
}

function validateRecordedReport(report: CmcdRecordedReport) {
  const result = validateCmcdRequest(report.request);
  expect(result.valid).to.equal(
    true,
    `CMCD validation failed: ${JSON.stringify(result.issues)}`,
  );
  return result.data as Record<string, unknown>;
}

describe('CMCD v2 E2E Tests', function () {
  this.timeout(60000);

  let recorder: CmcdReportRecorder;
  let video: HTMLVideoElement;
  let hls: Hls;
  let origOnerror: OnErrorEventHandler;

  beforeEach(function () {
    recorder = new CmcdReportRecorder();
    video = createVideoElement();

    // Suppress uncaught errors from the transmuxer worker blob.
    // The worker blob runs the full IIFE bundle which references mocha's
    // `describe` at the top level, causing "describe is not defined" errors
    // in the worker scope. These are harmless and pre-existing.
    origOnerror = self.onerror;
    self.onerror = function (message, source, ...rest) {
      if (
        typeof source === 'string' &&
        source.startsWith('blob:') &&
        typeof message === 'string' &&
        message.includes('describe is not defined')
      ) {
        return true; // suppress
      }
      if (origOnerror) {
        return (origOnerror as any).call(this, message, source, ...rest);
      }
      return false;
    };
  });

  afterEach(function () {
    if (hls) {
      hls.destroy();
    }
    destroyVideoElement(video);
    recorder.detach();
    recorder.clear();
    self.onerror = origOnerror;
  });

  describe('Group 1: Query Mode (v2)', function () {
    beforeEach(function () {
      recorder.attach({ waitTimeout: REQUEST_TIMEOUT });
      hls = new Hls({
        loader: FetchLoader,
        cmcd: {
          version: 2,
          sessionId: SESSION_ID,
          contentId: CONTENT_ID,
        },
      });
      hls.attachMedia(video);
      hls.loadSource(TEST_STREAM);
    });

    it('should send valid CMCD v2 on manifest requests', async function () {
      const manifests = await recorder.waitForManifest();
      const decoded = validateRecordedReport(manifests[0]);

      expect(decoded).to.have.property('ot', 'm');
      expect(decoded).to.have.property('sf', 'h');
      expect(decoded).to.have.property('sid', SESSION_ID);
      expect(decoded).to.have.property('cid', CONTENT_ID);
      expect(decoded).to.have.property('v', 2);
      // Video has autoplay=true and attachMedia runs before loadSource, so
      // MEDIA_ATTACHING sets STARTING (s) before the manifest URL is built.
      expect(decoded).to.have.property('sta', 's');
    });

    it('should send valid CMCD v2 on segment requests', async function () {
      // Wait for segments directly — segments are requested before playback starts
      const segments = await recorder.waitForSegments({ count: 2 });
      const decoded = validateRecordedReport(segments[0]);

      expect(decoded).to.have.property('ot');
      expect(['av', 'v', 'a', 'i']).to.include(decoded.ot as string);
      expect(decoded).to.have.property('d');
      expect(decoded.d as number).to.be.greaterThan(0);
      expect(decoded).to.have.property('br');
      expect(decoded).to.have.property('st', 'v');
    });

    it('should include next object request (nor) on at least one segment', async function () {
      await waitForPlayback(hls, video);

      const segments = await recorder.waitForSegments({ count: 2 });
      const hasNor = segments.some((report) => {
        const result = validateCmcdRequest(report.request);
        return result.data.nor != null;
      });
      expect(hasNor).to.equal(true, 'No segment had a "nor" field');
    });

    it('should reflect player state transitions (sta)', async function () {
      // Video has autoplay=true and attachMedia is called before loadSource,
      // so the first manifest carries sta=s (STARTING). Once 'playing' fires
      // the state transitions to PLAYING (p) for subsequent requests.
      const manifests = await recorder.waitForManifest();
      expect(validateRecordedReport(manifests[0])).to.have.property('sta', 's');

      await waitForPlayback(hls, video);
      await recorder.waitForSegments({ count: 4 });

      const segments = recorder
        .getReports()
        .filter((r) => r.type === 'segment');
      const states = segments.map(
        (r) => validateCmcdRequest(r.request).data.sta,
      );

      const hasPlaying = states.includes('p');
      expect(hasPlaying).to.equal(
        true,
        `No segment had sta=p (playing state). States found: ${states.join(', ')}`,
      );

      // Per spec/design: with autoplay=true, the only non-PLAYING value
      // segments should ever report is STARTING — never PRELOADING.
      const unexpected = states.filter(
        (s) => s !== undefined && s !== 's' && s !== 'p',
      );
      expect(unexpected).to.deep.equal(
        [],
        `Unexpected sta tokens on segments: ${unexpected.join(', ')}`,
      );
    });

    it('should include measured throughput (mtp) after playback', async function () {
      await waitForPlayback(hls, video);

      const segments = await recorder.waitForSegments({ count: 2 });
      const hasMtp = segments.some((report) => {
        const result = validateCmcdRequest(report.request);
        return result.data.mtp != null;
      });
      expect(hasMtp).to.equal(
        true,
        'No segment had "mtp" (measured throughput)',
      );
    });
  });

  describe('Group 2: Header Mode (v2)', function () {
    beforeEach(function () {
      recorder.attach({ waitTimeout: REQUEST_TIMEOUT });
      hls = new Hls({
        loader: FetchLoader,
        cmcd: {
          version: 2,
          useHeaders: true,
          sessionId: SESSION_ID,
          contentId: CONTENT_ID,
        },
      });
      hls.attachMedia(video);
      hls.loadSource(TEST_STREAM);
    });

    it('should send CMCD headers (not query) on manifest requests', async function () {
      const manifests = await recorder.waitForManifest();
      const report = manifests[0];

      expect(report.reportingMode).to.equal('header');
      expect(report.request.url).to.not.include('CMCD=');

      const decoded = validateRecordedReport(report);
      expect(decoded).to.have.property('ot', 'm');
      expect(decoded).to.have.property('sf', 'h');
      expect(decoded).to.have.property('sid', SESSION_ID);
      expect(decoded).to.have.property('v', 2);
    });

    it('should validate CMCD headers contain correct v2 fields', async function () {
      // Note: CMCD header mode adds custom CMCD-* headers which trigger CORS
      // preflight on cross-origin requests. The test stream server may not
      // support these headers in CORS. We validate the headers on the initial
      // manifest request which is always captured by the interceptor.
      const manifests = await recorder.waitForManifest();
      const report = manifests[0];

      expect(report.reportingMode).to.equal('header');

      const decoded = validateRecordedReport(report);

      // v2-specific fields. Video has autoplay=true and attachMedia runs
      // before loadSource, so sta=s (STARTING) is set before the manifest
      // request is built.
      expect(decoded).to.have.property('v', 2);
      expect(decoded).to.have.property('sta', 's');

      // Standard fields
      expect(decoded).to.have.property('ot', 'm');
      expect(decoded).to.have.property('sf', 'h');
      expect(decoded).to.have.property('sid', SESSION_ID);
      expect(decoded).to.have.property('cid', CONTENT_ID);
    });

    it('should place CMCD fields in correct header shards', async function () {
      const manifests = await recorder.waitForManifest();
      const headers = manifests[0].request.headers;

      // CMCD-Session should contain sid, sf
      const session = headers?.['cmcd-session'];
      if (session) {
        expect(session).to.include('sid=');
        expect(session).to.include('sf=');
      }

      // CMCD-Object should contain ot
      const object = headers?.['cmcd-object'];
      if (object) {
        expect(object).to.include('ot=');
      }
    });
  });

  describe('Group 3: Event Mode (v2)', function () {
    beforeEach(function () {
      recorder.attach({
        eventTargetUrls: [EVENT_TARGET_URL],
        waitTimeout: REQUEST_TIMEOUT,
      });
      hls = new Hls({
        loader: FetchLoader,
        cmcd: {
          version: 2,
          sessionId: SESSION_ID,
          contentId: CONTENT_ID,
          eventTargets: [
            {
              url: EVENT_TARGET_URL,
              events: [CmcdEventType.PLAY_STATE],
            },
          ],
        },
      });
      hls.attachMedia(video);
      hls.loadSource(TEST_STREAM);
    });

    it('should send play state events via POST', async function () {
      await waitForPlayback(hls, video);

      const events = await recorder.waitForEvents();
      expect(events.length).to.be.greaterThan(0);

      const report = events[0];
      expect(report.request.method).to.equal('POST');

      const body = report.request.body as string;
      expect(body.length).to.be.greaterThan(0);

      const result = validateCmcdEvents(body);
      expect(result.valid).to.equal(
        true,
        `CMCD event validation failed: ${JSON.stringify(result.issues)}`,
      );
      expect(result.data.length).to.be.greaterThan(0);

      result.data.forEach((decoded) => {
        assert(decoded.v === 2);
        expect(decoded.e).to.equal('ps');
        expect(decoded).to.have.property('ts');
      });
    });
  });

  describe('Group 4: Key Filtering', function () {
    const INCLUDED_KEYS = ['sid', 'cid', 'ot', 'v', 'sf'];

    beforeEach(function () {
      recorder.attach({ waitTimeout: REQUEST_TIMEOUT });
      hls = new Hls({
        loader: FetchLoader,
        cmcd: {
          version: 2,
          sessionId: SESSION_ID,
          contentId: CONTENT_ID,
          includeKeys: INCLUDED_KEYS as any,
        },
      });
      hls.attachMedia(video);
      hls.loadSource(TEST_STREAM);
    });

    it('should only include specified keys', async function () {
      const manifests = await recorder.waitForManifest();
      const result = validateCmcdRequest(manifests[0].request);
      const decoded = result.data as Record<string, unknown>;

      INCLUDED_KEYS.forEach((key) => {
        expect(decoded).to.have.property(key);
      });

      // These keys should be excluded
      expect(decoded).to.not.have.property('su');
      expect(decoded).to.not.have.property('sta');
      expect(decoded).to.not.have.property('mtp');
    });
  });

  describe('Group 5: Version Comparison', function () {
    it('v1 should omit v and sta fields', async function () {
      recorder.attach({ waitTimeout: REQUEST_TIMEOUT });
      hls = new Hls({
        loader: FetchLoader,
        cmcd: {
          sessionId: SESSION_ID,
          contentId: CONTENT_ID,
        },
      });
      hls.attachMedia(video);
      hls.loadSource(TEST_STREAM);

      const manifests = await recorder.waitForManifest();
      const result = validateCmcdRequest(manifests[0].request);
      const decoded = result.data as Record<string, unknown>;

      expect(decoded).to.not.have.property('v');
      expect(decoded).to.not.have.property('sta');
    });

    it('v2 should include v=2 and sta', async function () {
      recorder.attach({ waitTimeout: REQUEST_TIMEOUT });
      hls = new Hls({
        loader: FetchLoader,
        cmcd: {
          version: 2,
          sessionId: SESSION_ID,
          contentId: CONTENT_ID,
        },
      });
      hls.attachMedia(video);
      hls.loadSource(TEST_STREAM);

      const manifests = await recorder.waitForManifest();
      const decoded = validateRecordedReport(manifests[0]);

      expect(decoded).to.have.property('v', 2);
      // Video has autoplay=true and attachMedia runs before loadSource, so
      // sta=s (STARTING) is set before the manifest URL is built.
      expect(decoded).to.have.property('sta', 's');
    });
  });

  // Verifies the master-manifest sta value across all combinations of
  // video.autoplay, hls.config.autoStartLoad, and the
  // attachMedia/loadSource call order.
  //
  // Expected outcome derives entirely from the autoplay+order pair:
  //   attach→load + autoplay=T → STARTING (s) — MEDIA_ATTACHING sets it
  //     before the manifest URL is built.
  //   any other combination → PRELOADING (d) — either set by
  //     onMediaAttaching (autoplay=false) or by the no-media fallback in
  //     onManifestLoading (load-before-attach).
  // autoStartLoad does not affect the master manifest's sta; it only
  // determines whether subsequent segments load automatically.
  describe('Group 6: initial sta matrix', function () {
    type Scenario = {
      autoplay: boolean;
      autoStartLoad: boolean;
      order: 'attach-load' | 'load-attach';
      expectedSta: 's' | 'd';
    };

    const scenarios: Record<string, Scenario> = {
      '1A: autoplay=T, autoStartLoad=T, attach→load': {
        autoplay: true,
        autoStartLoad: true,
        order: 'attach-load',
        expectedSta: 's',
      },
      '1B: autoplay=T, autoStartLoad=T, load→attach': {
        autoplay: true,
        autoStartLoad: true,
        order: 'load-attach',
        expectedSta: 'd',
      },
      '2A: autoplay=F, autoStartLoad=T, attach→load': {
        autoplay: false,
        autoStartLoad: true,
        order: 'attach-load',
        expectedSta: 'd',
      },
      '2B: autoplay=F, autoStartLoad=T, load→attach': {
        autoplay: false,
        autoStartLoad: true,
        order: 'load-attach',
        expectedSta: 'd',
      },
      '3A: autoplay=F, autoStartLoad=F, attach→load': {
        autoplay: false,
        autoStartLoad: false,
        order: 'attach-load',
        expectedSta: 'd',
      },
      '3B: autoplay=F, autoStartLoad=F, load→attach': {
        autoplay: false,
        autoStartLoad: false,
        order: 'load-attach',
        expectedSta: 'd',
      },
    };

    Object.entries(scenarios).forEach(([label, scenario]) => {
      it(`${label} → sta=${scenario.expectedSta} on first manifest`, async function () {
        // Override the default-created video element with one that matches
        // this scenario's autoplay setting.
        destroyVideoElement(video);
        video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.autoplay = scenario.autoplay;
        document.body.appendChild(video);

        recorder.attach({ waitTimeout: REQUEST_TIMEOUT });
        hls = new Hls({
          loader: FetchLoader,
          autoStartLoad: scenario.autoStartLoad,
          cmcd: {
            version: 2,
            sessionId: SESSION_ID,
            contentId: CONTENT_ID,
          },
        });

        if (scenario.order === 'attach-load') {
          hls.attachMedia(video);
          hls.loadSource(TEST_STREAM);
        } else {
          hls.loadSource(TEST_STREAM);
          hls.attachMedia(video);
        }

        const manifests = await recorder.waitForManifest();
        const decoded = validateRecordedReport(manifests[0]);

        expect(decoded).to.have.property('sta', scenario.expectedSta);
      });
    });
  });
});
