const DECIMAL_RESOLUTION_REGEX = /^(\d+)x(\d+)$/;
const ATTR_LIST_REGEX = /(.+?)=(".*?"|.*?)(?:,|$)/g;

// adapted from https://github.com/kanongil/node-m3u8parse/blob/master/attrlist.js
export class AttrList {
  [key: string]: any;

  constructor(attrs: string | Record<string, any>) {
    if (typeof attrs === 'string') {
      attrs = AttrList.parseAttrList(attrs);
    }
    Object.assign(this, attrs);
  }

  get clientAttrs(): string[] {
    return Object.keys(this).filter((attr) => attr.substring(0, 2) === 'X-');
  }

  decimalInteger(attrName: string): number {
    const intValue = parseInt(this[attrName], 10);
    if (intValue > Number.MAX_SAFE_INTEGER) {
      return Infinity;
    }

    return intValue;
  }

  hexadecimalInteger(attrName: string) {
    if (this[attrName]) {
      let stringValue = (this[attrName] || '0x').slice(2);
      stringValue = (stringValue.length & 1 ? '0' : '') + stringValue;

      const value = new Uint8Array(stringValue.length / 2);
      for (let i = 0; i < stringValue.length / 2; i++) {
        value[i] = parseInt(stringValue.slice(i * 2, i * 2 + 2), 16);
      }

      return value;
    } else {
      return null;
    }
  }

  hexadecimalIntegerAsNumber(attrName: string): number {
    const intValue = parseInt(this[attrName], 16);
    if (intValue > Number.MAX_SAFE_INTEGER) {
      return Infinity;
    }

    return intValue;
  }

  decimalFloatingPoint(attrName: string): number {
    return parseFloat(this[attrName]);
  }

  optionalFloat(attrName: string, defaultValue: number): number {
    const value = this[attrName];
    return value ? parseFloat(value) : defaultValue;
  }

  enumeratedString(attrName: string): string | undefined {
    return this[attrName];
  }

  bool(attrName: string): boolean {
    return this[attrName] === 'YES';
  }

  decimalResolution(attrName: string):
    | {
        width: number;
        height: number;
      }
    | undefined {
    const res = DECIMAL_RESOLUTION_REGEX.exec(this[attrName]);
    if (res === null) {
      return undefined;
    }

    return {
      width: parseInt(res[1], 10),
      height: parseInt(res[2], 10),
    };
  }

  static parseAttrList(input: string): Record<string, any> {
    let match;
    const attrs = {};
    const quote = '"';
    ATTR_LIST_REGEX.lastIndex = 0;
    while ((match = ATTR_LIST_REGEX.exec(input)) !== null) {
      let value = match[2];

      if (
        value.indexOf(quote) === 0 &&
        value.lastIndexOf(quote) === value.length - 1
      ) {
        value = value.slice(1, -1);
      }
      const name = match[1].trim();
      attrs[name] = value;
    }
    return attrs;
  }
}
