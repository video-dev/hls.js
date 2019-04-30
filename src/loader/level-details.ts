import Fragment from './fragment';

export default class LevelDetails {
  public PTSKnown?: boolean;
  public availabilityDelay?: number; // Manifest reload synchronization
  public averagetargetduration?: number;
  public endCC: number = 0;
  public endSN: number = 0;
  public fragments: Fragment[];
  public initSegment: Fragment | null = null;
  public lastModified?: number;
  public live: boolean = true;
  public needSidxRanges: boolean = false;
  public startCC: number = 0;
  public startSN: number = 0;
  public startTimeOffset: number | null = null;
  public targetduration: number = 0;
  public tload?: number;
  public totalduration: number = 0;
  public type: string | null = null;
  public updated?: boolean; // Manifest reload synchronization
  public url: string;
  public version: number | null = null;

  constructor (baseUrl) {
    this.fragments = [];
    this.url = baseUrl;
  }

  get hasProgramDateTime (): boolean {
    return !!this.fragments[0] && Number.isFinite(this.fragments[0].programDateTime as number);
  }
}
