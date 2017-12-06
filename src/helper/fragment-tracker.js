import {logger} from '../utils/logger';
import EventHandler from '../event-handler';
import Event from '../events';

const bufferPadding = 0.2;
function getFragmentKey(fragment) {
  return `${fragment.type}_${fragment.level}_${fragment.sn}`;
}

export const FragmentTrackerState = {
  NONE: 'NONE',
  LOADING_BUFFER: 'LOADING_BUFFER',
  PARTIAL: 'PARTIAL',
  GOOD: 'GOOD',
};

export class FragmentTracker extends EventHandler {

  constructor(hls) {
    super(hls,
      Event.BUFFER_APPENDED,
      Event.FRAG_BUFFERED,
      Event.FRAG_LOADED
    );

    // This holds all the loading fragments until the buffer is populated
    this.loadingFragments = {};
    // This holds all the successfully loaded fragments until the buffer is evicted
    this.goodFragments = {};
    // This keeps track of all fragments that loaded differently into the buffer from the PTS
    this.partialFragments = {};
    this.partialFragmentTimes = {};
    this.timeRanges = {};
    this.config = hls.config;
  }

  destroy() {
    this.goodFragments = {};
    this.loadingFragments = {};
    this.partialFragments = {};
    this.partialFragmentTimes = {};
    this.timeRanges = {};
    EventHandler.prototype.destroy.call(this);
  }

  /**
   * Partial fragments effected by coded frame eviction will be unregistered
   * The browser will unload parts of the buffer to free up memory for new buffer data
   * Fragments will need to be reloaded when the buffer is freed up, unregistering partial fragments will allow them to reload(since there might be parts that are still playable)
   * @param type The type of media this is (eg. video, audio)
   * @param timeRange TimeRange object from a sourceBuffer
   */
  detectEvictedFragments(type, timeRange) {
    let fragment, fragmentTimes, time, found, startTime, endTime;
    // Check if any flagged fragments have been unloaded
    for (let fragKey in this.partialFragments) {
      if (this.partialFragments.hasOwnProperty(fragKey)) {
        fragment = this.partialFragments[fragKey];
        if(this.partialFragmentTimes[type] !== undefined && this.partialFragmentTimes[type][fragKey] !== undefined){
          fragmentTimes = this.partialFragmentTimes[type][fragKey];
          for (let i = 0; i < fragmentTimes.length; i++) {
            time = fragmentTimes[i];
            found = false;
            // This can be optimized
            for (let j = 0; j < timeRange.length; j++) {
              startTime = timeRange.start(j) - bufferPadding;
              endTime = timeRange.end(j) + bufferPadding;
              if (time.startPTS >= startTime && time.endPTS <= endTime) {
                found = true;
              }
              if(time.endPTS <= startTime) {
                // No need to check the rest of the timeRange as it is in order
                break;
              }
            }
            if(found === false) {
              // Unregister partial fragment as it needs to load again to be reused
              delete this.partialFragments[fragKey];
              delete this.partialFragmentTimes[type][fragKey];
              break;
            }
          }
        }
      }
    }
    for (let fragKey in this.goodFragments) {
      if (this.goodFragments.hasOwnProperty(fragKey)) {
        fragment = this.goodFragments[fragKey];
        let found = false;
        for (let i = 0; i < timeRange.length; i++) {
          startTime = timeRange.start(i) - bufferPadding;
          endTime = timeRange.end(i) + bufferPadding;
          if (fragment.startPTS >= startTime && fragment.endPTS <= endTime) {
            // Fragment is entirely contained in buffer
            found = true;
            // No need to check the other timeRange times since it's completely playable
            break;
          }
          if(fragment.endPTS <= startTime) {
            // No need to check the rest of the timeRange as it is in order
            break;
          }
        }
        if(!found) {
          delete this.goodFragments[fragKey];
        }
      }
    }
  }

