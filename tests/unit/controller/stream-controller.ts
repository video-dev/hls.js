/* eslint-disable dot-notation */
import chai from 'chai';
import { fakeXhr } from 'nise';
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
import { mockFragments as mockFragmentArray } from '../../mocks/data';
import { TimeRangesMock } from '../../mocks/time-ranges.mock';
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
  const mockFragments = mockFragmentArray as MediaFragment[];

  beforeEach(function () {
    fake = fakeXhr.useFakeXMLHttpRequest();
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
      networkDetails: new Response('ok'),
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
        networkDetails: new Response('ok'),
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
        networkDetails: new Response('ok'),
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
        networkDetails: new Response('ok'),
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
    fragPrevious.setStart(10.0);
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
        fragPrevious = new Fragment(PlaylistLevelType.MAIN, '');
        // Fragment with PDT 1505502681523 in level 1 does not have the same sn as in level 2 where cc is 1
        fragPrevious.cc = 0;
        fragPrevious.programDateTime = 1505502681523;
        fragPrevious.duration = 5.0;
        fragPrevious.level = 1;
        fragPrevious.setStart(15.0);
        fragPrevious.sn = 3;
        streamController['fragPrevious'] = fragPrevious;

        levelDetails.PTSKnown = false;
        levelDetails.alignedSliding = false;
        levelDetails.live = true;
      });

      describe('with program-date-time', function () {
        it('does PDT search, choosing fragment after level loaded', function () {
          const foundFragment =
            streamController['getInitialLiveFragment'](levelDetails);
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
          let foundFragment =
            streamController['getInitialLiveFragment'](levelDetails);
          expect(foundFragment).to.equal(
            fragmentsWithoutPdt[1],
            `Expected sn 1, found sn segment ${
              foundFragment ? foundFragment.sn : -1
            }`,
          );

          fragPrevious.sn = 3;
          foundFragment =
            streamController['getInitialLiveFragment'](levelDetails);
          expect(foundFragment).to.equal(
            fragmentsWithoutPdt[4],
            `Expected sn 4, found sn segment ${
              foundFragment ? foundFragment.sn : -1
            }`,
          );
        });

        it('finds the first fragment to load when starting or re-syncing with a live stream', function () {
          streamController['fragPrevious'] = null;

          const foundFragment =
            streamController['getInitialLiveFragment'](levelDetails);
          expect(foundFragment).to.equal(
            fragmentsWithoutPdt[2],
            `Expected sn 2, found sn segment ${
              foundFragment ? foundFragment.sn : -1
            }`,
          );
        });

        it('finds the fragment with the same cc when there is no sn match', function () {
          fragPrevious.cc = 0;
          const foundFragment =
            streamController['getInitialLiveFragment'](levelDetails);
          expect(foundFragment).to.equal(
            fragmentsWithoutPdt[0],
            `Expected sn 0, found sn segment ${
              foundFragment ? foundFragment.sn : -1
            }`,
          );
        });

        it('returns null when there is no cc match with the previous segment', function () {
          fragPrevious.cc = 2;
          const foundFragment =
            streamController['getInitialLiveFragment'](levelDetails);
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
      firstFrag.setStart(0);
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

    it('should seek to start pos when media is buffered and seek to segment boundary', function () {
      streamController['config'].startOnSegmentBoundary = true;
      streamController['startPosition'] = 7;
      streamController['media']?.buffered;
      streamController['media'] = {
        buffered: {
          start() {
            return 5;
          },
          length: 1,
        },
        currentTime: 0,
      } as any as HTMLMediaElement;

      streamController['seekToStartPos']();
      expect(streamController['media']!.currentTime).to.equal(5);
    });

    it('should seek to start pos when media is buffered and not seek to segment boundary', function () {
      streamController['config'].startOnSegmentBoundary = false;
      streamController['startPosition'] = 7;
      streamController['media']?.buffered;
      streamController['media'] = {
        buffered: {
          start() {
            return 5;
          },
          length: 1,
        },
        currentTime: 0,
      } as any as HTMLMediaElement;

      streamController['seekToStartPos']();
      expect(streamController['media']!.currentTime).to.equal(7);
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

  describe('getBufferOutput', function () {
    let media: any;
    let mediaBuffer: any;

    beforeEach(function () {
      media = { buffered: new TimeRangesMock() };
      mediaBuffer = { buffered: new TimeRangesMock() };
      streamController['media'] = media;
    });

    it('should return media when altAudio is DISABLED', function () {
      streamController['altAudio'] = 0; // AlternateAudio.DISABLED
      streamController['mediaBuffer'] = mediaBuffer;
      expect(streamController['getBufferOutput']()).to.equal(media);
    });

    it('should return media when altAudio is SWITCHING', function () {
      streamController['altAudio'] = 1; // AlternateAudio.SWITCHING
      streamController['mediaBuffer'] = mediaBuffer;
      expect(streamController['getBufferOutput']()).to.equal(media);
    });

    it('should return mediaBuffer when altAudio is SWITCHED', function () {
      streamController['altAudio'] = 2; // AlternateAudio.SWITCHED
      streamController['mediaBuffer'] = mediaBuffer;
      expect(streamController['getBufferOutput']()).to.equal(mediaBuffer);
    });

    it('should return media when mediaBuffer is null even if altAudio is SWITCHED', function () {
      streamController['altAudio'] = 2; // AlternateAudio.SWITCHED
      streamController['mediaBuffer'] = null;
      expect(streamController['getBufferOutput']()).to.equal(media);
    });
  });

  describe('checkFragmentChanged override', function () {
    let media: any;
    let mockFrag: Fragment;

    beforeEach(function () {
      mockFrag = new Fragment(PlaylistLevelType.MAIN, 'test.ts');
      mockFrag.sn = 1;
      mockFrag.level = 0;
      mockFrag.setStart(5);
      mockFrag.duration = 10;

      media = {
        readyState: 4,
        seeking: false,
        currentTime: 7,
        buffered: new TimeRangesMock([5, 15]),
      };
      streamController['media'] = media;
      streamController['fragmentTracker'].getAppendedFrag = sinon
        .stub()
        .returns(mockFrag);
    });

    it('should trigger FRAG_CHANGED event when fragment changes', function () {
      const triggerSpy = sinon.spy(hls, 'trigger');
      const oldFrag = new Fragment(PlaylistLevelType.MAIN, 'old.ts');
      oldFrag.sn = 0;
      oldFrag.level = 0;
      streamController['fragPlaying'] = oldFrag;

      const result = streamController['checkFragmentChanged']();

      expect(result).to.be.true;
      const calls = triggerSpy.getCalls();
      let fragChangedCall;
      for (let i = 0; i < calls.length; i++) {
        if (calls[i].args[0] === Events.FRAG_CHANGED) {
          fragChangedCall = calls[i];
          break;
        }
      }
      expect(fragChangedCall).to.exist;
      expect(fragChangedCall?.args[1]).to.have.property('frag', mockFrag);
    });

    it('should trigger LEVEL_SWITCHED event when level changes', function () {
      const triggerSpy = sinon.spy(hls, 'trigger');
      const oldFrag = new Fragment(PlaylistLevelType.MAIN, 'old.ts');
      oldFrag.sn = 0;
      oldFrag.level = 1;

      streamController['fragPlaying'] = oldFrag;

      streamController['checkFragmentChanged']();

      const calls = triggerSpy.getCalls();
      let levelSwitchedCall;
      for (let i = 0; i < calls.length; i++) {
        if (calls[i].args[0] === Events.LEVEL_SWITCHED) {
          levelSwitchedCall = calls[i];
          break;
        }
      }
      expect(levelSwitchedCall).to.exist;
      expect(levelSwitchedCall?.args[1]).to.have.property('level', 0);
    });

    it('should return false when fragment has not changed', function () {
      streamController['fragPlaying'] = mockFrag;

      const result = streamController['checkFragmentChanged']();

      expect(result).to.be.false;
    });
  });

  describe('abortCurrentFrag override', function () {
    it('should clear backtrackFragment and call super', function () {
      const mockFrag = new Fragment(PlaylistLevelType.MAIN, 'test.ts');
      mockFrag.abortRequests = sinon.stub();
      streamController['fragCurrent'] = mockFrag;
      streamController['backtrackFragment'] = new Fragment(
        PlaylistLevelType.MAIN,
        'backtrack.ts',
      );
      streamController['state'] = State.FRAG_LOADING;

      streamController['abortCurrentFrag']();

      expect(streamController['backtrackFragment']).to.be.undefined;
      expect(streamController['fragCurrent']).to.be.null;
      expect(streamController['state']).to.equal(State.IDLE);
    });
  });
});
