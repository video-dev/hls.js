/*
 * playlist loader
 *
 */

import Event                from '../events';
import observer             from '../observer';
import {logger}             from '../utils/logger';

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


 class PlaylistLoader {

  constructor() {
  }

  load(url) {
    this.url = url;
    this.trequest = Date.now();
    this.tfirst = null;
    var xhr = new XMLHttpRequest();
    xhr.onload=  this.loadsuccess.bind(this);
    xhr.onerror = this.loaderror.bind(this);
    xhr.onprogress = this.loadprogress.bind(this);
    xhr.open('GET', url, true);
    xhr.send();
    observer.trigger(Event.MANIFEST_LOADING);
  }

  loadsuccess(event) {
    var fragments =
    event.currentTarget.responseText
    .split(/\r?\n/)
    .filter(RegExp.prototype.test.bind(/\.ts$/))
    .map(resolveURL.bind(null, this.url))
    logger.log('found ' + fragments.length + ' fragments');
    observer.trigger(Event.MANIFEST_LOADED, { fragments : fragments, url : this.url , stats : {trequest : this.trequest, tfirst : this.tfirst, tend : Date.now()}});
  }

  loaderror(event) {
    observer.trigger(Event.ERROR, 'error loading ' + this.url);
  }

  loadprogress(event) {
    if(this.tfirst === null) {
      this.tfirst = Date.now();
    }
  }
}

export default PlaylistLoader;
