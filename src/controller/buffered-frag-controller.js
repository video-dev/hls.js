/*
 * Buffered Fragment Controller
 */

import BinarySearch from '../utils/binary-search';
import BufferHelper from '../helper/buffer-helper';
import Event from '../events';
import EventHandler from '../event-handler';
import {logger} from '../utils/logger';

class BufferedFragController extends EventHandler{

  constructor(hls) {
    super(hls,
      Event.MEDIA_ATTACHED,
      Event.FRAG_BUFFERED,
      Event.BUFFER_RESET,
      Event.BUFFER_FLUSHED,
      Event.MEDIA_BUFFER_UPDATED
    );
  }

  tick() {
    // FRAG_CHANGE + LEVEL_SWITCHED METHOD
    var fragPlayingCurrent, currentTime, video = this.media;
    if (video && video.readyState && video.seeking === false) {
      currentTime = video.currentTime;

      if (BufferHelper.isBuffered(video,currentTime)) {
        fragPlayingCurrent = this.getBufferedFrag(currentTime);
      } else if (BufferHelper.isBuffered(video,currentTime + 0.1)) {
        /* ensure that FRAG_CHANGED event is triggered at startup,
          when first video frame is displayed and playback is paused.
          add a tolerance of 100ms, in case current position is not buffered,
          check if current pos+100ms is buffered and use that buffer range
          for FRAG_CHANGED event reporting */
        fragPlayingCurrent = this.getBufferedFrag(currentTime + 0.1);
      }
      if (fragPlayingCurrent) {
        var fragPlaying = fragPlayingCurrent;
        if (fragPlaying !== this.fragPlaying) {
          this.hls.trigger(Event.FRAG_CHANGED, {frag: fragPlaying});
          const fragPlayingLevel = fragPlaying.level;
          if (!this.fragPlaying || this.fragPlaying.level !== fragPlayingLevel) {
            this.hls.trigger(Event.LEVEL_SWITCHED, {level: fragPlayingLevel});
          }
          this.fragPlaying = fragPlaying;
        }
      }
    }

    // CHECK LEVE_SWITCH_END.
    if (this.immediateSwitch) {
      this.immediateLevelSwitchEnd();
    } 
  }

  /*
     on immediate level switch end, after new fragment has been buffered :
      - nudge video decoder by slightly adjusting video currentTime (if currentTime buffered)
      - resume the playback if needed
  */
  immediateLevelSwitchEnd() {
    let media = this.media;
    if (media && media.buffered.length) {
      this.immediateSwitch = false;
      if(BufferHelper.isBuffered(media,media.currentTime)) {
        // only nudge if currentTime is buffered
        media.currentTime -= 0.0001;
      }
      if (!this.previouslyPaused) {
        media.play();
      }
    }
  }

  getBufferedFrag(position) {
    return BinarySearch.search(this._bufferedFrags, function(frag) {
      if (position < frag.startPTS) {
        return -1;
      } else if (position > frag.endPTS) {
        return 1;
      }
      return 0;
    });
  }

  get currentLevel() {
    const media = this.media;
    if (media) {
      const frag = this.getBufferedFrag(media.currentTime);
      if (frag) {
        return frag.level;
      }
    }
    return -1;
  }

  /*
    on immediate level switch :
     - pause playback if playing
     - cancel any pending load request
     - and trigger a buffer flush
  */
  immediateLevelSwitch() {
    logger.log('immediateLevelSwitch');
    if (!this.immediateSwitch) {
      this.immediateSwitch = true;
      let media = this.media, previouslyPaused;
      if (media) {
        previouslyPaused = media.paused;

        const playPromise = media.play();

        if (playPromise !== undefined) {
          playPromise.catch(function() {});
        }
      } else {
        // don't restart playback after instant level switch in case media not attached
        previouslyPaused = true;
      }
      this.previouslyPaused = previouslyPaused;

      // flush everything
      this.flushMainBuffer(0,Number.POSITIVE_INFINITY);
    }
  }

  get nextBufferedFrag() {
    const media = this.media;
    if (media) {
      // first get end range of current fragment
      return this.followingBufferedFrag(this.getBufferedFrag(media.currentTime));
    } else {
      return null;
    }
  }

  followingBufferedFrag(frag) {
    if (frag) {
      // try to get range of next fragment (500ms after this range)
      return this.getBufferedFrag(frag.endPTS + 0.5);
    }
    return null;
  }

