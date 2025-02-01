/* eslint-disable dot-notation */
import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { State } from '../../../src/controller/base-stream-controller';
import { FragmentState } from '../../../src/controller/fragment-tracker';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import { Fragment } from '../../../src/loader/fragment';
import { LevelDetails } from '../../../src/loader/level-details';
import { LoadStats } from '../../../src/loader/load-stats';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { Level } from '../../../src/types/level';
import { PlaylistLevelType } from '../../../src/types/loader';
import { AttrList } from '../../../src/utils/attr-list';
import { mockFragments } from '../../mocks/data';
import type { FragmentTracker } from '../../../src/controller/fragment-tracker';
import type StreamController from '../../../src/controller/stream-controller';
import type { MediaFragment } from '../../../src/loader/fragment';
import type { ParsedMultivariantPlaylist } from '../../../src/loader/m3u8-parser';
import type { LevelAttributes } from '../../../src/types/level';

chai.use(sinonChai);
const expect = chai.expect;

describe('StreamController', function () {
  let fake;
  let hls: Hls;
  let fragmentTracker: FragmentTracker;
  let streamController: StreamController;
  const attrs: LevelAttributes = new AttrList({});

  beforeEach(function () {
    fake = sinon.useFakeXMLHttpRequest();
    hls = new Hls({
      // Enable debug to catch callback errors and enable logging in these tests:
      // debug: true,
      startFragPrefetch: true,
      enableWorker: false,
    });
    streamController = hls['streamController'];
    fragmentTracker = streamController['fragmentTracker'];
    streamController['startFragRequested'] = true;
  });

  this.afterEach(function () {
    fake.restore();
    hls.destroy();
  });

  const assertStreamControllerStarted = (streamController) => {
    expect(
      streamController.hasInterval(),
      `StreamController should be ticking. State: ${streamController.state}`,
    ).to.be.true;
    expect(streamController.state).to.equal(
      State.IDLE,
      "StreamController's state should not be STOPPED",
    );
  };

  const assertStreamControllerStopped = (streamController) => {
    expect(
      streamController.hasInterval(),
      `StreamController should be stopped. State: ${streamController.state}`,
    ).to.be.false;
    expect(streamController.state).to.equal(
      State.STOPPED,
      "StreamController's state should be STOPPED",
    );
  };

  const loadManifest = (manifest: string): ParsedMultivariantPlaylist => {
    const result = M3U8Parser.parseMasterPlaylist(
      manifest,
      'http://www.example.com',
    );
    const {
      contentSteering,
      levels,
      sessionData,
      sessionKeys,
      startTimeOffset,
      variableList,
    } = result;
    hls.trigger(Events.MANIFEST_LOADED, {
      levels,
      audioTracks: [],
      contentSteering,
      url: 'http://www.example.com',
      stats: new LoadStats(),
      networkDetails: {},
      sessionData,
      sessionKeys,
      startTimeOffset,
      variableList,
    });
    const playlistLoader = (hls as any).networkControllers[0];
    (playlistLoader as any).checkAutostartLoad();
    return result;
  };

  describe('StreamController', function () {
    it('should be STOPPED when it is initialized', function () {
      assertStreamControllerStopped(streamController);
    });

    it('should not start when controller does not have level data', function () {
      streamController.startLoad(1);
      assertStreamControllerStopped(streamController);
    });

    it('should start without level details', function () {
      loadManifest(`#EXTM3U
      #EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,RESOLUTION=848x360,NAME="480"
      http://proxy-62.dailymotion.com/sec(3ae40f708f79ca9471f52b86da76a3a8)/video/107/282/158282701_mp4_h264_aac_hq.m3u8#cell=core`);
      assertStreamControllerStarted(streamController);
      streamController.stopLoad();
      assertStreamControllerStopped(streamController);
    });

    it('should use EXT-X-START from Multivariant Playlist when not overridden by startPosition', function () {
      loadManifest(`#EXTM3U
  #EXT-X-START:TIME-OFFSET=130.5
  #EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,RESOLUTION=848x360,NAME="480"
  http://www.example.com/media.m3u8`);
      assertStreamControllerStarted(streamController);
      // Trigger Level Loaded
      const details = new LevelDetails('');
      details.live = false;
      details.totalduration = 200;
      details.fragments.push({} as any);
      hls.trigger(Events.LEVEL_LOADED, {
        details,
        id: 0,
        level: 0,
        networkDetails: {},
        stats: new LoadStats(),
        deliveryDirectives: null,
        levelInfo: new Level({
          name: '',
          url: '',
          attrs,
          bitrate: 500000,
        }),
      });
      expect(streamController['startPosition']).to.equal(130.5);
      expect(streamController['nextLoadPosition']).to.equal(130.5);
      expect(streamController['lastCurrentTime']).to.equal(130.5);
    });

    it('should use EXT-X-START from Multivariant Playlist when not overridden by startPosition with live playlists', function () {
      const result = loadManifest(`#EXTM3U
  #EXT-X-START:TIME-OFFSET=-12.0
  #EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=836280,RESOLUTION=848x360,NAME="480"
  http://www.example.com/media.m3u8`);
      const {
        contentSteering,
        levels,
        sessionData,
        sessionKeys,
        startTimeOffset,
        variableList,
      } = result;
      hls.trigger(Events.MANIFEST_LOADED, {
        levels,
        audioTracks: [],
        contentSteering,
        url: 'http://www.example.com',
        stats: new LoadStats(),
        networkDetails: {},
        sessionData,
        sessionKeys,
        startTimeOffset,
        variableList,
      });
      assertStreamControllerStarted(streamController);

      // Trigger Level Loaded
      const details = new LevelDetails('');
      details.live = true;
      details.totalduration = 30;
      details.fragments.push({ start: 0, end: details.totalduration } as any);
      hls.trigger(Events.LEVEL_LOADED, {
        details,
        id: 0,
        level: 0,
        networkDetails: {},
        stats: new LoadStats(),
        deliveryDirectives: null,
        levelInfo: new Level({
          name: '',
          url: '',
          attrs,
          bitrate: 500000,
        }),
      });
      expect(streamController['startPosition']).to.equal(18);
      expect(streamController['nextLoadPosition']).to.equal(18);
      expect(streamController['lastCurrentTime']).to.equal(18);
    });
  });

  describe('SN Searching', function () {
    const fragPrevious = new Fragment(
      PlaylistLevelType.MAIN,
      '',
    ) as MediaFragment;
    fragPrevious.programDateTime = 1505502671523;
    fragPrevious.duration = 5.0;
    fragPrevious.level = 1;
    fragPrevious.start = 10.0;
    fragPrevious.sn = 2; // Fragment with PDT 1505502671523 in level 1 does not have the same sn as in level 2 where cc is 1
    fragPrevious.cc = 0;

    const levelDetails = new LevelDetails('');

    const bufferEnd = fragPrevious.start + fragPrevious.duration;
    const end =
      mockFragments[mockFragments.length - 1].start +
      mockFragments[mockFragments.length - 1].duration;

    beforeEach(function () {
      streamController['fragPrevious'] = fragPrevious;
      levelDetails.live = false;
      levelDetails.startSN = mockFragments[0].sn;
      levelDetails.endSN = mockFragments[mockFragments.length - 1].sn;
      levelDetails.fragments = mockFragments;
      levelDetails.targetduration = mockFragments[0].duration;
      levelDetails.totalduration = mockFragments.reduce(
        (sum, frag) => sum + frag.duration,
        0,
      );
    });

    it('PTS search choosing wrong fragment (3 instead of 2) after level loaded', function () {
      const foundFragment = streamController['getNextFragment'](
        bufferEnd,
        levelDetails,
      );
      const resultSN = foundFragment ? foundFragment.sn : -1;
      expect(foundFragment).to.equal(
        mockFragments[3],
        'Expected sn 3, found sn segment ' + resultSN,
      );
    });

    it('PTS search choosing the right segment if fragPrevious is not available', function () {
      streamController['fragPrevious'] = null;
      const foundFragment = streamController['getNextFragment'](
        bufferEnd,
        levelDetails,
      );
      const resultSN = foundFragment ? foundFragment.sn : -1;
      expect(foundFragment).to.equal(
        mockFragments[3],
        'Expected sn 3, found sn segment ' + resultSN,
      );
    });

    it('returns the last fragment if the stream is fully buffered', function () {
      const actual = streamController['getNextFragment'](end, levelDetails);
      expect(actual).to.equal(mockFragments[mockFragments.length - 1]);
    });

    describe('getInitialLiveFragment', function () {
      let fragPrevious;

      beforeEach(function () {
        // onLevelUpdated updates  latencyController.levelDetails used to get live sync position
        hls['latencyController']['levelDetails'] = levelDetails;

        fragPrevious = new Fragment(PlaylistLevelType.MAIN, '');
        // Fragment with PDT 1505502681523 in level 1 does not have the same sn as in level 2 where cc is 1
        fragPrevious.cc = 0;
        fragPrevious.programDateTime = 1505502681523;
        fragPrevious.duration = 5.0;
        fragPrevious.level = 1;
        fragPrevious.start = 15.0;
        fragPrevious.sn = 3;
        streamController['fragPrevious'] = fragPrevious;

        levelDetails.PTSKnown = false;
        levelDetails.alignedSliding = false;
        levelDetails.live = true;
      });

      describe('with program-date-time', function () {
        it('does PDT search, choosing fragment after level loaded', function () {
          const foundFragment = streamController['getInitialLiveFragment'](
            levelDetails,
            mockFragments,
          );
          expect(foundFragment).to.equal(
            mockFragments[4],
            `Expected sn 4, found sn segment ${
              foundFragment ? foundFragment.sn : -1
            }`,
          );
        });
      });

      describe('without program-date-time', function () {
        const fragmentsWithoutPdt = mockFragments.map((frag) => {
          const newFragment = new Fragment(PlaylistLevelType.MAIN, '');
          return Object.assign(newFragment, frag, {
            programDateTime: null,
          });
        });

        beforeEach(function () {
          // For sn lookup, cc much match
          fragPrevious.cc = 1;

          levelDetails.PTSKnown = false;
          levelDetails.alignedSliding = false;
          levelDetails.live = true;
          levelDetails.startSN = fragmentsWithoutPdt[0].sn;
          levelDetails.endSN =
            fragmentsWithoutPdt[fragmentsWithoutPdt.length - 1].sn;
          levelDetails.fragments = fragmentsWithoutPdt;
          const latestLevelDetailsStub = sinon.stub(hls, 'latestLevelDetails');
          latestLevelDetailsStub.get(() => levelDetails);
        });

        it('finds the next fragment to load based on the last fragment buffered', function () {
          fragPrevious.sn = 0;
          let foundFragment = streamController['getInitialLiveFragment'](
            levelDetails,
            fragmentsWithoutPdt,
          );
          expect(foundFragment).to.equal(
            fragmentsWithoutPdt[1],
            `Expected sn 1, found sn segment ${
              foundFragment ? foundFragment.sn : -1
            }`,
          );

          fragPrevious.sn = 3;
          foundFragment = streamController['getInitialLiveFragment'](
            levelDetails,
            fragmentsWithoutPdt,
          );
          expect(foundFragment).to.equal(
            fragmentsWithoutPdt[4],
            `Expected sn 4, found sn segment ${
              foundFragment ? foundFragment.sn : -1
            }`,
          );
        });

        it('finds the first fragment to load when starting or re-syncing with a live stream', function () {
          streamController['fragPrevious'] = null;

          const foundFragment = streamController['getInitialLiveFragment'](
            levelDetails,
            fragmentsWithoutPdt,
          );
          expect(foundFragment).to.equal(
            fragmentsWithoutPdt[2],
            `Expected sn 2, found sn segment ${
              foundFragment ? foundFragment.sn : -1
            }`,
          );
        });

        it('finds the fragment with the same cc when there is no sn match', function () {
          fragPrevious.cc = 0;
          const foundFragment = streamController['getInitialLiveFragment'](
            levelDetails,
            fragmentsWithoutPdt,
          );
          expect(foundFragment).to.equal(
            fragmentsWithoutPdt[0],
            `Expected sn 0, found sn segment ${
              foundFragment ? foundFragment.sn : -1
            }`,
          );
        });

        it('returns null when there is no cc match with the previous segment', function () {
          fragPrevious.cc = 2;
          const foundFragment = streamController['getInitialLiveFragment'](
            levelDetails,
            fragmentsWithoutPdt,
          );
          expect(foundFragment).to.equal(null);
        });
      });
    });
  });

  describe('fragment loading', function () {
    function fragStateStub(state) {
      return sinon.stub(fragmentTracker, 'getState').callsFake(() => state);
    }

    let triggerSpy;
    let frag;
    let level;
    beforeEach(function () {
      streamController['levels'] = [
        new Level({
          name: '',
          url: '',
          attrs,
          bitrate: 500000,
        }),
      ];
      triggerSpy = sinon.spy(hls, 'trigger');
      frag = new Fragment(PlaylistLevelType.MAIN, '');
      frag.level = 0;
      frag.url = 'file';
      level = new Level({
        attrs: new AttrList({}),
        bitrate: 1,
        name: '',
        url: '',
      });
      level.details = new LevelDetails('');
      level.details.fragments.push(frag);
    });

    function assertLoadingState(frag) {
      expect(triggerSpy).to.have.been.calledWith(Events.FRAG_LOADING, {
        frag,
        targetBufferTime: 0,
      });
      expect(streamController.state).to.equal(State.FRAG_LOADING);
    }

    function assertNotLoadingState() {
      expect(triggerSpy).to.not.have.been.called;
      expect(streamController.state).to.not.equal(State.FRAG_LOADING);
    }

    it('should load a complete fragment which has not been previously appended', function () {
      fragStateStub(FragmentState.NOT_LOADED);
      streamController['loadFragment'](frag, level, 0);
      assertLoadingState(frag);
    });

    it('should not load a fragment which has completely & successfully loaded', function () {
      fragStateStub(FragmentState.OK);
      streamController['loadFragment'](frag, level, 0);
      assertNotLoadingState();
    });

    it('should not load a fragment while it is appending', function () {
      fragStateStub(FragmentState.APPENDING);
      streamController['loadFragment'](frag, level, 0);
      assertNotLoadingState();
    });
  });

  describe('seekToStartPos', function () {
    const sandbox = sinon.createSandbox();
    const bufStart = 5;

    beforeEach(function () {
      // @ts-ignore
      streamController.gapController = {
        poll: function () {},
        destroy: function () {},
      };
      streamController['media'] = {
        buffered: {
          start() {
            return bufStart;
          },
          end() {
            return bufStart;
          },
          length: 1,
        },
        currentTime: 0,
        readyState: 4,
      } as any as HTMLMediaElement;
      streamController['mediaBuffer'] = null;
    });
    afterEach(function () {
      sandbox.restore();
    });

    it('should seek to start pos when data is first loaded', function () {
      const firstFrag = new Fragment(
        PlaylistLevelType.MAIN,
        '',
      ) as MediaFragment;
      firstFrag.duration = 5.0;
      firstFrag.level = 1;
      firstFrag.start = 0;
      firstFrag.sn = 1;
      firstFrag.cc = 0;
      firstFrag.elementaryStreams.video = {
        startDTS: 0,
        startPTS: 0,
        endDTS: 5,
        endPTS: 5,
      };
      // @ts-ignore
      const seekStub = sandbox.stub(streamController, 'seekToStartPos');
      streamController['fragCurrent'] = streamController['fragPrevious'] =
        firstFrag;
      streamController['onFragBuffered'](Events.FRAG_BUFFERED, {
        stats: new LoadStats(),
        frag: firstFrag,
        part: null,
        id: 'main',
      });
      expect(seekStub).to.have.been.calledOnce;
    });

    describe('seekToStartPos', function () {
      it('should seek to startPosition when startPosition is not buffered & the media is not seeking', function () {
        streamController['startPosition'] = 5;
        streamController['seekToStartPos']();
        expect(streamController['media']!.currentTime).to.equal(5);
      });

      it('should not seek to startPosition when it is buffered', function () {
        streamController['startPosition'] = 5;
        streamController['media']!.currentTime = 5;
        streamController['seekToStartPos']();
        expect(streamController['media']!.currentTime).to.equal(5);
      });
    });

    describe('startLoad', function () {
      beforeEach(function () {
        hls.trigger(Events.LEVELS_UPDATED, {
          levels: [
            new Level({
              name: '',
              url: '',
              attrs,
              bitrate: 500000,
            }),
            new Level({
              name: '',
              url: '',
              attrs,
              bitrate: 250000,
            }),
            new Level({
              name: '',
              url: '',
              attrs,
              bitrate: 750000,
            }),
          ],
        });
        streamController['media'] = null;
      });
      it('should not start when controller does not have level data', function () {
        streamController['levels'] = null;
        streamController.startLoad(-1);
        assertStreamControllerStopped(streamController);
      });

      it('should start when controller has level data', function () {
        streamController.startLoad(5);
        assertStreamControllerStarted(streamController);
        expect(streamController['nextLoadPosition']).to.equal(5);
        expect(streamController['startPosition']).to.equal(5);
        expect(streamController['lastCurrentTime']).to.equal(5);
      });

      it('should set startPosition to lastCurrentTime if unset and lastCurrentTime > 0', function () {
        streamController['lastCurrentTime'] = 5;
        streamController.startLoad(-1);
        assertStreamControllerStarted(streamController);
        expect(streamController['nextLoadPosition']).to.equal(5);
        expect(streamController['startPosition']).to.equal(5);
        expect(streamController['lastCurrentTime']).to.equal(5);
      });

      it('should set startPosition when passed as an argument', function () {
        streamController.startLoad(123);
        assertStreamControllerStarted(streamController);
        expect(streamController['nextLoadPosition']).to.equal(123);
        expect(streamController['startPosition']).to.equal(123);
        expect(streamController['lastCurrentTime']).to.equal(123);
      });

      it('should set startPosition to -1 when passed as an argument', function () {
        streamController.startLoad(-1);
        assertStreamControllerStarted(streamController);
        expect(streamController['nextLoadPosition']).to.equal(-1);
        expect(streamController['startPosition']).to.equal(-1);
        expect(streamController['lastCurrentTime']).to.equal(-1);
      });

      it('sets up for a bandwidth test if starting at auto', function () {
        streamController['startFragRequested'] = false;
        hls.startLevel = -1;

        streamController.startLoad(-1);
        expect(streamController['level']).to.equal(0);
        expect(streamController['bitrateTest']).to.be.true;
      });

      it('should not signal a bandwidth test if config.testBandwidth is false', function () {
        streamController['startFragRequested'] = false;
        hls.startLevel = -1;
        hls.nextAutoLevel = 2;
        hls.config.testBandwidth = false;

        streamController.startLoad(-1);
        expect(streamController['level']).to.equal(2);
        expect(streamController['bitrateTest']).to.be.false;
      });

      it('should not signal a bandwidth test with only one level', function () {
        streamController['startFragRequested'] = false;
        hls.trigger(Events.LEVELS_UPDATED, {
          levels: [
            new Level({
              name: '',
              url: '',
              attrs,
              bitrate: 250000,
            }),
          ],
        });
        hls.startLevel = -1;

        streamController.startLoad(-1);
        expect(streamController['level']).to.equal(hls.nextAutoLevel);
        expect(streamController['bitrateTest']).to.be.false;
      });
    });
  });
});
