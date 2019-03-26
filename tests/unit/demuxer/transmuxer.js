import TransmuxerInterface from '../../../src/demux/transmuxer-interface';

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
    let data = new ArrayBuffer(8),
      initSegment = {},
      audioCodec = {},
      videoCodec = {},
      duration = {},
      accurateTimeOffset = {},
      defaultInitPTS = {};

    let stub = sinon.stub(transmuxerInterface.worker, 'postMessage').callsFake(function (obj1, obj2) {
      expect(obj1.cmd).to.equal('demux', 'cmd');
      expect(obj1.data).to.equal(data, 'data');
      expect(obj1.decryptdata).to.equal(newFrag.decryptdata, 'decryptdata');
      expect(obj1.initSegment).to.equal(initSegment, 'initSegment');
      expect(obj1.audioCodec).to.equal(audioCodec, 'audioCodec');
      expect(obj1.videoCodec).to.equal(videoCodec, 'videoCodec');
      expect(obj1.timeOffset).to.equal(newFrag.startPTS, 'timeOffset');
      expect(obj1.discontinuity).to.be.false;
      expect(obj1.trackSwitch).to.be.false;
      expect(obj1.contiguous).to.be.true;
      expect(obj1.duration).to.equal(duration, 'duration');
      expect(obj1.defaultInitPTS).to.equal(defaultInitPTS, 'defaultInitPTS');
      expect(obj2[0]).to.equal(data, 'ArrayBuffer');
    });

    transmuxerInterface.push(data, initSegment, audioCodec, videoCodec, newFrag, duration, accurateTimeOffset, defaultInitPTS);

    expect(stub).to.have.been.calledOnce;
  });

  it('pushes data to demuxer with no worker', function () {
    let config = { enableWorker: false }; // Option debug : true crashes mocha
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
      cc: 200,
      sn: 5,
      level: 2,
      start: 1000
    };
    let data = {},
      initSegment = {},
      audioCodec = {},
      videoCodec = {},
      duration = {},
      accurateTimeOffset = {},
      defaultInitPTS = {};

    let stub = sinon.stub(transmuxerInterface.transmuxer, 'push').callsFake(function (obj1, obj2, obj3, obj4, obj5, obj6, obj7, obj8, obj9, obj10, obj11, obj12) {
      expect(obj1).to.equal(data);
      expect(obj2).to.equal(newFrag.decryptdata);
      expect(obj3).to.equal(initSegment);
      expect(obj4).to.equal(audioCodec);
      expect(obj5).to.equal(videoCodec);
      expect(obj6).to.equal(newFrag.start);
      expect(obj7).to.be.true;
      expect(obj8).to.be.true;
      expect(obj9).to.be.false;
      expect(obj10).to.equal(duration);
      expect(obj11).to.equal(accurateTimeOffset);
      expect(obj12).to.equal(defaultInitPTS);
    });

    transmuxerInterface.push(data, initSegment, audioCodec, videoCodec, newFrag, duration, accurateTimeOffset, defaultInitPTS);
    expect(stub).to.have.been.calledWith(data, newFrag.decryptdata, initSegment, audioCodec, videoCodec, newFrag.start, true, true, false, duration, accurateTimeOffset, defaultInitPTS);
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
