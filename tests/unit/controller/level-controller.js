const assert = require('assert');
const sinon = require('sinon');

import LevelController from '../../../src/controller/level-controller';
import HlsMock from '../../mocks/hls.mock';
import Event from '../../../src/events';
import { ErrorTypes, ErrorDetails } from '../../../src/errors';

describe('LevelController', () => {
  let hls, levelController;

  beforeEach(() => {
    hls = new HlsMock();
    levelController = new LevelController(hls);
  });

  afterEach(() => {
    hls.destroy();
    hls = null;
    levelController = null;
  });

  it('should trigger an error when no levels are found in the manifest', () => {
    levelController.onManifestLoaded({
      audioTracks: [],
      levels: [],
      networkDetails: '',
      subtitles: [],
      url: 'https://video-dev.github.io/streams/x36xhzz/x36xhzz.m3u8'
    });

    assert.equal(levelController.hls.trigger.args[0][1].details, ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR);
  });

  it('should trigger hlsManifestParsed when levels are found in the manifest', () => {
    let data = {
      audioTracks: [],
      levels: [
        { bitrate: 105000, name: '144', details: { totalduration: 10, fragments: [{}] } },
        { bitrate: 246440, name: '240', details: { totalduration: 10, fragments: [{}] } },
        { bitrate: 460560, name: '380', details: { totalduration: 10, fragments: [{}] } },
        { bitrate: 836280, name: '480', details: { totalduration: 10, fragments: [{}] } },
        { bitrate: 2149280, name: '720', details: { totalduration: 10, fragments: [{}] } },
        { bitrate: 6221600, name: '1080', details: { totalduration: 10, fragments: [{}] } }
      ],
      networkDetails: '',
      subtitles: [],
      stats: {},
      url: 'https://video-dev.github.io/streams/x36xhzz/x36xhzz.m3u8'
    };

    levelController.onManifestLoaded(data);

    assert.equal(levelController.hls.trigger.args[0][0], Event.MANIFEST_PARSED);
    assert.equal(levelController.hls.trigger.args[0][1].levels.length, data.levels.length);
  });

  it('should trigger level switch when level is manually set', () => {
    let data = {
      audioTracks: [],
      levels: [
        { bitrate: 105000, name: '144', details: { totalduration: 10, fragments: [{}] } },
        { bitrate: 246440, name: '240', details: { totalduration: 10, fragments: [{}] } },
        { bitrate: 460560, name: '380', details: { totalduration: 10, fragments: [{}] } },
        { bitrate: 836280, name: '480', details: { totalduration: 10, fragments: [{}] } },
        { bitrate: 2149280, name: '720', details: { totalduration: 10, fragments: [{}] } },
        { bitrate: 6221600, name: '1080', details: { totalduration: 10, fragments: [{}] } }
      ],
      networkDetails: '',
      subtitles: [],
      url: 'https://video-dev.github.io/streams/x36xhzz/x36xhzz.m3u8'
    };

    let nextLevel = 1;

    levelController.onManifestLoaded(data);
    levelController.level = nextLevel;

    assert.equal(levelController.hls.trigger.args[1][0], Event.LEVEL_SWITCHING);
    assert.equal(levelController.hls.trigger.args[1][1].level, nextLevel);
  });
});
