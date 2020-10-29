import { Events } from '../events';
import Fragment from '../loader/fragment';
import { SourceBufferName } from '../types/buffer';
import { FragmentBufferedRange, FragmentEntity, FragmentTimeRange } from '../types/fragment-tracker';
import { PlaylistLevelType } from '../types/loader';
import { ComponentAPI } from '../types/component-api';
import Hls from '../hls';
import { BufferAppendedData, FragBufferedData, FragLoadedData } from '../types/events';

export enum FragmentState {
  NOT_LOADED = 'NOT_LOADED',
  APPENDING = 'APPENDING',
  PARTIAL = 'PARTIAL',
  OK = 'OK'
}

export class FragmentTracker implements ComponentAPI {
  private activeFragment: Fragment | null = null;
  private fragments: Partial<Record<string, FragmentEntity>> = Object.create(null);
  private timeRanges: {
    [key in SourceBufferName]: TimeRanges
  } | null = Object.create(null);

  private bufferPadding: number = 0.2;
  private hls: Hls;

  constructor (hls: Hls) {
    this.hls = hls;

    this._registerListeners();
  }

  private _registerListeners () {
    const { hls } = this;
    hls.on(Events.BUFFER_APPENDED, this.onBufferAppended, this);
    hls.on(Events.FRAG_BUFFERED, this.onFragBuffered, this);
    hls.on(Events.FRAG_LOADED, this.onFragLoaded, this);
  }

  private _unregisterListeners () {
    const { hls } = this;
    hls.off(Events.BUFFER_APPENDED, this.onBufferAppended, this);
    hls.off(Events.FRAG_BUFFERED, this.onFragBuffered, this);
    hls.off(Events.FRAG_LOADED, this.onFragLoaded, this);
  }

  public destroy (): void {
    this.fragments = Object.create(null);
    this.timeRanges = Object.create(null);
    this._unregisterListeners();
  }

  /**
   * Return a Fragment with an appended range that matches the position and levelType.
   * If not found any Fragment, return null
   */
  getAppendedFrag (position: number, levelType: PlaylistLevelType) : Fragment | null {
    const { activeFragment } = this;
    if (!activeFragment) {
      return null;
    }
    if (activeFragment.appendedPTS !== undefined && activeFragment.start <= position && position <= activeFragment.appendedPTS) {
      return activeFragment;
    }
    return this.getBufferedFrag(position, levelType);
  }

  /**
   * Return a buffered Fragment that matches the position and levelType.
   * A buffered Fragment is one whose loading, parsing and appending is done (completed or "partial" meaning aborted).
   * If not found any Fragment, return null
   */
  getBufferedFrag (position: number, levelType: PlaylistLevelType) : Fragment | null {
    const { fragments } = this;
    const keys = Object.keys(fragments);
    for (let i = keys.length; i--;) {
      const fragmentEntity = fragments[keys[i]];
      if (fragmentEntity?.body.type === levelType && fragmentEntity.buffered) {
        const frag = fragmentEntity.body;
        if (frag.start <= position && position <= frag.end) {
          return frag;
        }
      }
    }
    return null;
  }

  /**
   * Partial fragments effected by coded frame eviction will be removed
   * The browser will unload parts of the buffer to free up memory for new buffer data
   * Fragments will need to be reloaded when the buffer is freed up, removing partial fragments will allow them to reload(since there might be parts that are still playable)
   */
  detectEvictedFragments (elementaryStream: SourceBufferName, timeRange: TimeRanges) {
    // Check if any flagged fragments have been unloaded
    Object.keys(this.fragments).forEach(key => {
      const fragmentEntity = this.fragments[key];
      if (!fragmentEntity || !fragmentEntity.buffered) {
        return;
      }
      const esData = fragmentEntity.range[elementaryStream];
      if (!esData) {
        return;
      }
      esData.time.some((time: FragmentTimeRange) => {
        const isNotBuffered = !this.isTimeBuffered(time.startPTS, time.endPTS, timeRange);
        if (isNotBuffered) {
          // Unregister partial fragment as it needs to load again to be reused
          this.removeFragment(fragmentEntity.body);
        }
        return isNotBuffered;
      });
    });
  }

  /**
   * Checks if the fragment passed in is loaded in the buffer properly
   * Partially loaded fragments will be registered as a partial fragment
   */
  detectPartialFragments (fragment: Fragment) {
    const { timeRanges, fragments } = this;
    if (!timeRanges || fragment.sn === 'initSegment') {
      return;
    }

    const fragKey = getFragmentKey(fragment);
    const fragmentEntity = fragments[fragKey];
    if (!fragmentEntity) {
      return;
    }
    fragmentEntity.buffered = true;
    Object.keys(timeRanges).forEach(elementaryStream => {
      if (!fragment.elementaryStreams[elementaryStream]) {
        return;
      }
      fragmentEntity.range[elementaryStream] = this.getBufferedTimes(fragment, timeRanges[elementaryStream]);
    });
  }

