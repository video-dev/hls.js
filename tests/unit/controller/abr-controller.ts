import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import { Fragment } from '../../../src/loader/fragment';
import { LevelDetails } from '../../../src/loader/level-details';
import { LoadStats } from '../../../src/loader/load-stats';
import { Level } from '../../../src/types/level';
import { PlaylistLevelType } from '../../../src/types/loader';
import { AttrList } from '../../../src/utils/attr-list';
import type AbrController from '../../../src/controller/abr-controller';
import type { HlsListeners } from '../../../src/events';
import type { LevelParsed } from '../../../src/types/level';
import type {
  MediaAttributes,
  MediaPlaylist,
} from '../../../src/types/media-playlist';

chai.use(sinonChai);
const expect = chai.expect;

function levelDetailsWithDuration(duration: number) {
  const details = new LevelDetails('');
  details.totalduration = duration;
  const frag = new Fragment(PlaylistLevelType.MAIN, '');
  frag.url = 'foo';
  details.fragments.push();
  return details;
}

describe('AbrController', function () {
  const sandbox = sinon.createSandbox();

  let hls: Hls;
  let abrController: AbrController;

  beforeEach(function () {
    hls = new Hls({
      maxStarvationDelay: 4,
      // debug: true
    });
    abrController = (hls as any).abrController;
  });

  afterEach(function () {
    sandbox.restore();
    hls.destroy();
  });

  describe('resetEstimator', function () {
    it('estimate can be reset with new value', function () {
      const { abrEwmaDefaultEstimate } = hls.config;
      expect(abrController.bwEstimator.getEstimate()).to.equal(
        abrEwmaDefaultEstimate,
      );
      const updatedEstimate = 5e6 + 1;
      abrController.resetEstimator(updatedEstimate);
      expect(abrController.bwEstimator.getEstimate()).to.equal(updatedEstimate);
    });
  });

  describe('firstAutoLevel getter', function () {
    it('returns starting level index matching estimate', function () {
      (hls as any).levelController._levels = getSimpleLevels();
      const bwe = abrController.bwEstimator.getEstimate();
      expect(bwe).to.equal(5e5);
      const firstAutoLevel = abrController.firstAutoLevel;
      const level = hls.levels[firstAutoLevel];
      expect(level.bitrate).to.be.lessThanOrEqual(bwe);
      expect(firstAutoLevel).to.equal(2);
    });

    it('returns starting level with preferred codecs within estimate', function () {
      (hls as any).levelController._levels = getMultiCodecLevels();
      const bwe = abrController.bwEstimator.getEstimate();
      expect(bwe).to.equal(5e5);
      const firstAutoLevel = abrController.firstAutoLevel;
      const level = hls.levels[firstAutoLevel];
      expect(level.codecSet).to.equal('hevc,mp4a');
      expect(level.bitrate).to.be.lessThanOrEqual(bwe);
      expect(firstAutoLevel).to.equal(3);
    });

    it('returns starting level between minAutoLevel and maxAutoLevel', function () {
      (hls as any).levelController._levels = getSimpleLevels();
      expect(hls.minAutoLevel).to.equal(0);
      expect(hls.maxAutoLevel).to.equal(hls.levels.length - 1);

      hls.firstLevel = 4;
      abrController.resetEstimator(hls.levels[hls.firstLevel].bitrate);
      expect(abrController.firstAutoLevel).to.equal(
        4,
        'firstAutoLevel exact match',
      );

      hls.autoLevelCapping = 3;
      hls.config.minAutoBitrate = 460560;
      expect(hls.minAutoLevel).to.equal(2);
      expect(hls.maxAutoLevel).to.equal(3);
      expect(abrController.firstAutoLevel).to.equal(
        3,
        'firstAutoLevel capped to 3',
      );

      hls.autoLevelCapping = 0;
      hls.config.minAutoBitrate = 0;
      expect(hls.minAutoLevel).to.equal(0);
      expect(hls.maxAutoLevel).to.equal(0);
      expect(abrController.firstAutoLevel).to.equal(
        0,
        'firstAutoLevel capped to 0',
      );
    });

    it('ignores starting level with config.audioPreference.channels when not within bandwidth estimate', function () {
      const { levels, audioTracks } = getMultiChannelAudioLevels();
      (hls as any).levelController._levels = levels;
      (hls as any).audioTrackController.tracks = audioTracks;
      hls.config.audioPreference = {
        channels: '6',
      };
      const bwe = hls.bandwidthEstimate;
      expect(bwe).to.equal(5e5);
      const firstAutoLevel = abrController.firstAutoLevel;
      const level = hls.levels[firstAutoLevel];
      expect(level.bitrate).to.be.lessThanOrEqual(bwe);
      expect(level.codecSet).to.equal('avc1,mp4a');
      expect(level.height).to.equal(1080);
      expect(firstAutoLevel).to.equal(5);
    });

    it('returns starting level with config.audioPreference.channels when within bandwidth estimate', function () {
      const { levels, audioTracks } = getMultiChannelAudioLevels();
      (hls as any).levelController._levels = levels;
      (hls as any).audioTrackController.tracks = audioTracks;
      hls.config.audioPreference = {
        channels: '6',
      };
      hls.bandwidthEstimate = 501000;
      const firstAutoLevel = abrController.firstAutoLevel;
      const level = hls.levels[firstAutoLevel];
      expect(level.codecSet).to.equal('hevc,ac-3');
      expect(level.height).to.equal(720);
      expect(firstAutoLevel).to.equal(3);
    });

    it('returns starting level with config.audioPreference.audioCodec when within bandwidth estimate', function () {
      const { levels, audioTracks } = getMultiChannelAudioLevels();
      (hls as any).levelController._levels = levels;
      (hls as any).audioTrackController.tracks = audioTracks;
      hls.config.audioPreference = {
        audioCodec: 'ec-3',
      };
      hls.bandwidthEstimate = 511000;
      const firstAutoLevel = abrController.firstAutoLevel;
      const level = hls.levels[firstAutoLevel];
      expect(level.codecSet).to.equal('hevc,ec-3');
      expect(level.height).to.equal(720);
      expect(firstAutoLevel).to.equal(4);
    });

    it('returns hls.firstLevel when match cannot be found', function () {
      (hls as any).levelController._levels = getSimpleLevels();
      expect(hls.minAutoLevel).to.equal(0);
      expect(hls.maxAutoLevel).to.equal(hls.levels.length - 1);
      expect(hls.firstLevel).to.equal(0);

      hls.firstLevel = 3;
      abrController.resetEstimator(hls.levels[hls.firstLevel].bitrate);
      expect(hls.firstLevel).to.equal(3);
      expect(abrController.firstAutoLevel).to.equal(3);

      abrController.resetEstimator(999999999);
      expect(abrController.firstAutoLevel).to.equal(5);

      abrController.resetEstimator(1);
      expect(abrController.firstAutoLevel).to.equal(3);
    });
  });

  describe('nextAutoLevel getter', function () {
    it('returns higher level index with sufficient buffer', function () {
      setForwardBufferlength(sandbox, hls, 8);
      (hls as any).levelController._levels = getSimpleLevels();
      const requiredBitrateForLevel2 = 460560 / 0.7 + 1;
      loadAndBufferFragment(
        abrController,
        0,
        requiredBitrateForLevel2 / 8,
        1000,
      );
      expect(abrController.nextAutoLevel).to.equal(2);
    });
  });

  describe('nextAutoLevel setter and forcedAutoLevel getter', function () {
    it('forcedAutoLevel returns value set by nextAutoLevel setter until nextAutoLevel can use estimate and find a candidate', function () {
      (hls as any).levelController._levels = getSimpleLevels();
      expect(abrController.forcedAutoLevel).to.equal(-1);
      expect(abrController.nextAutoLevel).to.equal(2);

      abrController.nextAutoLevel = 1;
      expect(abrController.forcedAutoLevel).to.equal(1);
      expect(abrController.nextAutoLevel).to.equal(1);

      loadAndBufferFragment(abrController, 1, 5e6, 1000);
      expect(abrController.forcedAutoLevel).to.equal(-1);
      expect(abrController.nextAutoLevel).to.equal(5);
    });
  });
});

