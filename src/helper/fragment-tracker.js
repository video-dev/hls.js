import EventHandler from '../event-handler';
import Event from '../events';

export const FragmentState = {
  NOT_LOADED: 'NOT_LOADED',
  APPENDING: 'APPENDING',
  PARTIAL: 'PARTIAL',
  OK: 'OK',
};

export class FragmentTracker extends EventHandler {

  constructor(hls) {
    super(hls,
      Event.BUFFER_APPENDED,
      Event.FRAG_BUFFERED,
      Event.FRAG_LOADED
    );

    this.bufferPadding = 0.2;

    this.fragments = {};

    this.timeRanges = {};
    this.config = hls.config;
  }

  destroy() {
    this.fragments = null;
    EventHandler.prototype.destroy.call(this);
  }

  /**
   * Partial fragments effected by coded frame eviction will be removed
   * The browser will unload parts of the buffer to free up memory for new buffer data
   * Fragments will need to be reloaded when the buffer is freed up, removing partial fragments will allow them to reload(since there might be parts that are still playable)
   * @param {String} type The type of media this is (eg. video, audio)
   * @param {Object} timeRange TimeRange object from a sourceBuffer
   */
  detectEvictedFragments(type, timeRange) {
    let fragmentObject, fragmentTimes, time, found, startTime, endTime;
    // Check if any flagged fragments have been unloaded
    for (let fragKey in this.fragments) {
      if (this.fragments.hasOwnProperty(fragKey)) {
        fragmentObject = this.fragments[fragKey];
        if(fragmentObject.state === FragmentState.PARTIAL || fragmentObject.state === FragmentState.OK) {
          fragmentTimes = fragmentObject.range[type];
          for (let i = 0; i < fragmentTimes.length; i++) {
            time = fragmentTimes[i];
            found = false;
            // This can be optimized
            for (let j = 0; j < timeRange.length; j++) {
              startTime = timeRange.start(j) - this.bufferPadding;
              endTime = timeRange.end(j) + this.bufferPadding;
              if (time.startPTS >= startTime && time.endPTS <= endTime) {
                found = true;
                break;
              }
              if(time.endPTS <= startTime) {
                // No need to check the rest of the timeRange as it is in order
                break;
              }
            }
            if(found === false) {
              // Unregister partial fragment as it needs to load again to be reused
              delete this.fragments[fragKey];
              break;
            }
          }
        }

      }
    }
  }

  /**
   * Checks if the fragment passed in is loaded in the buffer properly
   * Partially loaded fragments will be registered as a partial fragment
   * @param {Object} fragment Check the fragment against all sourceBuffers loaded
   */
  detectPartialFragments(fragment) {
    let fragmentGaps, startTime, endTime;
    let fragKey = this.getFragmentKey(fragment);
    let fragmentIsOK = true;
    let fragmentObject = this.fragments[fragKey];
    let timeRange;

    for(let type in this.timeRanges) {
      if (this.timeRanges.hasOwnProperty(type)) {
        if(fragment.type === 'main' || fragment.type === type) {
          timeRange = this.timeRanges[type];
          // Check for malformed fragments
          fragmentGaps = [];
          for (let i = 0; i < timeRange.length; i++) {
            startTime = timeRange.start(i) - this.bufferPadding;
            endTime = timeRange.end(i) + this.bufferPadding;
            if (fragment.startPTS >= startTime && fragment.endPTS <= endTime) {
              // Fragment is entirely contained in buffer
              // No need to check the other timeRange times since it's completely playable
              fragmentGaps.push({
                startPTS: Math.max(fragment.startPTS, timeRange.start(i)),
                endPTS: Math.min(fragment.endPTS, timeRange.end(i))
              });
              break;
            } else if (fragment.startPTS < endTime && fragment.endPTS > startTime) {
              // Check for intersection with buffer
              // Get playable sections of the fragment
              fragmentGaps.push({
                startPTS: Math.max(fragment.startPTS, timeRange.start(i)),
                endPTS: Math.min(fragment.endPTS, timeRange.end(i))
              });

              fragmentIsOK = false;
            }
          }

          fragmentObject.range[type] = fragmentGaps;
        }
      }
    }
    if(fragmentIsOK === true) {
      fragmentObject.state = FragmentState.OK;
    } else {
      fragmentObject.state = FragmentState.PARTIAL;
    }
  }

  getFragmentKey(fragment) {
    return `${fragment.type}_${fragment.level}_${fragment.sn}`;
  }

  /**
   * Gets the partial fragment for a certain time
   * @param {Number} time
   * @returns {Object} fragment Returns a partial fragment at a time or null if there is no partial fragment
   */
  getPartialFragment(time) {
    let fragmentObject, timePadding, startTime, endTime;
    let bestFragment = null;
    let bestOverlap = 0;
    for (let fragKey in this.fragments) {
      if (this.fragments.hasOwnProperty(fragKey)) {
        fragmentObject = this.fragments[fragKey];
        if(fragmentObject.state === FragmentState.PARTIAL) {
          startTime = fragmentObject.body.startPTS - this.bufferPadding;
          endTime = fragmentObject.body.endPTS + this.bufferPadding;
          if(time >= startTime && time <= endTime) {
            // Use the fragment that has the most padding from start and end time
            timePadding = Math.min(time - startTime, endTime - time);
            if(bestOverlap <= timePadding) {
              bestFragment = fragmentObject.body;
              bestOverlap = timePadding;
            }
          }
        }
      }
    }
    return bestFragment;
  }

  /**
   * @param {Object} fragment The fragment to check
   * @returns {String} Returns the fragment state when a fragment never loaded or if it partially loaded
   */
  getState(fragment) {
    let fragKey = this.getFragmentKey(fragment);
    if (this.fragments[fragKey]) {
      return this.fragments[fragKey].state;
    }
    return FragmentState.NOT_LOADED;
  }

  /**
   * Remove a fragment from fragment tracker until it is loaded again
   * @param {Object} fragment The fragment to remove
   */
  removeFragment(fragment) {
    let fragKey = this.getFragmentKey(fragment);
    delete this.fragments[fragKey];
  }

  /**
   * Fires when a fragment loading is completed
   */
  onFragLoaded(e) {
    let fragment = e.frag;
    let fragKey = this.getFragmentKey(fragment);
    this.fragments[fragKey] = {
      body: fragment,
      range: {},
      state: FragmentState.APPENDING
    };
  }

  /**
   * Fires when the buffer is updated
   */
  onBufferAppended(e) {
    let timeRange;
    // Store the latest timeRanges loaded in the buffer
    this.timeRanges = e.timeRanges;
    for(let type in this.timeRanges) {
      if (this.timeRanges.hasOwnProperty(type)) {
        timeRange = this.timeRanges[type];
        this.detectEvictedFragments(type, timeRange);
      }
    }
  }

  /**
   * Fires after a fragment has been loaded into the source buffer
   */
  onFragBuffered(e) {
    let fragment = e.frag;
    this.detectPartialFragments(fragment);
  }
}
