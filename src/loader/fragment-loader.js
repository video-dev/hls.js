/*
 * fragment loader
 *
 */

(function() {
    'use strict';
    var fragmentLoader;

    fragmentLoader = function() {
        var url;
        var self = this;
        var trequest;
        var tfirst;

        fragmentLoader.prototype.init.call(this);

        this.load = function(url) {
            this.url = url;
            trequest = Date.now();
            tfirst = null;
            var xhr = new XMLHttpRequest();
            xhr.onload = loadsuccess;
            xhr.onerror = loaderror;
            xhr.onprogress = loadprogress;
            xhr.responseType = 'arraybuffer';
            xhr.open('GET', url, true);
            xhr.send();
        };

        function loadsuccess(event) {
            self.trigger('stats', {
                trequest: trequest,
                tfirst: tfirst,
                tend: Date.now(),
                length: event.currentTarget.response.byteLength,
                url: self.url
            });
            self.trigger('data', event.currentTarget.response);
        }

        function loaderror(event) {
            console.log('error loading ' + self.url);
        }

        function loadprogress(event) {
            if (tfirst === null) {
                tfirst = Date.now();
            }
        }
    };
    fragmentLoader.prototype = new hls.Stream();
    hls.fragmentLoader = fragmentLoader;
})();
