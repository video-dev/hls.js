/* eslint-disable dot-notation */
import LatencyController from '../../../src/controller/latency-controller';
import Hls from '../../../src/hls';
import { Events } from '../../../src/events';
import { LevelDetails } from '../../../src/loader/level-details';
import { LevelUpdatedData } from '../../../src/types/events';

import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';

chai.use(sinonChai);
const expect = chai.expect;

// Write to .age and .edge getter stubs for testing LevelDetails in LatencyController
interface TestLevelDetails extends LevelDetails {
  age: number;
  edge: number;
}

describe('LatencyController', function () {
  let latencyController: LatencyController;
  let hls: Hls;
  let media: {
    currentTime: number;
    playbackRate: number;
    buffered: TimeRanges;
  };
  let mockTimeRanges: [number, number][] = [];
  let levelDetails: TestLevelDetails;

  beforeEach(function () {
    hls = new Hls({});
    latencyController = new LatencyController(hls);
    levelDetails = new LevelDetails('');
    levelDetails.live = true;
    levelDetails.targetduration = 5;
    levelDetails.totalduration = 15;
    const levelUpdatedData: LevelUpdatedData = {
      details: levelDetails,
      level: 0,
    };
    const edgeStub = sinon.stub(levelDetails, 'edge');
    edgeStub.get(() => 0);
    edgeStub.set((value: number) => {
      edgeStub.get(() => value);
      latencyController['onLevelUpdated'](
        Events.LEVEL_UPDATED,
        levelUpdatedData
      );
    });
    const ageStub = sinon.stub(levelDetails, 'age');
    ageStub.get(() => 0);
    ageStub.set((value: number) => {
      ageStub.get(() => value);
      latencyController['onLevelUpdated'](
        Events.LEVEL_UPDATED,
        levelUpdatedData
      );
    });
    let currentTime = 0;
    // @ts-ignore
    media = latencyController['media'] = {
      currentTime: 0,
      playbackRate: 1,
      buffered: {
        get length() {
          return mockTimeRanges.length;
        },
        start(index) {
          return mockTimeRanges[index][0];
        },
        end(index) {
          return mockTimeRanges[index][1];
        },
      },
    };
    const currentTimeStub = sinon.stub(media, 'currentTime');
    currentTimeStub.get(() => currentTime);
    currentTimeStub.set((value: number) => {
      currentTime = value;
      latencyController['timeupdate']();
    });
  });

  describe('latency', function () {
    it('returns 0 when unknown / detached / prior to timeupdate', function () {
      expect(latencyController.latency).to.equal(0);
    });

    it('is the distance between currentTime and the live edge plus playlist age', function () {
      levelDetails.edge = 25;
      expect(latencyController.latency).to.equal(25);
      media.currentTime = 15;
      expect(latencyController.latency).to.equal(10);
      media.currentTime = 20;
      expect(latencyController.latency).to.equal(5);
      levelDetails.age = 1;
      expect(latencyController.latency).to.equal(6);
      levelDetails.edge = 30;
      levelDetails.age = 0;
      expect(latencyController.latency).to.equal(10);
    });
  });

  describe('maxLatency', function () {
    it('returns liveMaxLatencyDuration when set', function () {
      latencyController['config'].liveMaxLatencyDuration = 30;
      expect(latencyController.maxLatency).to.equal(30);
    });

    it('returns liveMaxLatencyDurationCount * targetduration after level update', function () {
      latencyController['config'].liveMaxLatencyDurationCount = 3;
      expect(latencyController.maxLatency).to.equal(0);
      levelDetails.age = 0;
      expect(latencyController.maxLatency).to.equal(15);
    });
  });

  describe('targetLatency', function () {
    it('returns null before level update', function () {
      expect(latencyController.targetLatency).to.equal(null);
    });

    it('returns liveSyncDuration if set after level update', function () {
      latencyController['config'].liveSyncDuration = 12;
      levelDetails.age = 0;
      expect(latencyController.targetLatency).to.equal(12);
    });

    it('returns targetduration * liveSyncDurationCount if set after level update', function () {
      latencyController['config'].liveSyncDurationCount = 2;
      levelDetails.age = 0;
      expect(latencyController.targetLatency).to.equal(10);
    });

    it('returns holdBack when set in playlist after level update', function () {
      levelDetails.holdBack = 8;
      levelDetails.age = 0;
      expect(latencyController.targetLatency).to.equal(8);
    });

    it('returns partHoldBack in lowLatencyMode when set in playlist after level update', function () {
      levelDetails.holdBack = 8;
      levelDetails.partHoldBack = 3;
      levelDetails.age = 0;
      latencyController['config'].lowLatencyMode = false;
      expect(latencyController.targetLatency).to.equal(8);
      latencyController['config'].lowLatencyMode = true;
      expect(latencyController.targetLatency).to.equal(3);
    });

    it('liveSyncDuration overrides holdBack when set by user', function () {
      hls.userConfig.liveSyncDuration = 12;
      latencyController['config'].liveSyncDuration = 12;
      levelDetails.holdBack = 8;
      levelDetails.age = 0;
      expect(latencyController.targetLatency).to.equal(12);
    });

    it('liveSyncDurationCount overrides holdBack when set by user', function () {
      hls.userConfig.liveSyncDurationCount = 2;
      latencyController['config'].liveSyncDurationCount = 2;
      levelDetails.holdBack = 8;
      levelDetails.age = 0;
      expect(latencyController.targetLatency).to.equal(10);
    });

    it('adds a second of latency for each stall up to targetduration', function () {
      latencyController['config'].lowLatencyMode = true;
      levelDetails.targetduration = 3.5;
      levelDetails.partHoldBack = 3;
      levelDetails.age = 0;
      expect(latencyController.targetLatency).to.equal(3);
      latencyController['stallCount'] = 1;
      expect(latencyController.targetLatency).to.equal(4);
      latencyController['stallCount'] += 1;
      expect(latencyController.targetLatency).to.equal(5);
      latencyController['stallCount'] += 1;
      expect(latencyController.targetLatency).to.equal(6);
      latencyController['stallCount'] += 1;
      expect(latencyController.targetLatency).to.equal(6.5);
    });
  });

  describe('liveSyncPosition', function () {
    it('returns null before level update', function () {
      expect(latencyController.liveSyncPosition).to.equal(null);
    });

    it('returns target currentTime based on edge and targetLatency', function () {
      latencyController['config'].liveSyncDuration = 12;
      levelDetails.edge = 60;
      expect(latencyController.liveSyncPosition).to.equal(48);
    });

    it('accounts for level update age up to 3 target durations', function () {
      levelDetails.targetduration = 5;
      levelDetails.holdBack = 15;
      levelDetails.edge = 60;
      expect(latencyController.liveSyncPosition).to.equal(45);
      levelDetails.age = 5;
      expect(latencyController.liveSyncPosition).to.equal(50);
      levelDetails.age = 10;
      expect(latencyController.liveSyncPosition).to.equal(55);
      levelDetails.age = 20;
      expect(latencyController.liveSyncPosition).to.equal(55);
    });

    it('accounts for level update age up to 3 part targets in low latency mode', function () {
      latencyController['config'].lowLatencyMode = true;
      levelDetails.partTarget = 1;
      levelDetails.partHoldBack = 3;
      levelDetails.edge = 60;
      expect(latencyController.liveSyncPosition).to.equal(57);
      levelDetails.age = 1;
      expect(latencyController.liveSyncPosition).to.equal(58);
      levelDetails.age = 2;
      expect(latencyController.liveSyncPosition).to.equal(59);
      levelDetails.age = 5;
      expect(latencyController.liveSyncPosition).to.equal(59);
    });
  });

  describe('edgeStalled', function () {
    it('returns 0 before level update', function () {
      expect(latencyController.edgeStalled).to.equal(0);
    });

    it('returns the age seconds past 3 target durations', function () {
      levelDetails.targetduration = 5;
      levelDetails.holdBack = 15;
      levelDetails.age = 0;
      expect(latencyController.edgeStalled).to.equal(0);
      levelDetails.age = 1;
      expect(latencyController.edgeStalled).to.equal(0);
      levelDetails.age = 20;
      expect(latencyController.edgeStalled).to.equal(5);
      levelDetails.age = 25;
      expect(latencyController.edgeStalled).to.equal(10);
    });

    it('returns the age seconds past 3 part targets in low latency mode', function () {
      latencyController['config'].lowLatencyMode = true;
      levelDetails.partTarget = 1;
      levelDetails.partHoldBack = 3;
      levelDetails.age = 0;
      expect(latencyController.edgeStalled).to.equal(0);
      levelDetails.age = 1;
      expect(latencyController.edgeStalled).to.equal(0);
      levelDetails.age = 5;
      expect(latencyController.edgeStalled).to.equal(2);
      levelDetails.age = 6;
      expect(latencyController.edgeStalled).to.equal(3);
    });
  });

  describe('when maxLiveSyncPlaybackRate is set', function () {
    beforeEach(function () {
      latencyController['config'].maxLiveSyncPlaybackRate = 2;
    });

    it('increases playbackRate when latency is greater than target latency on timeupdate', function () {
      levelDetails.edge = 12;
      mockTimeRanges = [[0, 12]];
      levelDetails.holdBack = 6;
      media.currentTime = 6;
      expect(media.playbackRate).to.equal(1);
      media.currentTime = 5;
      expect(media.playbackRate).to.be.within(1.3, 1.4);
      media.currentTime = 4;
      expect(media.playbackRate).to.be.within(1.6, 1.7);
      media.currentTime = 1;
      expect(media.playbackRate).to.be.within(1.9, 2);
    });

    it('resets latency estimates when a new manifest is loading', function () {
      expect(latencyController.latency).to.equal(0);
      levelDetails.edge = 25;
      expect(latencyController.latency).to.equal(25);
      latencyController['onManifestLoading']();
      expect(latencyController.latency).to.equal(0);
    });
  });
});
