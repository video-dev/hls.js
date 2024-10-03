import type { DateRange, DateRangeCue } from './date-range';
import type { Loader, LoaderContext } from '../types/loader';
import type { Fragment } from './fragment';
import { hash } from '../utils/hash';

export type PlaybackRestrictions = {
  skip: boolean;
  jump: boolean;
};

export type SnapOptions = {
  out: boolean;
  in: boolean;
};

export enum TimelineOccupancy {
  Point,
  Range,
}

export type AssetListJSON = {
  ASSETS: Array<{ URI: string; DURATION: string }>;
};
export interface InterstitialEventWithAssetList extends InterstitialEvent {
  assetListUrl: string;
}

export type BaseData = {
  url: string;
};

export type InterstitialId = string;
export type InterstitialAssetId = string;

export type InterstitialAssetItem = {
  parentIdentifier: InterstitialId;
  identifier: InterstitialAssetId;
  duration: number | null;
  startOffset: number;
  timelineStart: number;
  uri: string;
  error?: Error;
};

export function generateAssetIdentifier(
  interstitial: InterstitialEvent,
  uri: string,
  assetListIndex: number,
): string {
  return `${interstitial.identifier}-${assetListIndex + 1}-${hash(uri)}`;
}

export class InterstitialEvent {
  private base: BaseData;
  private _duration: number | null = null;
  private _timelineStart: number | null = null;
  private appendInPlaceDisabled?: boolean;
  public dateRange: DateRange;
  public hasPlayed: boolean = false;
  public cumulativeDuration: number = 0;
  public resumeOffset: number = NaN;
  public playoutLimit: number = NaN;
  public restrictions: PlaybackRestrictions = {
    skip: false,
    jump: false,
  };
  public snapOptions: SnapOptions = {
    out: false,
    in: false,
  };
  public assetList: InterstitialAssetItem[] = [];
  public assetListLoader?: Loader<LoaderContext>;
  public assetListResponse: AssetListJSON | null = null;
  public resumeAnchor?: Fragment;
  public error?: Error;

  constructor(dateRange: DateRange, base: BaseData) {
    this.base = base;
    this.dateRange = dateRange;
    this.setDateRange(dateRange);
  }

  public setDateRange(dateRange: DateRange) {
    this.dateRange = dateRange;
    this.resumeOffset = dateRange.attr.optionalFloat(
      'X-RESUME-OFFSET',
      this.resumeOffset,
    );
    this.playoutLimit = dateRange.attr.optionalFloat(
      'X-PLAYOUT-LIMIT',
      this.playoutLimit,
    );
    this.restrictions = dateRange.attr.enumeratedStringList(
      'X-RESTRICT',
      this.restrictions,
    );
    this.snapOptions = dateRange.attr.enumeratedStringList(
      'X-SNAP',
      this.snapOptions,
    );
  }

  public reset() {
    this.assetListLoader?.destroy();
    this.assetListLoader = this.error = undefined;
  }

  public isAssetPastPlayoutLimit(assetIndex: number): boolean {
    if (assetIndex >= this.assetList.length) {
      return true;
    }
    const playoutLimit = this.playoutLimit;
    if (assetIndex <= 0 || isNaN(playoutLimit)) {
      return false;
    }
    const assetOffset = this.assetList[assetIndex].startOffset;
    return assetOffset > playoutLimit;
  }

  get identifier(): InterstitialId {
    return this.dateRange.id;
  }

  get startDate(): Date {
    return this.dateRange.startDate;
  }

  get startTime(): number {
    // Primary media timeline start time
    const startTime = this.dateRange.startTime;
    if (this.snapOptions.out) {
      const frag = this.dateRange.tagAnchor;
      if (frag) {
        return getSnapToFragmentTime(startTime, frag, false);
      }
    }
    return startTime;
  }

  get startOffset(): number {
    return this.cue.pre ? 0 : this.startTime;
  }

