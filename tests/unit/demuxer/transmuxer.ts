import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { TransmuxConfig, TransmuxState } from '../../../src/demux/transmuxer';
import TransmuxerInterface from '../../../src/demux/transmuxer-interface';
import Hls from '../../../src/hls';
import { Fragment, Part } from '../../../src/loader/fragment';
import { PlaylistLevelType } from '../../../src/types/loader';
import { ChunkMetadata } from '../../../src/types/transmuxer';
import { AttrList } from '../../../src/utils/attr-list';
import type Transmuxer from '../../../src/demux/transmuxer';
import type { MediaFragment } from '../../../src/loader/fragment';
import type { TransmuxerResult } from '../../../src/types/transmuxer';
import type { TimestampOffset } from '../../../src/utils/timescale-conversion';

use(sinonChai);

describe('TransmuxerInterface tests', function () {
  let hls;

  afterEach(function () {
    sinon.restore();
    if (hls) {
      hls.destroy();
    }
  });

  const onTransmuxComplete = (res: TransmuxerResult) => {};
  const onFlush = (meta: ChunkMetadata) => {};

  it('can construct without a worker', function () {
    const config = { enableWorker: false }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const id = PlaylistLevelType.MAIN;
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      id,
      onTransmuxComplete,
      onFlush,
    ) as any;
    expect(transmuxerInterface.hls).to.equal(hls, 'Hls object created');
    expect(transmuxerInterface.id).to.equal(id, 'Id has been set up');
    expect(transmuxerInterface.observer.emit, 'emit exists').to.exist;
    expect(transmuxerInterface.observer.off, 'off exists').to.exist;
    expect(transmuxerInterface.workerContext, 'workerContext is null').to.not
      .exist;
  });

  it('can construct with a worker', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const id = PlaylistLevelType.MAIN;
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      id,
      onTransmuxComplete,
      onFlush,
    ) as any;
    expect(transmuxerInterface.hls).to.equal(hls, 'Hls object created');
    expect(transmuxerInterface.id).to.equal(id, 'Id has been set up');
    expect(transmuxerInterface.observer.emit, 'emit exists').to.exist;
    expect(transmuxerInterface.observer.off, 'off exists').to.exist;
    expect(transmuxerInterface.workerContext, 'workerContext exists').to.exist;
  });

  it('can destroy a transmuxer worker', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const id = PlaylistLevelType.MAIN;
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      id,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;
    transmuxerInterface.destroy();
    expect(transmuxerInterfacePrivates.observer, 'observer').to.not.exist;
    expect(transmuxerInterfacePrivates.transmuxer, 'transmuxer').to.not.exist;
    expect(transmuxerInterfacePrivates.workerContext, 'workerContext').to.not
      .exist;
  });

  it('can destroy an inline transmuxer', function () {
    const config = { enableWorker: false }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const id = PlaylistLevelType.MAIN;
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      id,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;
    transmuxerInterface.destroy();
    expect(transmuxerInterfacePrivates.observer, 'observer').to.not.exist;
    expect(transmuxerInterfacePrivates.transmuxer, 'transmuxer').to.not.exist;
    expect(transmuxerInterfacePrivates.workerContext, 'workerContext').to.not
      .exist;
  });

  it('pushes data to a transmuxer worker', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const id = PlaylistLevelType.MAIN;
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      id,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;
    const stub = sinon.stub(
      transmuxerInterfacePrivates.workerContext.worker,
      'postMessage',
    );
    const currentFrag = new Fragment(PlaylistLevelType.MAIN, '');
    currentFrag.cc = 100;
    currentFrag.sn = 5;
    currentFrag.level = 1;
    // Config for push
    transmuxerInterfacePrivates.frag = currentFrag;

    const part = null;
    const data = new ArrayBuffer(8);
    const initSegmentData = new Uint8Array(0);
    const audioCodec = '';
    const videoCodec = '';
    const duration = 0;
    const accurateTimeOffset = true;
    let chunkMeta = new ChunkMetadata(currentFrag.level, currentFrag.sn + 1, 0);
    let state = new TransmuxState(false, true, true, false, 0, false);
    transmuxerInterface.push(
      data,
      initSegmentData,
      audioCodec,
      videoCodec,
      currentFrag as MediaFragment,
      part,
      duration,
      accurateTimeOffset,
      chunkMeta,
    );

    expect(stub).to.have.been.calledOnce;
    const firstCall = stub.args[0][0];
    expect(
      firstCall,
      'Demux call 1: ' + JSON.stringify(firstCall, null, 2),
    ).to.deep.include({
      cmd: 'demux',
      data,
      decryptdata: currentFrag.decryptdata,
      chunkMeta,
      state,
    });

    const newFrag = new Fragment(PlaylistLevelType.MAIN, '');
    newFrag.cc = 100;
    newFrag.sn = 6;
    newFrag.level = 1;
    newFrag.start = 1000;
    newFrag.startPTS = 1000;
    chunkMeta = new ChunkMetadata(newFrag.level, newFrag.sn, 0);
    state = new TransmuxState(false, true, true, false, 1000, false);
    transmuxerInterface.push(
      data,
      initSegmentData,
      audioCodec,
      videoCodec,
      newFrag as MediaFragment,
      part,
      duration,
      accurateTimeOffset,
      chunkMeta,
    );

    expect(stub).to.have.been.calledTwice;
    const secondCall = stub.args[1][0];
    expect(
      secondCall,
      'Demux call 2: ' + JSON.stringify(secondCall, null, 2),
    ).to.deep.include({
      cmd: 'demux',
      data,
      decryptdata: newFrag.decryptdata,
      chunkMeta,
      state,
    });
  });

  it('pushes data to demuxer with no worker', function () {
    const config = { enableWorker: false }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const id = PlaylistLevelType.MAIN;
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      id,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;

    const currentFrag = new Fragment(PlaylistLevelType.MAIN, '');
    currentFrag.cc = 100;
    currentFrag.sn = 5;
    currentFrag.level = 1;

    // Config for push
    transmuxerInterfacePrivates.frag = currentFrag;

    const newFrag = new Fragment(PlaylistLevelType.MAIN, '');
    newFrag.cc = 200;
    newFrag.sn = 5;
    newFrag.level = 2;
    newFrag.start = 1000;
    const part = null;
    const data = new ArrayBuffer(8);
    const initSegmentData = new Uint8Array(0);
    const audioCodec = '';
    const videoCodec = '';
    const duration = 0;
    const accurateTimeOffset = true;
    const chunkMeta = new ChunkMetadata(newFrag.level, newFrag.sn, 0);

    const configureStub = sinon.stub(
      transmuxerInterfacePrivates.transmuxer,
      'configure',
    );
    const pushStub = sinon.stub(transmuxerInterfacePrivates.transmuxer, 'push');
    pushStub.returns(Promise.reject(new Error('Stubbed transmux result')));
    transmuxerInterface.push(
      data,
      initSegmentData,
      audioCodec,
      videoCodec,
      newFrag as MediaFragment,
      part,
      duration,
      accurateTimeOffset,
      chunkMeta,
    );

    const tConfig = new TransmuxConfig('', '', initSegmentData, 0);
    const state = new TransmuxState(true, false, true, true, 1000, false);
    expect(configureStub).to.have.been.calledOnce;
    expect(configureStub).to.have.been.calledWith(tConfig);

    expect(pushStub).to.have.been.calledOnce;
    expect(pushStub).to.have.been.calledWith(
      data,
      newFrag.decryptdata,
      chunkMeta,
      state,
    );
  });

  it('flags a discontinuity reached with a level switch as consecutive but not contiguous', function () {
    const config = { enableWorker: false };
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      PlaylistLevelType.MAIN,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;

    const currentFrag = new Fragment(PlaylistLevelType.MAIN, '');
    currentFrag.cc = 100;
    currentFrag.sn = 5;
    currentFrag.level = 1;
    transmuxerInterfacePrivates.frag = currentFrag;

    // next sequence number, new discontinuity sequence, different level
    const newFrag = new Fragment(PlaylistLevelType.MAIN, '');
    newFrag.cc = 101;
    newFrag.sn = 6;
    newFrag.level = 2;
    newFrag.start = 1000;
    const data = new ArrayBuffer(8);
    const initSegmentData = new Uint8Array(0);
    const chunkMeta = new ChunkMetadata(newFrag.level, newFrag.sn, 0);

    sinon.stub(transmuxerInterfacePrivates.transmuxer, 'configure');
    const pushStub = sinon.stub(transmuxerInterfacePrivates.transmuxer, 'push');
    pushStub.returns(Promise.reject(new Error('Stubbed transmux result')));
    transmuxerInterface.push(
      data,
      initSegmentData,
      '',
      '',
      newFrag as MediaFragment,
      null,
      0,
      true,
      chunkMeta,
    );

    const state = new TransmuxState(true, false, true, true, 1000, false, true);
    expect(pushStub).to.have.been.calledOnce;
    expect(pushStub).to.have.been.calledWith(
      data,
      newFrag.decryptdata,
      chunkMeta,
      state,
    );
  });

  it('flags a discontinuity switch to a level with a different sequence-number base as consecutive when it starts at the previous fragment end', function () {
    const config = { enableWorker: false };
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      PlaylistLevelType.MAIN,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;

    const currentFrag = new Fragment(PlaylistLevelType.MAIN, '');
    currentFrag.cc = 100;
    currentFrag.sn = 5;
    currentFrag.level = 0;
    currentFrag.start = 990;
    currentFrag.duration = 10;
    transmuxerInterfacePrivates.frag = currentFrag;

    // Variant Streams may number Media Segments independently (RFC 8216 6.3.2)
    const newFrag = new Fragment(PlaylistLevelType.MAIN, '');
    newFrag.cc = 101;
    newFrag.sn = 106;
    newFrag.level = 1;
    newFrag.start = currentFrag.end;
    const data = new ArrayBuffer(8);
    const initSegmentData = new Uint8Array(0);
    const chunkMeta = new ChunkMetadata(newFrag.level, newFrag.sn, 0);

    sinon.stub(transmuxerInterfacePrivates.transmuxer, 'configure');
    const pushStub = sinon.stub(transmuxerInterfacePrivates.transmuxer, 'push');
    pushStub.returns(Promise.reject(new Error('Stubbed transmux result')));
    transmuxerInterface.push(
      data,
      initSegmentData,
      '',
      '',
      newFrag as MediaFragment,
      null,
      0,
      true,
      chunkMeta,
    );

    const state = new TransmuxState(true, false, true, true, 1000, false, true);
    expect(pushStub).to.have.been.calledOnce;
    expect(pushStub).to.have.been.calledWith(
      data,
      newFrag.decryptdata,
      chunkMeta,
      state,
    );
  });

  it('does not flag a level switch as consecutive when the fragment does not start at the previous fragment end', function () {
    const config = { enableWorker: false };
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      PlaylistLevelType.MAIN,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;

    const currentFrag = new Fragment(PlaylistLevelType.MAIN, '');
    currentFrag.cc = 100;
    currentFrag.sn = 5;
    currentFrag.level = 0;
    currentFrag.start = 990;
    currentFrag.duration = 10;
    transmuxerInterfacePrivates.frag = currentFrag;

    // seek: one fragment ahead of the previous fragment end, on another level with a different base
    const newFrag = new Fragment(PlaylistLevelType.MAIN, '');
    newFrag.cc = 101;
    newFrag.sn = 107;
    newFrag.level = 1;
    newFrag.start = currentFrag.end + 10;
    const data = new ArrayBuffer(8);
    const initSegmentData = new Uint8Array(0);
    const chunkMeta = new ChunkMetadata(newFrag.level, newFrag.sn, 0);

    sinon.stub(transmuxerInterfacePrivates.transmuxer, 'configure');
    const pushStub = sinon.stub(transmuxerInterfacePrivates.transmuxer, 'push');
    pushStub.returns(Promise.reject(new Error('Stubbed transmux result')));
    transmuxerInterface.push(
      data,
      initSegmentData,
      '',
      '',
      newFrag as MediaFragment,
      null,
      0,
      true,
      chunkMeta,
    );

    const state = new TransmuxState(
      true,
      false,
      true,
      true,
      1010,
      false,
      false,
    );
    expect(pushStub).to.have.been.calledOnce;
    expect(pushStub).to.have.been.calledWith(
      data,
      newFrag.decryptdata,
      chunkMeta,
      state,
    );
  });

  it('flags a level switch at a discontinuity as consecutive when the first part of the new fragment starts at the previous part end', function () {
    const config = { enableWorker: false };
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      PlaylistLevelType.MAIN,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;

    // last part of the last fragment of the previous discontinuity sequence
    const currentFrag = new Fragment(PlaylistLevelType.MAIN, '');
    currentFrag.cc = 100;
    currentFrag.sn = 5;
    currentFrag.level = 0;
    currentFrag.start = 990;
    currentFrag.duration = 10;
    const partAttrs = new AttrList('DURATION=2');
    let currentPart = new Part(partAttrs, currentFrag as MediaFragment, '', 0);
    for (let index = 1; index < 5; index++) {
      currentPart = new Part(
        partAttrs,
        currentFrag as MediaFragment,
        '',
        index,
        currentPart,
      );
    }
    expect(currentPart.end).to.equal(1000);
    transmuxerInterfacePrivates.frag = currentFrag;
    transmuxerInterfacePrivates.part = currentPart;

    // first part of the first fragment of the next sequence, on a level with its own sequence-number base
    const newFrag = new Fragment(PlaylistLevelType.MAIN, '');
    newFrag.cc = 101;
    newFrag.sn = 106;
    newFrag.level = 1;
    newFrag.start = 1000;
    const newPart = new Part(partAttrs, newFrag as MediaFragment, '', 0);
    const chunkMeta = new ChunkMetadata(
      newFrag.level,
      newFrag.sn,
      0,
      0,
      newPart.index,
    );

    sinon.stub(transmuxerInterfacePrivates.transmuxer, 'configure');
    const pushStub = sinon.stub(transmuxerInterfacePrivates.transmuxer, 'push');
    pushStub.returns(Promise.reject(new Error('Stubbed transmux result')));
    transmuxerInterface.push(
      new ArrayBuffer(8),
      new Uint8Array(0),
      '',
      '',
      newFrag as MediaFragment,
      newPart,
      0,
      true,
      chunkMeta,
    );

    expect(pushStub).to.have.been.calledOnce;
    const state = pushStub.firstCall.args[3] as TransmuxState;
    expect(state).to.include({
      discontinuity: true,
      trackSwitch: true,
      contiguous: false,
      consecutive: true,
      timeOffset: 1000,
    });
  });

  it('does not flag the first fragment of a session as consecutive', function () {
    const config = { enableWorker: false };
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      PlaylistLevelType.MAIN,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;

    // nothing was pushed before: a start position in the middle of the playlist
    const frag = new Fragment(PlaylistLevelType.MAIN, '');
    frag.cc = 0;
    frag.sn = 10;
    frag.level = 2;
    frag.start = 100;
    const chunkMeta = new ChunkMetadata(frag.level, frag.sn, 0);

    sinon.stub(transmuxerInterfacePrivates.transmuxer, 'configure');
    const pushStub = sinon.stub(transmuxerInterfacePrivates.transmuxer, 'push');
    pushStub.returns(Promise.reject(new Error('Stubbed transmux result')));
    transmuxerInterface.push(
      new ArrayBuffer(8),
      new Uint8Array(0),
      '',
      '',
      frag as MediaFragment,
      null,
      0,
      true,
      chunkMeta,
    );

    expect(pushStub).to.have.been.calledOnce;
    const state = pushStub.firstCall.args[3] as TransmuxState;
    expect(state).to.include({
      discontinuity: true,
      trackSwitch: true,
      contiguous: false,
      consecutive: false,
      timeOffset: 100,
    });
  });

  it('sends worker generic message', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    hls = new Hls(config);
    const triggerStub = sinon.stub(hls, 'trigger');
    triggerStub.callsFake(function (event, data) {
      expect(event).to.equal(evt.data.event);
      expect(data).to.equal(evt.data.data);
      expect(transmuxerInterfacePrivates.frag).to.equal(evt.data.data.frag);
      expect(evt.data.data.id).to.equal('main');
      return true;
    });
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      PlaylistLevelType.MAIN,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;
    transmuxerInterfacePrivates.frag = {};

    const evt = {
      data: {
        event: {},
        data: {},
        instanceNo: transmuxerInterfacePrivates.instanceNo,
      },
    } as any;

    transmuxerInterfacePrivates.onWorkerMessage(evt);
    expect(triggerStub.callCount).equals(1);
  });

  it('Handles the init event', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      PlaylistLevelType.MAIN,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;
    const evt = {
      data: {
        event: 'init',
        data: {},
        instanceNo: transmuxerInterfacePrivates.instanceNo,
      },
    };

    const spy = sinon.spy(self.URL, 'revokeObjectURL');
    transmuxerInterfacePrivates.onWorkerMessage(evt);
    expect(spy).to.have.been.calledOnce;
  });

  it('Handles logger events from the worker', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    hls = new Hls(config);
    sinon.stub(hls, 'trigger');
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      PlaylistLevelType.MAIN,
      onTransmuxComplete,
      onFlush,
    );
    const transmuxerInterfacePrivates = transmuxerInterface as any;
    const evt = {
      data: {
        event: 'workerLog',
        data: {
          logType: 'log',
          message: 'testing logger',
        },
        instanceNo: transmuxerInterfacePrivates.instanceNo,
      },
    };

    const spy = sinon.spy(hls.logger, 'log');
    transmuxerInterfacePrivates.onWorkerMessage(evt);
    expect(spy).to.have.been.calledWith(evt.data.data.message);
  });
});

