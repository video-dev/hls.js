const assert = require('assert');
const bufferIsEqual = require('arraybuffer-equal');
const deepStrictEqual = require('deep-strict-equal');

import AttrList from '../../../src/utils/attr-list';

describe('AttrList', () => {
  it('constructor() supports empty arguments', () => {
    assert.deepEqual(new AttrList(), {});
    assert.deepEqual(new AttrList({}), {});
    assert.deepEqual(new AttrList(undefined), {});
  });
  it('constructor() supports object argument', () => {
    const obj = { VALUE: "42" };
    const list = new AttrList(obj);
    assert.strictEqual(list.decimalInteger('VALUE'), 42);
    assert.strictEqual(Object.keys(list).length, 1);
  });

  it('parses valid decimalInteger attribute', () => {
    assert.strictEqual(new AttrList('INT=42').decimalInteger('INT'), 42);
    assert.strictEqual(new AttrList('INT=0').decimalInteger('INT'), 0);
    assert.strictEqual(new AttrList('INT="42"').decimalInteger('INT'), 42);
  });

  it('parses attribute with leading space', () => {
    assert.strictEqual(new AttrList(' INT=42').decimalInteger('INT'), 42);
    assert.strictEqual(new AttrList(' INT=0').decimalInteger('INT'), 0);
    assert.strictEqual(new AttrList(' INT="42"').decimalInteger('INT'), 42);
  });

  it('parses attribute with trailing space', () => {
    assert.strictEqual(new AttrList('INT =42').decimalInteger('INT'), 42);
    assert.strictEqual(new AttrList('INT =0').decimalInteger('INT'), 0);
    assert.strictEqual(new AttrList('INT ="42"').decimalInteger('INT'), 42);
  });

  it('parses valid hexadecimalInteger attribute', () => {
    assert.strictEqual(new AttrList('HEX=0x42').hexadecimalIntegerAsNumber('HEX'), 0x42);
    assert.strictEqual(new AttrList('HEX=0X42').hexadecimalIntegerAsNumber('HEX'), 0x42);
    assert.strictEqual(new AttrList('HEX=0x0').hexadecimalIntegerAsNumber('HEX'), 0);
    assert.strictEqual(new AttrList('HEX="0x42"').hexadecimalIntegerAsNumber('HEX'), 0x42);
  });
  it('parses valid decimalFloatingPoint attribute', () => {
    assert.strictEqual(new AttrList('FLOAT=0.42').decimalFloatingPoint('FLOAT'), 0.42);
    assert.strictEqual(new AttrList('FLOAT=-0.42').decimalFloatingPoint('FLOAT'), -0.42);
    assert.strictEqual(new AttrList('FLOAT=0').decimalFloatingPoint('FLOAT'), 0);
    assert.strictEqual(new AttrList('FLOAT="0.42"').decimalFloatingPoint('FLOAT'), 0.42);
  });
  it('parses valid quotedString attribute', () => {
    assert.strictEqual(new AttrList('STRING="hi"').STRING, 'hi');
    assert.strictEqual(new AttrList('STRING=""').STRING, '');
  });
  it('parses exotic quotedString attribute', () => {
    const list = new AttrList('STRING="hi,ENUM=OK,RES=4x2"');
    assert.strictEqual(list.STRING, 'hi,ENUM=OK,RES=4x2');
    assert.strictEqual(Object.keys(list).length, 1);
  });
  it('parses valid enumeratedString attribute', () => {
    assert.strictEqual(new AttrList('ENUM=OK').enumeratedString('ENUM'), 'OK');
    assert.strictEqual(new AttrList('ENUM="OK"').enumeratedString('ENUM'), 'OK');
  });
  it('parses exotic enumeratedString attribute', () => {
    assert.strictEqual(new AttrList('ENUM=1').enumeratedString('ENUM'), '1');
    assert.strictEqual(new AttrList('ENUM=A=B').enumeratedString('ENUM'), 'A=B');
    assert.strictEqual(new AttrList('ENUM=A=B=C').enumeratedString('ENUM'), 'A=B=C');
    const list = new AttrList('ENUM1=A=B=C,ENUM2=42');
    assert.strictEqual(list.enumeratedString('ENUM1'), 'A=B=C');
    assert.strictEqual(list.enumeratedString('ENUM2'), '42');
  });
  it('parses valid decimalResolution attribute', () => {
    assert(deepStrictEqual(new AttrList('RES=400x200').decimalResolution('RES'), { width:400, height:200 }));
    assert(deepStrictEqual(new AttrList('RES=0x0').decimalResolution('RES'), { width:0, height:0 }));
    assert(deepStrictEqual(new AttrList('RES="400x200"').decimalResolution('RES'), { width:400, height:200 }));
  });
  it('handles invalid decimalResolution attribute', () => {
    assert(deepStrictEqual(new AttrList('RES=400x-200').decimalResolution('RES'), undefined));
    assert(deepStrictEqual(new AttrList('RES=400.5x200').decimalResolution('RES'), undefined));
    assert(deepStrictEqual(new AttrList('RES=400x200.5').decimalResolution('RES'), undefined));
    assert(deepStrictEqual(new AttrList('RES=400').decimalResolution('RES'), undefined));
    assert(deepStrictEqual(new AttrList('RES=400x').decimalResolution('RES'), undefined));
    assert(deepStrictEqual(new AttrList('RES=x200').decimalResolution('RES'), undefined));
    assert(deepStrictEqual(new AttrList('RES=x').decimalResolution('RES'), undefined));
  });

  it('parses multiple attributes', () => {
    const list = new AttrList('INT=42,HEX=0x42,FLOAT=0.42,STRING="hi",ENUM=OK,RES=4x2');
    assert.strictEqual(list.decimalInteger('INT'), 42);
    assert.strictEqual(list.hexadecimalIntegerAsNumber('HEX'), 0x42);
    assert.strictEqual(list.decimalFloatingPoint('FLOAT'), 0.42);
    assert.strictEqual(list.STRING, 'hi');
    assert.strictEqual(list.enumeratedString('ENUM'), 'OK');
    assert(deepStrictEqual(list.decimalResolution('RES'), { width:4, height:2 }));
    assert.strictEqual(Object.keys(list).length, 6);
  });

  it('handles missing attributes', () => {
    const list = new AttrList();
    assert(isNaN(list.decimalInteger('INT')));
    assert(isNaN(list.hexadecimalIntegerAsNumber('HEX')));
    assert(isNaN(list.decimalFloatingPoint('FLOAT')));
    assert.strictEqual(list.STRING, undefined);
    assert.strictEqual(list.enumeratedString('ENUM'), undefined);
    assert.strictEqual(list.decimalResolution('RES'), undefined);
    assert.strictEqual(Object.keys(list).length, 0);
  });

  it('parses dashed attribute names', () => {
    const list = new AttrList('INT-VALUE=42,H-E-X=0x42,-FLOAT=0.42,STRING-="hi",ENUM=OK');
    assert.strictEqual(list.decimalInteger('INT-VALUE'), 42);
    assert.strictEqual(list.hexadecimalIntegerAsNumber('H-E-X'), 0x42);
    assert.strictEqual(list.decimalFloatingPoint('-FLOAT'), 0.42);
    assert.strictEqual(list['STRING-'], 'hi');
    assert.strictEqual(list.enumeratedString('ENUM'), 'OK');
    assert.strictEqual(Object.keys(list).length, 5);
  });

  it('handles hexadecimalInteger conversions', () => {
    const list = new AttrList('HEX1=0x0123456789abcdef0123456789abcdef,HEX2=0x123,HEX3=0x0');
    assert(bufferIsEqual(list.hexadecimalInteger('HEX1').buffer, new Uint8Array([0x01,0x23,0x45,0x67,0x89,0xab,0xcd,0xef,0x01,0x23,0x45,0x67,0x89,0xab,0xcd,0xef]).buffer));
    assert(bufferIsEqual(list.hexadecimalInteger('HEX2').buffer, new Uint8Array([0x01,0x23]).buffer));
    assert(bufferIsEqual(list.hexadecimalInteger('HEX3').buffer, new Uint8Array([0x0]).buffer));
  });

  it('returns infinity on large number conversions', () => {
    const list = new AttrList('VAL=12345678901234567890,HEX=0x0123456789abcdef0123456789abcdef');
    assert.strictEqual(list.decimalInteger('VAL'), Infinity);
    assert.strictEqual(list.hexadecimalIntegerAsNumber('HEX'), Infinity);
  });
});