function loadAndBufferFragment(
  abrController: AbrController,
  levelIndex: number,
  sizeInBytes: number,
  timeToLoad: number,
  timeToFirstByte: number = 0,
  timeToParse: number = 0,
) {
  const frag = new Fragment(PlaylistLevelType.MAIN, '');
  frag.level = levelIndex;
  frag.stats = new LoadStats();
  frag.stats.loaded = sizeInBytes;
  frag.stats.loading = {
    first: 0,
    start: timeToFirstByte,
    end: timeToLoad + timeToFirstByte,
  };
  frag.stats.parsing = {
    start: frag.stats.loading.end,
    end: frag.stats.loading.end + timeToParse,
  };
  ((abrController as any).onFragLoaded as HlsListeners[Events.FRAG_LOADED])(
    Events.FRAG_LOADED,
    {
      frag,
      part: null,
      payload: new ArrayBuffer(0),
      networkDetails: null,
    },
  );
  ((abrController as any).onFragBuffered as HlsListeners[Events.FRAG_BUFFERED])(
    Events.FRAG_BUFFERED,
    {
      frag,
      part: null,
      stats: frag.stats,
      id: 'video',
    },
  );
}

function setForwardBufferlength(
  sandbox: sinon.SinonSandbox,
  hls: Hls,
  length: number,
) {
  sandbox
    .stub((hls as any).streamController, 'getMainFwdBufferInfo')
    .returns({ len: length, start: 0, end: length, nextStart: undefined });
}