describe('Transmuxer', function () {
  let hls: Hls;

  afterEach(function () {
    sinon.restore();
    if (hls) {
      hls.destroy();
    }
  });

  // A Transmuxer whose demuxer and remuxer are stubs, so push() can be driven through the
  // discontinuity and track-switch branches without media data
  function createTransmuxer(defaultInitPts?: TimestampOffset) {
    hls = new Hls({ enableWorker: false });
    sinon.stub(hls, 'trigger');
    const transmuxerInterface = new TransmuxerInterface(
      hls,
      PlaylistLevelType.MAIN,
      () => {},
      () => {},
    ) as any;
    const transmuxer = transmuxerInterface.transmuxer as Transmuxer;
    const demuxer = {
      resetTimeStamp: sinon.stub(),
      resetContiguity: sinon.stub(),
      resetInitSegment: sinon.stub(),
      destroy: sinon.stub(),
    };
    const remuxer = {
      resetTimeStamp: sinon.stub(),
      resetNextTimestamp: sinon.stub(),
      resetInitSegment: sinon.stub(),
      destroy: sinon.stub(),
    };
    const transmuxerPrivates = transmuxer as any;
    transmuxerPrivates.demuxer = demuxer;
    transmuxerPrivates.remuxer = remuxer;
    sinon.stub(transmuxerPrivates, 'configureTransmuxer').returns(undefined);
    sinon
      .stub(transmuxerPrivates, 'transmux')
      .callsFake(
        (data, keyData, timeOffset, accurateTimeOffset, chunkMeta) => ({
          remuxResult: {},
          chunkMeta,
        }),
      );
    transmuxer.configure(
      new TransmuxConfig('', '', new Uint8Array(0), 0, defaultInitPts),
    );
    return { transmuxer, demuxer, remuxer };
  }

  function pushWithState(transmuxer: Transmuxer, state: TransmuxState) {
    const chunkMeta = new ChunkMetadata(1, 6, 0);
    const result = transmuxer.push(new ArrayBuffer(8), null, chunkMeta, state);
    // the stubbed transmux result comes back synchronously
    expect(result).to.have.property('chunkMeta', chunkMeta);
  }

  it('resets the remuxer timestamp as consecutive for a discontinuity reached in sequence on the same level', function () {
    const { transmuxer, remuxer } = createTransmuxer();
    // consecutive defaults to contiguous
    pushWithState(
      transmuxer,
      new TransmuxState(true, true, true, false, 1000, false),
    );
    expect(remuxer.resetTimeStamp).to.have.been.calledOnce;
    expect(remuxer.resetTimeStamp).to.have.been.calledWithExactly(null, true);
    expect(remuxer.resetNextTimestamp).to.not.have.been.called;
  });

  it('resets the remuxer timestamp as consecutive for a discontinuity reached with a level switch', function () {
    const { transmuxer, remuxer } = createTransmuxer();
    pushWithState(
      transmuxer,
      new TransmuxState(true, false, true, true, 1000, false, true),
    );
    expect(remuxer.resetTimeStamp).to.have.been.calledOnce;
    expect(remuxer.resetTimeStamp).to.have.been.calledWithExactly(null, true);
    // samples from another level are not stitched to the previous fragment
    expect(remuxer.resetNextTimestamp).to.have.been.calledOnce;
  });

  it('resets the remuxer timestamp as not consecutive for a discontinuity reached by a seek', function () {
    const { transmuxer, remuxer } = createTransmuxer();
    pushWithState(
      transmuxer,
      new TransmuxState(true, false, true, false, 1000, false, false),
    );
    expect(remuxer.resetTimeStamp).to.have.been.calledOnce;
    expect(remuxer.resetTimeStamp).to.have.been.calledWithExactly(null, false);
  });

  it('forwards the cached offset of a discontinuity sequence with the consecutive flag', function () {
    const defaultInitPts = { baseTime: 900000, timescale: 90000, trackId: 1 };
    const { transmuxer, remuxer } = createTransmuxer(defaultInitPts);
    pushWithState(
      transmuxer,
      new TransmuxState(true, false, true, false, 1000, false, false),
    );
    expect(remuxer.resetTimeStamp).to.have.been.calledOnce;
    expect(remuxer.resetTimeStamp).to.have.been.calledWithExactly(
      defaultInitPts,
      false,
    );
  });

  it('does not reset the remuxer timestamp for a contiguous push within a discontinuity sequence', function () {
    const { transmuxer, remuxer } = createTransmuxer();
    pushWithState(
      transmuxer,
      new TransmuxState(false, true, true, false, 1000, false),
    );
    expect(remuxer.resetTimeStamp).to.not.have.been.called;
  });
});
