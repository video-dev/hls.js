import { Events } from '../events';
import { Fragment, Part } from '../loader/fragment';
import { PlaylistLevelType } from '../types/loader';
import type { SourceBufferName } from '../types/buffer';
import type {
  FragmentBufferedRange,
  FragmentEntity,
  FragmentTimeRange,
} from '../types/fragment-tracker';
import type { ComponentAPI } from '../types/component-api';
import type {
  BufferAppendedData,
  FragBufferedData,
  FragLoadedData,
} from '../types/events';
import type Hls from '../hls';

export enum FragmentState {
  NOT_LOADED = 'NOT_LOADED',
  APPENDING = 'APPENDING',
  PARTIAL = 'PARTIAL',
  OK = 'OK',
}

export class FragmentTracker implements ComponentAPI {
  private activeFragment: Fragment | null = null;
  private activeParts: Part[] | null = null;
  private endListFragments: { [key in PlaylistLevelType]?: FragmentEntity } =
    Object.create(null);
  private fragments: Partial<Record<string, FragmentEntity>> =
    Object.create(null);
  private timeRanges:
    | {
        [key in SourceBufferName]?: TimeRanges;
      }
    | null = Object.create(null);

  private bufferPadding: number = 0.2;
  private hls: Hls;

  constructor(hls: Hls) {
    this.hls = hls;

    this._registerListeners();
  }

  private _registerListeners() {
    const { hls } = this;
    hls.on(Events.BUFFER_APPENDED, this.onBufferAppended, this);
    hls.on(Events.FRAG_BUFFERED, this.onFragBuffered, this);
    hls.on(Events.FRAG_LOADED, this.onFragLoaded, this);
  }

  private _unregisterListeners() {
    const { hls } = this;
    hls.off(Events.BUFFER_APPENDED, this.onBufferAppended, this);
    hls.off(Events.FRAG_BUFFERED, this.onFragBuffered, this);
    hls.off(Events.FRAG_LOADED, this.onFragLoaded, this);
  }

  public destroy() {
    this._unregisterListeners();
    // @ts-ignore
    this.fragments =
      // @ts-ignore
      this.endListFragments =
      this.timeRanges =
      this.activeFragment =
      this.activeParts =
        null;
  }

  /**
   * Return a Fragment with an appended range that matches the position and levelType.
   * If not found any Fragment, return null
   */
  public getAppendedFrag(
    position: number,
    levelType: PlaylistLevelType
  ): Fragment | Part | null {
    if (levelType === PlaylistLevelType.MAIN) {
      const { activeFragment, activeParts } = this;
      if (!activeFragment) {
        return null;
      }
      if (activeParts) {
        for (let i = activeParts.length; i--; ) {
          const activePart = activeParts[i];
          const appendedPTS = activePart
            ? activePart.end
            : activeFragment.appendedPTS;
          if (
            activePart.start <= position &&
            appendedPTS !== undefined &&
            position <= appendedPTS
          ) {
            // 9 is a magic number. remove parts from lookup after a match but keep some short seeks back.
            if (i > 9) {
              this.activeParts = activeParts.slice(i - 9);
            }
            return activePart;
          }
        }
      } else if (
        activeFragment.start <= position &&
        activeFragment.appendedPTS !== undefined &&
        position <= activeFragment.appendedPTS
      ) {
        return activeFragment;
      }
    }
    return this.getBufferedFrag(position, levelType);
  }

