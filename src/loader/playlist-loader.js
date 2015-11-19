/**
 * Playlist Loader
*/

import Event from '../events';
import {ErrorTypes, ErrorDetails} from '../errors';
//import {logger} from '../utils/logger';

class PlaylistLoader {

  constructor(hls) {
    this.hls = hls;
    this.onml = this.onManifestLoading.bind(this);
    this.onll = this.onLevelLoading.bind(this);
    this.onkl = this.onKeyLoading.bind(this);
    hls.on(Event.MANIFEST_LOADING, this.onml);
    hls.on(Event.LEVEL_LOADING, this.onll);
    hls.on(Event.KEY_LOADING, this.onkl);
  }

  destroy() {
    if (this.loader) {
      this.loader.destroy();
      this.loader = null;
    }
    this.url = this.id = null;
    this.hls.off(Event.MANIFEST_LOADING, this.onml);
    this.hls.off(Event.LEVEL_LOADING, this.onll);
    this.hls.off(Event.KEY_LOADING, this.onkl);
  }

  onManifestLoading(event, data) {
    this.load(data.url, null);
  }

  onLevelLoading(event, data) {
    this.load(data.url, data.level, data.id);
  }
  onKeyLoading(event, data) {
    this.load(data.url, data, Event.KEY_LOADING, 'arraybuffer');
  }

  load(url, id1, id2, responseType) {
    if (!responseType) {
      responseType = '';
    }
    var config = this.hls.config;
    this.url = url;
    this.id = id1;
    this.id2 = id2;
    this.loader = new config.loader(config);
    this.loader.load(url, responseType, this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.manifestLoadingTimeOut, config.manifestLoadingMaxRetry, config.manifestLoadingRetryDelay);
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
    if (oldBase) { oldBase.href = oldHref; }
    else { docHead.removeChild(ourBase); }
    return resolvedUrl;
  }

