let BinarySearch = {
  /**
     * Searches for an item in an array which matches a certain condition.
     * This requires the condition to only match one item in the array,
     * and for the array to be ordered.
     *
     * @param {Array} list The array to search.
     * @param {Function} comparisonFunction
     *      Called and provided a candidate item as the first argument.
     *      Should return:
     *          > -1 if the item should be located at a lower index than the provided item.
     *          > 1 if the item should be located at a higher index than the provided item.
     *          > 0 if the item is the item you're looking for.
     *
     * @return {*} The object if it is found or null otherwise.
     */
  search: function (list, comparisonFunction) {
    let minIndex = 0;
    let maxIndex = list.length - 1;
    let currentIndex = null;
    let currentElement = null;

    while (minIndex <= maxIndex) {
      currentIndex = (minIndex + maxIndex) / 2 | 0;
      currentElement = list[currentIndex];

      let comparisonResult = comparisonFunction(currentElement);
      if (comparisonResult > 0) {
        minIndex = currentIndex + 1;
      } else if (comparisonResult < 0) {
        maxIndex = currentIndex - 1;
      } else {
        return currentElement;
      }
    }

    return null;
  }
};

export default BinarySearch;
