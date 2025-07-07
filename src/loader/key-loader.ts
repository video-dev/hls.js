import { LoadError } from './fragment-loader';
import { ErrorDetails, ErrorTypes } from '../errors';
import { type Fragment, isMediaFragment } from '../loader/fragment';
import {
  getKeySystemsForConfig,
  keySystemFormatToKeySystemDomain,
} from '../utils/mediakeys-helper';
import type { LevelKey } from './level-key';
import type { HlsConfig } from '../config';
import type EMEController from '../controller/eme-controller';
import type { MediaKeySessionContext } from '../controller/eme-controller';
import type { ComponentAPI } from '../types/component-api';
import type { KeyLoadedData } from '../types/events';
import type {
  KeyLoaderContext,
  Loader,
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderResponse,
  LoaderStats,
  PlaylistLevelType,
} from '../types/loader';
import type { KeySystemFormats } from '../utils/mediakeys-helper';

export interface KeyLoaderInfo {
  decryptdata: LevelKey;
  keyLoadPromise: Promise<KeyLoadedData> | null;
  loader: Loader<KeyLoaderContext> | null;
  mediaKeySessionContext: MediaKeySessionContext | null;
}
export default class KeyLoader implements ComponentAPI {
  private readonly config: HlsConfig;
  public keyUriToKeyInfo: { [keyuri: string]: KeyLoaderInfo } = {};
  public emeController: EMEController | null = null;

  constructor(config: HlsConfig) {
    this.config = config;
  }

  abort(type?: PlaylistLevelType) {
    for (const uri in this.keyUriToKeyInfo) {
      const loader = this.keyUriToKeyInfo[uri].loader;
      if (loader) {
        if (type && type !== loader.context?.frag.type) {
          return;
        }
        loader.abort();
      }
    }
  }

  detach() {
    for (const uri in this.keyUriToKeyInfo) {
      const keyInfo = this.keyUriToKeyInfo[uri];
      // Remove cached EME keys on detach
      if (
        keyInfo.mediaKeySessionContext ||
        keyInfo.decryptdata.isCommonEncryption
      ) {
        delete this.keyUriToKeyInfo[uri];
      }
    }
  }

  destroy() {
    this.detach();
    for (const uri in this.keyUriToKeyInfo) {
      const loader = this.keyUriToKeyInfo[uri].loader;
      if (loader) {
        loader.destroy();
      }
    }
    this.keyUriToKeyInfo = {};
  }

  createKeyLoadError(
    frag: Fragment,
    details: ErrorDetails = ErrorDetails.KEY_LOAD_ERROR,
    error: Error,
    networkDetails?: any,
    response?: { url: string; data: undefined; code: number; text: string },
  ): LoadError {
    return new LoadError({
      type: ErrorTypes.NETWORK_ERROR,
      details,
      fatal: false,
      frag,
      response,
      error,
      networkDetails,
    });
  }

  loadClear(
    loadingFrag: Fragment,
    encryptedFragments: Fragment[],
    startFragRequested: boolean,
  ): null | Promise<void> {
    if (
      this.emeController &&
      this.config.emeEnabled &&
      !this.emeController.getSelectedKeySystemFormats().length
    ) {
      // Access key-system with nearest key on start (loading frag is unencrypted)
      if (encryptedFragments.length) {
        for (let i = 0, l = encryptedFragments.length; i < l; i++) {
          const frag = encryptedFragments[i];
          // Loading at or before segment with EXT-X-KEY, or first frag loading and last EXT-X-KEY
          if (
            (loadingFrag.cc <= frag.cc &&
              (!isMediaFragment(loadingFrag) ||
                !isMediaFragment(frag) ||
                loadingFrag.sn < frag.sn)) ||
            (!startFragRequested && i == l - 1)
          ) {
            return this.emeController
              .selectKeySystemFormat(frag)
              .then((keySystemFormat) => {
                if (!this.emeController) {
                  return;
                }
                frag.setKeyFormat(keySystemFormat);
                const keySystem =
                  keySystemFormatToKeySystemDomain(keySystemFormat);
                if (keySystem) {
                  return this.emeController.getKeySystemAccess([keySystem]);
                }
              });
          }
        }
      }
      if (this.config.requireKeySystemAccessOnStart) {
        const keySystemsInConfig = getKeySystemsForConfig(this.config);
        if (keySystemsInConfig.length) {
          return this.emeController.getKeySystemAccess(keySystemsInConfig);
        }
      }
    }
    return null;
  }

