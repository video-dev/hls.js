import { expect } from 'chai';
import sinon from 'sinon';
import { State } from '../../../src/controller/base-stream-controller';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import { LoadStats } from '../../../src/loader/load-stats';
import { ChunkMetadata } from '../../../src/types/transmuxer';
import { findBox } from '../../../src/utils/mp4-tools';
import type {
  HlsImageIFramesOnly,
  IFrameController,
} from '../../../src/controller/iframe-controller';
import type { ImageIFrameStreamController } from '../../../src/controller/image-iframe-stream-controller';
import type PlaylistLoader from '../../../src/loader/playlist-loader';
import type {
  ComponentAPI,
  NetworkComponentAPI,
} from '../../../src/types/component-api';
import type { ErrorData } from '../../../src/types/events';
import type { RemuxedTrack } from '../../../src/types/remuxer';

type HlsTestable = Omit<Hls, 'networkControllers' | 'coreComponents'> & {
  coreComponents: ComponentAPI[];
  networkControllers: NetworkComponentAPI[];
  iframeController: IFrameController;
};

type PlaylistLoaderTestable = Omit<PlaylistLoader, 'handleMasterPlaylist'> & {
  handleMasterPlaylist: (
    response: { data: string; url: string },
    stats: LoadStats,
  ) => void;
};

type ImageIFrameStreamControllerTestable = Omit<
  ImageIFrameStreamController,
  | 'state'
  | 'fragCurrent'
  | 'fragmentTracker'
  | 'hls'
  | '_bufferInitSegment'
  | 'bufferFragmentData'
  | 'media'
> & {
  state: string;
  fragCurrent: any;
  fragmentTracker: any;
  hls: any;
  media: any;
  _bufferInitSegment(): void;
  bufferFragmentData(
    data: RemuxedTrack,
    frag: any,
    part: any,
    chunkMeta: ChunkMetadata,
  ): void;
};

const silentLogger = {
  trace: () => null,
  debug: () => null,
  log: () => null,
  warn: () => null,
  info: () => null,
  error: () => null,
};