  /**
   * Fragments that are loading will be checked in the buffer to see if they are loaded properly
   * Partially loaded fragments will be registered as a partial fragment
   * @param fragment Check the fragment against all sourceBuffers loaded
   */
  detectPartialFragments(fragment) {
    let fragmentGaps, startTime, endTime;
    let fragKey = getFragmentKey(fragment);
    let goodFragment = true;
    for(let type in this.timeRanges) {
      if (this.timeRanges.hasOwnProperty(type)) {
        if(fragment.type === 'main' || fragment.type === type) {
          let timeRange = this.timeRanges[type];

          // Check for malformed fragments
          fragmentGaps = [];
          for (let i = 0; i < timeRange.length; i++) {
            startTime = timeRange.start(i) - bufferPadding;
            endTime = timeRange.end(i) + bufferPadding;
            if (fragment.startPTS >= startTime && fragment.endPTS <= endTime) {
              // Fragment is entirely contained in buffer
              // No need to check the other timeRange times since it's completely playable
              break;
            } else if (fragment.startPTS < endTime && fragment.endPTS > startTime) {
              // Check for intersection with buffer
              // Get playable sections of the fragment
              fragmentGaps.push({
                startPTS: Math.max(fragment.startPTS, timeRange.start(i)),
                endPTS: Math.min(fragment.endPTS, timeRange.end(i))
              });
            }
          }

          if (fragmentGaps.length > 0) {
            if(this.config.debug) {
              let fragmentGapString = '';
              for (let key in fragmentGaps) {
                let time = fragmentGaps[key];
                fragmentGapString += `[${time.startPTS}, ${time.endPTS}]`;
              }
              logger.warn(`fragment-tracker: fragment with malformed PTS detected(${type}), level: ${fragment.level} sn: ${fragment.sn} startPTS: ${fragment.startPTS} endPTS: ${fragment.endPTS} loadedPTS: ${fragmentGapString}`);
            }
            if(this.partialFragmentTimes[type] === undefined) {
              // fragment type can be 'main' while buffer type can be 'video' so we need both
              this.partialFragmentTimes[type] = {};
            }
            this.partialFragmentTimes[type][fragKey] = fragmentGaps;
            this.partialFragments[fragKey] = fragment;

            goodFragment = false;
          }
        }
      }
    }
    // Fragments can be good in one buffer but not in all, so we need to check this outside the loop
    if (goodFragment) {
      this.goodFragments[fragKey] = fragment;
    }
  }

  /**
   * Gets the partial fragment for a certain time
   * @param time
   * @returns fragment Returns a partial fragment at a time or null if there is no partial fragment
   */
  getPartialFragment(time) {
    let fragment, timePadding, startTime, endTime;
    let bestFragment = null;
    let bestOverlap = 0;
    for (let fragKey in this.partialFragments) {
      if (this.partialFragments.hasOwnProperty(fragKey)) {
        fragment = this.partialFragments[fragKey];
        startTime = fragment.startPTS - bufferPadding;
        endTime = fragment.endPTS + bufferPadding;
        if(time >= startTime && time <= endTime) {
          // Use the fragment that has the most padding from start and end time
          timePadding = Math.min(time - startTime, endTime - time);
          if(bestOverlap <= timePadding) {
            bestFragment = fragment;
            bestOverlap = timePadding;
          }
        }
      }
    }
    return bestFragment;
  }

  /**
   * getState
   * @param fragment The fragment to check
   * @returns {string} Returns the fragment state when a fragment never loaded or if it partially loaded
   */
  getState(fragment) {
    let fragKey = getFragmentKey(fragment);
    if (this.goodFragments[fragKey]) {
      // Fragment is still loaded
      return FragmentTrackerState.GOOD;
    }else if (this.loadingFragments[fragKey]) {
      // Fragment never loaded into buffer
      return FragmentTrackerState.LOADING_BUFFER;
    }else if (this.partialFragments[fragKey]) {
      // Fragment only partially loaded
      return FragmentTrackerState.PARTIAL;
    }
    return FragmentTrackerState.NONE;
  }

  /**
   * cancelFragmentLoad
   * Calling cancelFragmentLoad will remove a fragment from being checked by onFragBuffered
   * @param fragment The fragment to cancel loading
   */
  cancelFragmentLoad(fragment) {
    let fragKey = getFragmentKey(fragment);
    delete this.loadingFragments[fragKey];
  }

  /**
   * Fires when a fragment loading is completed
   */
  onFragLoaded(e) {
    let fragment = e.frag;
    let fragKey = getFragmentKey(fragment);
    this.loadingFragments[fragKey] = fragment;
  }

  /**
   * Fires when the buffer is updated
   */
  onBufferAppended(e) {
    // Store the latest timeRanges loaded in the buffer
    this.timeRanges = e.timeRanges;
    for(let type in this.timeRanges) {
      if (this.timeRanges.hasOwnProperty(type)) {
        let timeRange = this.timeRanges[type];
        this.detectEvictedFragments(type, timeRange);
      }
    }
  }

  /**
   * Fires after a fragment has been loaded into the source buffer
   */
  onFragBuffered(e) {
    let fragment = e.frag;
    let fragKey = getFragmentKey(fragment);
    this.detectPartialFragments(fragment);
    delete this.loadingFragments[fragKey];
  }

}
