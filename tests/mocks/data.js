import { Fragment } from '../../src/loader/fragment';
import { PlaylistLevelType } from '../../src/types/loader';

function fragment(options) {
  const frag = new Fragment(PlaylistLevelType.MAIN, '');
  Object.assign(frag, options);
  return frag;
}

export const mockFragments = [
  fragment({
    programDateTime: 1505502661523,
    level: 2,
    duration: 5.0,
    start: 0,
    sn: 0,
    cc: 0,
  }),
  // Discontinuity with PDT 1505502671523 which does not exist in level 1 as per fragPrevious
  fragment({
    programDateTime: 1505502671523,
    level: 2,
    duration: 5.0,
    start: 5.0,
    sn: 1,
    cc: 1,
  }),
  fragment({
    programDateTime: 1505502676523,
    level: 2,
    duration: 5.0,
    start: 10.0,
    sn: 2,
    cc: 1,
  }),
  fragment({
    programDateTime: 1505502681523,
    level: 2,
    duration: 5.0,
    start: 15.0,
    sn: 3,
    cc: 1,
  }),
  fragment({
    programDateTime: 1505502686523,
    level: 2,
    duration: 5.0,
    start: 20.0,
    sn: 4,
    cc: 1,
  }),
];
