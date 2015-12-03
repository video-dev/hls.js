
// adapted from https://github.com/kanongil/node-m3u8parse/blob/master/attrlist.js
class AttrList {

  constructor(attrs) {
    if (typeof attrs === 'string') {
      attrs = AttrList.parseAttrList(attrs);
    }

    Object.assign(this, attrs);
  }

  decimalInteger(attrName) {
    const intValue = parseInt(this[attrName], 10);
    if (intValue > Number.MAX_SAFE_INTEGER) {
      throw new RangeError('Value is to large to represent without loss of precision');
    }
    return intValue;
  }

  hexadecimalInteger(attrName) {
    let stringValue = (this[attrName] || '0x').slice(2);
    stringValue = ((stringValue.length & 1) ? '0' : '') + stringValue;

    const value = new Uint8Array(stringValue.length / 2);
    for (let i = 0; i < stringValue.length / 2; i++) {
      value[i] = parseInt(stringValue.slice(i * 2, i * 2 + 2), 16);
    }
    return value;
  }

  hexadecimalIntegerAsNumber(attrName) {
    const intValue = parseInt(this[attrName], 16);
    if (intValue > Number.MAX_SAFE_INTEGER) {
      throw new RangeError('Value is to large to represent without loss of precision');
    }
    return intValue;
  }

  decimalFloatingPoint(attrName) {
    return parseFloat(this[attrName]);
  }

  quotedString(attrName) {
    const val = this[attrName];
    return val ? val.slice(1, -1) : undefined;
  }

  enumeratedString(attrName) {
    return this[attrName];
  }

  decimalResolution(attrName) {
    const res = /(\d+)x(\d+)/.exec(this[attrName]);
    return {
      width: res ? parseInt(res[1], 10) : null,
      height: res ? parseInt(res[2], 10) : null,
    };
  }

  static parseAttrList(input) {
    const re = /(.+?)=((?:\".*?\")|.*?)(?:,|$)/g;
    var match, attrs = {};
    while ((match = re.exec(input)) !== null) {
      attrs[match[1]] = match[2];
    }
    return attrs;
  }

}

export default AttrList;
