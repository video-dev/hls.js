import { config as chaiConfig, expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { State } from '../../../src/controller/base-stream-controller';
import { ImageIFrameStreamController } from '../../../src/controller/image-iframe-stream-controller';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import { Fragment } from '../../../src/loader/fragment';
import { LoadStats } from '../../../src/loader/load-stats';
import { PlaylistLevelType } from '../../../src/types/loader';
import type { HlsConfig } from '../../../src/config';
import type {
  HlsIFramesOnly,
  HlsImageIFramesOnly,
  IFrameController,
} from '../../../src/controller/iframe-controller';
import type { MediaFragment } from '../../../src/loader/fragment';
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

const playlistWithImageIFrameVariants = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="en",NAME="English",AUTOSELECT=YES,DEFAULT=YES,CHANNELS="2",URI="audio/en/mp4a.40.2/media.m3u8"
#EXT-X-STREAM-INF:AUDIO="audio",AVERAGE-BANDWIDTH=6383725,BANDWIDTH=7495785,CODECS="avc1.64002A,mp4a.40.2",RESOLUTION=1920x1080
video/avc1/1/media.m3u8
#EXT-X-I-FRAME-STREAM-INF:AVERAGE-BANDWIDTH=309502,BANDWIDTH=481062,CODECS="avc1.64002A",RESOLUTION=1920x1080,URI="video/avc1/1/iframes.m3u8"
#EXT-X-I-FRAME-STREAM-INF:AVERAGE-BANDWIDTH=65770,BANDWIDTH=110693,CODECS="avc1.64002A",RESOLUTION=960x540,URI="video/avc1/3/iframes.m3u8"
#EXT-X-I-FRAME-STREAM-INF:AVERAGE-BANDWIDTH=50000,BANDWIDTH=50000,CODECS="mjpg",RESOLUTION=960x540,URI="video/mjpg/iframes.m3u8"
#EXT-X-I-FRAME-STREAM-INF:AVERAGE-BANDWIDTH=30000,BANDWIDTH=30000,CODECS="mjpg",RESOLUTION=480x270,URI="video/mjpg/2/iframes.m3u8"
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
    expect(iframePlayer)
      .to.have.property('iframeVariants')
      .which.has.lengthOf(0);
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

  it('passes copy of initPTS to a newly created IFramePlayer', function () {
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
    expect(iframeStreamController.initPTS).to.not.equal(timestamps);
    expect(iframeStreamController.initPTS).to.deep.equal(timestamps);
  });

  it('flushes buffer beyond the target and signals EOS before seeking on fragment buffered', function () {
    const iframePlayer = loadedIFramePlayer(playlistWithIFrameVariants);
    const streamController = (iframePlayer as any).streamController;
    const frag = new Fragment(PlaylistLevelType.MAIN, '');
    frag.sn = 30;
    frag.level = 0;
    frag.setStart(60);
    frag.setDuration(2);
    frag.elementaryStreams.video = {
      startPTS: 60,
      endPTS: 62,
      startDTS: 60,
      endDTS: 62,
    };
    // Media with a buffered range beyond the fragment (an earlier operation
    // rendered a later frame)
    streamController.media = {
      seeking: false,
      currentTime: 421.2,
      buffered: {
        length: 2,
        start: (i: number) => [60, 420][i],
        end: (i: number) => [62, 422][i],
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      pause: () => {},
    };
    streamController.currentOp = [61.2, { seekOnAppend: true }];
    const calls: string[] = [];
    sandbox
      .stub(streamController, 'seekTo' as any)
      .callsFake(() => calls.push('seek') > 0);
    const trigger = iframePlayer.trigger.bind(iframePlayer);
    sandbox
      .stub(iframePlayer, 'trigger' as any)
      .callsFake((event: any, data: any) => {
        if (event === Events.BUFFER_FLUSHING || event === Events.BUFFER_EOS) {
          calls.push(event);
        }
        return trigger(event, data);
      });

    streamController.fragBufferedComplete(frag, null);

    // The buffered range after the target must be removed and end of stream
    // signalled before seeking, so the decoder does not starve waiting for a
    // frame after the seek target (it would never complete the seek).
    expect(calls).to.deep.equal([
      Events.BUFFER_FLUSHING,
      Events.BUFFER_EOS,
      'seek',
    ]);
  });

  it('queues loadMediaAt operations issued while a fragment is loading', function () {
    const iframePlayer = loadedIFramePlayer(playlistWithIFrameVariants);
    const streamController = (iframePlayer as any).streamController;
    // Simulate an in-flight fragment load for a span that does not contain
    // the newly requested time. The operation must be queued (not dropped)
    // so it is issued when the active fragment completes.
    streamController.state = State.FRAG_LOADING;
    streamController.fragCurrent = { start: 0, end: 4 };
    streamController.loadMediaAt(30, { seekOnAppend: true });
    expect(streamController.nextOp).to.deep.equal([30, { seekOnAppend: true }]);
    // A subsequent call replaces the pending operation
    streamController.loadMediaAt(2, { seekOnAppend: true });
    expect(streamController.nextOp).to.deep.equal([2, { seekOnAppend: true }]);
  });

  it('createImageIFramePlayer returns null when no image iframe variants exist', function () {
    loadManifest(playlistWithIFrameVariants);
    expect(hls.iframeVariants).to.have.lengthOf(3);
    const imagePlayer = iframeController.createImageIFramePlayer();
    expect(imagePlayer).to.be.null;
  });

  it('createImageIFramePlayer returns instance when mjpg variants exist', function () {
    loadManifest(playlistWithImageIFrameVariants);
    const imagePlayer = iframeController.createImageIFramePlayer();
    expect(imagePlayer).to.be.an.instanceOf(Hls);
  });

  it('createImageIFramePlayer filters to only image codec variants', function () {
    loadManifest(playlistWithImageIFrameVariants);
    expect(hls.iframeVariants).to.have.lengthOf(4);
    const imagePlayer = iframeController.createImageIFramePlayer();
    expect(imagePlayer).to.be.an.instanceOf(Hls);
    if (imagePlayer) {
      expect(imagePlayer.levels).to.have.lengthOf(2);
      imagePlayer.levels.forEach((level) => {
        expect(level).to.have.property('imageCodec', 'mjpg');
      });
    }
  });

  it('Image IFrame player throws on attachMedia', function () {
    loadManifest(playlistWithImageIFrameVariants);
    const imagePlayer =
      iframeController.createImageIFramePlayer() as HlsImageIFramesOnly;
    expect(imagePlayer).to.be.an.instanceOf(Hls);
    expect(() => (imagePlayer as any).attachMedia({} as any)).to.throw(
      'Image I-Frame player does not accept HTMLMediaElements',
    );
  });

  it('Image IFrame player is destroyed with parent', function () {
    loadManifest(playlistWithImageIFrameVariants);
    const imagePlayer = iframeController.createImageIFramePlayer();
    expect(imagePlayer).to.be.an.instanceOf(Hls);
    if (imagePlayer) {
      expect(imagePlayer.url).to.eql('main.m3u8');
      hls.destroy();
      expect(imagePlayer.url).to.eql(null);
    }
  });
});