  /**
   * Return a buffered Fragment that matches the position and levelType.
   * A buffered Fragment is one whose loading, parsing and appending is done (completed or "partial" meaning aborted).
   * If not found any Fragment, return null
   */
  public getBufferedFrag(
    position: number,
    levelType: PlaylistLevelType
  ): Fragment | null {
    const { fragments } = this;
    const keys = Object.keys(fragments);
    for (let i = keys.length; i--; ) {
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
  public detectEvictedFragments(
    elementaryStream: SourceBufferName,
    timeRange: TimeRanges,
    playlistType?: PlaylistLevelType
  ) {
    if (this.timeRanges) {
      this.timeRanges[elementaryStream] = timeRange;
    }
    // Check if any flagged fragments have been unloaded
    Object.keys(this.fragments).forEach((key) => {
      const fragmentEntity = this.fragments[key];
      if (!fragmentEntity) {
        return;
      }
      if (!fragmentEntity.buffered && !fragmentEntity.loaded) {
        if (fragmentEntity.body.type === playlistType) {
          this.removeFragment(fragmentEntity.body);
        }
        return;
      }
      const esData = fragmentEntity.range[elementaryStream];
      if (!esData) {
        return;
      }
      esData.time.some((time: FragmentTimeRange) => {
        const isNotBuffered = !this.isTimeBuffered(
          time.startPTS,
          time.endPTS,
          timeRange
        );
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
  private detectPartialFragments(data: FragBufferedData) {
    const timeRanges = this.timeRanges;
    const { frag, part } = data;
    if (!timeRanges || frag.sn === 'initSegment') {
      return;
    }

    const fragKey = getFragmentKey(frag);
    const fragmentEntity = this.fragments[fragKey];
    if (!fragmentEntity) {
      return;
    }
    Object.keys(timeRanges).forEach((elementaryStream) => {
      const streamInfo = frag.elementaryStreams[elementaryStream];
      if (!streamInfo) {
        return;
      }
      const timeRange = timeRanges[elementaryStream];
      const partial = part !== null || streamInfo.partial === true;
      fragmentEntity.range[elementaryStream] = this.getBufferedTimes(
        frag,
        part,
        partial,
        timeRange
      );
    });
    fragmentEntity.loaded = null;
    if (Object.keys(fragmentEntity.range).length) {
      fragmentEntity.buffered = true;
      if (fragmentEntity.body.endList) {
        this.endListFragments[fragmentEntity.body.type] = fragmentEntity;
      }
    } else {
      // remove fragment if nothing was appended
      this.removeFragment(fragmentEntity.body);
    }
  }

  public fragBuffered(frag: Fragment) {
    const fragKey = getFragmentKey(frag);
    const fragmentEntity = this.fragments[fragKey];
    if (fragmentEntity) {
      fragmentEntity.loaded = null;
      fragmentEntity.buffered = true;
    }
  }

  private getBufferedTimes(
    fragment: Fragment,
    part: Part | null,
    partial: boolean,
    timeRange: TimeRanges
  ): FragmentBufferedRange {
    const buffered: FragmentBufferedRange = {
      time: [],
      partial,
    };
    const startPTS = part ? part.start : fragment.start;
    const endPTS = part ? part.end : fragment.end;
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
          endPTS: Math.min(endPTS, timeRange.end(i)),
        });
        break;
      } else if (startPTS < endTime && endPTS > startTime) {
        buffered.partial = true;
        // Check for intersection with buffer
        // Get playable sections of the fragment
        buffered.time.push({
          startPTS: Math.max(startPTS, timeRange.start(i)),
          endPTS: Math.min(endPTS, timeRange.end(i)),
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
  public getPartialFragment(time: number): Fragment | null {
    let bestFragment: Fragment | null = null;
    let timePadding: number;
    let startTime: number;
    let endTime: number;
    let bestOverlap: number = 0;
    const { bufferPadding, fragments } = this;
    Object.keys(fragments).forEach((key) => {
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

  public isEndListAppended(type: PlaylistLevelType): boolean {
    const lastFragmentEntity = this.endListFragments[type];
    return (
      lastFragmentEntity !== undefined &&
      (lastFragmentEntity.buffered || isPartial(lastFragmentEntity))
    );
  }

  public getState(fragment: Fragment): FragmentState {
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

  private isTimeBuffered(
    startPTS: number,
    endPTS: number,
    timeRange: TimeRanges
  ): boolean {
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

  private onFragLoaded(event: Events.FRAG_LOADED, data: FragLoadedData) {
    const { frag, part } = data;
    // don't track initsegment (for which sn is not a number)
    // don't track frags used for bitrateTest, they're irrelevant.
    // don't track parts for memory efficiency
    if (frag.sn === 'initSegment' || frag.bitrateTest || part) {
      return;
    }

    const fragKey = getFragmentKey(frag);
    this.fragments[fragKey] = {
      body: frag,
      loaded: data,
      buffered: false,
      range: Object.create(null),
    };
  }

  private onBufferAppended(
    event: Events.BUFFER_APPENDED,
    data: BufferAppendedData
  ) {
    const { frag, part, timeRanges } = data;
    if (frag.type === PlaylistLevelType.MAIN) {
      if (this.activeFragment !== frag) {
        this.activeFragment = frag;
        frag.appendedPTS = undefined;
      }
      if (part) {
        let activeParts = this.activeParts;
        if (!activeParts) {
          this.activeParts = activeParts = [];
        }
        activeParts.push(part);
      } else {
        this.activeParts = null;
      }
    }
    // Store the latest timeRanges loaded in the buffer
    this.timeRanges = timeRanges;
    Object.keys(timeRanges).forEach((elementaryStream: SourceBufferName) => {
      const timeRange = timeRanges[elementaryStream] as TimeRanges;
      this.detectEvictedFragments(elementaryStream, timeRange);
      if (!part && frag.type === PlaylistLevelType.MAIN) {
        const streamInfo = frag.elementaryStreams[elementaryStream];
        if (!streamInfo) {
          return;
        }
        for (let i = 0; i < timeRange.length; i++) {
          const rangeEnd = timeRange.end(i);
          if (rangeEnd <= streamInfo.endPTS && rangeEnd > streamInfo.startPTS) {
            frag.appendedPTS = Math.max(rangeEnd, frag.appendedPTS || 0);
          } else {
            frag.appendedPTS = streamInfo.endPTS;
          }
        }
      }
    });
  }

  private onFragBuffered(event: Events.FRAG_BUFFERED, data: FragBufferedData) {
    this.detectPartialFragments(data);
  }

  private hasFragment(fragment: Fragment): boolean {
    const fragKey = getFragmentKey(fragment);
    return !!this.fragments[fragKey];
  }

  public removeFragmentsInRange(
    start: number,
    end: number,
    playlistType: PlaylistLevelType
  ) {
    Object.keys(this.fragments).forEach((key) => {
      const fragmentEntity = this.fragments[key];
      if (!fragmentEntity) {
        return;
      }
      if (fragmentEntity.buffered) {
        const frag = fragmentEntity.body;
        if (
          frag.type === playlistType &&
          frag.start < end &&
          frag.end > start
        ) {
          this.removeFragment(frag);
        }
      }
    });
  }

  public removeFragment(fragment: Fragment) {
    const fragKey = getFragmentKey(fragment);
    fragment.stats.loaded = 0;
    fragment.clearElementaryStreamInfo();
    fragment.appendedPTS = undefined;
    delete this.fragments[fragKey];
    if (fragment.endList) {
      delete this.endListFragments[fragment.type];
    }
  }

  public removeAllFragments() {
    this.fragments = Object.create(null);
    this.endListFragments = Object.create(null);
    this.activeFragment = null;
    this.activeParts = null;
  }
}

function isPartial(fragmentEntity: FragmentEntity): boolean {
  return (
    fragmentEntity.buffered &&
    (fragmentEntity.range.video?.partial || fragmentEntity.range.audio?.partial)
  );
}

function getFragmentKey(fragment: Fragment): string {
  return `${fragment.type}_${fragment.level}_${fragment.urlId}_${fragment.sn}`;
}
