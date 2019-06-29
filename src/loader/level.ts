import Fragment from './fragment';

export default class Level {
  // Please keep properties in alphabetical order
  public endCC = 0;
  public endSN = 0;
  public fragments: Fragment[] = [];
  public initSegment: Fragment | null = null;
  public live = true;
  public needSidxRanges = false;
  public startCC = 0;
  public startSN = 0;
  public startTimeOffset: number | null = null;
  public targetduration = 0;
  public totalduration = 0;
  public type: null | 'LIVE' | 'EVENT' = null;
  public url: string;
  public version: number | null = null;

  constructor (baseUrl: string) {
    this.url = baseUrl;
  }

  get hasProgramDateTime (): boolean {
    return !!(this.fragments[0] && Number.isFinite(this.fragments[0].programDateTime as number));
  }
}