  get nextLevel() {
    const frag = this.nextBufferedFrag;
    if (frag) {
      return frag.level;
    } else {
      return -1;
    }
  }

  get altAudio() {
    return (this.mediaBuffer !== this.media);
  }

  nextLevelSwitch() {
    /* try to switch ASAP without breaking video playback :
       in order to ensure smooth but quick level switching,
      we need to find the next flushable buffer range
      we should take into account new segment fetch time
    */
    let media = this.media;
    // ensure that media is defined and that metadata are available (to retrieve currentTime)
    if (media && media.readyState) {
      let fetchdelay, fragPlayingCurrent, nextBufferedFrag;
      fragPlayingCurrent = this.getBufferedFrag(media.currentTime);
      if (fragPlayingCurrent && fragPlayingCurrent.startPTS > 1) {
        // flush buffer preceding current fragment (flush until current fragment start offset)
        // minus 1s to avoid video freezing, that could happen if we flush keyframe of current video ...
        this.flushMainBuffer(0,fragPlayingCurrent.startPTS - 1);
      }
      if (!media.paused) {
        const hls = this.hls;
        const nextLevel = hls.levels[hls.nextLoadLevel];
        const fragLastKbps = this.fragLastKbps;

        fetchdelay = fragLastKbps
          // add a safety delay of 1s
          ? this.lastFragDuration * nextLevel.bitrate / (1000 * fragLastKbps) + 1
          : 0;
      } else {
        fetchdelay = 0;
      }
      //logger.log('fetchdelay:'+fetchdelay);
      // find buffer range that will be reached once new fragment will be fetched
      nextBufferedFrag = this.getBufferedFrag(media.currentTime + fetchdelay);
      if (nextBufferedFrag) {
        // we can flush buffer range following this one without stalling playback
        nextBufferedFrag = this.followingBufferedFrag(nextBufferedFrag);
        if (nextBufferedFrag) {
          // flush position is the start position of this new buffer
          this.flushMainBuffer(nextBufferedFrag.startPTS , Number.POSITIVE_INFINITY);
        }
      }
    }
  }

  flushMainBuffer(startOffset,endOffset) {
    const mediaBuffer = this.mediaBuffer;

    if (mediaBuffer && mediaBuffer.buffered.length > 0) {
      let flushScope = {startOffset: startOffset, endOffset: endOffset};
      // if alternate audio tracks are used, only flush video, otherwise flush everything
      if (this.altAudio) {
        flushScope.type = 'video';
      }
      this.hls.trigger(Event.BUFFER_FLUSHING, flushScope);
    }
  }

  onMediaAttached(data) {
    this.media = data.media;
  }

  onBufferReset(data) {
    this._bufferedFrags = [];
  }

  onFragBuffered(data) {
    const mediaBuffer = this.mediaBuffer;
    const frag = data.frag;

    if (frag && frag.type == 'main') {
      const stats = data.stats;

      // used to compute the fetch-delay on next-level-switching.
      this.lastFragKbps = Math.round(8 * stats.total / (stats.tbuffered - stats.tfirst));
      this.lastFragDuration = frag.duration; 

      if (mediaBuffer) {
        // filter fragments potentially evicted from buffer. this is to avoid memleak on live streams
        let bufferedFrags = this._bufferedFrags.filter(frag => {return BufferHelper.isBuffered(mediaBuffer, (frag.startPTS + frag.endPTS) / 2);});
        // push new range
        bufferedFrags.push(frag);
        // sort frags, as we use BinarySearch for lookup in getBufferedFrag ...
        this._bufferedFrags = bufferedFrags.sort(function(a,b) {return (a.startPTS - b.startPTS);});
      }
    }
  }

  onBufferFlushed(data) {
    /* after successful buffer flushing, filter flushed fragments from bufferedFrags
      use mediaBuffered instead of media (so that we will check against video.buffered ranges in case of alt audio track)
    */
    const mediaBuffer = this.mediaBuffer;
    this._bufferedFrags = this._bufferedFrags.filter(frag => {return BufferHelper.isBuffered(mediaBuffer, (frag.startPTS + frag.endPTS) / 2);});
  }

  onMediaBufferUpdated(data) {
    if (data.type == 'main') {
      this.mediaBuffer = data.mediaBuffer;
    }
  }
}

export default BufferedFragController;

