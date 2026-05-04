import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import { hlsDefaultConfig, mergeConfig } from '../../../src/config';
import { Fragment } from '../../../src/loader/fragment';
import KeyLoader from '../../../src/loader/key-loader';
import { LevelKey } from '../../../src/loader/level-key';
import { LoadStats } from '../../../src/loader/load-stats';
import { PlaylistLevelType } from '../../../src/types/loader';
import { logger } from '../../../src/utils/logger';
import { MockXhr } from '../../mocks/loader.mock';
import type { FragmentLoaderContext } from '../../../src/types/loader';

use(sinonChai);

function createEncryptedFragment(
  sn: number,
  type: PlaylistLevelType,
  keyUri: string,
) {
  const frag = new Fragment(type, '');
  frag.sn = sn;
  frag.relurl = `segment-${sn}.ts`;
  frag.level = 0;
  frag.levelkeys = {
    identity: new LevelKey('AES-128', keyUri, 'identity'),
  };
  return frag;
}

describe('KeyLoader', function () {
  let keyLoader: KeyLoader;
  let config;

  beforeEach(function () {
    config = mergeConfig(hlsDefaultConfig, { loader: MockXhr }, logger);
    keyLoader = new KeyLoader(config, logger);
  });

  afterEach(function () {
    keyLoader.destroy();
  });

  describe('loadKeyHTTP key deduplication', function () {
    it('copies loaded key to fragment decryptdata when key is already cached', function () {
      const keyUri = 'https://example.com/key.bin';
      const keyBytes = new Uint8Array([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
      ]);

      // First fragment triggers the actual key load
      const frag1 = createEncryptedFragment(0, PlaylistLevelType.MAIN, keyUri);
      const promise1 = keyLoader.load(frag1);

      // Simulate key load success on the XHR
      const loader1 = frag1.keyLoader as unknown as MockXhr;
      expect(loader1).to.exist;
      if (loader1.callbacks) {
        loader1.callbacks.onSuccess(
          { data: keyBytes.buffer, url: keyUri },
          new LoadStats(),
          loader1.context as FragmentLoaderContext,
          null,
        );
      }

      return promise1.then((keyLoadedData1) => {
        expect(frag1.decryptdata!.key).to.deep.equal(keyBytes);

        // Second fragment loads with cached key (already resolved)
        const frag2 = createEncryptedFragment(
          0,
          PlaylistLevelType.AUDIO,
          keyUri,
        );
        return keyLoader.load(frag2).then((keyLoadedData2) => {
          expect(frag2.decryptdata!.key).to.deep.equal(keyBytes);
        });
      });
    });

    it('copies loaded key to fragment decryptdata when key is still loading', function () {
      const keyUri = 'https://example.com/key.bin';
      const keyBytes = new Uint8Array([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
      ]);

      // First fragment triggers the actual key load (promise pending)
      const frag1 = createEncryptedFragment(0, PlaylistLevelType.MAIN, keyUri);
      const promise1 = keyLoader.load(frag1);

      // Second fragment requests the same key while first is still loading
      const frag2 = createEncryptedFragment(0, PlaylistLevelType.AUDIO, keyUri);
      const promise2 = keyLoader.load(frag2);

      // Now simulate key load success for the first request
      const loader1 = frag1.keyLoader as unknown as MockXhr;
      expect(loader1).to.exist;
      if (loader1.callbacks) {
        loader1.callbacks.onSuccess(
          { data: keyBytes.buffer, url: keyUri },
          new LoadStats(),
          loader1.context as FragmentLoaderContext,
          null,
        );
      }

      return Promise.all([promise1, promise2]).then(
        ([keyLoadedData1, keyLoadedData2]) => {
          // First fragment should have the key
          expect(frag1.decryptdata!.key).to.deep.equal(keyBytes);
          // Second fragment (audio) MUST also have the key copied to its decryptdata
          expect(frag2.decryptdata!.key).to.deep.equal(
            keyBytes,
            'key must be copied to the requesting fragment decryptdata when key load was pending',
          );
        },
      );
    });
  });
});
