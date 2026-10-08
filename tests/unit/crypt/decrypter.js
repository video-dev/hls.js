import { expect } from 'chai';
import Decrypter from '../../../src/crypt/decrypter';

describe('Decrypter', function () {
  it('decripts correctly aes-128-cbc software mode', function () {
    const data = get128cbcData();

    const config = { enableSoftwareAES: true };
    const decrypter = new Decrypter(config);
    const cbcMode = 0;

    decrypter.softwareDecrypt(data.encrypted, data.key, data.iv, cbcMode);
    const decrypted = decrypter.flush();
    expect(new Uint8Array(decrypted)).to.deep.equal(data.expected);
  });

  it('decripts correctly aes-128-cbc webCrypto mode', async function () {
    const data = get128cbcData();

    const config = { enableSoftwareAES: false };
    const decrypter = new Decrypter(config);
    const cbcMode = 0;
    const decrypted = await decrypter.webCryptoDecrypt(
      data.encrypted,
      data.key,
      data.iv,
      cbcMode,
    );
    expect(new Uint8Array(decrypted)).to.deep.equal(data.expected);
  });

  it('decripts correctly aes-128-cbc', async function () {
    const data = get128cbcData();

    const config = { enableSoftwareAES: true };
    const decrypter = new Decrypter(config);
    const cbcMode = 0;
    const decrypted = await decrypter.decrypt(
      data.encrypted,
      data.key,
      data.iv,
      cbcMode,
    );
    expect(new Uint8Array(decrypted)).to.deep.equal(data.expected);
  });

  it('decripts correctly aes-256-cbc', async function () {
    const data = get256cbcData();

    const config = { enableSoftwareAES: false };
    const decrypter = new Decrypter(config);
    const cbcMode = 0;
    const decrypted = await decrypter.decrypt(
      data.encrypted,
      data.key,
      data.iv,
      cbcMode,
    );
    expect(new Uint8Array(decrypted)).to.deep.equal(data.expected);
  });

  it('decripts correctly aes-256-ctr', async function () {
    const data = get256ctrData();

    const config = { enableSoftwareAES: false };
    const decrypter = new Decrypter(config);
    const ctrMode = 1;
    const decrypted = await decrypter.decrypt(
      data.encrypted,
      data.key,
      data.iv,
      ctrMode,
    );
    expect(new Uint8Array(decrypted)).to.deep.equal(data.expected);
  });

  it('decrypts an aes-128-cbc segment loaded in uneven chunks (progressive)', async function () {
    const plain = new Uint8Array(1000);
    for (let i = 0; i < plain.length; i++) {
      plain[i] = (i * 7 + 3) & 0xff;
    }
    const key = new Uint8Array(16).map((_, i) => i + 1);
    const iv = new Uint8Array(16).map((_, i) => 0xa0 + i);
    const cryptoKey = await self.crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-CBC' },
      false,
      ['encrypt'],
    );
    const encrypted = new Uint8Array(
      await self.crypto.subtle.encrypt(
        { name: 'AES-CBC', iv },
        cryptoKey,
        plain,
      ),
    );

    const decrypter = new Decrypter({ enableSoftwareAES: true });
    const out = [];
    // Uneven chunk sizes, as a network delivers them, repeated until all
    // of the encrypted segment has been fed in.
    const sizes = [100, 333, 17, 250];
    let start = 0;
    for (let i = 0; start < encrypted.length; i++) {
      const size = sizes[i % sizes.length];
      const chunk = encrypted.slice(start, start + size);
      start += size;
      const result = decrypter.decryptProgressive(chunk, key.buffer, iv.buffer);
      if (result) {
        out.push(new Uint8Array(result));
      }
    }
    out.push(decrypter.flush());

    const decrypted = new Uint8Array(
      out.reduce((total, part) => total + part.length, 0),
    );
    let offset = 0;
    out.forEach((part) => {
      decrypted.set(part, offset);
      offset += part.length;
    });
    expect(decrypted).to.deep.equal(plain);
  });
});

function get128cbcData() {
  const key = new Uint8Array([
    0xe5, 0xe9, 0xfa, 0x1b, 0xa3, 0x1e, 0xcd, 0x1a, 0xe8, 0x4f, 0x75, 0xca,
    0xaa, 0x47, 0x4f, 0x3a,
  ]).buffer;
  const iv = new Uint8Array([
    0x66, 0x3f, 0x05, 0xf4, 0x12, 0x02, 0x8f, 0x81, 0xda, 0x65, 0xd2, 0x6e,
    0xe5, 0x64, 0x24, 0xb2,
  ]).buffer;
  const encrypted = new Uint8Array([
    0x2c, 0x94, 0xcf, 0xc0, 0x91, 0xff, 0x0e, 0xcc, 0x98, 0x66, 0xcc, 0x83,
    0x0d, 0xd7, 0xc3, 0x55,
  ]);
  const expected = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21, 0x0a]);
  return { key: key, iv: iv, encrypted: encrypted, expected: expected };
}

function get256Data() {
  const key = new Uint8Array([
    0xe5, 0xe9, 0xfa, 0x1b, 0xa3, 0x1e, 0xcd, 0x1a, 0xe8, 0x4f, 0x75, 0xca,
    0xaa, 0x47, 0x4f, 0x3a, 0x66, 0x3f, 0x05, 0xf4, 0x12, 0x02, 0x8f, 0x81,
    0xda, 0x65, 0xd2, 0x6e, 0xe5, 0x64, 0x24, 0xb2,
  ]).buffer;
  const iv = new Uint8Array([
    0xf4, 0x8c, 0xef, 0xa0, 0xad, 0x59, 0xc9, 0xa5, 0x60, 0x16, 0xcf, 0xbb,
    0x26, 0x5b, 0xee, 0x8c,
  ]).buffer;
  const expected = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21, 0x0a]);
  return { key: key, iv: iv, expected: expected };
}

function get256cbcData() {
  const some256data = get256Data();
  const encrypted = new Uint8Array([
    0xe7, 0x25, 0x6a, 0x77, 0x3a, 0xa5, 0x43, 0x59, 0xaf, 0x60, 0xc1, 0xd3,
    0xed, 0x31, 0xc4, 0x01,
  ]);
  some256data.encrypted = encrypted;
  return some256data;
}

function get256ctrData() {
  const some256data = get256Data();
  const encrypted = new Uint8Array([0xb8, 0xd1, 0xcf, 0x15, 0x0d, 0x34, 0x12]);
  some256data.encrypted = encrypted;
  return some256data;
}
