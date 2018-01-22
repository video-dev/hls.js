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
    this.timeRanges = null;

    this.config = hls.config;
  }

  destroy() {
    this.fragments = null;
    this.timeRanges = null;
    this.config = null;
    EventHandler.prototype.destroy.call(this);
    super.destroy();
  }

  /**
   * Partial fragments effected by coded frame eviction will be removed
   * The browser will unload parts of the buffer to free up memory for new buffer data
   * Fragments will need to be reloaded when the buffer is freed up, removing partial fragments will allow them to reload(since there might be parts that are still playable)
   * @param {String} elementaryStream The elementaryStream of media this is (eg. video/audio)
   * @param {Object} timeRange TimeRange object from a sourceBuffer
   */
  detectEvictedFragments(elementaryStream, timeRange) {
    let fragmentTimes, time;
    // Check if any flagged fragments have been unloaded
    for (let key in this.fragments) {
      if (this.fragments.hasOwnProperty(key)) {
        let fragmentEntity = this.fragments[key];
        if(fragmentEntity.buffered === true) {
          const esData = fragmentEntity.range[elementaryStream];
          if (esData) {
            fragmentTimes = esData.time;
            for (let i = 0; i < fragmentTimes.length; i++) {
              time = fragmentTimes[i];

              if(this.isTimeBuffered(time.startPTS, time.endPTS, timeRange) === false) {
                // Unregister partial fragment as it needs to load again to be reused
                this.removeFragment(fragmentEntity.body);
                break;
              }
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
    let fragKey = this.getFragmentKey(fragment);
    let fragmentEntity = this.fragments[fragKey];
    fragmentEntity.buffered = true;

    for (let elementaryStream in this.timeRanges) {
      if (this.timeRanges.hasOwnProperty(elementaryStream)) {
        if(fragment.hasElementaryStream(elementaryStream) === true) {
          let timeRange = this.timeRanges[elementaryStream];
          // Check for malformed fragments
          // Gaps need to be calculated for each elementaryStream
          fragmentEntity.range[elementaryStream] = this.getBufferedTimes(fragment.startPTS, fragment.endPTS, timeRange);
        }
      }
    }
  }

  getBufferedTimes(startPTS, endPTS, timeRange) {
    let fragmentTimes = [];
    let startTime, endTime;
    let fragmentPartial = false;
    for (let i = 0; i < timeRange.length; i++) {
      startTime = timeRange.start(i) - this.bufferPadding;
      endTime = timeRange.end(i) + this.bufferPadding;
      if (startPTS >= startTime && endPTS <= endTime) {
        // Fragment is entirely contained in buffer
        // No need to check the other timeRange times since it's completely playable
        fragmentTimes.push({
          startPTS: Math.max(startPTS, timeRange.start(i)),
          endPTS: Math.min(endPTS, timeRange.end(i))
        });
        break;
      } else if (startPTS < endTime && endPTS > startTime) {
        // Check for intersection with buffer
        // Get playable sections of the fragment
        fragmentTimes.push({
          startPTS: Math.max(startPTS, timeRange.start(i)),
          endPTS: Math.min(endPTS, timeRange.end(i))
        });
        fragmentPartial = true;
      } else if(endPTS <= startTime) {
        // No need to check the rest of the timeRange as it is in order
        break;
      }
    }

    return {
      time: fragmentTimes,
      partial: fragmentPartial
    };
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
    let timePadding, startTime, endTime;
    let bestFragment = null;
    let bestOverlap = 0;
    for (let key in this.fragments) {
      if (this.fragments.hasOwnProperty(key)) {
        let fragmentEntity = this.fragments[key];
        if(this.isPartial(fragmentEntity)) {
          startTime = fragmentEntity.body.startPTS - this.bufferPadding;
          endTime = fragmentEntity.body.endPTS + this.bufferPadding;
          if(time >= startTime && time <= endTime) {
            // Use the fragment that has the most padding from start and end time
            timePadding = Math.min(time - startTime, endTime - time);
            if(bestOverlap <= timePadding) {
              bestFragment = fragmentEntity.body;
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
    let fragmentEntity = this.fragments[fragKey];
    let state = FragmentState.NOT_LOADED;

    if(fragmentEntity !== undefined) {
      if(!fragmentEntity.buffered) {
        state = FragmentState.APPENDING;
      } else if(this.isPartial(fragmentEntity) === true) {
        state = FragmentState.PARTIAL;
      } else {
        state = FragmentState.OK;
      }
    }

    return state;
  }

  isPartial(fragmentEntity) {
    return fragmentEntity.buffered === true &&
      ((fragmentEntity.range.video !== undefined && fragmentEntity.range.video.partial === true) ||
        (fragmentEntity.range.audio !== undefined && fragmentEntity.range.audio.partial === true));
  }

  isTimeBuffered(startPTS, endPTS, timeRange) {
    let startTime, endTime;
    for (let i = 0; i < timeRange.length; i++) {
      startTime = timeRange.start(i) - this.bufferPadding;
      endTime = timeRange.end(i) + this.bufferPadding;
      if (startPTS >= startTime && endPTS <= endTime) {
        return true;
      }
      if(endPTS <= startTime) {
        // No need to check the rest of the timeRange as it is in order
        return false;
      }
    }

    return false;
  }

  /**
   * Fires when a fragment loading is completed
   */
  onFragLoaded(e) {
    let fragment = e.frag;
    let fragKey = this.getFragmentKey(fragment);
    let fragmentEntity = {
      body: fragment,
      range: {},
      buffered: false,
    };
    this.fragments[fragKey] = fragmentEntity;
  }

  /**
   * Fires when the buffer is updated
   */
  onBufferAppended(e) {
    // Store the latest timeRanges loaded in the buffer
    this.timeRanges = e.timeRanges;
    for (let elementaryStream in this.timeRanges) {
      if (this.timeRanges.hasOwnProperty(elementaryStream)) {
        let timeRange = this.timeRanges[elementaryStream];
        this.detectEvictedFragments(elementaryStream, timeRange);
      }
    }
  }

  /**
   * Fires after a fragment has been loaded into the source buffer
   */
  onFragBuffered(e) {
    this.detectPartialFragments(e.frag);
  }

  /**
   * Remove a fragment from fragment tracker until it is loaded again
   * @param {Object} fragment The fragment to remove
   */
  removeFragment(fragment) {
    let fragKey = this.getFragmentKey(fragment);
    delete this.fragments[fragKey];
  }
}