  load(frag: Fragment): Promise<KeyLoadedData> {
    if (
      !frag.decryptdata &&
      frag.encrypted &&
      this.emeController &&
      this.config.emeEnabled
    ) {
      // Multiple keys, but none selected, resolve in eme-controller
      return this.emeController
        .selectKeySystemFormat(frag)
        .then((keySystemFormat) => {
          return this.loadInternal(frag, keySystemFormat);
        });
    }

    return this.loadInternal(frag);
  }

  loadInternal(
    frag: Fragment,
    keySystemFormat?: KeySystemFormats,
  ): Promise<KeyLoadedData> {
    if (keySystemFormat) {
      frag.setKeyFormat(keySystemFormat);
    }
    const decryptdata = frag.decryptdata;
    if (!decryptdata) {
      const error = new Error(
        keySystemFormat
          ? `Expected frag.decryptdata to be defined after setting format ${keySystemFormat}`
          : 'Missing decryption data on fragment in onKeyLoading',
      );
      return Promise.reject(
        this.createKeyLoadError(frag, ErrorDetails.KEY_LOAD_ERROR, error),
      );
    }
    const uri = decryptdata.uri;
    if (!uri) {
      return Promise.reject(
        this.createKeyLoadError(
          frag,
          ErrorDetails.KEY_LOAD_ERROR,
          new Error(`Invalid key URI: "${uri}"`),
        ),
      );
    }
    let keyInfo = this.keyUriToKeyInfo[uri];

    if (keyInfo?.decryptdata.key) {
      decryptdata.key = keyInfo.decryptdata.key;
      return Promise.resolve({ frag, keyInfo });
    }
    // Return key load promise as long as it does not have a mediakey session with an unusable key status
    if (keyInfo?.keyLoadPromise) {
      switch (keyInfo.mediaKeySessionContext?.keyStatus) {
        case undefined:
        case 'status-pending':
        case 'usable':
        case 'usable-in-future':
          return keyInfo.keyLoadPromise.then((keyLoadedData) => {
            // Return the correct fragment with updated decryptdata key and loaded keyInfo
            decryptdata.key = keyLoadedData.keyInfo.decryptdata.key;
            return { frag, keyInfo };
          });
      }
      // If we have a key session and status and it is not pending or usable, continue
      // This will go back to the eme-controller for expired keys to get a new keyLoadPromise
    }

    // Load the key or return the loading promise
    keyInfo = this.keyUriToKeyInfo[uri] = {
      decryptdata,
      keyLoadPromise: null,
      loader: null,
      mediaKeySessionContext: null,
    };

    switch (decryptdata.method) {
      case 'ISO-23001-7':
      case 'SAMPLE-AES':
      case 'SAMPLE-AES-CENC':
      case 'SAMPLE-AES-CTR':
        if (decryptdata.keyFormat === 'identity') {
          // loadKeyHTTP handles http(s) and data URLs
          return this.loadKeyHTTP(keyInfo, frag);
        }
        return this.loadKeyEME(keyInfo, frag);
      case 'AES-128':
      case 'AES-256':
      case 'AES-256-CTR':
        return this.loadKeyHTTP(keyInfo, frag);
      default:
        return Promise.reject(
          this.createKeyLoadError(
            frag,
            ErrorDetails.KEY_LOAD_ERROR,
            new Error(
              `Key supplied with unsupported METHOD: "${decryptdata.method}"`,
            ),
          ),
        );
    }
  }

