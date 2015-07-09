/*
 * level controller
 *
 */

import Event from '../events';
import observer from '../observer';
import { logger } from '../utils/logger';
import { ErrorTypes, ErrorDetails } from '../errors';

class LevelController {
    constructor(hls) {
        this.hls = hls;
        this.onml = this.onManifestLoaded.bind(this);
        this.onll = this.onLevelLoaded.bind(this);
        this.onflp = this.onFragmentLoadProgress.bind(this);
        this.onerr = this.onError.bind(this);
        this.ontick = this.tick.bind(this);
        observer.on(Event.MANIFEST_LOADED, this.onml);
        observer.on(Event.FRAG_LOAD_PROGRESS, this.onflp);
        observer.on(Event.LEVEL_LOADED, this.onll);
        observer.on(Event.ERROR, this.onerr);
        this._manualLevel = this._autoLevelCapping = -1;
    }

    destroy() {
        observer.off(Event.MANIFEST_LOADED, this.onml);
        observer.off(Event.FRAG_LOAD_PROGRESS, this.onflp);
        observer.off(Event.LEVEL_LOADED, this.onll);
        observer.off(Event.ERROR, this.onerr);
        if (this.timer) {
            clearInterval(this.timer);
        }
        this._manualLevel = -1;
    }

    onManifestLoaded(event, data) {
        var levels = [],
            bitrateStart,
            i,
            bitrateSet = {},
            aac = false,
            heaac = false,
            codecs;
        if (data.levels.length > 1) {
            // remove failover level for now to simplify the logic
            data.levels.forEach(level => {
                if (!bitrateSet.hasOwnProperty(level.bitrate)) {
                    levels.push(level);
                    bitrateSet[level.bitrate] = true;
                }
                // detect if we have different kind of audio codecs used amongst playlists
                codecs = level.codecs;
                if (codecs) {
                    if (codecs.indexOf('mp4a.40.2') !== -1) {
                        aac = true;
                    }
                    if (codecs.indexOf('mp4a.40.5') !== -1) {
                        heaac = true;
                    }
                }
            });
            // start bitrate is the first bitrate of the manifest
            bitrateStart = levels[0].bitrate;
            // sort level on bitrate
            levels.sort(function(a, b) {
                return a.bitrate - b.bitrate;
            });
            this._levels = levels;

            // find index of first level in sorted levels
            for (i = 0; i < levels.length; i++) {
                if (levels[i].bitrate === bitrateStart) {
                    this._firstLevel = i;
                    logger.log(
                        `manifest loaded,${
                            levels.length
                        } level(s) found, first bitrate:${bitrateStart}`
                    );
                    break;
                }
            }

            //this._startLevel = -1;
            observer.trigger(Event.MANIFEST_PARSED, {
                levels: this._levels,
                startLevel: this._startLevel,
                audiocodecswitch: aac && heaac
            });
        } else {
            this._levels = data.levels;
            this._firstLevel = 0;
            observer.trigger(Event.MANIFEST_PARSED, {
                levels: this._levels,
                startLevel: 0,
                audiocodecswitch: false
            });
        }

        return;
    }

    get levels() {
        return this._levels;
    }

    get level() {
        return this._level;
    }

    set level(newLevel) {
        if (this._level !== newLevel) {
            this.setLevelInternal(newLevel);
        }
    }

    setLevelInternal(newLevel) {
        // check if level idx is valid
        if (newLevel >= 0 && newLevel < this._levels.length) {
            // stopping live reloading timer if any
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
            this._level = newLevel;
            logger.log(`switching to level ${newLevel}`);
            observer.trigger(Event.LEVEL_SWITCH, { levelId: newLevel });
            var level = this._levels[newLevel];
            // check if we need to load playlist for this level
            if (level.details === undefined || level.details.live === true) {
                // level not retrieved yet, or live playlist we need to (re)load it
                logger.log(`(re)loading playlist for level ${newLevel}`);
                observer.trigger(Event.LEVEL_LOADING, {
                    url: level.url,
                    level: newLevel
                });
            }
        } else {
            // invalid level id given, trigger error
            observer.trigger(Event.ERROR, {
                type: ErrorTypes.OTHER_ERROR,
                details: ErrorDetails.LEVEL_SWITCH_ERROR,
                level: newLevel,
                fatal: false,
                reason: 'invalid level idx'
            });
        }
    }

