if (typeof ArrayBuffer !== 'undefined' && !ArrayBuffer.prototype.slice) {
  ArrayBuffer.prototype.slice = function (start, end) {
    var that = new Uint8Array(this);
    if (end === undefined) {
      end = that.length;
    }
    var result = new ArrayBuffer(end - start);
    var resultArray = new Uint8Array(result);
    for (var i = 0; i < resultArray.length; i++) {
      resultArray[i] = that[i + start];
    }
    return result;
  };
}
