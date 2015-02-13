/*
 * playlist loader
 *
 */

import Event from '../events';
import observer from '../observer';
import { logger } from '../utils/logger';

class PlaylistLoader {
    constructor() {}

    load(url) {
        this.url = url;
        this.trequest = Date.now();
        this.tfirst = null;
        var xhr = new XMLHttpRequest();
        xhr.onload = this.loadsuccess.bind(this);
        xhr.onerror = this.loaderror.bind(this);
        xhr.onprogress = this.loadprogress.bind(this);
        xhr.open('GET', url, true);
        xhr.send();
        observer.trigger(Event.MANIFEST_LOADING, { url: this.url });
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

    parseManifest(string, url) {
        var levels;
        if (string.indexOf('#EXTM3U') === 0) {
            if (string.indexOf('#EXTINF:') > 0) {
                // 1 level playlist, create unique level and parse playlist
                levels = [this.parseLevelPlaylist(string, url)];
            } else {
                // multi level playlist, parse level info
                levels = this.parseMasterPlaylist(string, url);
            }
            observer.trigger(Event.MANIFEST_LOADED, {
                levels: levels,
                url: url,
                stats: {
                    trequest: this.trequest,
                    tfirst: this.tfirst,
                    tend: Date.now()
                }
            });
        } else {
            observer.trigger(Event.LOAD_ERROR, {
                url: url,
                event: 'not an HLS playlist'
            });
        }
    }

    parseMasterPlaylist(string, baseurl) {
        var levels = [];
        var level = {};
        var result;
        var re = /#EXT-X-STREAM-INF:[^\n\r]*(BANDWIDTH)=(\d+)*[^\n\r](RESOLUTION)=(\d+)x(\d+)[^\r\n]*[\r\n]+([^\r\n]+)/g;
        while ((result = re.exec(string)) != null) {
            result.shift();
            result = result.filter(function(n) {
                return n !== undefined;
            });
            level.url = this.resolve(result.pop(), baseurl);
            while (result.length > 0) {
                switch (result.shift()) {
                    case 'RESOLUTION':
                        level.width = result.shift();
                        level.height = result.shift();
                        break;
                    case 'BANDWIDTH':
                        level.bitrate = result.shift();
                        break;
                    default:
                        result.shift();
                        break;
                }
            }
            levels.push(level);
            level = {};
        }
        return levels;
    }

    parseLevelPlaylist(string, baseurl) {
        var startSN,
            targetduration,
            endList = false,
            totalduration = 0;
        var currentSN;
        var fragments = [];

        var result;
        var re = /(?:#EXT-X-(MEDIA-SEQUENCE):(\d+))|(?:#EXT-X-(TARGETDURATION):(\d+))|(?:#EXT(INF):(\d+)[^\r\n]*[\r\n]+([^\r\n]+)|(?:#EXT-X-(ENDLIST)))/g;
        while ((result = re.exec(string)) !== null) {
            result.shift();
            result = result.filter(function(n) {
                return n !== undefined;
            });
            switch (result[0]) {
                case 'MEDIA-SEQUENCE':
                    currentSN = startSN = result[1];
                    break;
                case 'TARGETDURATION':
                    targetduration = result[1];
                    break;
                case 'ENDLIST':
                    endList = true;
                    break;
                case 'INF':
                    fragments.push({
                        url: this.resolve(result[2], baseurl),
                        duration: result[1],
                        sn: currentSN++
                    });
                    totalduration += result[1];
                    break;
                default:
                    break;
            }
        }
        logger.log('found ' + fragments.length + ' fragments');
        return {
            fragments: fragments,
            url: baseurl,
            startSN: startSN,
            endSN: currentSN - 1,
            targetduration: targetduration,
            totalduration: totalduration,
            endList: endList
        };
    }

    loadsuccess() {
        this.parseManifest(event.currentTarget.responseText, this.url);
    }

    loaderror(event) {
        observer.trigger(Event.LOAD_ERROR, { url: this.url, event: event });
    }

    loadprogress() {
        if (this.tfirst === null) {
            this.tfirst = Date.now();
        }
    }
}

export default PlaylistLoader;