  parseMasterPlaylist(string, baseurl) {
    var levels = [], level =  {}, result, codecs, codec;
    // https://regex101.com is your friend
    var re = /#EXT-X-STREAM-INF:([^\n\r]*(BAND)WIDTH=(\d+))?([^\n\r]*(CODECS)=\"([^\"\n\r]*)\",?)?([^\n\r]*(RES)OLUTION=(\d+)x(\d+))?([^\n\r]*(NAME)=\"(.*)\")?[^\n\r]*[\r\n]+([^\r\n]+)/g;
    while ((result = re.exec(string)) != null){
      result.shift();
      result = result.filter(function(n) { return (n !== undefined); });
      level.url = this.resolve(result.pop(), baseurl);
      while (result.length > 0) {
        switch (result.shift()) {
          case 'RES':
            level.width = parseInt(result.shift());
            level.height = parseInt(result.shift());
            break;
          case 'BAND':
            level.bitrate = parseInt(result.shift());
            break;
          case 'NAME':
            level.name = result.shift();
            break;
          case 'CODECS':
            codecs = result.shift().split(',');
            while (codecs.length > 0) {
              codec = codecs.shift();
              if (codec.indexOf('avc1') !== -1) {
                level.videoCodec = this.avc1toavcoti(codec);
              } else {
                level.audioCodec = codec;
              }
            }
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

  avc1toavcoti(codec) {
    var result, avcdata = codec.split('.');
    if (avcdata.length > 2) {
      result = avcdata.shift() + '.';
      result += parseInt(avcdata.shift()).toString(16);
      result += ('00' + parseInt(avcdata.shift()).toString(16)).substr(-4);
    } else {
      result = codec;
    }
    return result;
  }

  ////////////////////////////////////
  // ここから videojs/m3u8/m3u8-parse より
  ////////////////////////////////////

    parseAttributes(attributes) {
      // "forgiving" attribute list psuedo-grammar:
      // attributes -> keyvalue (',' keyvalue)*
      // keyvalue   -> key '=' value
      // key        -> [^=]*
      // value      -> '"' [^"]* '"' | [^,]*
      var attributeSeparator = (function() {
        var
          key = '[^=]*',
          value = '"[^"]*"|[^,]*',
          keyvalue = '(?:' + key + ')=(?:' + value + ')';

        return new RegExp('(?:^|,)(' + keyvalue + ')');
      })();

      var
        // split the string using attributes as the separator
        attrs = attributes.split(attributeSeparator),
        i = attrs.length,
        result = {},
        attr;

      while (i--) {
        // filter out unmatched portions of the string
        if (attrs[i] === '') {
          continue;
        }

        // split the key and value
        attr = /([^=]*)=(.*)/.exec(attrs[i]).slice(1);
        // trim whitespace and remove optional quotes around the value
        attr[0] = attr[0].replace(/^\s+|\s+$/g, '');
        attr[1] = attr[1].replace(/^\s+|\s+$/g, '');
        attr[1] = attr[1].replace(/^['"](.*)['"]$/g, '$1');
        result[attr[0]] = attr[1];
      }
      return result;
    }

    parseKey(match, baseurl, level) {
      if (!match[1]) {
        return;
      }

      var data = {
        level: level,
        attributes: this.parseAttributes(match[1]),
        iv: null,
        key: null,
        url: null
      };

      // parse the IV string into a Uint32Array
      if (!data.attributes.IV ||
          !data.attributes.URI ||
          !data.attributes.METHOD ||
          data.attributes.METHOD !== 'AES-128') {
        return;
      }

      var ivValue = data.attributes.IV;
      if (ivValue.substring(0,2) === '0x') {
        ivValue = ivValue.substring(2);
      }

      ivValue = ivValue.match(/.{8}/g);
      ivValue[0] = parseInt(ivValue[0], 16);
      ivValue[1] = parseInt(ivValue[1], 16);
      ivValue[2] = parseInt(ivValue[2], 16);
      ivValue[3] = parseInt(ivValue[3], 16);
      data.iv = new Uint32Array(ivValue);
         
      data.url = this.resolve(data.attributes.URI, baseurl);
      this.hls.trigger(Event.KEY_LOADING, data);
    }

  ////////////////////////////////////
  // ここまで videojs/m3u8/m3u8-parse より
  ////////////////////////////////////

  parseLevelPlaylist(string, baseurl, id) {
    var currentSN = 0, totalduration = 0, level = {url: baseurl, fragments: [], live: true, startSN: 0}, result, regexp, cc = 0, frag, byteRangeEndOffset, byteRangeStartOffset;
    regexp = /(?:#EXT-X-(MEDIA-SEQUENCE):(\d+))|(?:#EXT-X-(TARGETDURATION):(\d+))|(?:#EXT(INF):([\d\.]+)[^\r\n]*([\r\n]+[^#|\r\n]+)?)|(?:#EXT-X-(BYTERANGE):([\d]+[@[\d]*)]*[\r\n]+([^#|\r\n]+)?|(?:#EXT-X-(ENDLIST))|(?:#EXT-X-(DIS)CONTINUITY))|(?:#EXT-X-(KEY):?(.*))/g;
    while ((result = regexp.exec(string)) !== null) {
      result.shift();
      result = result.filter(function(n) { return (n !== undefined); });
      switch (result[0]) {
        case 'MEDIA-SEQUENCE':
          currentSN = level.startSN = parseInt(result[1]);
          break;
        case 'TARGETDURATION':
          level.targetduration = parseFloat(result[1]);
          break;
        case 'ENDLIST':
          level.live = false;
          break;
        case 'DIS':
          cc++;
          break;
        case 'BYTERANGE':
          var params = result[1].split('@');
          if (params.length === 1) {
            byteRangeStartOffset = byteRangeEndOffset;
          } else {
            byteRangeStartOffset = parseInt(params[1]);
          }
          byteRangeEndOffset = parseInt(params[0]) + byteRangeStartOffset;
          frag = level.fragments.length ? level.fragments[level.fragments.length - 1] : null;
          if (frag && !frag.url) {
            frag.byteRangeStartOffset = byteRangeStartOffset;
            frag.byteRangeEndOffset = byteRangeEndOffset;
            frag.url = this.resolve(result[2], baseurl);
          }
          break;
        case 'INF':
          var duration = parseFloat(result[1]);
          if (!isNaN(duration)) {
            level.fragments.push({url: result[2] ? this.resolve(result[2], baseurl) : null, duration: duration, start: totalduration, sn: currentSN++, level: id, cc: cc, byteRangeStartOffset: byteRangeStartOffset, byteRangeEndOffset: byteRangeEndOffset});
            totalduration += duration;
            byteRangeStartOffset = null;
          }
          break;
        case 'KEY':
          this.parseKey(result, baseurl, level);
          break;
        default:
          break;
      }
    }

    //logger.log('found ' + level.fragments.length + ' fragments');
    level.totalduration = totalduration;
    level.endSN = currentSN - 1;
    return level;
  }

  loadKey(event, data, stats) {
      var view = new DataView(event.currentTarget.response);
      data.key = new Uint32Array([
        view.getUint32(0),
        view.getUint32(4),
        view.getUint32(8),
        view.getUint32(12)
      ]);

    data.stats = stats;
    this.hls.trigger(Event.KEY_LOADED, data);
  }

  loadsuccess(event, stats) {
    var url = event.currentTarget.responseURL, id = this.id, id2 = this.id2, hls = this.hls, levels;
    var string = null;
    if (event.currentTarget.responseType === '' || event.currentTarget.responseType === 'text') {
      string = event.currentTarget.responseText;
    }

    // responseURL not supported on some browsers (it is used to detect URL redirection)
    if (url === undefined) {
      // fallback to initial URL
      url = this.url;
    }
    stats.tload = new Date();
    stats.mtime = new Date(event.currentTarget.getResponseHeader('Last-Modified'));
    if (string && string.indexOf('#EXTM3U') === 0) {
      if (string.indexOf('#EXTINF:') > 0) {
        // 1 level playlist
        // if first request, fire manifest loaded event, level will be reloaded afterwards
        // (this is to have a uniform logic for 1 level/multilevel playlists)
        if (this.id === null) {
          hls.trigger(Event.MANIFEST_LOADED, {levels: [{url: url}], url: url, stats: stats});
        } else {
          hls.trigger(Event.LEVEL_LOADED, {details: this.parseLevelPlaylist(string, url, id), level: id, id: id2, stats: stats});
        }
      } else {
        levels = this.parseMasterPlaylist(string, url);
        // multi level playlist, parse level info
        if (levels.length) {
          hls.trigger(Event.MANIFEST_LOADED, {levels: levels, url: url, stats: stats});
        } else {
          hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'no level found in manifest'});
        }
      }
    }
    else if (id2 === Event.KEY_LOADING) {
      this.loadKey(event, id, stats);
    } else {
      hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'no EXTM3U delimiter'});
    }
  }

  loaderror(event) {
    var details, fatal;
    if (this.id === null) {
      details = ErrorDetails.MANIFEST_LOAD_ERROR;
      fatal = true;
    } else {
      details = ErrorDetails.LEVEL_LOAD_ERROR;
      fatal = false;
    }
    this.loader.abort();
    this.hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: this.url, loader: this.loader, response: event.currentTarget, level: this.id, id: this.id2});
  }

  loadtimeout() {
    var details, fatal;
    if (this.id === null) {
      details = ErrorDetails.MANIFEST_LOAD_TIMEOUT;
      fatal = true;
    } else {
      details = ErrorDetails.LEVEL_LOAD_TIMEOUT;
      fatal = false;
    }
   this.loader.abort();
   this.hls.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: this.url, loader: this.loader, level: this.id, id: this.id2});
  }
}

export default PlaylistLoader;