function getSimpleLevels(): Level[] {
  const parsedLevels: LevelParsed[] = [
    {
      bitrate: 105000,
      name: '144',
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({}),
      url: '',
    },
    {
      bitrate: 246440,
      name: '240',
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({}),
      url: '',
    },
    {
      bitrate: 460560,
      name: '380',
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({}),
      url: '',
    },
    {
      bitrate: 836280,
      name: '480',
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({}),
      url: '',
    },
    {
      bitrate: 2149280,
      name: '720',
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({}),
      url: '',
    },
    {
      bitrate: 6221600,
      name: '1080',
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({}),
      url: '',
    },
  ];
  return parsedLevels.map((parsedLevel) => new Level(parsedLevel));
}

function getMultiCodecLevels(): Level[] {
  const parsedLevels: LevelParsed[] = [
    {
      bitrate: 336280,
      name: '480',
      width: 852,
      height: 480,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({}),
      url: '',
      videoCodec: 'avc1',
      audioCodec: 'mp4a',
    },
    {
      bitrate: 300000,
      name: '480',
      width: 852,
      height: 480,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({}),
      url: '',
      videoCodec: 'hevc',
      audioCodec: 'mp4a',
    },
    {
      bitrate: 414928,
      name: '720',
      width: 1280,
      height: 720,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({}),
      url: '',
      videoCodec: 'avc1',
      audioCodec: 'mp4a',
    },
    {
      bitrate: 480928,
      name: '720',
      width: 1280,
      height: 720,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({}),
      url: '',
      videoCodec: 'hevc',
      audioCodec: 'mp4a',
    },
    {
      bitrate: 480000,
      name: '1080',
      width: 1920,
      height: 1080,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({}),
      url: '',
      videoCodec: 'avc1',
      audioCodec: 'mp4a',
    },
    {
      bitrate: 522160,
      name: '1080',
      width: 1920,
      height: 1080,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({}),
      url: '',
      videoCodec: 'avc1',
      audioCodec: 'mp4a',
    },
    {
      bitrate: 500060,
      name: '1080',
      width: 1920,
      height: 1080,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({}),
      url: '',
      videoCodec: 'hevc',
      audioCodec: 'mp4a',
    },
  ];
  return parsedLevels.map((parsedLevel) => new Level(parsedLevel));
}

