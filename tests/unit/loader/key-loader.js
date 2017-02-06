const assert = require('assert');

import KeyLoader from '../../../src/loader/key-loader';
import {ResourceTypes} from '../../../src/loader/resource-types';

describe('FragmentLoader', () => {
  it('loads with the appropriate type', () => {
    var resultType;
    var loader = function() {
      this.load = function(context, config, callbacks, type) {
        resultType = type;
      };
    };
    var keyLoader = new KeyLoader({
      on: function() {},
      config: {
        loader: loader
      }
    });

    keyLoader.onKeyLoading({frag: {decryptdata: {}}});
    assert.strictEqual(resultType, ResourceTypes.KEY);
  });
});
