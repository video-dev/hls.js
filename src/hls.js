/**
 * HLS engine
 */
(function() {
    'use strict';
    var init, attachView, attachSource;
    var mediaSource, video, url;
    var playlistLoader, fragmentLoader;
    var buffer, demuxer;
    var mp4segments;

    init = function() {
        mediaSource = new MediaSource();
        playlistLoader = new hls.playlistLoader();
        fragmentLoader = new hls.fragmentLoader();
        // setup the media source
        mediaSource.addEventListener('sourceopen', onMediaSourceOpen);
        mediaSource.addEventListener('sourceended', function() {
            hls.log.debug('media source ended');
        });

        mediaSource.addEventListener('sourceclose', function() {
            hls.log.debug('media source closed');
        });
    };

    attachView = function(view) {
        video = view;
        video.src = URL.createObjectURL(mediaSource);
        video.addEventListener('loadstart', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('progress', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('suspend', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('abort', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('error', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('emptied', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('stalled', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('loadedmetadata', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('loadeddata', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('canplay', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('canplaythrough', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('playing', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('waiting', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('seeking', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('seeked', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('durationchange', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('timeupdate', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('play', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('pause', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('ratechange', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('resize', function(evt) {
            logEvt(evt);
        });
        video.addEventListener('volumechange', function(evt) {
            logEvt(evt);
        });
    };

    attachSource = function(url) {
        url = url;
        playlistLoader.load(url);
    };

    function onMediaSourceOpen() {
        buffer = mediaSource.addSourceBuffer(
            'video/mp4;codecs=avc1.4d400d,mp4a.40.5'
        );
        demuxer = new hls.demux.TSDemuxer();
        mp4segments = [];

        buffer.addEventListener('updateend', function() {
            appendSegments();
        });

        buffer.addEventListener('error', function(event) {
            hls.log.debug(' buffer append error:' + event);
        });

        var fragments;
        var fragmentIndex;
        playlistLoader.on('data', function(data) {
            fragments = data;
            fragmentIndex = 0;
            fragmentLoader.load(fragments[fragmentIndex++]);
        });

        playlistLoader.on('stats', function(stats) {
            var rtt, loadtime, bw;
            rtt = stats.tfirst - stats.trequest;
            loadtime = stats.tend - stats.trequest;
            hls.log.debug(
                'playlist loaded,RTT(ms)/load(ms)/nb frag:' +
                    rtt +
                    '/' +
                    loadtime +
                    '/' +
                    stats.length
            );
        });

        fragmentLoader.on('data', function(data) {
            demuxer.push(new Uint8Array(data));
            demuxer.end();
            appendSegments();
            if (fragmentIndex < fragments.length) {
                fragmentLoader.load(fragments[fragmentIndex++]);
            } else {
                hls.log.debug('last fragment loaded');
            }
        });

        fragmentLoader.on('stats', function(stats) {
            var rtt, loadtime, bw;
            rtt = stats.tfirst - stats.trequest;
            loadtime = stats.tend - stats.trequest;
            bw = stats.length * 8 / (1000 * loadtime);
            hls.log.debug(
                'frag loaded, RTT(ms)/load(ms)/bitrate:' +
                    rtt +
                    '/' +
                    loadtime +
                    '/' +
                    bw.toFixed(3) +
                    ' Mb/s'
            );
        });

        // transmux the MPEG-TS data to ISO-BMFF segments
        demuxer.on('data', function(segment) {
            //console.log(JSON.stringify(hls.inspectMp4(segment.data)),null,4);
            mp4segments.push(segment);
        });
    }

    function appendSegments() {
        if (!buffer.updating && mp4segments.length) {
            buffer.appendBuffer(mp4segments.shift().data);
        }
    }

    function logEvt(evt) {
        var data = '';
        switch (evt.type) {
            case 'durationchange':
                data = event.target.duration;
                break;
            case 'resize':
                data =
                    'videoWidth:' +
                    evt.target.videoWidth +
                    '/videoHeight:' +
                    evt.target.videoHeight;
                break;
            case 'loadedmetadata':
                data =
                    'duration:' +
                    evt.target.duration +
                    '/videoWidth:' +
                    evt.target.videoWidth +
                    '/videoHeight:' +
                    evt.target.videoHeight;
                break;
            case 'loadeddata':
            case 'canplay':
            case 'canplaythrough':
            case 'timeupdate':
            case 'seeking':
            case 'seeked':
            case 'pause':
            case 'play':
            case 'stalled':
                data = 'currentTime:' + evt.target.currentTime;
                break;
            default:
                break;
        }
        hls.log.debug(evt.type + ':' + data);
    }

    window.hls = window.hls || {
        init: init,
        attachView: attachView,
        attachSource: attachSource
    };
})();
