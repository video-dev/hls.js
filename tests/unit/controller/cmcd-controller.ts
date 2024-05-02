import CMCDController from '../../../src/controller/cmcd-controller';
import HlsMock from '../../mocks/hls.mock';
import type { CMCDControllerConfig } from '../../../src/config';
import { CmcdHeaderField } from '@svta/common-media-library/cmcd/CmcdHeaderField';

import chai from 'chai';
import type { FragmentLoaderContext } from '../../../src/types/loader';

const expect = chai.expect;

let cmcdController;

const uuidRegex =
  '[a-f\\d]{8}-[a-f\\d]{4}-4[a-f\\d]{3}-[89ab][a-f\\d]{3}-[a-f\\d]{12}';

const frag = {
  url: 'https://test.com/frag1.mp4',
  level: 0,
  sn: 0,
  duration: 4,
  type: 'main',
};

const level = {
  bitrate: 1000,
  details: {
    startSN: 0,
    fragments: [
      frag,
      {
        url: 'https://test.com/frag2.mp4',
        level: 0,
        sn: 1,
        duration: 4,
        type: 'main',
      }],
    partList: [{
      url: 'https://test.com/frag1.0.mp4',
      index: 0,
      duration: 2,
      fragment: frag,
    }, {
      url: 'https://test.com/frag1.1.mp4',
      index: 1,
      duration: 2,
      fragment: frag,
    }],
  }
};

const setupEach = (cmcd?: CMCDControllerConfig) => {
  const hls = new HlsMock({ cmcd }) as any;
  hls.levelController = {
    levels: [level],
    level: 0,
  };
  hls.audioTracks = [];

  cmcdController = new CMCDController(hls);
};

const base = {
  url: 'https://test.com/test.mpd',
  headers: undefined,
};

const applyPlaylistData = (data = {}) => {
  const context = Object.assign(data, base);
  cmcdController.applyPlaylistData(context);
  return context;
};

const applyFragmentData = (data = {}) => {
  const context = Object.assign({ url: frag.url, frag }, data);
  cmcdController.applyFragmentData(context);
  return context;
};

const expectField = (result, expected) => {
  const regex = new RegExp(expected);
  expect(regex.test(result)).to.equal(true);
};

describe('CMCDController', function () {
  describe('cmcdController instance', function () {
    describe('configuration', function () {
      it('does not modify requests when disabled', function () {
        setupEach();

        const { config } = cmcdController.hls;
        expect(config.pLoader).to.equal(undefined);
        expect(config.fLoader).to.equal(undefined);
      });

      it('uses the session id if provided', function () {
        const sessionId = 'SESSION_ID';
        setupEach({ sessionId });

        const { url } = applyPlaylistData();
        expectField(url, `sid%3D%22${sessionId}%22`);
      });

      it('generates a session id if not provided', function () {
        setupEach({});

        const { url } = applyPlaylistData();
        expectField(url, `sid%3D%22${uuidRegex}%22`);
      });

      it('uses the content id if provided', function () {
        const contentId = 'CONTENT_ID';
        setupEach({ contentId });

        const { url } = applyPlaylistData();
        expectField(url, `cid%3D%22${contentId}%22`);
      });

      it('uses headers if configured', function () {
        const contentId = 'CONTENT_ID';
        setupEach({ contentId, useHeaders: true });

        const { url, headers = {} } = applyPlaylistData();

        expect(url).to.equal(base.url);
        expectField(headers[CmcdHeaderField.SESSION], `cid="${contentId}"`);
      });

      it('uses includeKeys if configured', function () {
        const contentId = 'CONTENT_ID';
        setupEach({ includeKeys: ['cid'], contentId });

        const { url } = applyPlaylistData();

        expect(url).to.equal(`${base.url}?CMCD=cid%3D%22${contentId}%22`);
      });

      it('uses fragment data', function () {
        setupEach({});

        const { url } = applyFragmentData();

        expectField(url, `nor%3D%22frag2.mp4%22`);
        expectField(url, `br%3D1`);
        expectField(url, `d%3D4000`);
      });

      it('uses part data when available', function () {
        setupEach({});

        const { url } = applyFragmentData({ part: level.details.partList[0] as any });

        expectField(url, `nor%3D%22frag1.1.mp4%22`);
        expectField(url, `br%3D1`);
        expectField(url, `d%3D2000`);
      });
    });
  });
});
