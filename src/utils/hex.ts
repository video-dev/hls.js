/**
 *  hex dump helper class
 */

const Hex = {
  hexDump: function (array) {
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

export default Hex;
