import BinarySearch from '../../../src/utils/binary-search';

describe('binary search util', function () {
  describe('search helper', function () {
    let list = null;
    const buildComparisonFunction = function (itemToSearchFor) {
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
        const item = list[i];
        const foundItem = BinarySearch.search(
          list,
          buildComparisonFunction(item)
        );
        expect(foundItem).to.equal(item);
      }
    });
    it('does not find the element if it is not present', function () {
      const item = 1000;
      const foundItem = BinarySearch.search(
        list,
        buildComparisonFunction(item)
      );
      expect(foundItem).to.not.exist;
    });
  });
});
