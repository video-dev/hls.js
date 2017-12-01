import {logger} from '../utils/logger';
import EventHandler from '../event-handler';
import Event from '../events';

const bufferPadding = 0.2;
function getFragmentKey(fragment) {
  return fragment.level + '_' + fragment.sn;
}

export default class FragmentTracker extends EventHandler {

  constructor(hls) {
    super(hls,
      Event.SOURCE_BUFFER_APPEND,
      Event.BUFFER_APPENDED
    );

    // This holds all the loading fragments until the buffer is populated
    this.loadingFragments = {};
    // This keeps track of all fragments that loaded differently into the buffer from the PTS
    this.partialFragments = {};
    this.partialFragmentTimes = {};
    this.config = hls.config;
    this.shouldTestFragment = false;
  }

  destroy() {
    this.loadingFragments = {};
    this.partialFragments = {};
    this.partialFragmentTimes = {};
    this.shouldTestFragment = false;
    EventHandler.prototype.destroy.call(this);
  }

  /**
   * Partial fragments effected by coded frame eviction will be unregistered
   * The browser will unload parts of the buffer to free up memory for new buffer data
   * Fragments will need to be reloaded when the buffer is freed up, unregistering partial fragments will allow them to reload(since there might be parts that are still playable)
   * @param buffered This should be the sourceBuffer object, not media.buffered
   */
  detectEvictedFragments(buffered) {
    let fragment, fragmentTimes, time, found, startTime, endTime;
    // Check if any flagged fragments have been unloaded
    for (let fragKey in this.partialFragments) {
      if (this.partialFragments.hasOwnProperty(fragKey)) {

        fragment = this.partialFragments[fragKey];
        fragmentTimes = this.partialFragmentTimes[fragKey];

        for (let i = 0; i < fragmentTimes.length; i++) {
          time = fragmentTimes[i];
          found = false;
          // This can be optimized
          for (let j = 0; j < buffered.length; j++) {
            startTime = buffered.start(j) - bufferPadding;
            endTime = buffered.end(j) + bufferPadding;
            if (time.startPTS >= startTime && time.endPTS <= endTime) {
              found = true;
            }
            if(time.endPTS <= startTime) {
              // No need to check the rest of the buffered as it is in order
              break;
            }
          }
          if(found === false) {
            // Unregister partial fragment as it needs to load again to be reused
            delete this.partialFragments[fragKey];
            delete this.partialFragmentTimes[fragKey];
            break;
          }
        }
      }
    }
  }

  /**
   * Fragments that are loading will be checked in the buffer to see if they are loaded properly
   * Partially loaded fragments will be registered as a partial fragment
   * @param buffered This should be the sourceBuffer object, not media.buffered
   */
  detectPartialFragments(buffered) {
    let fragment, fragmentGaps, startTime, endTime;
    for (let fragKey in this.loadingFragments) {
      if (this.loadingFragments.hasOwnProperty(fragKey)) {
        fragment = this.loadingFragments[fragKey];
        fragmentGaps = [];
        for (let i = 0; i < buffered.length; i++) {
          startTime = buffered.start(i) - bufferPadding;
          endTime = buffered.end(i) + bufferPadding;

          if (fragment.startPTS >= startTime && fragment.endPTS <= endTime) {
            // Fragment is entirely contained in buffer
            delete this.loadingFragments[fragKey];
            // No need to check the other buffered times since it's completely playable
            break;
          } else if (fragment.startPTS < endTime && fragment.endPTS > startTime) {
            // Check for intersection with buffer
            // Get playable sections of the fragment
            fragmentGaps.push({
              startPTS: Math.max(fragment.startPTS, buffered.start(i)),
              endPTS: Math.min(fragment.endPTS, buffered.end(i))
            });
          }
        }

        if(fragmentGaps.length > 0) {
          let fragmentGapString = '';
          for(let key in fragmentGaps) {
            let time = fragmentGaps[key];
            fragmentGapString += `[${time.startPTS}, ${time.endPTS}]`;
          }
          logger.warn(`Fragment with bad PTS detected, level: ${fragment.level} sn: ${fragment.sn} startPTS: ${fragment.startPTS} endPTS: ${fragment.endPTS} loadedPTS: ${fragmentGapString}`);
          this.partialFragmentTimes[fragKey] = fragmentGaps;
          this.partialFragments[fragKey] = fragment;
          delete this.loadingFragments[fragKey];
        }
      }
    }
  }

  /**
   * Gets the partial fragment for a certain time
   * @param time
   * @returns fragment Returns a partial fragment at a time or null if there is no partial fragment
   */
  getPartialFragment(time) {
    let fragment;
    for (let fragKey in this.partialFragments) {
      if (this.partialFragments.hasOwnProperty(fragKey)) {
        fragment = this.partialFragments[fragKey];
        if(time >= fragment.startPTS && time <= fragment.endPTS) {
          return fragment;
        }
      }
    }
    return null;
  }

  /**
   * isBadFragment
   * @param fragment The fragment to check
   * @returns {boolean} Returns true when a fragment never loaded or if it partially loaded
   */
  isBadFragment(fragment) {
    let fragKey = getFragmentKey(fragment);
    if (this.loadingFragments[fragKey]) {
      // Fragment never loaded into buffer
      return true;
    }else if (this.partialFragments[fragKey]) {
      // Fragment only partially loaded
      return true;
    }
    return false;
  }

  /**
   * Fires when the buffer is updated
   */
  onBufferAppended(e) {
    let buffered = e.sourceBufferRanges;
    if(buffered === null) {
      return;
    }
    this.detectEvictedFragments(buffered);
    // Check for bad fragments
    if(this.shouldTestFragment === true) {
      this.detectPartialFragments(buffered);
    }
  }

  /**
   * Fires when source buffer is being appended to
   * Note that this should not be called again before invoking onBufferAppended
   */
  onSourceBufferAppend(e) {
    let segment = e.segment;
    // Only test videos that effect the PTS
    this.shouldTestFragment = segment.type === 'video' && segment.updatePTS === true;
    if(this.shouldTestFragment === true) {
      let fragment = segment.fragment;
      let fragKey = getFragmentKey(fragment);
      this.loadingFragments[fragKey] = fragment;
    }
  }
}
