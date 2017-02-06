const assert = require('assert');

import FragmentLoader from '../../../src/loader/fragment-loader';
import {ResourceTypes} from '../../../src/loader/resource-types';

describe('FragmentLoader', () => {
  it('loads with the appropriate type', () => {
    var resultType;
    var loader = function() {
      this.load = function(context, config, callbacks, type) {
        resultType = type;
      };
    };
    var fragmentLoader = new FragmentLoader({
      on: function() {},
      config: {
        loader: loader
      }
    });

    fragmentLoader.onFragLoading({frag: {}});
    assert.strictEqual(resultType, ResourceTypes.FRAGMENT);
  });
});
