import { ErrorTypes, ErrorDetails } from '../errors';
import {
  LoaderStats,
  LoaderResponse,
  LoaderConfiguration,
  LoaderCallbacks,
  Loader,
  KeyLoaderContext,
} from '../types/loader';
import { LoadError } from './fragment-loader';
import type { HlsConfig } from '../hls';
import type { Fragment } from '../loader/fragment';
import type { ComponentAPI } from '../types/component-api';
import type { KeyLoadedData } from '../types/events';
import type { LevelKey } from './level-key';
import type EMEController from '../controller/eme-controller';
import type { MediaKeySessionContext } from '../controller/eme-controller';
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

  abort() {
    for (const uri in this.keyUriToKeyInfo) {
      const loader = this.keyUriToKeyInfo[uri].loader;
      if (loader) {
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
    networkDetails?: any,
    message?: string
  ): LoadError {
    return new LoadError({
      type: ErrorTypes.NETWORK_ERROR,
      details,
      fatal: false,
      frag,
      networkDetails,
    });
  }

  loadClear(
    loadingFrag: Fragment,
    encryptedFragments: Fragment[]
  ): void | Promise<void> {
    if (this.emeController && this.config.emeEnabled) {
      // access key-system with nearest key on start (loaidng frag is unencrypted)
      const { sn, cc } = loadingFrag;
      for (let i = 0; i < encryptedFragments.length; i++) {
        const frag = encryptedFragments[i];
        if (cc <= frag.cc && (sn === 'initSegment' || sn < frag.sn)) {
          this.emeController
            .selectKeySystemFormat(frag)
            .then((keySystemFormat) => {
              frag.setKeyFormat(keySystemFormat);
            });
          break;
        }
      }
    }
  }

  load(frag: Fragment): Promise<KeyLoadedData> {
    if (!frag.decryptdata && frag.encrypted && this.emeController) {
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
    keySystemFormat?: KeySystemFormats
  ): Promise<KeyLoadedData> {
    if (keySystemFormat) {
      frag.setKeyFormat(keySystemFormat);
    }
    const decryptdata = frag.decryptdata;
    if (!decryptdata) {
      const errorMessage = keySystemFormat
        ? `Expected frag.decryptdata to be defined after setting format ${keySystemFormat}`
        : 'Missing decryption data on fragment in onKeyLoading';
      return Promise.reject(
        this.createKeyLoadError(
          frag,
          ErrorDetails.KEY_LOAD_ERROR,
          null,
          errorMessage
        )
      );
    }
    const uri = decryptdata.uri;
    if (!uri) {
      return Promise.reject(
        this.createKeyLoadError(
          frag,
          ErrorDetails.KEY_LOAD_ERROR,
          null,
          `Invalid key URI: "${uri}"`
        )
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
        return this.loadKeyHTTP(keyInfo, frag);
      default:
        return Promise.reject(
          this.createKeyLoadError(
            frag,
            ErrorDetails.KEY_LOAD_ERROR,
            null,
            `Key supplied with unsupported METHOD: "${decryptdata.method}"`
          )
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
          }
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
      const loaderConfig: LoaderConfiguration = {
        timeout: config.fragLoadingTimeOut,
        maxRetry: 0,
        retryDelay: config.fragLoadingRetryDelay,
        maxRetryDelay: config.fragLoadingMaxRetryTimeout,
        highWaterMark: 0,
      };

      const loaderCallbacks: LoaderCallbacks<KeyLoaderContext> = {
        onSuccess: (
          response: LoaderResponse,
          stats: LoaderStats,
          context: KeyLoaderContext,
          networkDetails: any
        ) => {
          const { frag, keyInfo, url: uri } = context;
          if (!frag.decryptdata || keyInfo !== this.keyUriToKeyInfo[uri]) {
            return reject(
              this.createKeyLoadError(
                frag,
                ErrorDetails.KEY_LOAD_ERROR,
                networkDetails,
                'after key load, decryptdata unset or changed'
              )
            );
          }

          keyInfo.decryptdata.key = frag.decryptdata.key = new Uint8Array(
            response.data as ArrayBuffer
          );

          // detach fragment key loader on load success
          frag.keyLoader = null;
          keyInfo.loader = null;
          resolve({ frag, keyInfo });
        },

        onError: (
          error: { code: number; text: string },
          context: KeyLoaderContext,
          networkDetails: any
        ) => {
          this.resetLoader(context);
          reject(
            this.createKeyLoadError(
              frag,
              ErrorDetails.KEY_LOAD_ERROR,
              networkDetails
            )
          );
        },

        onTimeout: (
          stats: LoaderStats,
          context: KeyLoaderContext,
          networkDetails: any
        ) => {
          this.resetLoader(context);
          reject(
            this.createKeyLoadError(
              frag,
              ErrorDetails.KEY_LOAD_TIMEOUT,
              networkDetails
            )
          );
        },

        onAbort: (
          stats: LoaderStats,
          context: KeyLoaderContext,
          networkDetails: any
        ) => {
          this.resetLoader(context);
          reject(
            this.createKeyLoadError(
              frag,
              ErrorDetails.INTERNAL_ABORTED,
              networkDetails
            )
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
