const assert = require('assert');
const sinon = require('sinon');

import Event from '../../../src/events.js';
import Demuxer from '../../../src/demux/demuxer.js';

describe('Demuxer tests', function () {
  it('Demuxer constructor no worker', function () {
    let config = { enableWorker: false }; // Option debug : true crashes mocha
    let hls = {
      trigger: function () {},
      config: config
    };
    let id = 'main';
    let demux = new Demuxer(hls, id);

    assert.equal(demux.hls, hls, 'Hls object created');
    assert.equal(demux.id, id, 'Id has been set up');

    assert.ok(demux.observer.trigger, 'Observer trigger set up');
    assert.ok(demux.observer.off, 'Observer off set up');
    assert.ok(demux.demuxer, 'Demuxer set up');
  });

  it('Demuxer constructor with worker', function () {
    let config = { enableWorker: true }; // Option debug : true crashes mocha
    let hls = {
      trigger: function () {},
      config: config
    };
    let id = 'main';
    let demux = new Demuxer(hls, id);

    assert.equal(demux.hls, hls, 'Hls object created');
    assert.equal(demux.id, id, 'Id has been set up');

    assert.ok(demux.observer.trigger, 'Observer trigger set up');
    assert.ok(demux.observer.off, 'Observer off set up');
    assert.ok(demux.w, 'Worker set up');
  });

  it('Destroy demuxer worker', function () {
    let config = { enableWorker: true }; // Option debug : true crashes mocha
    let hls = {
      trigger: function () {},
      config: config
    };
    let id = 'main';
    let demux = new Demuxer(hls, id);
    demux.destroy();

    assert.equal(demux.observer, null, 'Observer destroyed');
    assert.equal(demux.demuxer, null, 'Demuxer destroyed');
    assert.equal(demux.w, null, 'Worker destroyed');
  });

  it('Destroy demuxer no worker', function () {
    let config = { enableWorker: false }; // Option debug : true crashes mocha
    let hls = {
      trigger: function () {},
      config: config
    };
    let id = 'main';
    let demux = new Demuxer(hls, id);
    demux.destroy();

    assert.equal(demux.observer, null, 'Observer destroyed');
    assert.equal(demux.demuxer, null, 'Demuxer destroyed');
    assert.equal(demux.w, null, 'Worker destroyed');
  });

  it('Push data to demuxer with worker', function () {
    let config = { enableWorker: true }; // Option debug : true crashes mocha
    let hls = {
      trigger: function () {},
      config: config
    };
    let id = 'main';
    let demux = new Demuxer(hls, id);
    let currentFrag = {
      cc: 100,
      sn: 5,
      level: 1
    };
    // Config for push
    demux.frag = currentFrag;

    let newFrag = {
      decryptdata: {},
      cc: 100,
      sn: 6,
      level: 1,
      startDTS: 1000,
      start: undefined
    };
    let data = new ArrayBuffer(8),
      initSegment = {},
      audioCodec = {},
      videoCodec = {},
      duration = {},
      accurateTimeOffset = {},
      defaultInitPTS = {};

    let stub = sinon.stub(demux.w, 'postMessage').callsFake(function (obj1, obj2) {
      assert.equal(obj1.cmd, 'demux', 'cmd');
      assert.equal(obj1.data, data, 'data');
      assert.equal(obj1.decryptdata, newFrag.decryptdata, 'decryptdata');
      assert.equal(obj1.initSegment, initSegment, 'initSegment');
      assert.equal(obj1.audioCodec, audioCodec, 'audioCodec');
      assert.equal(obj1.videoCodec, videoCodec, 'videoCodec');
      assert.equal(obj1.timeOffset, newFrag.startDTS, 'timeOffset');
      assert.equal(obj1.discontinuity, false, 'discontinuity');
      assert.equal(obj1.trackSwitch, false, 'trackSwitch');
      assert.equal(obj1.contiguous, true, 'contiguous');
      assert.equal(obj1.duration, duration, 'duration');
      assert.equal(obj1.defaultInitPTS, defaultInitPTS, 'defaultInitPTS');
      assert.equal(obj2[0], data, 'ArrayBuffer');
    });

    demux.push(data, initSegment, audioCodec, videoCodec, newFrag, duration, accurateTimeOffset, defaultInitPTS);

    assert.ok(stub.calledOnce, 'postMessage called once');
  });

  it('Push data to demuxer with no worker', function () {
    let config = { enableWorker: false }; // Option debug : true crashes mocha
    let hls = {
      trigger: function () {},
      config: config
    };
    let id = 'main';
    let demux = new Demuxer(hls, id);
    let currentFrag = {
      cc: 100,
      sn: 5,
      level: 1
    };
    // Config for push
    demux.frag = currentFrag;

    let newFrag = {
      decryptdata: {},
      cc: 200,
      sn: 5,
      level: 2,
      startDTS: undefined,
      start: 1000
    };
    let data = {},
      initSegment = {},
      audioCodec = {},
      videoCodec = {},
      duration = {},
      accurateTimeOffset = {},
      defaultInitPTS = {};

    let stub = sinon.stub(demux.demuxer, 'push').callsFake(function (obj1, obj2, obj3, obj4, obj5, obj6, obj7, obj8, obj9, obj10, obj11, obj12, obj13) {
      assert.equal(obj1, data);
      assert.equal(obj2, newFrag.decryptdata);
      assert.equal(obj3, initSegment);
      assert.equal(obj4, audioCodec);
      assert.equal(obj5, videoCodec);
      assert.equal(obj6, newFrag.start);
      assert.equal(obj7, true);
      assert.equal(obj8, true);
      assert.equal(obj9, false);
      assert.equal(obj10, duration);
      assert.equal(obj11, accurateTimeOffset);
      assert.equal(obj12, defaultInitPTS);
    });

    demux.push(data, initSegment, audioCodec, videoCodec, newFrag, duration, accurateTimeOffset, defaultInitPTS);

    assert.ok(stub.calledWith(data, newFrag.decryptdata, initSegment, audioCodec, videoCodec, newFrag.start, true, true, false, duration, accurateTimeOffset, defaultInitPTS));
  });

  it('Sent worker generic message', function () {
    let config = { enableWorker: true }; // Option debug : true crashes mocha
    let hls = {
      trigger: function (event, data) {},
      config: config
    };
    let id = 'main';
    let demux = new Demuxer(hls, id);
    demux.frag = {};

    let evt = {
      data: {
        event: {},
        data: {}
      }
    };

    hls.trigger = function (event, data) {
      assert.equal(event, evt.data.event);
      assert.equal(data, evt.data.data);
      assert.equal(demux.frag, evt.data.data.frag);
      assert.equal(id, evt.data.data.id);
    };

    demux.onWorkerMessage(evt);
  });

  it('Sent worker message type main', function () {
    let config = { enableWorker: true }; // Option debug : true crashes mocha
    let hls = {
      trigger: function (event, data) {},
      config: config
    };
    let id = 'main';
    let demux = new Demuxer(hls, id);

    let evt = {
      data: {
        event: 'init',
        data: {}
      }
    };

    let spy = sinon.spy(window.URL, 'revokeObjectURL');

    demux.onWorkerMessage(evt);

    assert.ok(spy.calledOnce);
  });

  it('Sent worker message FRAG_PARSING_DATA', function () {
    let config = { enableWorker: true }; // Option debug : true crashes mocha
    let hls = {
      trigger: function () {},
      config: config
    };
    let id = 'main';
    let demux = new Demuxer(hls, id);

    let evt = {
      data: {
        event: Event.FRAG_PARSING_DATA,
        data: {},
        data1: {},
        data2: {}
      }
    };

    demux.onWorkerMessage(evt);

    assert.ok(evt.data.data.data1);
    assert.ok(evt.data.data.data2);
  });
});
