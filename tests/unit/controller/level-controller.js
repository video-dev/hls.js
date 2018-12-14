import LevelController from '../../../src/controller/level-controller';
import HlsMock from '../../mocks/hls.mock';
import Event from '../../../src/events';
import { ErrorDetails } from '../../../src/errors';

const assert = require('assert');

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

  describe('manifest parsing', function () {
    let data;
    beforeEach(function () {
      data = {
        audioTracks: [],
        levels: [{ bitrate: 105000, name: '144', details: { totalduration: 10, fragments: [{}] } }],
        networkDetails: '',
        subtitles: [],
        url: 'foo'
      };
    });

    it('signals video if there is a videoCodec signaled', function () {
      data.levels[0].videoCodec = 'avc1.42e01e';
      levelController.onManifestLoaded(data);

      const { name, payload } = hls.getEventData(0);
      assert.strictEqual(name, Event.MANIFEST_PARSED);
      assert.strictEqual(payload.video, true);
      assert.strictEqual(payload.audio, false);
      assert.strictEqual(payload.altAudio, false);
    });

    it('signals audio if there is an audioCodec signaled', function () {
      data.levels[0].audioCodec = 'mp4a.40.5';
      levelController.onManifestLoaded(data);

      const { name, payload } = hls.getEventData(0);
      assert.strictEqual(name, Event.MANIFEST_PARSED);
      assert.strictEqual(payload.video, false);
      assert.strictEqual(payload.audio, true);
      assert.strictEqual(payload.altAudio, false);
    });

    it('signals audio if the level is part of an audio group', function () {
      data.levels = [{
        attrs: {
          AUDIO: true
        }
      }];
      levelController.onManifestLoaded(data);

      const { name, payload } = hls.getEventData(0);
      assert.strictEqual(name, Event.MANIFEST_PARSED);
      assert.strictEqual(payload.video, false);
      assert.strictEqual(payload.audio, true);
      assert.strictEqual(payload.altAudio, false);
    });

    it('signals altAudio if there are audioTracks containing URIs', function () {
      data.levels[0].videoCodec = 'avc1.42e01e';
      data.audioTracks = [
        {
          groupId: 'audio',
          name: 'Audio',
          type: 'AUDIO',
          default: true,
          autoselect: true,
          forced: false,
          url: 'https://d35u71x3nb8v2y.cloudfront.net/4b711b97-513c-4d36-ad29-298ab23a2e5e/05845f51-c319-41ca-8e84-b84299925a0c/playlist.m3u8',
          id: 0
        },
        {
          groupId: 'audio',
          name: 'Audio',
          type: 'AUDIO',
          default: true,
          autoselect: true,
          forced: false,
          id: 0
        }
      ];

      levelController.onManifestLoaded(data);

      const { name, payload } = hls.getEventData(0);
      assert.strictEqual(name, Event.MANIFEST_PARSED);
      assert.strictEqual(payload.video, true);
      assert.strictEqual(payload.audio, false);
      assert.strictEqual(payload.altAudio, true);
    });

    it('does not signal altAudio if the audioTracks do no not contain any URIs', function () {
      data.levels[0].videoCodec = 'avc1.42e01e';
      data.audioTracks = [
        {
          groupId: 'audio',
          name: 'Audio',
          type: 'AUDIO',
          default: true,
          autoselect: true,
          forced: false,
          id: 0
        },
        {
          groupId: 'audio',
          name: 'Audio',
          type: 'AUDIO',
          default: true,
          autoselect: true,
          forced: false,
          id: 0
        }
      ];

      levelController.onManifestLoaded(data);

      const { name, payload } = hls.getEventData(0);
      assert.strictEqual(name, Event.MANIFEST_PARSED);
      assert.strictEqual(payload.video, true);
      assert.strictEqual(payload.audio, false);
      assert.strictEqual(payload.altAudio, false);
    });
  });
});
