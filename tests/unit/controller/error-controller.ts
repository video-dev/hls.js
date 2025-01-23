import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { multivariantPlaylistWithRedundantFallbacks } from './level-controller';
import { ErrorDetails, ErrorTypes } from '../../../src/errors';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import type {
  ErrorData,
  FragLoadedData,
  LevelSwitchingData,
} from '../../../src/types/events';

chai.use(sinonChai);
const expect = chai.expect;

describe('ErrorController Integration Tests', function () {
  let server: sinon.SinonFakeServer;
  let timers: sinon.SinonFakeTimers;
  let hls: Hls;

  beforeEach(function () {
    server = sinon.fakeServer.create();
    setupMockServerResponses(server);
    timers = sinon.useFakeTimers({ shouldClearNativeTimers: true } as any);

    hls = new Hls({
      // Enable debug to catch callback errors and enable logging in these tests:
      // debug: true,
      startFragPrefetch: true,
      enableWorker: false,
      testBandwidth: false,
    });
    sinon.spy(hls, 'stopLoad');
    sinon.spy(hls, 'trigger');
  });

  afterEach(function () {
    server.restore();
    timers.restore();
    hls.destroy();
  });

  describe('Multivariant Playlist Error Handling', function () {
    it('Manifest Parsing Errors are fatal and stop all network operations', function () {
      hls.loadSource('noEXTM3U.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.MANIFEST_LOADED, (event, data) =>
          reject(
            new Error(
              'Manifest Loaded should not be triggered when manifest parsing fails',
            ),
          ),
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.MANIFEST_PARSING_ERROR,
          'no EXTM3U delimiter',
        ),
      );
    });

    it('Manifest Parsing Errors (no variants) are fatal and stop all network operations', function () {
      hls.loadSource('noLevels.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.MANIFEST_LOADED, (event, data) =>
          reject(
            new Error(
              'Manifest Loaded should not be triggered when manifest parsing fails',
            ),
          ),
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.MANIFEST_PARSING_ERROR,
          'no levels found in manifest',
        ),
      );
    });

    it('Manifest Parsing Errors (Variable Substitution) are fatal and stop all network operations', function () {
      hls.loadSource('varSubErrorMultivariantPlaylist.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.MANIFEST_LOADED, (event, data) =>
          reject(
            new Error(
              'Manifest Loaded should not be triggered when manifest parsing fails',
            ),
          ),
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.MANIFEST_PARSING_ERROR,
          'Missing preceding EXT-X-DEFINE tag for Variable Reference: "foobar"',
        ),
      );
    });

    it('Manifest Incompatible Codecs Errors are fatal and stop all network operations', function () {
      hls.loadSource('noCompatCodecs.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.MANIFEST_PARSED, (event, data) =>
          reject(
            new Error(
              'Manifest Parsed should not be triggered when manifest parsing fails',
            ),
          ),
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR,
          'no level with compatible codecs found in manifest',
        ),
      );
    });

    it('Manifest HTTP 4XX Load Errors are fatal and stop all network operations', function () {
      server.respondWith('http400.m3u8', [400, {}, ``]);
      hls.loadSource('http400.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.MANIFEST_PARSED, (event, data) =>
          reject(
            new Error(
              'Manifest Parsed should not be triggered when manifest parsing fails',
            ),
          ),
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.MANIFEST_LOAD_ERROR,
          'A network error (status 400) occurred while loading manifest',
        ),
      );
    });

    it('Manifest HTTP status 501 and >= 505 Errors fail silently until exhausting all retries then are fatal', function () {
      server.respondWith('http500.m3u8', [501, {}, ``]);
      hls.loadSource('http500.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.MANIFEST_PARSED, (event, data) =>
          reject(
            new Error(
              'Manifest Parsed should not be triggered when manifest parsing fails',
            ),
          ),
        );
        server.respond();
        timers.tick(1000);
        server.respond();
      })
        .then((data) => {
          expect(server.requests.length).to.equal(2);
          server.requests[0].should.have
            .property('url')
            .which.equals('http500.m3u8');
          server.requests[0].should.have.property('status').which.equals(501);
          server.requests[1].should.have
            .property('url')
            .which.equals('http500.m3u8');
          server.requests[1].should.have.property('status').which.equals(501);
          return data;
        })
        .then(
          expectFatalErrorEventToStopPlayer(
            hls,
            ErrorDetails.MANIFEST_LOAD_ERROR,
            'A network error (status 501) occurred while loading manifest',
          ),
        );
    });

    it('Manifest Load Timeout Errors are fatal and stop all network operations', function () {
      hls.loadSource('timeout.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.MANIFEST_PARSED, (event, data) =>
          reject(
            new Error(
              'Manifest Parsed should not be triggered when manifest parsing fails',
            ),
          ),
        );
        // tick 3 times to trigger 2 retries and then an error
        timers.tick(hls.config.manifestLoadPolicy.default.maxLoadTimeMs + 1);
        timers.tick(hls.config.manifestLoadPolicy.default.maxLoadTimeMs + 1);
        timers.tick(hls.config.manifestLoadPolicy.default.maxLoadTimeMs);
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.MANIFEST_LOAD_TIMEOUT,
          'A network timeout occurred while loading manifest',
        ),
      );
    });
  });

  describe('Variant Media Playlist (no Multivariant Loaded) Error Handling', function () {
    it('Level Parsing Errors (Variable Substitution) are escalated to fatal when no switch options are present', function () {
      hls.loadSource('varSubErrorMediaPlaylist.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.LEVEL_LOADED, () =>
          reject(
            new Error(
              'Level Loaded should not be triggered when playlist parsing fails',
            ),
          ),
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.LEVEL_PARSING_ERROR,
          'Missing preceding EXT-X-DEFINE tag for Variable Reference: "foobar"',
        ),
      );
    });

    it('Level Parsing Errors (Missing Target Duration) are escalated to fatal when no switch options are present', function () {
      hls.loadSource('noTargetDuration.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.LEVEL_LOADED, () =>
          reject(
            new Error(
              'Level Loaded should not be triggered when playlist parsing fails',
            ),
          ),
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.LEVEL_PARSING_ERROR,
          'Missing Target Duration',
        ),
      );
    });

    it('Level Empty Errors (No Segments) are escalated to fatal when no switch options are present and Playlist is VOD', function () {
      hls.loadSource('noSegmentsVod.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) =>
          Promise.resolve().then(() => resolve(data)),
        );
        hls.on(Events.LEVEL_LOADED, () =>
          reject(
            new Error(
              'Level Loaded should not be triggered when playlist parsing fails',
            ),
          ),
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.LEVEL_EMPTY_ERROR,
          'No Segments found in Playlist',
        ),
      );
    });

    it('Level Empty Errors (No Segments) are not fatal when Playlist with no switch options is Live', function () {
      hls.loadSource('noSegmentsLive.m3u8');
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.LEVEL_LOADED, () =>
          reject(
            new Error(
              'Level Loaded should not be triggered when playlist parsing fails',
            ),
          ),
        );
        server.respond();
      }).then((data: ErrorData) => {
        expect(data.details).to.equal(ErrorDetails.LEVEL_EMPTY_ERROR);
        expect(data.fatal).to.equal(false, 'Error should not be fatal');
        expect(data.error.message).to.equal(
          'No Segments found in Playlist',
          data.error.message,
        );
        hls.stopLoad.should.have.been.calledOnce;
        hls.trigger.should.not.have.been.calledWith(Events.LEVEL_LOADED);
        server.respondWith(
          'noSegmentsLive.m3u8',
          testResponses['oneSegmentLive.m3u8'],
        );
        timers.tick(6000);
        server.respond();
        hls.trigger.should.have.been.calledWith(Events.LEVEL_LOADED);
      });
    });
  });

  describe('Multivariant Media Playlist Error Handling', function () {
    it('Level Parsing Errors (Missing Target Duration) are not fatal when switch options are present', function () {
      hls.loadSource('multivariantPlaylist.m3u8');
      let errorIndex = -1;
      hls.once(Events.LEVEL_LOADING, (event, data) => {
        errorIndex = data.level;
        server.respondWith(data.url, testResponses['noTargetDuration.m3u8']);
      });
      hls.on(Events.LEVEL_LOADING, loadingEventCallback(server, timers));
      return new Promise((resolve) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        server.respond();
      })
        .then((data: ErrorData) => {
          expect(data.details).to.equal(ErrorDetails.LEVEL_PARSING_ERROR);
          expect(data.fatal).to.equal(false, 'Error should not be fatal');
          expect(data.error.message).to.equal(
            'Missing Target Duration',
            data.error.message,
          );
          hls.stopLoad.should.have.been.calledOnce;
          timers.tick(100);
          return Promise.resolve();
        })
        .then(() => {
          hls.trigger.should.have.been.calledWith(Events.LEVEL_LOADED);
          expect(hls.currentLevel).to.not.equal(
            errorIndex,
            'Should not be on errored level',
          );
        });
    });

    it('Level HTTP 4XX Load Errors are not fatal when switch options are present', function () {
      hls.loadSource('multivariantPlaylist.m3u8');
      let errorIndex = -1;
      hls.once(Events.LEVEL_LOADING, (event, data) => {
        errorIndex = data.level;
        server.respondWith(data.url, [400, {}, '']);
      });
      hls.on(Events.LEVEL_LOADING, loadingEventCallback(server, timers));
      return new Promise((resolve) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        server.respond();
      }).then((data: ErrorData) => {
        expect(data.details).to.equal(ErrorDetails.LEVEL_LOAD_ERROR);
        expect(data.fatal).to.equal(false, 'Error should not be fatal');
        expect(data.error.message).to.equal(
          'A network error (status 400) occurred while loading level: 2 id: 0',
          data.error.message,
        );
        hls.stopLoad.should.have.been.calledOnce;
        hls.trigger.should.have.been.calledWith(Events.LEVEL_LOADED);
        expect(hls.currentLevel).to.not.equal(
          errorIndex,
          'Should not be on errored level',
        );
      });
    });

    it('Level Load Timeout Errors are not fatal when switch options are present', function () {
      hls.loadSource('multivariantPlaylist.m3u8');
      let errorIndex = -1;
      hls.once(Events.LEVEL_LOADING, (event, data) => {
        errorIndex = data.level;
      });
      return new Promise((resolve) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        server.respond();
        timers.tick(20000);
      }).then((data: ErrorData) => {
        expect(data.details).to.equal(ErrorDetails.LEVEL_LOAD_TIMEOUT);
        expect(data.fatal).to.equal(false, 'Error should not be fatal');
        expect(data.error.message).to.equal(
          'A network timeout occurred while loading level: 2 id: 0',
          data.error.message,
        );
        server.respond();
        hls.stopLoad.should.have.been.calledOnce;
        hls.trigger.should.have.been.calledWith(Events.LEVEL_LOADED);
        expect(hls.currentLevel).to.not.equal(
          errorIndex,
          'Should not be on errored level',
        );
      });
    });
  });

  describe('Segment Error Handling', function () {
    it('Fragment HTTP Load Errors retry fragLoadPolicy `errorRetry.maxNumRetry` times before switching down and continues until no lower levels are available', function () {
      server.respondWith('multivariantPlaylist.m3u8/segment.mp4', [
        500,
        {},
        new ArrayBuffer(0),
      ]);
      hls.loadSource('multivariantPlaylist.m3u8');
      hls.on(Events.LEVEL_LOADING, loadingEventCallback(server, timers));
      hls.on(Events.FRAG_LOADING, loadingEventCallback(server, timers));
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => {
          if (data.fatal) {
            resolve(data);
          } else {
            timers.tick(
              hls.config.fragLoadPolicy.default.errorRetry!.maxRetryDelayMs,
            );
          }
        });
        hls.on(Events.FRAG_LOADED, (event, data) =>
          reject(
            new Error(
              'Frag Loaded should not be triggered when frag loading fails',
            ),
          ),
        );
        server.respond();
      }).then((errorData: ErrorData) => {
        expect(server.requests).to.have.lengthOf(13);
        const finalAssertion = expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.FRAG_LOAD_ERROR,
          'HTTP Error 500 Internal Server Error',
        );
        finalAssertion(errorData);
      });
    });

    it('Fragment Timout Errors retry within a tick fragLoadPolicy `timeoutRetry.maxNumRetry` times before switching down and continues no lower levels are available', function () {
      server.respondWith('multivariantPlaylist.m3u8/segment.mp4', [
        400,
        {},
        new ArrayBuffer(0),
      ]);
      hls.loadSource('multivariantPlaylist.m3u8');
      hls.on(Events.LEVEL_LOADING, (event, data) => {
        server.respond();
      });
      hls.on(Events.FRAG_LOADING, (event, data) => {
        timers.tick(hls.config.fragLoadPolicy.default.maxTimeToFirstByteMs);
      });
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => {
          if (data.fatal) {
            resolve(data);
          } else {
            timers.tick(100);
          }
        });
        hls.on(Events.FRAG_LOADED, (event, data) =>
          reject(
            new Error(
              'Frag Loaded should not be triggered when frag loading fails',
            ),
          ),
        );
        server.respond();
      }).then((errorData: ErrorData) => {
        expect(server.requests).to.have.lengthOf(11);
        const finalAssertion = expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.FRAG_LOAD_TIMEOUT,
          'Timeout after 10000ms',
        );
        finalAssertion(errorData);
      });
    });

    it('Init segment decrypt errors are fatal with no alternates after retries', function () {
      server.respondWith(
        'aes-128-init-segment.m3u8',
        `#EXTM3U
#EXT-X-VERSION:1
#EXT-X-TARGETDURATION:6
#EXT-X-KEY:METHOD=AES-128,URI="bad.key",IV=0x0000000000
#EXT-X-MAP:URI="init.mp4"
#EXTINF:6
segment.mp4
#EXT-X-ENDLIST`,
      );
      server.respondWith('aes-128-init-segment.m3u8/bad.key', [
        200,
        {},
        new ArrayBuffer(16),
      ]);
      server.respondWith('aes-128-init-segment.m3u8/init.mp4', [
        200,
        {},
        new ArrayBuffer(1024),
      ]);
      server.respondWith('aes-128-init-segment.m3u8/segment.mp4', [
        200,
        {},
        new ArrayBuffer(1024),
      ]);
      hls.config.fragLoadPolicy.default.errorRetry!.maxNumRetry = 1;
      hls.loadSource('aes-128-init-segment.m3u8');
      hls.on(Events.KEY_LOADING, loadingEventCallback(server, timers));
      hls.on(Events.LEVEL_LOADING, loadingEventCallback(server, timers));
      hls.on(Events.FRAG_LOADING, loadingEventCallback(server, timers));
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => {
          if (data.fatal) {
            resolve(data);
          } else {
            timers.tick(2000);
          }
        });
        hls.on(Events.FRAG_DECRYPTED, (event, data) =>
          reject(
            new Error(
              'Frag Decrypted should not be triggered when frag decryption fails',
            ),
          ),
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.FRAG_DECRYPT_ERROR,
          'Offset is outside the bounds of the DataView',
        ),
      );
    });
  });

  describe('Transmuxer Error Handling', function () {
    it('Fragment parsing errors are fatal with no alternates after retries', function () {
      server.respondWith('oneSegmentVod-mp2ts.m3u8/segment.ts', [
        200,
        {},
        new ArrayBuffer(188 * 5),
      ]);
      hls.config.fragLoadPolicy.default.errorRetry!.maxNumRetry = 2;
      hls.loadSource('oneSegmentVod-mp2ts.m3u8');
      hls.on(Events.LEVEL_LOADING, loadingEventCallback(server, timers));
      hls.on(Events.FRAG_LOADING, loadingEventCallback(server, timers));
      let errorCount = 0;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => {
          errorCount++;
          if (errorCount === 3 && data.fatal) {
            resolve(data);
          } else if (data.fatal) {
            reject(
              new Error(
                `Error fatal before retries exhausted: "${data.error.message}"`,
              ),
            );
          } else {
            timers.tick(8000);
          }
        });
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.FRAG_PARSING_ERROR,
          'Failed to find demuxer by probing fragment data',
        ),
      );
    });

    it('Remux Allocation Errors are not fatal when switch options are present', function () {
      hls.loadSource('multivariantPlaylist.m3u8');
      let errorIndex = -1;
      hls.on(Events.LEVEL_LOADING, (event, data) => {
        server.respond();
      });
      hls.once(Events.LEVEL_LOADED, (event, data) => {
        hls.trigger(Events.ERROR, {
          type: ErrorTypes.MUX_ERROR,
          details: ErrorDetails.REMUX_ALLOC_ERROR,
          fatal: false,
          bytes: 999999999999,
          error: new Error('OOM Error'),
          reason: `fail allocating video mdat ${999999999999}`,
        });
        errorIndex = data.level;
      });
      return new Promise((resolve) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        server.respond();
        timers.tick(5000);
      }).then((data: ErrorData) => {
        expect(data.details).to.equal(ErrorDetails.REMUX_ALLOC_ERROR);
        expect(data.fatal).to.equal(false, 'Error should not be fatal');
        expect(data.error.message).to.equal('OOM Error');
        server.respond();
        hls.stopLoad.should.have.been.calledOnce;
        hls.trigger.should.have.been.calledWith(Events.LEVEL_LOADED);
        expect(hls.currentLevel).to.not.equal(
          errorIndex,
          'Should not be on errored level',
        );
      });
    });
  });

  describe('Key-System Error Handling', function () {
    it('handles Key-System Output Restricted Errors by setting hls.maxHdcpLevel', function () {
      hls.loadSource('multivariantPlaylist-HDCP-LEVEL.m3u8');
      hls.startLevel = 2;
      expect(hls.maxHdcpLevel).to.equal(null);
      let errorIndex = -1;
      hls.on(Events.LEVEL_LOADING, (event, data) => {
        server.respond();
      });
      hls.once(Events.LEVEL_LOADED, (event, data) => {
        hls.trigger(Events.ERROR, {
          type: ErrorTypes.KEY_SYSTEM_ERROR,
          details: ErrorDetails.KEY_SYSTEM_STATUS_OUTPUT_RESTRICTED,
          fatal: false,
          error: new Error('HDCP level output restricted'),
        });
        errorIndex = data.level;
      });
      return new Promise((resolve) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        server.respond();
        timers.tick(5000);
      }).then((data: ErrorData) => {
        expect(data.details).to.equal(
          ErrorDetails.KEY_SYSTEM_STATUS_OUTPUT_RESTRICTED,
        );
        expect(data.fatal).to.equal(false, 'Error should not be fatal');
        expect(data.error.message).to.equal('HDCP level output restricted');
        hls.stopLoad.should.have.been.calledOnce;
        hls.trigger.should.have.been.calledWith(Events.LEVEL_LOADED);
        expect(hls.maxHdcpLevel).to.equal('TYPE-0');
        expect(hls.currentLevel).to.not.equal(
          errorIndex,
          'Should not be on errored level',
        );
      });
    });
  });

  describe('Redundant Stream Error Handling', function () {
    it('switches to fallback variants after fragLoadPolicy `errorRetry.maxNumRetry` segment errors in level', function () {
      const errors: ErrorData[] = [];
      // All segments from foo and bar fail, baz succeeds
      const fakeMP2TS = new ArrayBuffer(188 * 3);
      const view = new Uint8Array(fakeMP2TS);
      view[0] = view[188] = view[376] = 0x47;
      server.respondWith(
        /http:\/\/www\.(foo|bar|baz)\.com\/tier.+\.m3u8/,
        testResponses['oneSegmentVod.m3u8'].replace(
          'segment.mp4',
          'video-segment.mp4',
        ),
      );
      server.respondWith(
        /http:\/\/www\.(foo|bar|baz)\.com\/audio.+\.m3u8/,
        testResponses['oneSegmentVod.m3u8'].replace(
          'segment.mp4',
          'audio-segment.mp4',
        ),
      );
      server.respondWith(
        /http:\/\/www\.(foo|bar|baz)\.com\/subs.+\.m3u8/,
        testResponses['oneSegmentVod.m3u8'].replace(
          'segment.mp4',
          'subs-segment.mp4',
        ),
      );
      server.respondWith(
        /http:\/\/www\.(foo|bar)\.com\/(video|audio)-segment.mp4/,
        [500, {}, new ArrayBuffer(0)],
      );
      server.respondWith(/http:\/\/www\.baz\.com\/audio-segment.mp4/, [
        200,
        {},
        fakeMP2TS,
      ]);
      server.respondWith(/http:\/\/www\.baz\.com\/subs-segment.mp4/, [
        200,
        {},
        '',
      ]);
      server.respondWith(/http:\/\/www\.baz\.com\/.+segment.mp4/, [
        200,
        {},
        fakeMP2TS,
      ]);
      hls.config.fragLoadPolicy.default.errorRetry!.maxNumRetry = 1;
      hls.loadSource('multivariantRedundantFallbacks.m3u8');
      hls.on(Events.LEVEL_LOADING, loadingEventCallback(server, timers));
      hls.on(Events.AUDIO_TRACK_LOADING, loadingEventCallback(server, timers));
      hls.on(
        Events.SUBTITLE_TRACK_LOADING,
        loadingEventCallback(server, timers),
      );
      hls.on(Events.FRAG_LOADING, loadingEventCallback(server, timers));
      hls.on(Events.ERROR, (event, data) => {
        errors.push(data);
        Promise.resolve().then(() => timers.tick(2000));
      });
      return new Promise((resolve, reject) => {
        hls.on(Events.LEVEL_SWITCHING, (event, data) => {
          if (data.uri.startsWith('http://www.bar.com/')) {
            resolve(data);
          }
        });
        server.respond();
      })
        .then((data: LevelSwitchingData) => {
          expect(
            errors,
            'fragment errors after yeilding to first error event',
          ).to.have.lengthOf(2);
          expect(hls.levels[0].uri).to.equal('http://www.bar.com/tier6.m3u8');
          return new Promise((resolve, reject) => {
            hls.on(Events.LEVEL_SWITCHING, (event, data) => {
              if (data.uri.startsWith('http://www.baz.com/')) {
                resolve(data);
              }
            });
          });
        })
        .then((data: LevelSwitchingData) => {
          expect(
            errors,
            'fragment errors after yeilding to second error event',
          ).to.have.lengthOf(8);
          expect(hls.levels[0].uri).to.equal('http://www.baz.com/tier6.m3u8');
          return new Promise((resolve, reject) => {
            hls.on(Events.FRAG_LOADED, (event, data) => {
              resolve(data);
            });
            hls.on(Events.ERROR, (event, data) => {
              reject(
                new Error(`Unexpected error after fallback: ${data.error}`),
              );
            });
          });
        })
        .then((data: FragLoadedData) => {
          expect(errors[errors.length - 1].fatal).to.equal(
            false,
            'Error should not be fatal',
          );
          expect(data.frag.url).to.equal(
            'http://www.baz.com/video-segment.mp4',
          );
        });
    });

    it('switches to fallback variants after media track error', function () {
      const errors: ErrorData[] = [];
      // All segments from foo and bar fail, baz succeeds
      const fakeMP2TS = new ArrayBuffer(188 * 3);
      const view = new Uint8Array(fakeMP2TS);
      view[0] = view[188] = view[376] = 0x47;
      server.respondWith(
        /http:\/\/www\.(foo|bar|baz)\.com\/tier.+\.m3u8/,
        testResponses['oneSegmentVod.m3u8'].replace(
          'segment.mp4',
          'video-segment.mp4',
        ),
      );
      server.respondWith(
        /http:\/\/www\.(foo|bar|baz)\.com\/audio.+\.m3u8/,
        testResponses['oneSegmentVod.m3u8'].replace(
          'segment.mp4',
          'audio-segment.mp4',
        ),
      );
      server.respondWith(
        /http:\/\/www\.(foo|bar|baz)\.com\/subs.+\.m3u8/,
        testResponses['oneSegmentVod.m3u8'].replace(
          'segment.mp4',
          'subs-segment.mp4',
        ),
      );
      server.respondWith(/http:\/\/www\.(foo|bar)\.com\/audio-segment.mp4/, [
        500,
        {},
        new ArrayBuffer(0),
      ]);
      server.respondWith(/http:\/\/www\.baz\.com\/video-segment.mp4/, [
        200,
        {},
        fakeMP2TS,
      ]);
      server.respondWith(/http:\/\/www\.baz\.com\/subs-segment.mp4/, [
        200,
        {},
        '',
      ]);
      server.respondWith(/http:\/\/www\.baz\.com\/.+segment.mp4/, [
        200,
        {},
        fakeMP2TS,
      ]);
      hls.config.fragLoadPolicy.default.errorRetry!.maxNumRetry = 1;
      hls.loadSource('multivariantRedundantFallbacks.m3u8');
      hls.on(Events.LEVEL_LOADING, loadingEventCallback(server, timers));
      hls.on(Events.AUDIO_TRACK_LOADING, loadingEventCallback(server, timers));
      hls.on(
        Events.SUBTITLE_TRACK_LOADING,
        loadingEventCallback(server, timers),
      );
      hls.on(Events.FRAG_LOADING, loadingEventCallback(server, timers));
      hls.on(Events.ERROR, (event, data) => {
        errors.push(data);
        Promise.resolve().then(() => timers.tick(2000));
      });
      return new Promise((resolve, reject) => {
        hls.on(Events.LEVEL_SWITCHING, (event, data) => {
          if (data.uri.startsWith('http://www.bar.com/')) {
            resolve(data);
          }
        });
        server.respond();
      })
        .then((data: LevelSwitchingData) => {
          expect(
            errors,
            'fragment errors after yeilding to first error event',
          ).to.have.lengthOf(2);
          expect(hls.levels[0].uri).to.equal('http://www.bar.com/tier6.m3u8');
          return new Promise((resolve, reject) => {
            hls.on(Events.LEVEL_SWITCHING, (event, data) => {
              if (data.uri.startsWith('http://www.baz.com/')) {
                resolve(data);
              }
            });
          });
        })
        .then((data: LevelSwitchingData) => {
          expect(
            errors,
            'fragment errors after yeilding to second error event',
          ).to.have.lengthOf(7);
          expect(hls.levels[0].uri).to.equal('http://www.baz.com/tier6.m3u8');
          return new Promise((resolve, reject) => {
            hls.on(Events.FRAG_LOADED, (event, data) => {
              resolve(data);
            });
            hls.on(Events.ERROR, (event, data) => {
              reject(new Error('Unexpected error after fallback'));
            });
          });
        })
        .then((data: FragLoadedData) => {
          expect(errors[errors.length - 1].fatal).to.equal(
            false,
            'Error should not be fatal',
          );
          expect(data.frag.url).to.equal(
            'http://www.baz.com/video-segment.mp4',
          );
        });
    });
  });
});

