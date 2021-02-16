import { buildAbsoluteURL } from 'url-toolkit';

export class LevelKey {
  private _uri: string | null = null;
  public method: string | null = null;
  public keyFormat: string | null = null;
  public keyFormatVersions: string | null = null;
  public keyID: string | null = null;
  public key: Uint8Array | null = null;
  public iv: Uint8Array | null = null;

  static fromURL(baseUrl: string, relativeUrl: string): LevelKey {
    return new LevelKey(baseUrl, relativeUrl);
  }

  static fromURI(uri: string): LevelKey {
    return new LevelKey(uri);
  }

  private constructor(absoluteOrBaseURI: string, relativeURL?: string) {
    if (relativeURL) {
      this._uri = buildAbsoluteURL(absoluteOrBaseURI, relativeURL, {
        alwaysNormalize: true,
      });
    } else {
      this._uri = absoluteOrBaseURI;
    }
  }

  get uri() {
    return this._uri;
  }
}
