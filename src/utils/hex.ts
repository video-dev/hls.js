/**
 *  hex dump helper class
 */

const Hex = {
  hexDump: function (array: Uint8Array<ArrayBuffer>) {
    let str = '';
    for (let i = 0; i < array.length; i++) {
      let h = array[i].toString(16);
      if (h.length < 2) {
        h = '0' + h;
      }

      str += h;
    }
    return str;
  },
};

export function hexToArrayBuffer(str: string): ArrayBuffer {
  return Uint8Array.from(
    str
      .replace(/^0x/, '')
      .replace(/([\da-fA-F]{2}) ?/g, '0x$1 ')
      .replace(/ +$/, '')
      .split(' '),
  ).buffer;
}

export default Hex;