  getBufferedTimes (fragment: Fragment, timeRange: TimeRanges): FragmentBufferedRange {
    const buffered: FragmentBufferedRange = {
      time: [],
      partial: false
    };
    const startPTS = fragment.start;
    const endPTS = fragment.end;
    const minEndPTS = fragment.minEndPTS || endPTS;
    const maxStartPTS = fragment.maxStartPTS || startPTS;
    for (let i = 0; i < timeRange.length; i++) {
      const startTime = timeRange.start(i) - this.bufferPadding;
      const endTime = timeRange.end(i) + this.bufferPadding;
      if (maxStartPTS >= startTime && minEndPTS <= endTime) {
        // Fragment is entirely contained in buffer
        // No need to check the other timeRange times since it's completely playable
        buffered.time.push({
          startPTS: Math.max(startPTS, timeRange.start(i)),
          endPTS: Math.min(endPTS, timeRange.end(i))
        });
        break;
      } else if (startPTS < endTime && endPTS > startTime) {
        buffered.partial = true;
        // Check for intersection with buffer
        // Get playable sections of the fragment
        buffered.time.push({
          startPTS: Math.max(startPTS, timeRange.start(i)),
          endPTS: Math.min(endPTS, timeRange.end(i))
        });
      } else if (endPTS <= startTime) {
        // No need to check the rest of the timeRange as it is in order
        break;
      }
    }
    return buffered;
  }

  /**
   * Gets the partial fragment for a certain time
   */
  getPartialFragment (time: number): Fragment | null {
    let bestFragment: Fragment | null = null;
    let timePadding: number;
    let startTime: number;
    let endTime: number;
    let bestOverlap: number = 0;
    const { bufferPadding, fragments } = this;
    Object.keys(fragments).forEach(key => {
      const fragmentEntity = fragments[key];
      if (!fragmentEntity) {
        return;
      }
      if (isPartial(fragmentEntity)) {
        startTime = fragmentEntity.body.start - bufferPadding;
        endTime = fragmentEntity.body.end + bufferPadding;
        if (time >= startTime && time <= endTime) {
          // Use the fragment that has the most padding from start and end time
          timePadding = Math.min(time - startTime, endTime - time);
          if (bestOverlap <= timePadding) {
            bestFragment = fragmentEntity.body;
            bestOverlap = timePadding;
          }
        }
      }
    });
    return bestFragment;
  }

  /**
   *  Return the fragment state when a fragment never loaded or if it partially loaded
   */
  getState (fragment: Fragment): FragmentState {
    const fragKey = getFragmentKey(fragment);
    const fragmentEntity = this.fragments[fragKey];

    if (fragmentEntity) {
      if (!fragmentEntity.buffered) {
        return FragmentState.APPENDING;
      } else if (isPartial(fragmentEntity)) {
        return FragmentState.PARTIAL;
      } else {
        return FragmentState.OK;
      }
    }

    return FragmentState.NOT_LOADED;
  }

  isTimeBuffered (startPTS: number, endPTS: number, timeRange: TimeRanges): boolean {
    let startTime;
    let endTime;
    for (let i = 0; i < timeRange.length; i++) {
      startTime = timeRange.start(i) - this.bufferPadding;
      endTime = timeRange.end(i) + this.bufferPadding;
      if (startPTS >= startTime && endPTS <= endTime) {
        return true;
      }

      if (endPTS <= startTime) {
        // No need to check the rest of the timeRange as it is in order
        return false;
      }
    }

    return false;
  }

  /**
   * Fires when a fragment loading is completed
   */
  onFragLoaded (event: Events.FRAG_LOADED, data: FragLoadedData): void {
    const { frag } = data;
    // don't track initsegment (for which sn is not a number)
    // don't track frags used for bitrateTest, they're irrelevant.
    if (frag.sn === 'initSegment' || frag.bitrateTest) {
      return;
    }

    this.fragments[getFragmentKey(frag)] = {
      body: frag,
      range: Object.create(null),
      buffered: false
    };
  }

  /**
   * Fires when the buffer is updated
   */
  onBufferAppended (event: Events.BUFFER_APPENDED, data: BufferAppendedData): void {
    const { frag, timeRanges } = data;
    this.activeFragment = frag;
    // Store the latest timeRanges loaded in the buffer
    this.timeRanges = timeRanges as { [key in SourceBufferName]: TimeRanges };
    Object.keys(timeRanges).forEach((elementaryStream: SourceBufferName) => {
      const timeRange = timeRanges[elementaryStream] as TimeRanges;
      this.detectEvictedFragments(elementaryStream, timeRange);
      for (let i = 0; i < timeRange.length; i++) {
        frag.appendedPTS = Math.max(timeRange.end(i), frag.appendedPTS || 0);
      }
    });
  }

  /**
   * Fires after a fragment has been loaded into the source buffer
   */
  onFragBuffered (event: Events.FRAG_BUFFERED, data: FragBufferedData): void {
    this.detectPartialFragments(data.frag);
  }

  /**
   * Return true if fragment tracker has the fragment.
   */
  hasFragment (fragment: Fragment): boolean {
    const fragKey = getFragmentKey(fragment);
    return !!this.fragments[fragKey];
  }

  /**
   * Remove a fragment from fragment tracker until it is loaded again
   */
  removeFragment (fragment: Fragment): void {
    const fragKey = getFragmentKey(fragment);
    delete this.fragments[fragKey];
  }

  /**
   * Remove all fragments from fragment tracker.
   */
  removeAllFragments (): void {
    this.fragments = Object.create(null);
  }
}

function isPartial (fragmentEntity: FragmentEntity): boolean {
  return fragmentEntity.buffered &&
    (fragmentEntity.range.video?.partial ||
      fragmentEntity.range.audio?.partial);
}

function getFragmentKey (fragment: Fragment): string {
  return `${fragment.type}_${fragment.level}_${fragment.urlId}_${fragment.sn}`;
}
