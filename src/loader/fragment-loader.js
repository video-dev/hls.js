/*
 * playlist loader
 *
 */

(function() {
    'use strict';
    var fragmentLoader;

    fragmentLoader = function() {
        var url;
        var self = this;

        fragmentLoader.prototype.init.call(this);

        this.load = function(url) {
            this.url = url;
            var xhr = new XMLHttpRequest();
            xhr.onload = loadsuccess;
            xhr.onerror = loaderror;
            xhr.responseType = 'arraybuffer';
            xhr.open('GET', url, true);
            xhr.send();
        };

        function loadsuccess(event) {
            console.log(
                'received fragment, length:' +
                    event.currentTarget.response.byteLength
            );
            self.trigger('data', event.currentTarget.response);
        }

        function loaderror(event) {
            console.log('error loading ' + self.url);
        }
    };
    fragmentLoader.prototype = new hls.Stream();
    hls.fragmentLoader = fragmentLoader;
})();
