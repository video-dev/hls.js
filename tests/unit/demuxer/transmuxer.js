import TransmuxerInterface from '../../../src/demux/transmuxer-interface';
import { TransmuxState, TransmuxConfig } from '../../../src/demux/transmuxer';
import { ChunkMetadata } from '../../../src/types/transmuxer';
import Fragment from '../../../src/loader/fragment';

const sinon = require('sinon');

describe('TransmuxerInterface tests', function () {
  it('can construct without a worker', function () {
    const config = { enableWorker: false }; // Option debug : true crashes mocha
    const hls = {
      trigger: function () {},
      config: config
    };
    const id = 'main';
    const transmuxerInterface = new TransmuxerInterface(hls, id);

    expect(transmuxerInterface.hls).to.equal(hls, 'Hls object created');
    expect(transmuxerInterface.id).to.equal(id, 'Id has been set up');
    expect(transmuxerInterface.observer.emit).to.exist;
    expect(transmuxerInterface.observer.off).to.exist;
    expect(transmuxerInterface.transmuxer).to.exist;
  });

  it('can construct with a worker', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    const hls = {
      trigger: function () {},
      config: config
    };
    const id = 'main';
    const transmuxerInterface = new TransmuxerInterface(hls, id);

    expect(transmuxerInterface.hls).to.equal(hls, 'Hls object created');
    expect(transmuxerInterface.id).to.equal(id, 'Id has been set up');

    expect(transmuxerInterface.observer.emit, 'emit exists').to.exist;
    expect(transmuxerInterface.observer.off, 'off exists').to.exist;
    expect(transmuxerInterface.worker, 'worker exists').to.exist;
  });

  it('can destroy a transmuxer worker', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    const hls = {
      trigger: function () {},
      config: config
    };
    const id = 'main';
    const transmuxerInterface = new TransmuxerInterface(hls, id);
    transmuxerInterface.destroy();

    expect(transmuxerInterface.observer).to.not.exist;
    expect(transmuxerInterface.transmuxer).to.not.exist;
    expect(transmuxerInterface.w).to.not.exist;
  });

  it('can destroy an inline transmuxer', function () {
    const config = { enableWorker: false }; // Option debug : true crashes mocha
    const hls = {
      trigger: function () {},
      config: config
    };
    const id = 'main';
    const transmuxerInterface = new TransmuxerInterface(hls, id);
    transmuxerInterface.destroy();

    expect(transmuxerInterface.observer).to.not.exist;
    expect(transmuxerInterface.transmuxer).to.not.exist;
    expect(transmuxerInterface.w).to.not.exist;
  });

  it('pushes data to a transmuxer worker', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    const hls = {
      trigger: function () {},
      config: config
    };
    const id = 'main';
    const transmuxerInterface = new TransmuxerInterface(hls, id);
    const currentFrag = new Fragment();
    currentFrag.cc = 100;
    currentFrag.sn = 5;
    currentFrag.level = 1;
    // Config for push
    transmuxerInterface.frag = currentFrag;

    const newFrag = new Fragment();
    newFrag.cc = 100;
    newFrag.sn = 6;
    newFrag.level = 1;
    newFrag.startPTS = 1000;

    const data = new ArrayBuffer(8);
    const initSegment = {};
    const audioCodec = '';
    const videoCodec = '';
    const duration = 0;
    const accurateTimeOffset = true;
    const chunkMeta = new ChunkMetadata(newFrag.level, newFrag.sn);

    const stub = sinon.stub(transmuxerInterface.worker, 'postMessage');

    transmuxerInterface.push(data, initSegment, audioCodec, videoCodec, newFrag, duration, accurateTimeOffset, chunkMeta);

    expect(stub).to.have.been.calledTwice;
    const firstCall = stub.args[0][0];
    const secondCall = stub.args[1][0];

    expect(firstCall, 'Configure call').to.deep.equal({
      cmd: 'configure',
      config: new TransmuxConfig('', '', new Uint8Array(), 0),
      state: new TransmuxState(false, true, true, false, 1000)
    });

    expect(secondCall, 'Demux call').to.deep.equal({
      cmd: 'demux',
      data,
      decryptdata: newFrag.decryptdata,
      chunkMeta
    });
  });

  it('pushes data to demuxer with no worker', function () {
    const config = { enableWorker: false }; // Option debug : true crashes mocha
    const hls = {
      trigger: function () {
      },
      config: config
    };
    const id = 'main';
    const transmuxerInterface = new TransmuxerInterface(hls, id);

    const currentFrag = new Fragment();
    currentFrag.cc = 100;
    currentFrag.sn = 5;
    currentFrag.level = 1;

    // Config for push
    transmuxerInterface.frag = currentFrag;

    const newFrag = new Fragment();
    newFrag.cc = 200;
    newFrag.sn = 5;
    newFrag.level = 2;
    newFrag.start = 1000;

    const data = new Uint8Array(new ArrayBuffer(8));
    const initSegment = {};
    const audioCodec = '';
    const videoCodec = '';
    const duration = 0;
    const accurateTimeOffset = true;
    const chunkMeta = new ChunkMetadata(newFrag.level, newFrag.sn, 0);

    const configureStub = sinon.stub(transmuxerInterface.transmuxer, 'configure');
    const pushStub = sinon.stub(transmuxerInterface.transmuxer, 'push');
    pushStub.returns(Promise.reject(new Error('Stubbed transmux result')));
    transmuxerInterface.push(data, initSegment, audioCodec, videoCodec, newFrag, duration, accurateTimeOffset, chunkMeta);

    const tConfig = new TransmuxConfig('', '', new Uint8Array(), 0);
    const state = new TransmuxState(true, false, true, true, 1000);
    expect(configureStub).to.have.been.calledOnce;
    expect(configureStub).to.have.been.calledWith(tConfig, state);

    expect(pushStub).to.have.been.calledOnce;
    expect(pushStub).to.have.been.calledWith(data, newFrag.decryptdata, chunkMeta);
  });

  it('sends worker generic message', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    const hls = {
      trigger: function (event, data) {},
      config: config
    };
    const transmuxerInterface = new TransmuxerInterface(hls, 'main');
    transmuxerInterface.frag = {};

    const evt = {
      data: {
        event: {},
        data: {}
      }
    };

    hls.trigger = function (event, data) {
      expect(event).to.equal(evt.data.event);
      expect(data).to.equal(evt.data.data);
      expect(transmuxerInterface.frag).to.equal(evt.data.data.frag);
      expect(evt.data.data.id).to.equal('main');
    };

    transmuxerInterface.onWorkerMessage(evt);
  });

  it('Handles the init event', function () {
    const config = { enableWorker: true }; // Option debug : true crashes mocha
    const hls = {
      trigger: function (event, data) {},
      config: config
    };
    const transmuxerInterface = new TransmuxerInterface(hls, 'main');
    const evt = {
      data: {
        event: 'init',
        data: {}
      }
    };

    const spy = sinon.spy(self.URL, 'revokeObjectURL');
    transmuxerInterface.onWorkerMessage(evt);
    expect(spy).to.have.been.calledOnce;
  });
});