const testResponses = {
  'noEXTM3U.m3u8': '#EXT_NOT_HLS',

  'noLevels.m3u8': '#EXTM3U',

  'noCompatCodecs.m3u8': `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=100000,CODECS="avc9.000000,mp5a.40.2,av99.000000",RESOLUTION=480x270
noop.m3u8`,

  'varSubErrorMultivariantPlaylist.m3u8': `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=100000,RESOLUTION=480x270
variant{$foobar}.m3u8`,

  'multivariantPlaylist.m3u8': `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=200000,RESOLUTION=1280x720
mid.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=100000,RESOLUTION=480x270
low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=300000,RESOLUTION=1920x1080
high.m3u8`,

  'multivariantPlaylist-HDCP-LEVEL.m3u8': `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=200000,HDCP-LEVEL=TYPE-0,RESOLUTION=1280x720
mid.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=100000,HDCP-LEVEL=NONE,RESOLUTION=480x270
low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=300000,HDCP-LEVEL=TYPE-1,RESOLUTION=1920x1080
high.m3u8`,

  'multivariantRedundantFallbacks.m3u8':
    multivariantPlaylistWithRedundantFallbacks,

  'varSubErrorMediaPlaylist.m3u8': `#EXTM3U
#EXT-X-VERSION:10
#EXT-X-TARGETDURATION:6
#EXTINF:6
segment{$foobar}.mp4`,

  'noTargetDuration.m3u8': `#EXTM3U
#EXT-X-VERSION:1
#EXTINF:6
segment.mp4`,

  'noSegmentsVod.m3u8': `#EXTM3U
#EXT-X-VERSION:1
#EXT-X-TARGETDURATION:6
#EXT-X-ENDLIST`,

  'noSegmentsLive.m3u8': `#EXTM3U
#EXT-X-VERSION:1
#EXT-X-TARGETDURATION:6`,

  'oneSegmentLive.m3u8': `#EXTM3U
#EXT-X-VERSION:1
#EXT-X-TARGETDURATION:6
#EXTINF:6
segment.mp4`,

  'oneSegmentVod.m3u8': `#EXTM3U
#EXT-X-VERSION:1
#EXT-X-TARGETDURATION:6
#EXTINF:6
segment.mp4
#EXT-X-ENDLIST`,

  'oneSegmentVod-mp2ts.m3u8': `#EXTM3U
#EXT-X-VERSION:1
#EXT-X-TARGETDURATION:6
#EXTINF:6
segment.ts
#EXT-X-ENDLIST`,
};

