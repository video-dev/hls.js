import TransmuxerInterface from '../../../src/demux/transmuxer-interface';
import { TransmuxState, TransmuxConfig } from '../../../src/demux/transmuxer';

const sinon = require('sinon');

describe('TransmuxerInterface tests', function () {
  it('can construct without a worker', function () {
    let config = { enableWorker: false }; // Option debug : true crashes mocha
    let hls = {
      trigger: function () {},
      config: config
    };
    let id = 'main';
    let transmuxerInterface = new TransmuxerInterface(hls, id);

    expect(transmuxerInterface.hls).to.equal(hls, 'Hls object created');
    expect(transmuxerInterface.id).to.equal(id, 'Id has been set up');
    expect(transmuxerInterface.observer.trigger).to.exist;
    expect(transmuxerInterface.observer.off).to.exist;
    expect(transmuxerInterface.transmuxer).to.exist;
  });

  it('can construct with a worker', function () {
    let config = { enableWorker: true }; // Option debug : true crashes mocha
    let hls = {
      trigger: function () {},
      config: config
    };
    let id = 'main';
    let transmuxerInterface = new TransmuxerInterface(hls, id);

    expect(transmuxerInterface.hls).to.equal(hls, 'Hls object created');
    expect(transmuxerInterface.id).to.equal(id, 'Id has been set up');

    expect(transmuxerInterface.observer.trigger, 'trigger exists').to.exist;
    expect(transmuxerInterface.observer.off, 'off exists').to.exist;
    expect(transmuxerInterface.worker, 'worker exists').to.exist;
  });

  it('can destroy a transmuxer worker', function () {
    let config = { enableWorker: true }; // Option debug : true crashes mocha
    let hls = {
      trigger: function () {},
      config: config
    };
    let id = 'main';
    let transmuxerInterface = new TransmuxerInterface(hls, id);
    transmuxerInterface.destroy();

    expect(transmuxerInterface.observer).to.not.exist;
    expect(transmuxerInterface.transmuxer).to.not.exist;
    expect(transmuxerInterface.w).to.not.exist;
  });

  it('can destroy an inline transmuxer', function () {
    let config = { enableWorker: false }; // Option debug : true crashes mocha
    let hls = {
      trigger: function () {},
      config: config
    };
    let id = 'main';
    let transmuxerInterface = new TransmuxerInterface(hls, id);
    transmuxerInterface.destroy();

    expect(transmuxerInterface.observer).to.not.exist;
    expect(transmuxerInterface.transmuxer).to.not.exist;
    expect(transmuxerInterface.w).to.not.exist;
  });

  it('pushes data to a transmuxer worker', function () {
    let config = { enableWorker: true }; // Option debug : true crashes mocha
    let hls = {
      trigger: function () {},
      config: config
    };
    let id = 'main';
    let transmuxerInterface = new TransmuxerInterface(hls, id);
    let currentFrag = {
      cc: 100,
      sn: 5,
      level: 1
    };
    // Config for push
    transmuxerInterface.frag = currentFrag;

    let newFrag = {
      decryptdata: {},
      cc: 100,
      sn: 6,
      level: 1,
      startPTS: 1000
    };
    const data = new ArrayBuffer(8);
    const initSegment = {};
    const audioCodec = '';
    const videoCodec = '';
    const duration = 0;
    const accurateTimeOffset = true;
    const transmuxIdentifier = { sn: newFrag.sn, level: newFrag.level };

    const stub = sinon.stub(transmuxerInterface.worker, 'postMessage');

    transmuxerInterface.push(data, initSegment, audioCodec, videoCodec, newFrag, duration, accurateTimeOffset, transmuxIdentifier);

    expect(stub).to.have.been.calledTwice;
    const firstCall = stub.args[0][0];
    const secondCall = stub.args[1][0];

    expect(firstCall).to.deep.equal({
      cmd: 'configure',
      config: new TransmuxConfig('', '', new Uint8Array(), 0),
      state: new TransmuxState(false, true, true, false, 1000)
    });

    expect(secondCall).to.deep.equal({
      cmd: 'demux',
      data,
      decryptdata: newFrag.decryptdata,
      transmuxIdentifier: { sn: newFrag.sn, level: newFrag.level }
    });
  });

  it('pushes data to demuxer with no worker', function () {
    let config = { enableWorker: false }; // Option debug : true crashes mocha
    let hls = {
      trigger: function () {
      },
      config: config
    };
    let id = 'main';
    let transmuxerInterface = new TransmuxerInterface(hls, id);
    let currentFrag = {
      cc: 100,
      sn: 5,
      level: 1
    };
      // Config for push
    transmuxerInterface.frag = currentFrag;

    let newFrag = {
      decryptdata: {},
      cc: 200,
      sn: 5,
      level: 2,
      start: 1000
    };
    const data = new ArrayBuffer(8);
    const initSegment = {};
    const audioCodec = '';
    const videoCodec = '';
    const duration = 0;
    const accurateTimeOffset = true;
    const transmuxIdentifier = { sn: newFrag.sn, level: newFrag.level };

    const configureStub = sinon.stub(transmuxerInterface.transmuxer, 'configure');
    const pushStub = sinon.stub(transmuxerInterface.transmuxer, 'push');
    transmuxerInterface.push(data, initSegment, audioCodec, videoCodec, newFrag, duration, accurateTimeOffset, transmuxIdentifier);

    const tConfig = new TransmuxConfig('', '', new Uint8Array(), 0);
    const state = new TransmuxState(true, false, true, true, 1000);
    expect(configureStub).to.have.been.calledOnce;
    expect(configureStub).to.have.been.calledWith(tConfig, state);

    expect(pushStub).to.have.been.calledOnce;
    expect(pushStub).to.have.been.calledWith(data, newFrag.decryptdata, transmuxIdentifier);
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

    const spy = sinon.spy(window.URL, 'revokeObjectURL');
    transmuxerInterface.onWorkerMessage(evt);
    expect(spy).to.have.been.calledOnce;
  });
});
