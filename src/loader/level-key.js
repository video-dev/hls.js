import * as URLToolkit from 'url-toolkit';

export default class LevelKey {
  constructor () {
    this.method = null;
    this.key = null;
    this.iv = null;
    this._uri = null;
  }

  get uri () {
    if (!this._uri && this.reluri) {
      this._uri = URLToolkit.buildAbsoluteURL(this.baseuri, this.reluri, { alwaysNormalize: true });
    }

    return this._uri;
  }
}
