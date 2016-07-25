/**
 *  TimeRanges to string helper
 */

class TimeRanges {
  static toString(r) {
    var log = '', len = r.length;
    for (var i=0; i<len; i++) {
      log += '[' + r.start(i) + ',' + r.end(i) + ']';
    }
    return log;
  }
}

export default TimeRanges;
