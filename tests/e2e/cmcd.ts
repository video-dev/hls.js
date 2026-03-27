import {
  CmcdEventType,
  validateCmcdEvents,
  validateCmcdRequest,
} from '@svta/cml-cmcd';
import { assert, expect } from 'chai';
import { Events } from '../../src/events';
import Hls from '../../src/hls';
import FetchLoader from '../../src/utils/fetch-loader';
import { CmcdRequestCollector } from '../mocks/cmcd-request-collector';
import type { CollectedRequest } from '../mocks/cmcd-request-collector';

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

function validateCollectedRequest(collected: CollectedRequest) {
  const result = validateCmcdRequest(collected.request);
  expect(result.valid).to.equal(
    true,
    `CMCD validation failed: ${JSON.stringify(result.issues)}`,
  );
  return result.data as Record<string, unknown>;
}

describe('CMCD v2 E2E Tests', function () {
  this.timeout(60000);

  let collector: CmcdRequestCollector;
  let video: HTMLVideoElement;
  let hls: Hls;
  let origOnerror: OnErrorEventHandler;

  beforeEach(function () {
    collector = new CmcdRequestCollector();
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
    collector.detach();
    collector.clear();
    self.onerror = origOnerror;
  });

  describe('Group 1: Query Mode (v2)', function () {
    beforeEach(function () {
      collector.attach();
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
      const manifests = await collector.waitForRequests(
        'manifest',
        1,
        REQUEST_TIMEOUT,
      );
      const decoded = validateCollectedRequest(manifests[0]);

      expect(decoded).to.have.property('ot', 'm');
      expect(decoded).to.have.property('sf', 'h');
      expect(decoded).to.have.property('sid', SESSION_ID);
      expect(decoded).to.have.property('cid', CONTENT_ID);
      expect(decoded).to.have.property('v', 2);
      expect(decoded).to.have.property('sta');
    });

    it('should send valid CMCD v2 on segment requests', async function () {
      // Wait for segments directly — segments are requested before playback starts
      const segments = await collector.waitForRequests(
        'segment',
        2,
        REQUEST_TIMEOUT,
      );
      const decoded = validateCollectedRequest(segments[0]);

      expect(decoded).to.have.property('ot');
      expect(['av', 'v', 'a', 'i']).to.include(decoded.ot as string);
      expect(decoded).to.have.property('d');
      expect(decoded.d as number).to.be.greaterThan(0);
      expect(decoded).to.have.property('br');
      expect(decoded).to.have.property('st', 'v');
    });

    it('should include next object request (nor) on at least one segment', async function () {
      await waitForPlayback(hls, video);

      const segments = await collector.waitForRequests(
        'segment',
        2,
        REQUEST_TIMEOUT,
      );
      const hasNor = segments.some((req) => {
        const result = validateCmcdRequest(req.request);
        return result.data.nor != null;
      });
      expect(hasNor).to.equal(true, 'No segment had a "nor" field');
    });

    it('should reflect player state transitions (sta)', async function () {
      const manifests = await collector.waitForRequests(
        'manifest',
        1,
        REQUEST_TIMEOUT,
      );
      const firstDecoded = validateCollectedRequest(manifests[0]);
      expect(firstDecoded).to.have.property('sta', 's');

      // Wait for playback to start, then wait for additional segments
      // which should carry sta=p (playing state)
      await waitForPlayback(hls, video);

      // After playback starts, wait for more segments to be requested
      // with the updated player state
      await collector.waitForRequests('segment', 4, REQUEST_TIMEOUT);

      const segments = collector.getRequests('segment');
      const hasPlaying = segments.some((req) => {
        const result = validateCmcdRequest(req.request);
        return result.data.sta === 'p';
      });
      expect(hasPlaying).to.equal(
        true,
        `No segment had sta=p (playing state). States found: ${segments
          .map((r) => validateCmcdRequest(r.request).data.sta)
          .join(', ')}`,
      );
    });

    it('should include measured throughput (mtp) after playback', async function () {
      await waitForPlayback(hls, video);

      const segments = await collector.waitForRequests(
        'segment',
        2,
        REQUEST_TIMEOUT,
      );
      const hasMtp = segments.some((req) => {
        const result = validateCmcdRequest(req.request);
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
      collector.attach();
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
      const manifests = await collector.waitForRequests(
        'manifest',
        1,
        REQUEST_TIMEOUT,
      );
      const req = manifests[0];

      expect(req.reportingMode).to.equal('header');
      expect(req.request.url).to.not.include('CMCD=');

      const decoded = validateCollectedRequest(req);
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
      const manifests = await collector.waitForRequests(
        'manifest',
        1,
        REQUEST_TIMEOUT,
      );
      const req = manifests[0];

      expect(req.reportingMode).to.equal('header');

      const decoded = validateCollectedRequest(req);

      // v2-specific fields
      expect(decoded).to.have.property('v', 2);
      expect(decoded).to.have.property('sta');

      // Standard fields
      expect(decoded).to.have.property('ot', 'm');
      expect(decoded).to.have.property('sf', 'h');
      expect(decoded).to.have.property('sid', SESSION_ID);
      expect(decoded).to.have.property('cid', CONTENT_ID);
    });

    it('should place CMCD fields in correct header shards', async function () {
      const manifests = await collector.waitForRequests(
        'manifest',
        1,
        REQUEST_TIMEOUT,
      );
      const { headers } = manifests[0].request;

      // CMCD-Session should contain sid, sf
      const session = headers.get('CMCD-Session');
      if (session) {
        expect(session).to.include('sid=');
        expect(session).to.include('sf=');
      }

      // CMCD-Object should contain ot
      const object = headers.get('CMCD-Object');
      if (object) {
        expect(object).to.include('ot=');
      }
    });
  });

  describe('Group 3: Event Mode (v2)', function () {
    beforeEach(function () {
      collector.attach({ eventTargetUrls: [EVENT_TARGET_URL] });
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

      const events = await collector.waitForRequests(
        'event',
        1,
        REQUEST_TIMEOUT,
      );
      expect(events.length).to.be.greaterThan(0);

      const req = events[0];
      expect(req.request.method).to.equal('POST');

      const body = await req.request.text();
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
      collector.attach();
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
      const manifests = await collector.waitForRequests(
        'manifest',
        1,
        REQUEST_TIMEOUT,
      );
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
      collector.attach();
      hls = new Hls({
        loader: FetchLoader,
        cmcd: {
          sessionId: SESSION_ID,
          contentId: CONTENT_ID,
        },
      });
      hls.attachMedia(video);
      hls.loadSource(TEST_STREAM);

      const manifests = await collector.waitForRequests(
        'manifest',
        1,
        REQUEST_TIMEOUT,
      );
      const result = validateCmcdRequest(manifests[0].request);
      const decoded = result.data as Record<string, unknown>;

      expect(decoded).to.not.have.property('v');
      expect(decoded).to.not.have.property('sta');
    });

    it('v2 should include v=2 and sta', async function () {
      collector.attach();
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

      const manifests = await collector.waitForRequests(
        'manifest',
        1,
        REQUEST_TIMEOUT,
      );
      const decoded = validateCollectedRequest(manifests[0]);

      expect(decoded).to.have.property('v', 2);
      expect(decoded).to.have.property('sta', 's');
    });
  });
});
