import LevelController from '../../../src/controller/level-controller';
import HlsMock from '../../mocks/hls.mock';
import Event from '../../../src/events';
import { ErrorTypes, ErrorDetails } from '../../../src/errors';

describe('LevelController', () => {
  const sandbox = sinon.createSandbox();
  let hls;
  let levelController;
  let triggerSpy;

  beforeEach(() => {
    hls = new HlsMock({}, sandbox);
    levelController = new LevelController(hls);
    triggerSpy = hls.trigger;
  });

  afterEach(() => {
    hls = null;
    levelController = null;
    sandbox.restore();
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

    expect(triggerSpy).to.have.been.calledWith(Event.LEVEL_SWITCHING, {
      bitrate: 246440,
      details: data.levels[1].details,
      fragmentError: false,
      level: 1,
      loadError: 0,
      name: '240',
      url: [undefined],
      urlId: 0
    });
  });

  describe('onManifestLoaded handler', function () {
    it('should trigger an error when no levels are found in the manifest', () => {
      levelController.onManifestLoaded({
        audioTracks: [],
        levels: [],
        networkDetails: '',
        subtitles: [],
        url: 'https://video-dev.github.io/streams/x36xhzz/x36xhzz.m3u8'
      });

      expect(triggerSpy).to.have.been.calledWith(Event.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR,
        fatal: true,
        url: undefined,
        reason: 'no level with compatible codecs found in manifest'
      });
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

      expect(triggerSpy).to.have.been.calledWith(Event.MANIFEST_PARSED, {
        altAudio: false,
        audio: false,
        audioTracks: [],
        firstLevel: 0,
        levels: data.levels,
        stats: {},
        video: false
      });
    });

    it.skip('should signal altAudio if present in the manifest', function () {
      let data = {
        audioTracks: [
          { audioCodec: 'mp4a.40.5' }
        ],
        levels: [
          { bitrate: 105000, name: '144', details: { totalduration: 10, fragments: [{}] } }
        ],
        networkDetails: '',
        subtitles: [],
        stats: {},
        url: 'https://video-dev.github.io/streams/x36xhzz/x36xhzz.m3u8'
      };

      levelController.onManifestLoaded(data);
      expect(triggerSpy).to.have.been.calledWith(Event.MANIFEST_PARSED, {
        altAudio: true,
        audio: false,
        audioTracks: [],
        firstLevel: 0,
        levels: data.levels,
        stats: {},
        video: false
      });
    });
  });
});
