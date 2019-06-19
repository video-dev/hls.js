import Fragment from './fragment';

export default class InitSegment {
  public fragment: Fragment;
  public data: ArrayBuffer | null = null;

  constructor (fragment: Fragment) {
    this.fragment = fragment;
  }
}
