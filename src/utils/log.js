/**
 * Class that sends log messages to browser console
 */
(function() {
    'use strict';
    var info, debug, error;
    var mediaSource, video, url;
    var playlistLoader, fragmentLoader;

    info = function(msg) {
        console.log('info:' + msg);
    };

    debug = function(msg) {
        console.log('debug:' + msg);
    };

    error = function(msg) {
        console.log('error:' + msg);
    };

    hls.log = {
        info: info,
        debug: debug,
        error: error
    };
})();
