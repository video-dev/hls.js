/**
 *  TimeRanges to string helper
 */

const TimeRanges = {
  toString : function(r) {
    var log = '', len = r.length;
    for (var i=0; i<len; i++) {
      log += '[' + r.start(i).toFixed(3) + ',' + r.end(i).toFixed(3) + ']';
    }
    return log;
  }
};

export default TimeRanges;