function getMultiChannelAudioLevels(): {
  levels: Level[];
  audioTracks: MediaPlaylist[];
} {
  const parsedLevels: LevelParsed[] = [
    {
      bitrate: 336280,
      name: '480',
      width: 852,
      height: 480,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({ AUDIO: 'mp4a' }),
      url: '',
      videoCodec: 'avc1',
      audioCodec: 'mp4a',
    },
    {
      bitrate: 414928,
      name: '720',
      width: 1280,
      height: 720,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({ AUDIO: 'mp4a' }),
      url: '',
      videoCodec: 'avc1',
      audioCodec: 'mp4a',
    },
    {
      bitrate: 480928,
      name: '720',
      width: 1280,
      height: 720,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({ AUDIO: 'mp4a' }),
      url: '',
      videoCodec: 'hevc',
      audioCodec: 'mp4a',
    },
    {
      bitrate: 500928,
      name: '720',
      width: 1280,
      height: 720,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({ AUDIO: 'ac-3' }),
      url: '',
      videoCodec: 'hevc',
      audioCodec: 'ac-3',
    },
    {
      bitrate: 510928,
      name: '720',
      width: 1280,
      height: 720,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({ AUDIO: 'ec-3' }),
      url: '',
      videoCodec: 'hevc',
      audioCodec: 'ec-3',
    },
    {
      bitrate: 480000,
      name: '1080',
      width: 1920,
      height: 1080,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({ AUDIO: 'mp4a' }),
      url: '',
      videoCodec: 'avc1',
      audioCodec: 'mp4a',
    },
    {
      bitrate: 500060,
      name: '1080',
      width: 1920,
      height: 1080,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({ AUDIO: 'mp4a' }),
      url: '',
      videoCodec: 'hevc',
      audioCodec: 'mp4a',
    },
    {
      bitrate: 510060,
      name: '1080',
      width: 1920,
      height: 1080,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({ AUDIO: 'ac-3' }),
      url: '',
      videoCodec: 'hevc',
      audioCodec: 'ac-3',
    },
    {
      bitrate: 520060,
      name: '1080',
      width: 1920,
      height: 1080,
      details: levelDetailsWithDuration(10),
      attrs: new AttrList({ AUDIO: 'ec-3' }),
      url: '',
      videoCodec: 'hevc',
      audioCodec: 'ec-3',
    },
  ];
  const levels = parsedLevels.map((parsedLevel) => {
    const level = new Level(parsedLevel);
    return level;
  });
  const audioTracks: MediaPlaylist[] = [
    {
      attrs: new AttrList({}) as MediaAttributes,
      autoselect: true,
      bitrate: 0,
      default: true,
      forced: false,
      channels: '2',
      groupId: 'mp4a',
      name: 'English',
      type: 'AUDIO',
      id: 0,
      url: 'data://',
    },
    {
      attrs: new AttrList({}) as MediaAttributes,
      autoselect: true,
      bitrate: 0,
      default: true,
      forced: false,
      channels: '6',
      groupId: 'ac-3',
      name: 'English',
      type: 'AUDIO',
      id: 0,
      url: 'data://',
    },
    {
      attrs: new AttrList({}) as MediaAttributes,
      autoselect: true,
      bitrate: 0,
      default: true,
      forced: false,
      channels: '16/JOC',
      groupId: 'ec-3',
      name: 'English',
      type: 'AUDIO',
      id: 0,
      url: 'data://',
    },
  ];
  return {
    levels,
    audioTracks,
  };
}
