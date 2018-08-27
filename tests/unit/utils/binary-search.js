import BinarySearch from '../../../src/utils/binary-search';
let assert = require('assert');

describe('binary search util', function () {
  describe('search helper', function () {
    let list = null;
    let buildComparisonFunction = function (itemToSearchFor) {
      return function (candidate) {
        if (candidate < itemToSearchFor) {
          return 1;
        } else if (candidate > itemToSearchFor) {
          return -1;
        }

        return 0;
      };
    };

    beforeEach(function () {
      list = [4, 8, 15, 16, 23, 42];
    });
    it('finds the element if it is present', function () {
      for (let i = 0; i < list.length; i++) {
        let item = list[i];
        let foundItem = BinarySearch.search(list, buildComparisonFunction(item));
        assert.strictEqual(foundItem, item);
      }
    });
    it('does not find the element if it is not present', function () {
      let item = 1000;
      let foundItem = BinarySearch.search(list, buildComparisonFunction(item));
      assert.strictEqual(foundItem, null);
    });
  });
});