const playlistWithImageIFrameVariants = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=7495785,CODECS="avc1.64002A,mp4a.40.2",RESOLUTION=1920x1080
video/avc1/1/media.m3u8
#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=50000,CODECS="mjpg",RESOLUTION=960x540,URI="video/mjpg/iframes.m3u8"
`;

function buildMdatBox(
  payload: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> {
  const size = 8 + payload.length;
  const box = new Uint8Array(size);
  new DataView(box.buffer).setUint32(0, size);
  box.set([0x6d, 0x64, 0x61, 0x74], 4); // "mdat"
  box.set(payload, 8);
  return box;
}

function createImagePlayer(
  hls: HlsTestable,
): [HlsImageIFramesOnly, ImageIFrameStreamControllerTestable] {
  const playlistLoader = hls.networkControllers[0] as PlaylistLoaderTestable;
  const iframeController = hls.iframeController;
  const url = 'main.m3u8';
  (iframeController as any).clearAsset();
  (hls as any)._url = url;
  playlistLoader.handleMasterPlaylist(
    { data: playlistWithImageIFrameVariants, url },
    new LoadStats(),
  );
  const imagePlayer = iframeController.createImageIFramePlayer();
  if (!imagePlayer) {
    throw new Error('createImageIFramePlayer returned null');
  }
  const controller = (imagePlayer as any)
    .streamController as ImageIFrameStreamControllerTestable;
  return [imagePlayer, controller];
}

describe('ImageIFrameStreamController', function () {
  const sandbox = sinon.createSandbox();
  let hls: HlsTestable;

  beforeEach(function () {
    hls = new Hls({
      autoStartLoad: false,
      debug: silentLogger,
    }) as unknown as HlsTestable;
  });

  afterEach(function () {
    hls.destroy();
    sandbox.restore();
  });

  it('getMainFwdBufferInfo returns zero-length buffer', function () {
    const [, controller] = createImagePlayer(hls);
    const info = controller.getMainFwdBufferInfo();
    expect(info).to.have.property('len', 0);
  });

  it('loadMediaAt transitions from STOPPED to IDLE', function () {
    const [imagePlayer] = createImagePlayer(hls);
    const controller = (imagePlayer as any)
      .streamController as ImageIFrameStreamControllerTestable;
    expect(controller.state).to.equal(State.STOPPED);
    imagePlayer.loadMediaAt(5);
    // State should have transitioned (may end up IDLE or further depending on tick)
    expect(controller.state).to.equal(State.IDLE);
  });

  it('loadMediaAt with negative time is ignored', function () {
    const [imagePlayer] = createImagePlayer(hls);
    const controller = (imagePlayer as any)
      .streamController as ImageIFrameStreamControllerTestable;
    expect(controller.state).to.equal(State.STOPPED);
    imagePlayer.loadMediaAt(-1);
    expect(controller.state).to.equal(State.STOPPED);
  });

  it('image setter revokes previous Blob URL', function () {
    const [, controller] = createImagePlayer(hls);
    const revokeStub = sandbox.stub(self.URL, 'revokeObjectURL');

    const img = new Image();
    controller.image = img;
    expect(revokeStub).to.not.have.been.called;

    // Set src to simulate a Blob URL
    img.src = 'blob:http://localhost/fake-url';
    const img2 = new Image();
    controller.image = img2;
    expect(revokeStub).to.have.been.calledOnce;
    expect(revokeStub).to.have.been.calledWith(
      'blob:http://localhost/fake-url',
    );

    controller.image = undefined;
  });

  it('bufferFragmentData extracts JPEG bytes from mdat box', function () {
    const [, controller] = createImagePlayer(hls);
    const jpegPayload = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]);
    const mdatBox = buildMdatBox(jpegPayload);

    const frag: any = {
      sn: 0,
      level: 0,
      type: 'main',
      start: 0,
      duration: 2,
      stats: {
        buffering: {},
        retry: 0,
      },
    };

    const data: RemuxedTrack = {
      data1: mdatBox,
      data2: undefined as any,
      startPTS: 0,
      endPTS: 2,
      startDTS: 0,
      endDTS: 2,
      type: 'video',
      hasAudio: false,
      hasVideo: true,
      nb: 1,
      dropped: 0,
      independent: true,
      firstKeyFrame: 0,
      firstKeyFramePTS: 0,
    };

    // Set state to PARSING so bufferFragmentData processes data
    controller.state = State.PARSING;
    controller.fragCurrent = frag;

    // Stub fragmentTracker.fragBuffered to prevent errors in fragBufferedComplete
    controller.fragmentTracker = {
      getState: () => null,
      fragBuffered: sandbox.stub(),
      getBufferedFrag: () => null,
      removeFragment: sandbox.stub(),
      removeFragmentsInRange: sandbox.stub(),
      isEndListAppended: () => false,
    };

    // Provide a stub for image so updateImage processes the data
    const img = new Image();
    controller.image = img;
    sandbox.stub(self.URL, 'createObjectURL').returns('blob:fake');
    sandbox.stub(self.URL, 'revokeObjectURL');

    controller.bufferFragmentData(
      data,
      frag,
      null,
      new ChunkMetadata(0, 0, 0, 0, -1, false, 2),
    );

    // Verify JPEG bytes were extracted and stored on fragment
    expect(frag.data).to.be.an.instanceOf(Uint8Array);
    // Verify the extracted bytes match the mdat payload by using findBox
    const extracted = findBox(mdatBox, ['mdat']);
    expect(extracted).to.have.lengthOf(1);
    expect(Array.from(frag.data)).to.deep.equal(Array.from(extracted[0]));
  });

  it('bufferFragmentData triggers error when no mdat box is found', function () {
    const [imagePlayer, controller] = createImagePlayer(hls);
    // Data that is not a valid mdat box
    const noMdatData = new Uint8Array([0, 0, 0, 8, 0x66, 0x72, 0x65, 0x65]); // "free" box

    const frag: any = {
      sn: 0,
      level: 0,
      type: 'main',
      start: 0,
      duration: 2,
      stats: { buffering: {} },
    };

    const data: RemuxedTrack = {
      data1: noMdatData,
      data2: undefined,
      startPTS: 0,
      endPTS: 2,
      startDTS: 0,
      endDTS: 2,
      type: 'video',
      hasAudio: false,
      hasVideo: true,
      nb: 1,
      dropped: 0,
      independent: true,
      firstKeyFrame: 0,
      firstKeyFramePTS: 0,
    };

    controller.state = State.PARSING;
    controller.fragCurrent = frag;
    controller.fragmentTracker = {
      getState: () => null,
      fragBuffered: sandbox.stub(),
      getBufferedFrag: () => null,
      removeFragment: sandbox.stub(),
      removeFragmentsInRange: sandbox.stub(),
      isEndListAppended: () => false,
    };

    const triggerSpy = sandbox.spy(imagePlayer, 'trigger');

    controller.bufferFragmentData(
      data,
      frag,
      null,
      new ChunkMetadata(0, 0, 0, 0, -1, false, 2),
    );

    expect(triggerSpy).to.have.been.calledWith(Events.ERROR);
    const errorCall = triggerSpy
      .getCalls()
      .filter((call) => call.args[0] === Events.ERROR);
    expect(errorCall).to.have.lengthOf(1);
    const errorEventData = errorCall[0].args[1] as ErrorData;
    expect(errorEventData).to.have.property('error');
    if (errorEventData) {
      expect(errorEventData.error.message).to.equal(
        'Could not find I-Frame mdat',
      );
    }
  });

  it('updateImage sets image.src when image element is attached', function () {
    const [, controller] = createImagePlayer(hls);
    const jpegPayload = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const mdatBox = buildMdatBox(jpegPayload);

    const frag: any = {
      sn: 0,
      level: 0,
      type: 'main',
      start: 0,
      duration: 2,
      stats: { buffering: {}, retry: 0 },
    };

    const data: RemuxedTrack = {
      data1: mdatBox,
      data2: undefined,
      startPTS: 0,
      endPTS: 2,
      startDTS: 0,
      endDTS: 2,
      type: 'video',
      hasAudio: false,
      hasVideo: true,
      nb: 1,
      dropped: 0,
      independent: true,
      firstKeyFrame: 0,
      firstKeyFramePTS: 0,
    };

    controller.state = State.PARSING;
    controller.fragCurrent = frag;
    controller.fragmentTracker = {
      getState: () => null,
      fragBuffered: sandbox.stub(),
      getBufferedFrag: () => null,
      removeFragment: sandbox.stub(),
      removeFragmentsInRange: sandbox.stub(),
      isEndListAppended: () => false,
    };

    const img = new Image();
    controller.image = img;

    const createURLStub = sandbox
      .stub(self.URL, 'createObjectURL')
      .returns('blob:http://localhost/jpeg-url');
    sandbox.stub(self.URL, 'revokeObjectURL');

    controller.bufferFragmentData(
      data,
      frag,
      null,
      new ChunkMetadata(0, 0, 0, 0, -1, false, 2),
    );

    expect(createURLStub).to.have.been.calledOnce;
    expect(img.src).to.equal('blob:http://localhost/jpeg-url');
  });

  it('updateImage transitions to STOPPED when no image element is attached', function () {
    const [, controller] = createImagePlayer(hls);
    const jpegPayload = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const mdatBox = buildMdatBox(jpegPayload);

    const frag: any = {
      sn: 0,
      level: 0,
      type: 'main',
      start: 0,
      duration: 2,
      stats: { buffering: {} },
    };

    const data: RemuxedTrack = {
      data1: mdatBox,
      data2: undefined,
      startPTS: 0,
      endPTS: 2,
      startDTS: 0,
      endDTS: 2,
      type: 'video',
      hasAudio: false,
      hasVideo: true,
      nb: 1,
      dropped: 0,
      independent: true,
      firstKeyFrame: 0,
      firstKeyFramePTS: 0,
    };

    controller.state = State.PARSING;
    controller.fragCurrent = frag;
    controller.fragmentTracker = {
      getState: () => null,
      fragBuffered: sandbox.stub(),
      getBufferedFrag: () => null,
      removeFragment: sandbox.stub(),
      removeFragmentsInRange: sandbox.stub(),
      isEndListAppended: () => false,
    };

    // No image attached
    controller.image = undefined;

    controller.bufferFragmentData(
      data,
      frag,
      null,
      new ChunkMetadata(0, 0, 0, 0, -1, false, 2),
    );

    expect(controller.state).to.equal(State.STOPPED);
  });
});
