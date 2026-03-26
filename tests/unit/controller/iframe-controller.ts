import { config as chaiConfig, expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import { LoadStats } from '../../../src/loader/load-stats';
import { PlaylistLevelType } from '../../../src/types/loader';
import type { HlsConfig } from '../../../src/config';
import type {
  HlsIFramesOnly,
  IFrameController,
} from '../../../src/controller/iframe-controller';
import type PlaylistLoader from '../../../src/loader/playlist-loader';
import type {
  ComponentAPI,
  NetworkComponentAPI,
} from '../../../src/types/component-api';
import type { TimestampOffset } from '../../../src/utils/timescale-conversion';

use(sinonChai);
chaiConfig.truncateThreshold = 0;

type HlsTestable = Omit<Hls, 'networkControllers' | 'coreComponents'> & {
  coreComponents: ComponentAPI[];
  networkControllers: NetworkComponentAPI[];
  iframeController: IFrameController;
  trigger: Hls['trigger'] & sinon.SinonSpy;
};

type PlaylistLoaderTestable = Omit<PlaylistLoader, 'handleMasterPlaylist'> & {
  handleMasterPlaylist: (
    response: { data: string; url: string },
    stats: LoadStats,
  ) => void;
};

class HLSTestPlayer extends Hls {
  constructor(config: Partial<HlsConfig>) {
    super(config);
  }
}

const playlistWithIFrameVariants = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="en",NAME="English",AUTOSELECT=YES,DEFAULT=YES,CHANNELS="2",URI="audio/en/mp4a.40.2/media.m3u8"
#EXT-X-STREAM-INF:AUDIO="audio",AVERAGE-BANDWIDTH=6383725,BANDWIDTH=7495785,CODECS="avc1.64002A,mp4a.40.2",RESOLUTION=1920x1080
video/avc1/1/media.m3u8
#EXT-X-STREAM-INF:AUDIO="audio",AVERAGE-BANDWIDTH=2131576,BANDWIDTH=2653633,CODECS="avc1.64002A,mp4a.40.2",RESOLUTION=960x540
video/avc1/3/media.m3u8
#EXT-X-STREAM-INF:AUDIO="audio",AVERAGE-BANDWIDTH=3552258,BANDWIDTH=4191484,CODECS="avc1.64002A,mp4a.40.2",RESOLUTION=1280x720
video/avc1/4/media.m3u8
#EXT-X-I-FRAME-STREAM-INF:AVERAGE-BANDWIDTH=309502,BANDWIDTH=481062,CODECS="avc1.64002A",RESOLUTION=1920x1080,URI="video/avc1/1/iframes.m3u8"
#EXT-X-I-FRAME-STREAM-INF:AVERAGE-BANDWIDTH=65770,BANDWIDTH=110693,CODECS="avc1.64002A",RESOLUTION=960x540,URI="video/avc1/3/iframes.m3u8"
#EXT-X-I-FRAME-STREAM-INF:AVERAGE-BANDWIDTH=169447,BANDWIDTH=271378,CODECS="avc1.64002A",RESOLUTION=1280x720,URI="video/avc1/4/iframes.m3u8"
`;

const playlistWithSteeringPathways = `#EXTM3U
#EXT-X-STREAM-INF:PATHWAY-ID=".",BANDWIDTH=7495785,CODECS="avc1.64002A,mp4a.40.2",RESOLUTION=1920x1080
video/avc1/1/media.m3u8
#EXT-X-STREAM-INF:PATHWAY-ID="..",BANDWIDTH=7495785,CODECS="avc1.64002A,mp4a.40.2",RESOLUTION=1920x1080
https://b.com/video/avc1/1/media.m3u8
#EXT-X-I-FRAME-STREAM-INF:PATHWAY-ID=".",BANDWIDTH=481062,CODECS="avc1.64002A",RESOLUTION=1920x1080,URI="video/avc1/1/iframes.m3u8"
#EXT-X-I-FRAME-STREAM-INF:PATHWAY-ID="..",BANDWIDTH=481062,CODECS="avc1.64002A",RESOLUTION=1920x1080,URI="https://b.com/video/avc1/1/media.m3u8"
`;

describe('IFrameController', function () {
  const sandbox = sinon.createSandbox();
  let hls: HlsTestable;
  let playlistLoader: PlaylistLoaderTestable;
  let iframeController: IFrameController;

  beforeEach(function () {
    hls = new HLSTestPlayer({
      autoStartLoad: false,
      // debug: true,
      debug: {
        trace: () => null,
        debug: () => null,
        log: () => null,
        warn: () => null,
        info: () => null,
        error: () => null,
      },
    }) as unknown as HlsTestable;
    playlistLoader = hls.networkControllers[0] as PlaylistLoaderTestable;
    sandbox.spy(hls, 'trigger');
    iframeController = hls.iframeController;
  });

  afterEach(function () {
    hls.destroy();
    sandbox.restore();
  });

  function loadManifest(data: string) {
    const url = 'main.m3u8';
    (iframeController as any).clearAsset();
    (hls as any)._url = url;
    playlistLoader.handleMasterPlaylist({ data, url }, new LoadStats());
    expect(hls.trigger).to.be.calledWith(Events.MANIFEST_LOADED);
  }

  function loadedIFramePlayer(data: string): HlsIFramesOnly {
    loadManifest(data);
    const iframePlayer = iframeController.createIFramePlayer();
    expect(iframePlayer).to.be.an.instanceOf(Hls);
    return iframePlayer as HlsIFramesOnly;
  }

  it('Does not return IFramePlayers before iframes are loaded', function () {
    const iframePlayer = iframeController.createIFramePlayer();
    expect(iframePlayer).to.be.null;
  });

  it('creates IFramePlayer instances once iframes are loaded', function () {
    loadManifest(playlistWithIFrameVariants);
    expect(hls.iframeVariants).to.have.lengthOf(3);
    const iframePlayer = iframeController.createIFramePlayer();
    expect(iframePlayer).to.be.an.instanceOf(Hls);
  });

  it('configures IFramePlayer instances to only handle iframe video variants', function () {
    const iframePlayer = loadedIFramePlayer(playlistWithIFrameVariants);
    expect(iframePlayer.levels).to.have.to.have.lengthOf(3);
    expect(iframePlayer.iframeVariants).to.have.lengthOf(0);
  });

  it('destroys child IFramePlayer instances when destroyed', function () {
    const iframePlayer = loadedIFramePlayer(playlistWithIFrameVariants);
    expect(hls.url).to.eql('main.m3u8');
    expect(iframePlayer.url).to.eql('main.m3u8');
    hls.destroy();
    expect(hls.url).to.eql(null);
    expect(iframePlayer.url).to.eql(null);
  });

  it('destroys child IFramePlayer instances when loading a new asset', function () {
    const iframePlayer = loadedIFramePlayer(playlistWithIFrameVariants);
    expect(hls.url).to.eql('main.m3u8');
    expect(iframePlayer.url).to.eql('main.m3u8');
    hls.loadSource('another.m3u8');
    expect(iframePlayer.url).to.eql(null);
  });

  it('sets Initial Pathway of IFramePlayer to parent instances active variant pathway', function () {
    loadManifest(playlistWithSteeringPathways);
    expect(hls.iframeVariants).to.have.lengthOf(2);
    expect(hls.pathways).to.deep.eq(['.', '..']);

    hls.loadLevel = 0;
    expect(hls.loadLevel).to.eq(0);
    expect(hls.levels[hls.loadLevel].pathwayId).to.eq('.');

    hls.pathwayPriority = ['..', '.'];
    expect(hls.pathwayPriority).to.deep.eq(['..', '.']);
    expect(hls.levels[hls.loadLevel].pathwayId).to.eq('..');

    const iframePlayer = iframeController.createIFramePlayer();
    expect(iframePlayer).to.be.an.instanceOf(Hls);
    if (iframePlayer) {
      expect(iframePlayer.levels[0].pathwayId).to.eq('..');
    }
  });

  it('updates IFramePlayer Pathway priorty once it has changed on the parent instance', function () {
    const iframePlayer = loadedIFramePlayer(playlistWithSteeringPathways);
    expect(hls.pathways).to.deep.eq(['.', '..']);
    expect(iframePlayer.levels[0].pathwayId).to.eq('.');
    hls.pathwayPriority = ['..', '.'];
    expect(iframePlayer.levels[0].pathwayId).to.eq('..');
  });

  it('passes current initPTS to a newly created IFramePlayer', function () {
    loadManifest(playlistWithIFrameVariants);
    const timestamps: TimestampOffset[] = [
      { baseTime: 900000, timescale: 90000, trackId: 0 },
    ];
    hls.trigger(Events.INIT_PTS_FOUND, {
      id: PlaylistLevelType.MAIN,
      timestampOffsets: timestamps,
      frag: { cc: 0 } as any,
      initPTS: 900000,
      timescale: 90000,
    });
    const iframePlayer = iframeController.createIFramePlayer();
    const iframeStreamController = (iframePlayer as any).streamController;
    expect(iframeStreamController.initPTS).to.equal(timestamps);
  });
});
