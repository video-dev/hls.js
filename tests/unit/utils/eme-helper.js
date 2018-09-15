import { base64ToArrayBuffer } from '../../../src/utils/eme-helper';
import assert from 'assert';

describe('base64 to arraybuffer util', function () {
  let base64String = 'AAAA';
  it('converts base 64 encoded string to arraybuffer', function () {
    let bytes = base64ToArrayBuffer(base64String);
    assert(Object.prototype.toString.call(bytes), '[object Uint8Array]');
    assert(bytes.toString(), '0,0,0');
  });
});