function setupMockServerResponses(server: sinon.SinonFakeServer) {
  Object.keys(testResponses).forEach((requestUrl) => {
    server.respondWith(requestUrl, [200, {}, testResponses[requestUrl]]);
  });
  server.respondWith(
    /multivariantPlaylist.*\/low.m3u8/,
    testResponses['oneSegmentVod.m3u8'],
  );
  server.respondWith(
    /multivariantPlaylist.*\/mid.m3u8/,
    testResponses['oneSegmentVod.m3u8'],
  );
  server.respondWith(
    /multivariantPlaylist.*\/high.m3u8/,
    testResponses['oneSegmentVod.m3u8'],
  );
}

function loadingEventCallback(server, timers) {
  return (event, data) => {
    Promise.resolve().then(() => {
      server.respond();
    });
  };
}

function expectFatalErrorEventToStopPlayer(
  hls: Hls,
  withErrorDetails: ErrorDetails,
  withErrorMessage: string,
) {
  return (data: ErrorData) => {
    expect(data.details).to.equal(withErrorDetails);
    expect(data.fatal).to.equal(true, 'Error should be fatal');
    expect(data.error.message).to.equal(withErrorMessage, data.error.message);
    expectPlayerStopped(hls);
    hls.stopLoad.should.have.been.calledTwice;
  };
}

function expectPlayerStopped(hlsPrivate: any) {
  hlsPrivate.networkControllers.forEach((controller) => {
    // All stream-controllers are stopped
    if ('state' in controller) {
      expect(controller.state, `${controller.constructor.name}.state`).to.equal(
        'STOPPED',
      );
    }
    // All loaders controllers have destroyed their loaders
    if ('loaders' in controller) {
      expect(controller.loaders, `${controller.constructor.name}.loaders`).to.be
        .empty;
    }
    // All playlist-controllers (level-, track-) have stopped loading
    if ('canLoad' in controller) {
      expect(controller.canLoad, `${controller.constructor.name}.canLoad`).to.be
        .false;
    }
  });
}
