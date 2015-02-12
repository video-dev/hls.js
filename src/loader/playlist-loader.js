/*
 * playlist loader
 *
 */

import Event from '../events';
import observer from '../observer';
import { logger } from '../utils/logger';

const ENDLIST = '#EXT-X-ENDLIST';
const FRAGMENT = '#EXTINF:';
const HEADER = '#EXTM3U';
const LEVEL = '#EXT-X-STREAM-INF:';
const SEQNUM = '#EXT-X-MEDIA-SEQUENCE:';
const TARGETDURATION = '#EXT-X-TARGETDURATION:';

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
        if (string.indexOf(HEADER) === 0) {
            // 1 level playlist, create unique level and parse playlist
            if (string.indexOf(FRAGMENT) > 0) {
                levels = [this.parseLevelPlaylist(string, url)];
            } else {
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
        }
    }

    parseMasterPlaylist(string, baseurl) {
        // var re = /(r'#EXT-X-STREAM-INF:[^\n\r]*RESOLUTION=(\d+)x(\d+)[^\r\n]*[\r\n]+([^\r\n]+))/g;
        // var results = string.match(re);
        var levels = [];
        var level = {};
        var levelFound = false;
        var lines = string.split(/\r?\n/);
        lines.forEach(line => {
            if (line.indexOf(LEVEL) === 0) {
                levelFound = true;
                var params = line.substr(LEVEL.length).split(',');
                params.forEach(param => {
                    if (param.indexOf('BANDWIDTH') > -1) {
                        level.bitrate = param.split('=')[1];
                    } else if (param.indexOf('RESOLUTION') > -1) {
                        var res = param.split('=')[1];
                        var dim = res.split('x');
                        level.width = parseInt(dim[0]);
                        level.height = parseInt(dim[1]);
                    } else if (param.indexOf('CODECS') > -1) {
                        level.codecs = param.split('=')[1];
                    } else if (param.indexOf('NAME') > -1) {
                        level.name = param.split('=')[1];
                    }
                });
            } else if (levelFound === true) {
                level.url = this.resolve(line, baseurl);
                levels.push(level);
                level = {};
                levelFound = false;
            }
        });
        return levels;
    }

    parseLevelPlaylist(string, baseurl) {
        // var re = /(?:#EXT-X-(MEDIA-SEQUENCE):(\d+))|(?:#EXT-X-(TARGETDURATION):(\d+))|(?:#EXT(INF):(\d+)[^\r\n]*[\r\n]+([^\r\n]+))/g;
        // var results = string.match(re);
        var startSN,
            endSN,
            targetduration,
            endList = false,
            totalduration = 0;
        var currentSN,
            duration,
            extinfFound = false;
        var lines = string.split(/\r?\n/);
        var fragments = [];
        lines.forEach(line => {
            if (line.indexOf(SEQNUM) === 0) {
                currentSN = startSN = parseInt(line.substr(SEQNUM.length));
            } else if (line.indexOf(TARGETDURATION) === 0) {
                targetduration = parseFloat(line.substr(TARGETDURATION.length));
            } else if (line.indexOf(ENDLIST) === 0) {
                endList = true;
            } else if (line.indexOf(FRAGMENT) === 0) {
                var commaPosition = line.indexOf(',');
                duration =
                    commaPosition === -1
                        ? parseFloat(line.substr(FRAGMENT.length))
                        : parseFloat(
                              line.substr(
                                  FRAGMENT.length,
                                  commaPosition - FRAGMENT.length
                              )
                          );
                totalduration += duration;
                extinfFound = true;
            } else if (extinfFound === true) {
                var url = this.resolve(line, baseurl);
                fragments.push({ url: url, duration: duration, sn: currentSN });
                currentSN++;
                extinfFound = false;
            }
        });
        endSN = currentSN - 1;

        logger.log('found ' + fragments.length + ' fragments');
        return {
            fragments: fragments,
            url: baseurl,
            startSN: startSN,
            endSN: endSN,
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
