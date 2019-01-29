import { buildAbsoluteURL } from 'url-toolkit';

export default class LevelKey {
  private _uri: string | null = null;

  public baseuri: string;
  public reluri: string;

  method: string | null = null;
  key: Uint8Array | null = null;
  iv: Uint8Array | null = null;

  constructor (baseURI: string, relativeURI: string) {
    this.baseuri = baseURI;
    this.reluri = relativeURI;
  }

  get uri () {
    if (!this._uri && this.reluri) {
      this._uri = buildAbsoluteURL(this.baseuri, this.reluri, { alwaysNormalize: true });
    }

    return this._uri;
  }
}
