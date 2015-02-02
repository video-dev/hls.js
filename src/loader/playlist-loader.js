/*
 * playlist loader
 *
 */

 (function() {
  'use strict';
  var playlistLoader;

  playlistLoader = function() {
    var url;
    var self = this;
    var trequest;
    var tfirst;

    playlistLoader.prototype.init.call(this);

    this.load = function(url) {
      this.url = url;
      trequest = Date.now();
      tfirst = null;
      var xhr = new XMLHttpRequest();
      xhr.onload=  loadsuccess;
      xhr.onerror =  loaderror;
      xhr.onprogress = loadprogress;
      xhr.open('GET', url, true);
      xhr.send();
    };

    function loadsuccess(event) {
      var fragments =
      this.responseText
      .split(/\r?\n/)
      .filter(RegExp.prototype.test.bind(/\.ts$/))
      .map(resolveURL.bind(null, self.url))
      console.log('found ' + fragments.length + ' fragments');
      self.trigger('stats', {trequest : trequest, tfirst : tfirst, tend : Date.now(), length :fragments.length, url : self.url });
      self.trigger('data',fragments);
    }

    function loaderror(event) {
      console.log('error loading ' + self.url);
    }

    function loadprogress(event) {
      if(tfirst === null) {
        tfirst = Date.now();
      }
    }

    // relative URL resolver
    var resolveURL = (function() {
      var doc = document,
      old_base = doc.getElementsByTagName('base')[0],
      old_href = old_base && old_base.href,
      doc_head = doc.head || doc.getElementsByTagName('head')[0],
      our_base = old_base || doc.createElement('base'),
      resolver = doc.createElement('a'),
      resolved_url;

      return function(base_url, url) {
        old_base || doc_head.appendChild(our_base);
        our_base.href = base_url;
        resolver.href = url;
        resolved_url = resolver.href; // browser magic at work here

        old_base ? old_base.href = old_href : doc_head.removeChild(our_base);

        return resolved_url;
      };
    })();
  };
  playlistLoader.prototype = new hls.Stream();
  hls.playlistLoader = playlistLoader;
})();