  get resumptionOffset(): number {
    const resumeOffset = this.resumeOffset;
    const offset = Number.isFinite(resumeOffset) ? resumeOffset : this.duration;
    return this.cumulativeDuration + offset;
  }

  get resumeTime(): number {
    // Primary media timeline resumption time
    const resumeTime = this.startOffset + this.resumptionOffset;
    if (this.snapOptions.in) {
      const frag = this.resumeAnchor;
      if (frag) {
        const resumeTimeSnapped = getSnapToFragmentTime(
          resumeTime,
          frag,
          this.appendInPlace,
        );
        return resumeTimeSnapped;
      }
    }
    return resumeTime;
  }

  get appendInPlace(): boolean {
    if (this.appendInPlaceDisabled) {
      return false;
    }
    if (
      !this.cue.once &&
      !this.cue.pre && // preroll starts at startPosition before startPosition is known (live)
      isNaN(this.resumeOffset)
    ) {
      const startTime = this.startTime;
      return (
        startTime >= 0 && // cannot append at negative timeline offsets
        (startTime === 0 || (this.snapOptions.in && this.snapOptions.out))
      );
    }
    return false;
  }

  set appendInPlace(value: boolean) {
    this.appendInPlaceDisabled = !value;
  }

  // Extended timeline start time
  get timelineStart(): number {
    if (this._timelineStart !== null) {
      return this._timelineStart;
    }
    return this.startTime;
  }

  set timelineStart(value: number) {
    this._timelineStart = value;
  }

  get duration(): number {
    const playoutLimit = this.playoutLimit;
    let duration: number;
    if (this._duration) {
      duration = this._duration;
    } else if (this.dateRange.duration) {
      duration = this.dateRange.duration;
    } else {
      duration = this.dateRange.plannedDuration || 0;
    }
    if (!isNaN(playoutLimit) && playoutLimit < duration) {
      duration = playoutLimit;
    }
    return duration;
  }

  set duration(value: number) {
    this._duration = value;
  }

  get cue(): DateRangeCue {
    return this.dateRange.cue;
  }

  get timelineOccupancy() {
    if (this.dateRange.attr['X-TIMELINE-OCCUPIES'] === 'RANGE') {
      return TimelineOccupancy.Range;
    }
    return TimelineOccupancy.Point;
  }

  get supplementsPrimary(): boolean {
    return this.dateRange.attr['X-TIMELINE-STYLE'] === 'PRIMARY';
  }

  get contentMayVary(): boolean {
    return this.dateRange.attr['X-CONTENT-MAY-VARY'] !== 'NO';
  }

  get assetUrl(): string | undefined {
    return this.dateRange.attr['X-ASSET-URI'];
  }

  get assetListUrl(): string | undefined {
    return this.dateRange.attr['X-ASSET-LIST'];
  }

  get baseUrl(): string {
    return this.base.url;
  }

  toString(): string {
    return JSON.stringify(
      {
        startTime: this.startTime,
        timelineStart: this.timelineStart,
        attr: this.dateRange.attr,
      },
      (key, value) => (/^(?:SCTE35|X-ASSET)/.test(key) ? '...' : value),
      2,
    );
  }
}

function getSnapToFragmentTime(
  time: number,
  frag: Fragment,
  snapInPlace: boolean,
) {
  return time - frag.start < frag.duration / 2 &&
    // FIXME: Only snap to end if it aligns better with audio. When appending in place ideally the resumption fragments would be adjusted to start later to avoid overlap.
    !(snapInPlace && time < frag.end)
    ? frag.start
    : frag.end;
}

export function getInterstitialUrl(
  uri: string,
  sessionId: string,
  baseUrl?: string,
): URL | never {
  const url = new self.URL(uri, baseUrl);
  if (url.protocol !== 'data:') {
    url.searchParams.set('_HLS_primary_id', sessionId);
  }
  return url;
}
