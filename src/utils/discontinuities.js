import BinarySearch from './binary-search';

export function findFragWithCC(fragments, CC) {
    return BinarySearch.search(fragments, candidate => {
        if (candidate.cc < CC) {
            return 1;
        } else if (candidate.cc > CC) {
            return -1;
        } else {
            return 0;
        }
    });
}
