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

    resolve(url, base_url) {
        var doc = document,
            old_base = doc.getElementsByTagName('base')[0],
            old_href = old_base && old_base.href,
            doc_head = doc.head || doc.getElementsByTagName('head')[0],
            our_base =
                old_base || doc_head.appendChild(doc.createElement('base')),
            resolver = doc.createElement('a'),
            resolved_url;
        our_base.href = base_url;
        resolver.href = url;
        resolved_url = resolver.href; // browser magic at work here

        if (old_base) old_base.href = old_href;
        else doc_head.removeChild(our_base);
        return resolved_url;
    }

    parseManifest(string, url) {
        if (string.indexOf(HEADER) == 0) {
            // 1 level playlist, create unique level and parse playlist
            if (string.indexOf(FRAGMENT) > 0) {
                var level = this.parseLevelPlaylist(string, url);
                observer.trigger(Event.MANIFEST_LOADED, {
                    levels: [level],
                    url: url,
                    stats: {
                        trequest: this.trequest,
                        tfirst: this.tfirst,
                        tend: Date.now()
                    }
                });
            }
        }
    }

    parseLevelPlaylist(string, baseurl) {
        var startSN,
            endSN,
            targetduration,
            endList = false,
            totalduration = 0;
        var currentSN,
            duration,
            extinf_found = false;
        var lines = string.split(/\r?\n/);
        var fragments = [];
        lines.forEach(line => {
            if (line.indexOf(SEQNUM) == 0) {
                currentSN = startSN = parseInt(line.substr(SEQNUM.length));
            } else if (line.indexOf(TARGETDURATION) == 0) {
                targetduration = parseFloat(line.substr(TARGETDURATION.length));
            } else if (line.indexOf(ENDLIST) == 0) {
                endList = true;
            } else if (line.indexOf(FRAGMENT) == 0) {
                var comma_position = line.indexOf(',');
                duration =
                    comma_position == -1
                        ? parseFloat(line.substr(FRAGMENT.length))
                        : parseFloat(
                              line.substr(
                                  FRAGMENT.length,
                                  comma_position - FRAGMENT.length
                              )
                          );
                totalduration += duration;
                extinf_found = true;
            } else if (extinf_found == true) {
                var url = this.resolve(line, baseurl);
                fragments.push({ url: url, duration: duration, sn: currentSN });
                currentSN++;
                extinf_found = false;
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

    loadsuccess(event) {
        this.parseManifest(event.currentTarget.responseText, this.url);
    }

    loaderror(event) {
        observer.trigger(Event.LOAD_ERROR, { url: this.url });
    }

    loadprogress(event) {
        if (this.tfirst === null) {
            this.tfirst = Date.now();
        }
    }
}

export default PlaylistLoader;