    get manualLevel() {
        return this._manualLevel;
    }

    set manualLevel(newLevel) {
        this._manualLevel = newLevel;
        if (newLevel !== -1) {
            this.level = newLevel;
        }
    }

    /** Return the capping/max level value that could be used by automatic level selection algorithm **/
    get autoLevelCapping() {
        return this._autoLevelCapping;
    }

    /** set the capping/max level value that could be used by automatic level selection algorithm **/
    set autoLevelCapping(newLevel) {
        this._autoLevelCapping = newLevel;
    }

    get firstLevel() {
        return this._firstLevel;
    }

    set firstLevel(newLevel) {
        this._firstLevel = newLevel;
    }

    get startLevel() {
        if (this._startLevel === undefined) {
            return this._firstLevel;
        } else {
            return this._startLevel;
        }
    }

    set startLevel(newLevel) {
        this._startLevel = newLevel;
    }

    onFragmentLoadProgress(event, data) {
        var stats = data.stats;
        if (stats.aborted === undefined) {
            this.lastfetchduration = (new Date() - stats.trequest) / 1000;
            this.lastfetchlevel = data.frag.level;
            this.lastbw = stats.loaded * 8 / this.lastfetchduration;
            //console.log(`fetchDuration:${this.lastfetchduration},bw:${(this.lastbw/1000).toFixed(0)}/${stats.aborted}`);
        }
    }

    onError(event, data) {
        var details = data.details,
            fatal = data.fatal;
        // try to recover not fatal errors
        switch (details) {
            case ErrorDetails.FRAG_LOAD_ERROR:
            case ErrorDetails.FRAG_LOAD_TIMEOUT:
            case ErrorDetails.FRAG_LOOP_LOADING_ERROR:
                if (!fatal) {
                    logger.log(
                        `level controller,${details}: emergency switch-down for next fragment`
                    );
                    this.lastbw = 0;
                    this.lastfetchduration = 0;
                }
                break;
            case ErrorDetails.LEVEL_LOAD_ERROR:
            case ErrorDetails.LEVEL_LOAD_TIMEOUT:
                if (fatal) {
                    this._level = undefined;
                }
                break;
            default:
                break;
        }
    }

    onLevelLoaded(event, data) {
        // check if current playlist is a live playlist
        if (data.details.live && !this.timer) {
            // if live playlist we will have to reload it periodically
            // set reload period to playlist target duration
            this.timer = setInterval(
                this.ontick,
                1000 * data.details.targetduration
            );
        }
    }

    tick() {
        observer.trigger(Event.LEVEL_LOADING, {
            url: this._levels[this._level].url,
            level: this._level
        });
    }

    nextLevel() {
        if (this._manualLevel !== -1) {
            return this._manualLevel;
        } else {
            return this.nextAutoLevel();
        }
    }

    nextFetchDuration() {
        if (this.lastfetchduration) {
            return (
                this.lastfetchduration *
                this._levels[this._level].bitrate /
                this._levels[this.lastfetchlevel].bitrate
            );
        } else {
            return 0;
        }
    }

    nextAutoLevel() {
        var lastbw = this.lastbw,
            adjustedbw,
            i,
            maxAutoLevel;
        if (this._autoLevelCapping === -1) {
            maxAutoLevel = this._levels.length - 1;
        } else {
            maxAutoLevel = this._autoLevelCapping;
        }
        // follow algorithm captured from stagefright :
        // https://android.googlesource.com/platform/frameworks/av/+/master/media/libstagefright/httplive/LiveSession.cpp
        // Pick the highest bandwidth stream below or equal to estimated bandwidth.
        for (i = 0; i <= maxAutoLevel; i++) {
            // consider only 80% of the available bandwidth, but if we are switching up,
            // be even more conservative (70%) to avoid overestimating and immediately
            // switching back.
            if (i <= this._level) {
                adjustedbw = 0.8 * lastbw;
            } else {
                adjustedbw = 0.7 * lastbw;
            }
            if (adjustedbw < this._levels[i].bitrate) {
                return Math.max(0, i - 1);
            }
        }
        return i - 1;
    }
}

export default LevelController;
