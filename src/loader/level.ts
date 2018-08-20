import { MediaVariantDetails } from '../hls';
import Fragment from './fragment';

// Q: We should actually rename this class (and private occurences) to `Variant` to finally resolve the confusion? Especially since this is also used
//    for alternate media and not only quality levels ....

export default class Level implements MediaVariantDetails {
  PTSKnown: boolean = false;
  fragments: Fragment[] = [];
  url: string;
  live: boolean = true;
  averagetargetduration: number = 0;
  targetduration: number = 0;
  totalduration: number = 0;
  startCC: number = 0;
  endCC: number = 0;
  startSN: number = 0;
  endSN: number = 0;
  startTimeOffset: number | null = null;
  tload: number | null;
  type: string | null = null;
  version: number | null = null;
  initSegment: Fragment | null = null;
  needSidxRanges: boolean = false;

  constructor (baseUrl: string) {
    this.url = baseUrl;
  }

  get hasProgramDateTime (): boolean {
    return !!(this.fragments[0] && Number.isFinite(this.fragments[0].programDateTime));
  }
}
