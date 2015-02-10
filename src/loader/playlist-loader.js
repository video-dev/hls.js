/*
 * playlist loader
 *
 */

 import Stream          from '../utils/stream';
 import {logger}         from '../utils/logger';

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


 class PlaylistLoader extends Stream {

  constructor() {
    super();
  }

  load(url) {
    this.url = url;
    this.trequest = Date.now();
    this.tfirst = null;
    var xhr = new XMLHttpRequest();
    xhr.onload=  this.loadsuccess;
    xhr.onerror =  this.loaderror;
    xhr.onprogress = this.loadprogress;
    xhr.parent = this;
    xhr.open('GET', url, true);
    xhr.send();
  }

  loadsuccess(event) {
    var fragments =
    this.responseText
    .split(/\r?\n/)
    .filter(RegExp.prototype.test.bind(/\.ts$/))
    .map(resolveURL.bind(null, this.parent.url))
    logger.log('found ' + fragments.length + ' fragments');
    this.parent.trigger('stats', {trequest : this.parent.trequest, tfirst : this.parent.tfirst, tend : Date.now(), length :fragments.length, url : this.parent.url});
    this.parent.trigger('data',fragments);
  }

  loaderror(event) {
    logger.log('error loading ' + self.url);
  }

  loadprogress(event) {
    if(this.parent.tfirst === null) {
      this.parent.tfirst = Date.now();
    }
  }
}

export default PlaylistLoader;