  loadKeyEME(keyInfo: KeyLoaderInfo, frag: Fragment): Promise<KeyLoadedData> {
    const keyLoadedData: KeyLoadedData = { frag, keyInfo };
    if (this.emeController && this.config.emeEnabled) {
      const keySessionContextPromise =
        this.emeController.loadKey(keyLoadedData);
      if (keySessionContextPromise) {
        return (keyInfo.keyLoadPromise = keySessionContextPromise.then(
          (keySessionContext) => {
            keyInfo.mediaKeySessionContext = keySessionContext;
            return keyLoadedData;
          },
        )).catch((error) => {
          // Remove promise for license renewal or retry
          keyInfo.keyLoadPromise = null;
          throw error;
        });
      }
    }
    return Promise.resolve(keyLoadedData);
  }

  loadKeyHTTP(keyInfo: KeyLoaderInfo, frag: Fragment): Promise<KeyLoadedData> {
    const config = this.config;
    const Loader = config.loader;
    const keyLoader = new Loader(config) as Loader<KeyLoaderContext>;
    frag.keyLoader = keyInfo.loader = keyLoader;

    return (keyInfo.keyLoadPromise = new Promise((resolve, reject) => {
      const loaderContext: KeyLoaderContext = {
        keyInfo,
        frag,
        responseType: 'arraybuffer',
        url: keyInfo.decryptdata.uri,
      };

      // maxRetry is 0 so that instead of retrying the same key on the same variant multiple times,
      // key-loader will trigger an error and rely on stream-controller to handle retry logic.
      // this will also align retry logic with fragment-loader
      const loadPolicy = config.keyLoadPolicy.default;
      const loaderConfig: LoaderConfiguration = {
        loadPolicy,
        timeout: loadPolicy.maxLoadTimeMs,
        maxRetry: 0,
        retryDelay: 0,
        maxRetryDelay: 0,
      };

      const loaderCallbacks: LoaderCallbacks<KeyLoaderContext> = {
        onSuccess: (
          response: LoaderResponse,
          stats: LoaderStats,
          context: KeyLoaderContext,
          networkDetails: any,
        ) => {
          const { frag, keyInfo, url: uri } = context;
          if (!frag.decryptdata || keyInfo !== this.keyUriToKeyInfo[uri]) {
            return reject(
              this.createKeyLoadError(
                frag,
                ErrorDetails.KEY_LOAD_ERROR,
                new Error('after key load, decryptdata unset or changed'),
                networkDetails,
              ),
            );
          }

          keyInfo.decryptdata.key = frag.decryptdata.key = new Uint8Array(
            response.data as ArrayBuffer,
          );

          // detach fragment key loader on load success
          frag.keyLoader = null;
          keyInfo.loader = null;
          resolve({ frag, keyInfo });
        },

        onError: (
          response: { code: number; text: string },
          context: KeyLoaderContext,
          networkDetails: any,
          stats: LoaderStats,
        ) => {
          this.resetLoader(context);
          reject(
            this.createKeyLoadError(
              frag,
              ErrorDetails.KEY_LOAD_ERROR,
              new Error(
                `HTTP Error ${response.code} loading key ${response.text}`,
              ),
              networkDetails,
              { url: loaderContext.url, data: undefined, ...response },
            ),
          );
        },

        onTimeout: (
          stats: LoaderStats,
          context: KeyLoaderContext,
          networkDetails: any,
        ) => {
          this.resetLoader(context);
          reject(
            this.createKeyLoadError(
              frag,
              ErrorDetails.KEY_LOAD_TIMEOUT,
              new Error('key loading timed out'),
              networkDetails,
            ),
          );
        },

        onAbort: (
          stats: LoaderStats,
          context: KeyLoaderContext,
          networkDetails: any,
        ) => {
          this.resetLoader(context);
          reject(
            this.createKeyLoadError(
              frag,
              ErrorDetails.INTERNAL_ABORTED,
              new Error('key loading aborted'),
              networkDetails,
            ),
          );
        },
      };

      keyLoader.load(loaderContext, loaderConfig, loaderCallbacks);
    }));
  }

  private resetLoader(context: KeyLoaderContext) {
    const { frag, keyInfo, url: uri } = context;
    const loader = keyInfo.loader;
    if (frag.keyLoader === loader) {
      frag.keyLoader = null;
      keyInfo.loader = null;
    }
    delete this.keyUriToKeyInfo[uri];
    if (loader) {
      loader.destroy();
    }
  }
}
