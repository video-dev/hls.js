import CMCDController from '../../../src/controller/cmcd-controller';
import { CMCDControllerConfig } from '../../../src/hls';
import HlsMock from '../../mocks/hls.mock';
import * as chai from 'chai';

const expect = chai.expect;

let cmcdController;

const uuidRegex =
  '[A-F\\d]{8}-[A-F\\d]{4}-4[A-F\\d]{3}-[89AB][A-F\\d]{3}-[A-F\\d]{12}';

const data = {
  sid: 'c936730c-031e-4a73-976f-92bc34039c60',
  cid: 'xyz',
  su: false,
  nor: '../testing/3.m4v',
  nrr: '0-99',
  d: 6066.66,
  mtp: 10049,
  bs: true,
  br: 52317,
  v: 1,
  pr: 1,
  'com.test-hello': 'world',
  'com.test-testing': 1234,
  'com.test-exists': true,
  'com.test-notExists': false,
};

const setupEach = function (cmcd?: CMCDControllerConfig) {
  cmcdController = new CMCDController(new HlsMock({ cmcd }));
};

describe('CMCDController', function () {
  describe('Query serialization', function () {
    it('produces correctly serialized data', function () {
      const query = CMCDController.toQuery(data);
      const result =
        'CMCD=br%3D52317%2Cbs%2Ccid%3D%22xyz%22%2C' +
        'com.test-exists%2Ccom.test-hello%3D%22world%22%2C' +
        'com.test-testing%3D1234%2C' +
        'd%3D6067%2Cmtp%3D10000%2C' +
        'nor%3D%22..%252Ftesting%252F3.m4v%22%2C' +
        'nrr%3D%220-99%22%2C' +
        'sid%3D%22c936730c-031e-4a73-976f-92bc34039c60%22';
      expect(query).to.equal(result);
    });

    it('appends with ?', function () {
      const result = CMCDController.appendQueryToUri(
        'http://test.com',
        'CMCD=d%3D6067'
      );
      expect(result).to.equal('http://test.com?CMCD=d%3D6067');
    });

    it('appends with &', function () {
      const result = CMCDController.appendQueryToUri(
        'http://test.com?testing=123',
        'CMCD=d%3D6067'
      );
      expect(result).to.equal('http://test.com?testing=123&CMCD=d%3D6067');
    });
  });

  describe('Header serialization', function () {
    it('produces all header shards', function () {
      const header = CMCDController.toHeaders(data);
      expect(header).to.deep.equal({
        'CMCD-Object': 'br=52317,d=6067',
        'CMCD-Request':
          'com.test-exists,com.test-hello="world",' +
          'com.test-testing=1234,mtp=10000,' +
          'nor="..%2Ftesting%2F3.m4v",nrr="0-99"',
        'CMCD-Session': 'cid="xyz",sid="c936730c-031e-4a73-976f-92bc34039c60"',
        'CMCD-Status': 'bs',
      });
    });

    it('ignores empty shards', function () {
      expect(CMCDController.toHeaders({ br: 200 })).to.deep.equal({
        'CMCD-Object': 'br=200',
      });
    });
  });

  describe('cmcdController instance', function () {
    const context = {
      url: 'https://test.com/test.mpd',
    };

    describe('configuration', function () {
      it('does not modify requests when disabled', function () {
        setupEach();

        const { config } = cmcdController.hls;
        expect(config.pLoader).to.equal(undefined);
        expect(config.fLoader).to.equal(undefined);
      });

      it('generates a session id if not provided', function () {
        setupEach({});

        const c = Object.assign({ frag: {} }, context);

        cmcdController.applyPlaylistData(c);
        const regex = new RegExp(`sid%3D%22${uuidRegex}%22`, 'i');
        expect(regex.test(c.url)).to.equal(true);
      });
    });
  });
});