describe('ImageIFrameStreamController', function () {
  function createFrag(sn: number, dataSize: number): MediaFragment {
    const frag = new Fragment(PlaylistLevelType.MAIN, '') as MediaFragment;
    frag.sn = sn;
    frag.data = new Uint8Array(dataSize);
    return frag;
  }

  describe('cacheSet', function () {
    let controller: any;
    let cacheSet: (frag: MediaFragment, data: Uint8Array) => void;

    beforeEach(function () {
      controller = {
        hls: { config: { iframeCacheLimit: 1024 } },
        cached: [] as MediaFragment[],
        cachedSize: 0,
      };
      cacheSet = (ImageIFrameStreamController.prototype as any).cacheSet.bind(
        controller,
      );
    });

    it('adds fragment data to cache and tracks size', function () {
      const frag = createFrag(0, 100);
      cacheSet(frag, frag.data!);
      expect(controller.cached).to.have.lengthOf(1);
      expect(controller.cachedSize).to.equal(100);
      expect(frag.data).to.not.be.undefined;
    });

    it('evicts oldest entries when cache exceeds iframeCacheLimit', function () {
      controller.hls.config.iframeCacheLimit = 300;
      const frag1 = createFrag(4, 150);
      const frag2 = createFrag(5, 100);
      const frag3 = createFrag(6, 201);
      cacheSet(frag1, frag1.data!);
      cacheSet(frag2, frag2.data!);
      expect(controller.cached).to.have.lengthOf(2);
      expect(controller.cachedSize).to.equal(250);

      // Adding frag3 pushes total to 451, exceeding 300 limit
      cacheSet(frag3, frag3.data!);

      // frag1 (150) and frag2 (100) evicted => total = 201
      expect(controller.cached).to.have.lengthOf(1);
      expect(controller.cached[0].sn).to.equal(6);
      expect(controller.cachedSize).to.equal(201);
      expect(frag1.data).to.be.undefined;
    });

    it('keeps at least one entry even if it exceeds the limit', function () {
      controller.hls.config.iframeCacheLimit = 50;
      const frag = createFrag(0, 100);
      cacheSet(frag, frag.data!);
      expect(controller.cached).to.have.lengthOf(1);
      expect(controller.cachedSize).to.equal(100);
      expect(frag.data).to.not.be.undefined;
    });

    it('recalculates size when evicted fragment data was already cleared', function () {
      controller.hls.config.iframeCacheLimit = 250;
      const frag1 = createFrag(1, 100);
      const frag2 = createFrag(2, 100);
      const frag3 = createFrag(3, 200);
      cacheSet(frag1, frag1.data!);
      cacheSet(frag2, frag2.data!);
      // Externally clear frag1.data (simulates fragment tracker removal)
      frag1.data = undefined;

      // Adding frag3 pushes cachedSize to 400, exceeding 250
      // Evicting frag1 finds data already cleared, triggers recalculation and break
      cacheSet(frag3, frag3.data!);
      expect(controller.cached).to.have.lengthOf(2);
      expect(controller.cached[0].sn).to.equal(2);
      expect(controller.cached[1].sn).to.equal(3);
    });
  });
});
