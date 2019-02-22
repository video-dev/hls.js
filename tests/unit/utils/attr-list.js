import AttrList from '../../../src/utils/attr-list';

describe('AttrList', function () {
  it('constructor() supports empty arguments', function () {
    expect(Object.keys(new AttrList())).to.deep.equal([]);
    expect(Object.keys(new AttrList({}))).to.deep.equal([]);
    expect(Object.keys(new AttrList(undefined))).to.deep.equal([]);
  });
  it('constructor() supports object argument', function () {
    const obj = { VALUE: '42' };
    const list = new AttrList(obj);
    expect(list.decimalInteger('VALUE')).to.equal(42);
    expect(Object.keys(list).length).to.equal(1);
  });

  it('parses valid decimalInteger attribute', function () {
    expect(new AttrList('INT=42').decimalInteger('INT')).to.equal(42);
    expect(new AttrList('INT=0').decimalInteger('INT')).to.equal(0);
    expect(new AttrList('INT="42"').decimalInteger('INT')).to.equal(42);
  });

  it('parses attribute with leading space', function () {
    expect(new AttrList(' INT=42').decimalInteger('INT')).to.equal(42);
    expect(new AttrList(' INT=0').decimalInteger('INT')).to.equal(0);
    expect(new AttrList(' INT="42"').decimalInteger('INT')).to.equal(42);
  });

  it('parses attribute with trailing space', function () {
    expect(new AttrList('INT =42').decimalInteger('INT')).to.equal(42);
    expect(new AttrList('INT =0').decimalInteger('INT')).to.equal(0);
    expect(new AttrList('INT ="42"').decimalInteger('INT')).to.equal(42);
  });

  it('parses valid hexadecimalInteger attribute', function () {
    expect(new AttrList('HEX=0x42').hexadecimalIntegerAsNumber('HEX')).to.equal(0x42);
    expect(new AttrList('HEX=0X42').hexadecimalIntegerAsNumber('HEX')).to.equal(0x42);
    expect(new AttrList('HEX=0x0').hexadecimalIntegerAsNumber('HEX')).to.equal(0);
    expect(new AttrList('HEX="0x42"').hexadecimalIntegerAsNumber('HEX')).to.equal(0x42);
  });
  it('parses valid decimalFloatingPoint attribute', function () {
    expect(new AttrList('FLOAT=0.42').decimalFloatingPoint('FLOAT')).to.equal(0.42);
    expect(new AttrList('FLOAT=-0.42').decimalFloatingPoint('FLOAT')).to.equal(-0.42);
    expect(new AttrList('FLOAT=0').decimalFloatingPoint('FLOAT')).to.equal(0);
    expect(new AttrList('FLOAT="0.42"').decimalFloatingPoint('FLOAT')).to.equal(0.42);
  });
  it('parses valid quotedString attribute', function () {
    expect(new AttrList('STRING="hi"').STRING).to.equal('hi');
    expect(new AttrList('STRING=""').STRING).to.equal('');
  });
  it('parses exotic quotedString attribute', function () {
    const list = new AttrList('STRING="hi,ENUM=OK,RES=4x2"');
    expect(list.STRING).to.equal('hi,ENUM=OK,RES=4x2');
    expect(Object.keys(list).length).to.equal(1);
  });
  it('parses valid enumeratedString attribute', function () {
    expect(new AttrList('ENUM=OK').enumeratedString('ENUM')).to.equal('OK');
    expect(new AttrList('ENUM="OK"').enumeratedString('ENUM')).to.equal('OK');
  });
  it('parses exotic enumeratedString attribute', function () {
    expect(new AttrList('ENUM=1').enumeratedString('ENUM')).to.equal('1');
    expect(new AttrList('ENUM=A=B').enumeratedString('ENUM')).to.equal('A=B');
    expect(new AttrList('ENUM=A=B=C').enumeratedString('ENUM')).to.equal('A=B=C');
    const list = new AttrList('ENUM1=A=B=C,ENUM2=42');
    expect(list.enumeratedString('ENUM1')).to.equal('A=B=C');
    expect(list.enumeratedString('ENUM2')).to.equal('42');
  });
  it('parses valid decimalResolution attribute', function () {
    expect(new AttrList('RES=400x200').decimalResolution('RES')).to.deep.equal({ width: 400, height: 200 });
    expect(new AttrList('RES=0x0').decimalResolution('RES')).to.deep.equal({ width: 0, height: 0 });
    expect(new AttrList('RES="400x200"').decimalResolution('RES')).to.deep.equal({ width: 400, height: 200 });
  });
  it('handles invalid decimalResolution attribute', function () {
    expect(new AttrList('RES=400x-200').decimalResolution('RES')).to.not.exist;
    expect(new AttrList('RES=400.5x200').decimalResolution('RES')).to.not.exist;
    expect(new AttrList('RES=400x200.5').decimalResolution('RES')).to.not.exist;
    expect(new AttrList('RES=400').decimalResolution('RES')).to.not.exist;
    expect(new AttrList('RES=400x').decimalResolution('RES')).to.not.exist;
    expect(new AttrList('RES=x200').decimalResolution('RES')).to.not.exist;
    expect(new AttrList('RES=x').decimalResolution('RES')).to.not.exist;
  });

  it('parses multiple attributes', function () {
    const list = new AttrList('INT=42,HEX=0x42,FLOAT=0.42,STRING="hi",ENUM=OK,RES=4x2');
    expect(list.decimalInteger('INT')).to.equal(42);
    expect(list.hexadecimalIntegerAsNumber('HEX')).to.equal(0x42);
    expect(list.decimalFloatingPoint('FLOAT')).to.equal(0.42);
    expect(list.STRING).to.equal('hi');
    expect(list.enumeratedString('ENUM')).to.equal('OK');
    expect(list.decimalResolution('RES')).to.deep.equal({ width: 4, height: 2 });
    expect(Object.keys(list).length).to.equal(6);
  });

  it('handles missing attributes', function () {
    const list = new AttrList();
    expect(list.decimalInteger('INT')).to.be.NaN;
    expect(list.hexadecimalIntegerAsNumber('HEX')).to.be.NaN;
    expect(list.decimalFloatingPoint('FLOAT')).to.be.NaN;
    expect(list.STRING).to.not.exist;
    expect(list.enumeratedString('ENUM')).to.not.exist;
    expect(list.decimalResolution('RES')).to.not.exist;
    expect(Object.keys(list)).to.have.lengthOf(0);
  });

  it('parses dashed attribute names', function () {
    const list = new AttrList('INT-VALUE=42,H-E-X=0x42,-FLOAT=0.42,STRING-="hi",ENUM=OK');
    expect(list.decimalInteger('INT-VALUE')).to.equal(42);
    expect(list.hexadecimalIntegerAsNumber('H-E-X')).to.equal(0x42);
    expect(list.decimalFloatingPoint('-FLOAT')).to.equal(0.42);
    expect(list['STRING-']).to.equal('hi');
    expect(list.enumeratedString('ENUM')).to.equal('OK');
    expect(Object.keys(list).length).to.equal(5);
  });

  it('handles hexadecimalInteger conversions', function () {
    const list = new AttrList('HEX1=0x0123456789abcdef0123456789abcdef,HEX2=0x123,HEX3=0x0');
    expect(list.hexadecimalInteger('HEX1').buffer).to.deep.equal(new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]).buffer);
    expect(list.hexadecimalInteger('HEX2').buffer).to.deep.equal(new Uint8Array([0x01, 0x23]).buffer);
    expect(list.hexadecimalInteger('HEX3').buffer).to.deep.equal(new Uint8Array([0x0]).buffer);
  });

  it('returns infinity on large number conversions', function () {
    const list = new AttrList('VAL=12345678901234567890,HEX=0x0123456789abcdef0123456789abcdef');
    expect(list.decimalInteger('VAL')).to.equal(Infinity);
    expect(list.hexadecimalIntegerAsNumber('HEX')).to.equal(Infinity);
  });
});
