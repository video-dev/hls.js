import Fragment, { Part } from './fragment';
import type AttrList from '../utils/attr-list';

const DEFAULT_TARGET_DURATION = 10;

export default class LevelDetails {
  public PTSKnown: boolean = false;
  public alignedSliding: boolean = false;
  public averagetargetduration?: number;
  public endCC: number = 0;
  public endSN: number = 0;
  public fragments: Fragment[];
  public fragmentHint?: Fragment;
  public partList: Part[] | null = null;
  public initSegment: Fragment | null = null;
  public live: boolean = true;
  public ageHeader: number = 0;
  public advancedDateTime?: number;
  public updated: boolean = true;
  public advanced: boolean = true;
  public availabilityDelay?: number; // Manifest reload synchronization
  public misses: number = 0;
  public needSidxRanges: boolean = false;
  public startCC: number = 0;
  public startSN: number = 0;
  public startTimeOffset: number | null = null;
  public targetduration: number = 0;
  public totalduration: number = 0;
  public type: string | null = null;
  public url: string;
  public m3u8: string = '';
  public version: number | null = null;
  public canBlockReload: boolean = false;
  public canSkipUntil: number = 0;
  public canSkipDateRanges: boolean = false;
  public skippedSegments: number = 0;
  public recentlyRemovedDateranges?: string[];
  public partHoldBack: number = 0;
  public holdBack: number = 0;
  public partTarget: number = 0;
  public preloadHint?: AttrList;
  public renditionReports?: AttrList[];
  public tuneInGoal: number = 0;
  public deltaUpdateFailed?: boolean;

  constructor(baseUrl) {
    this.fragments = [];
    this.url = baseUrl;
  }

  reloaded(previous: LevelDetails | undefined) {
    if (!previous) {
      this.advanced = true;
      this.updated = true;
      return;
    }
    const partSnDiff = this.lastPartSn - previous.lastPartSn;
    const partIndexDiff = this.lastPartIndex - previous.lastPartIndex;
    this.updated =
      this.endSN !== previous.endSN || !!partIndexDiff || !!partSnDiff;
    this.advanced =
      this.endSN > previous.endSN ||
      partSnDiff > 0 ||
      (partSnDiff === 0 && partIndexDiff > 0);
    if (this.updated || this.advanced) {
      this.misses = Math.floor(previous.misses * 0.6);
    } else {
      this.misses = previous.misses + 1;
    }
    this.availabilityDelay = previous.availabilityDelay;
  }

  get hasProgramDateTime(): boolean {
    if (this.fragments.length) {
      return Number.isFinite(
        this.fragments[this.fragments.length - 1].programDateTime as number
      );
    }
    return false;
  }

  get levelTargetDuration(): number {
    return (
      this.averagetargetduration ||
      this.targetduration ||
      DEFAULT_TARGET_DURATION
    );
  }

  get edge(): number {
    return this.partEnd || this.fragmentEnd;
  }

  get partEnd(): number {
    if (this.partList?.length) {
      return this.partList[this.partList.length - 1].end;
    }
    return this.fragmentEnd;
  }

  get fragmentEnd(): number {
    if (this.fragments?.length) {
      return this.fragments[this.fragments.length - 1].end;
    }
    return 0;
  }

  get age(): number {
    if (this.advancedDateTime) {
      return Math.max(Date.now() - this.advancedDateTime, 0) / 1000;
    }
    return 0;
  }

  get lastPartIndex(): number {
    if (this.partList?.length) {
      return this.partList[this.partList.length - 1].index;
    }
    return -1;
  }

  get lastPartSn(): number {
    if (this.partList?.length) {
      return this.partList[this.partList.length - 1].fragment.sn as number;
    }
    return this.endSN;
  }
}
