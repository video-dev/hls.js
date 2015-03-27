/*
 * playlist loader
 *
 */

import Event from '../events';
import observer from '../observer';
//import {logger}             from '../utils/logger';

class PlaylistLoader {
    constructor() {
        this.manifestLoaded = false;
    }

    destroy() {
        if (this.xhr && this.xhr.readyState !== 4) {
            this.xhr.abort();
            this.xhr = null;
        }
        this.url = this.id = null;
    }

    load(url, requestId) {
        this.url = url;
        this.id = requestId;
        this.stats = { trequest: new Date() };
        var xhr = (this.xhr = new XMLHttpRequest());
        xhr.onload = this.loadsuccess.bind(this);
        xhr.onerror = this.loaderror.bind(this);
        xhr.onprogress = this.loadprogress.bind(this);
        xhr.open('GET', url, true);
        xhr.send();
    }

    resolve(url, baseUrl) {
        var doc = document,
            oldBase = doc.getElementsByTagName('base')[0],
            oldHref = oldBase && oldBase.href,
            docHead = doc.head || doc.getElementsByTagName('head')[0],
            ourBase = oldBase || docHead.appendChild(doc.createElement('base')),
            resolver = doc.createElement('a'),
            resolvedUrl;

        ourBase.href = baseUrl;
        resolver.href = url;
        resolvedUrl = resolver.href; // browser magic at work here

        if (oldBase) {
            oldBase.href = oldHref;
        } else {
            docHead.removeChild(ourBase);
        }
        return resolvedUrl;
    }

    parseMasterPlaylist(string, baseurl) {
        var levels = [],
            level = {},
            result,
            codecs,
            codec;
        var re = /#EXT-X-STREAM-INF:([^\n\r]*(BAND)WIDTH=(\d+))?([^\n\r]*(CODECS)=\"(.*)\",)?([^\n\r]*(RES)OLUTION=(\d+)x(\d+))?([^\n\r]*(NAME)=\"(.*)\")?[^\n\r]*[\r\n]+([^\r\n]+)/g;
        while ((result = re.exec(string)) != null) {
            result.shift();
            result = result.filter(function(n) {
                return n !== undefined;
            });
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
        var result,
            avcdata = codec.split('.');
        if (avcdata.length > 2) {
            result = avcdata.shift() + '.';
            result += parseInt(avcdata.shift()).toString(16);
            result += ('00' + parseInt(avcdata.shift()).toString(16)).substr(
                -4
            );
        } else {
            result = codec;
        }
        return result;
    }

    parseLevelPlaylist(string, baseurl, id) {
        var currentSN = 0,
            totalduration = 0,
            level = { url: baseurl, fragments: [], live: true },
            result,
            regexp;
        regexp = /(?:#EXT-X-(MEDIA-SEQUENCE):(\d+))|(?:#EXT-X-(TARGETDURATION):(\d+))|(?:#EXT(INF):([\d\.]+)[^\r\n]*[\r\n]+([^\r\n]+)|(?:#EXT-X-(ENDLIST)))/g;
        while ((result = regexp.exec(string)) !== null) {
            result.shift();
            result = result.filter(function(n) {
                return n !== undefined;
            });
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
                case 'INF':
                    var duration = parseFloat(result[1]);
                    level.fragments.push({
                        url: this.resolve(result[2], baseurl),
                        duration: duration,
                        start: totalduration,
                        sn: currentSN++,
                        level: id
                    });
                    totalduration += duration;
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

    loadsuccess(event) {
        var data,
            string = event.currentTarget.responseText,
            url = event.currentTarget.responseURL,
            id = this.id;
        // responseURL not supported on some browsers (it is used to detect URL redirection)
        if (url === undefined) {
            // fallback to initial URL
            url = this.url;
        }
        this.stats.tload = new Date();
        this.stats.mtime = new Date(
            this.xhr.getResponseHeader('Last-Modified')
        );

        if (string.indexOf('#EXTM3U') === 0) {
            if (string.indexOf('#EXTINF:') > 0) {
                // 1 level playlist, parse it
                data = this.parseLevelPlaylist(string, url, id);
                // if first request, fire manifest loaded event beforehand
                if (this.id === null) {
                    observer.trigger(Event.MANIFEST_LOADED, {
                        levels: [data],
                        url: url,
                        stats: this.stats
                    });
                }
                observer.trigger(Event.LEVEL_LOADED, {
                    details: data,
                    levelId: id,
                    stats: this.stats
                });
            } else {
                // multi level playlist, parse level info
                observer.trigger(Event.MANIFEST_LOADED, {
                    levels: this.parseMasterPlaylist(string, url),
                    url: url,
                    id: id,
                    stats: this.stats
                });
            }
        } else {
            observer.trigger(Event.LOAD_ERROR, {
                url: url,
                response: event.currentTarget
            });
        }
    }

    loaderror(event) {
        observer.trigger(Event.LOAD_ERROR, {
            url: this.url,
            response: event.currentTarget
        });
    }

    loadprogress() {
        if (this.stats.tfirst === undefined) {
            this.stats.tfirst = new Date();
        }
    }
}

export default PlaylistLoader;
