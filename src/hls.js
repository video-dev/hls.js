/**
 * HLS engine
 */
'use strict';

import Event from './events';
import observer from './observer';
import PlaylistLoader from './loader/playlist-loader';
import BufferController from './controller/buffer-controller';
import LevelController from './controller/level-controller';
import { logger, enableLogs } from './utils/logger';
//import MP4Inspect         from '/remux/mp4-inspector';

class Hls {
    static isSupported() {
        return (
            window.MediaSource &&
            MediaSource.isTypeSupported(
                'video/mp4; codecs="avc1.42E01E,mp4a.40.2"'
            )
        );
    }

    constructor(video) {
        this.playlistLoader = new PlaylistLoader();
        this.levelController = new LevelController(video, this.playlistLoader);
        this.bufferController = new BufferController(
            video,
            this.levelController
        );
        this.Events = Event;
        this.debug = enableLogs;
        this.logEvt = this.logEvt;
        // observer setup
        this.on = observer.on.bind(observer);
        this.off = observer.removeListener.bind(observer);
        this.attachView(video);
    }

    destroy() {
        if (this.playlistLoader) {
            this.playlistLoader.destroy();
            this.playlistLoader = null;
        }
        if (this.bufferController) {
            this.bufferController.destroy();
            this.bufferController = null;
        }
        if (this.levelController) {
            this.levelController.destroy();
            this.levelController = null;
        }
        this.detachSource();
        this.detachView();
        observer.removeAllListeners();
    }

    attachView(video) {
        this.video = video;
        // setup the media source
        var ms = (this.mediaSource = new MediaSource());
        //Media Source listeners
        this.onmso = this.onMediaSourceOpen.bind(this);
        this.onmse = this.onMediaSourceEnded.bind(this);
        this.onmsc = this.onMediaSourceClose.bind(this);
        ms.addEventListener('sourceopen', this.onmso);
        ms.addEventListener('sourceended', this.onmse);
        ms.addEventListener('sourceclose', this.onmsc);
        // link video and media Source
        video.src = URL.createObjectURL(ms);
        this.onverror = this.onVideoError.bind(this);
        video.addEventListener('error', this.onverror);
    }

    detachView() {
        var video = this.video;
        var ms = this.mediaSource;
        if (ms) {
            ms.endOfStream();
            ms.removeEventListener('sourceopen', this.onmso);
            ms.removeEventListener('sourceended', this.onmse);
            ms.removeEventListener('sourceclose', this.onmsc);
            // unlink MediaSource from video tag
            video.src = '';
            this.mediaSource = null;
        }
        this.onmso = this.onmse = this.onmsc = null;
        if (video) {
            this.video = null;
            // remove video error listener
            video.removeEventListener('error', this.onverror);
            this.onverror = null;
        }
    }

    attachSource(url) {
        this.url = url;
        logger.log('attachSource:' + url);
        // when attaching to a source URL, trigger a playlist load
        this.playlistLoader.load(url, null);
    }

    detachSource() {
        this.url = null;
    }

    /** Return all quality levels **/
    get levels() {
        return this.levelController.levels;
    }
    /** Return the quality level of last loaded fragment **/
    get level() {
        return this.levelController.level;
    }

    /* set quality level for next loaded fragment (-1 for automatic level selection) */
    set level(newLevel) {
        this.levelController.manualLevel = newLevel;
    }

    /* check if we are in automatic level selection mode */
    get autoLevelEnabled() {
        return this.levelController.manualLevel === -1;
    }

    /* return manual level */
    get manualLevel() {
        return this.levelController.manualLevel;
    }

    onMediaSourceOpen() {
        observer.trigger(Event.FRAMEWORK_READY, {
            mediaSource: this.mediaSource
        });
    }

    onMediaSourceClose() {
        logger.log('media source closed');
    }

    onMediaSourceEnded() {
        logger.log('media source ended');
    }

    onVideoError() {
        observer.trigger(Event.VIDEO_ERROR);
    }
}

export default Hls;
