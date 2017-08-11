var assert = require("assert");
import BinarySearch from '../../../src/utils/binary-search';

describe('binary search util', function() {
  describe('search helper', function () {
    var list = null;
    var buildComparisonFunction = function(itemToSearchFor) {
      return function(candidate) {
        if (candidate < itemToSearchFor) {
          return 1;
        }
        else if (candidate > itemToSearchFor) {
          return -1;
        }
        return 0;
      };
    }

    beforeEach(function() {
      list = [4, 8, 15, 16, 23, 42];
    });
    it('finds the element if it is present', function () {
      for(var i=0; i<list.length; i++) {
        var item = list[i];
        var foundItem = BinarySearch.search(list, buildComparisonFunction(item));
        assert.strictEqual(foundItem, item);
      }
    });
    it('does not find the element if it is not present', function () {
      var item = 1000;
      var foundItem = BinarySearch.search(list, buildComparisonFunction(item));
      assert.strictEqual(foundItem, null);
    });
  });
});
