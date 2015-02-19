/*
 * playlist loader
 *
 */

import Event                from '../events';
import observer             from '../observer';
import {logger}             from '../utils/logger';

 class PlaylistLoader {

  constructor() {
    this.levels = [];
    this._level = undefined;
  }

  destroy() {
    if(this.xhr &&this.xhr.readyState !== 4) {
      this.xhr.abort();
      this.xhr = null;
    }
    this.levels = [];
    this._level = undefined;
  }

  load(url) {
    observer.trigger(Event.MANIFEST_LOADING, { url: this.url});
    this._load(url);
  }

  _load(url) {
    this.url = url;
    this.stats = { trequest : Date.now()};
    var xhr = this.xhr = new XMLHttpRequest();
    xhr.onload=  this.loadsuccess.bind(this);
    xhr.onerror = this.loaderror.bind(this);
    xhr.onprogress = this.loadprogress.bind(this);
    xhr.open('GET', url, true);
    xhr.send();
  }

  get level() {
    return this._level;
  }

  set level(newLevel) {
    if(this._level !== newLevel) {
      // check if level idx is valid
      if(newLevel >= 0 && newLevel < this.levels.length) {
        this._level = newLevel;
         // check if we need to load playlist for this new level
        if(this.levels[newLevel].fragments === undefined) {
          // level not retrieved yet, we need to load it
          observer.trigger(Event.LEVEL_LOADING, { level : newLevel});
          this._load(this.levels[newLevel].url);
        }
      } else {
        // invalid level id given, trigger error
        observer.trigger(Event.LEVEL_ERROR, { level : newLevel, event: 'invalid level idx'});
      }
    }
  }

  resolve(url, baseUrl) {
    var doc      = document,
        oldBase = doc.getElementsByTagName('base')[0],
        oldHref = oldBase && oldBase.href,
        docHead = doc.head || doc.getElementsByTagName('head')[0],
        ourBase = oldBase || docHead.appendChild(doc.createElement('base')),
        resolver = doc.createElement('a'),
        resolvedUrl;

    ourBase.href = baseUrl;
    resolver.href = url;
    resolvedUrl  = resolver.href; // browser magic at work here

    if (oldBase) {oldBase.href = oldHref;}
    else {docHead.removeChild(ourBase);}
    return resolvedUrl;
  }



  parseManifest(string, url) {
    if(string.indexOf('#EXTM3U') === 0) {
      if (string.indexOf('#EXTINF:') > 0) {
        // 1 level playlist, create unique level and parse playlist
        this._level = 0;
        this.levels.length = 1;
        this.levels[0] = {};
        this.parseLevelPlaylist(string,url,0);
        observer.trigger(Event.MANIFEST_LOADED,
                        { levels : this.levels,
                          url : url ,
                          stats : this.stats});
        observer.trigger(Event.LEVEL_LOADED,
                        { level : this._level,
                          url : url ,
                          stats : this.stats});
      } else {
        // multi level playlist, parse level info
        this.levels = this.parseMasterPlaylist(string,url);
        observer.trigger(Event.MANIFEST_LOADED,
                        { levels : this.levels,
                          url : url ,
                          stats : this.stats});
      }
    } else {
      observer.trigger(Event.LOAD_ERROR, { url : url, event: 'not an HLS playlist'});
    }
  }

  parseMasterPlaylist(string,baseurl) {
    var levels = [];
    var level =  {};
    var result;
    var re = /#EXT-X-STREAM-INF:([^\n\r]*(BAND)WIDTH=(\d+))?([^\n\r]*(RES)OLUTION=(\d+)x(\d+))?([^\n\r]*(NAME)=\"(.*)\")?[^\n\r]*[\r\n]+([^\r\n]+)/g;
    while((result = re.exec(string)) != null){
      result.shift();
      result = result.filter(function(n){ return (n !== undefined);});
      level.url = this.resolve(result.pop(),baseurl);
      while(result.length > 0) {
        switch(result.shift()) {
          case 'RES':
            level.width = result.shift();
            level.height = result.shift();
            break;
          case 'BAND':
            level.bitrate = result.shift();
            break;
          case 'NAME':
            level.name = result.shift();
            break;
          default:
            break;
        }
      }
      levels.push(level);
      level = {};
    }
    return levels;
  }

  parseLevelPlaylist(string, baseurl, idx) {
    var currentSN = 0,totalduration = 0;
    var obj = this.levels[idx];
    obj.url = baseurl;
    obj.fragments = [];
    obj.endList = false;

    var result;
    var re = /(?:#EXT-X-(MEDIA-SEQUENCE):(\d+))|(?:#EXT-X-(TARGETDURATION):([0-9]*\.?[0-9]+.))|(?:#EXT(INF):([0-9]*\.?[0-9]+.),[^\r\n]*[\r\n]+([^\r\n]+)|(?:#EXT-X-(ENDLIST)))/g;
    while((result = re.exec(string)) !== null){
      result.shift();
      result = result.filter(function(n){ return (n !== undefined);});
      switch(result[0]) {
        case 'MEDIA-SEQUENCE':
          currentSN = obj.startSN = parseInt(result[1]);
          break;
        case 'TARGETDURATION':
          obj.targetduration = parseFloat(result[1]);
          break;
        case 'ENDLIST':
          obj.endList = true;
          break;
        case 'INF':
          var duration = parseFloat(result[1]);
          obj.fragments.push({url : this.resolve(result[2],baseurl), duration : duration, start : totalduration, sn : currentSN++});
          totalduration+=duration;
          break;
        default:
          break;
      }
    }
    logger.log('found ' + obj.fragments.length + ' fragments');
    obj.totalduration = totalduration;
    obj.endSN = currentSN - 1;
  }

  loadsuccess() {
    this.stats.tend = Date.now();
    if(this.levels.length === 0) {
      this.parseManifest(event.currentTarget.responseText, this.url);
    } else {
      this.parseLevelPlaylist(event.currentTarget.responseText, this.url, this._level);
      observer.trigger(Event.LEVEL_LOADED,
                       { level : this._level,
                          url : this.url ,
                          stats : this.stats});
    }
  }

  loaderror(event) {
    observer.trigger(Event.LOAD_ERROR, { url : this.url, event: event});
  }

  loadprogress() {
    if(this.stats.tfirst === undefined) {
      this.stats.tfirst = Date.now();
    }
  }
}

export default PlaylistLoader;
