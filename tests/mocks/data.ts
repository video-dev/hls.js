import { Fragment } from '../../src/loader/fragment';
import { PlaylistLevelType } from '../../src/types/loader';
import type { MediaFragment } from '../../src/loader/fragment';

type MockMediaFragmentData = {
  level: number;
  programDateTime: number;
  duration: number;
  start: number;
  sn: number;
  cc: number;
  deltaPTS?: number;
} & Partial<MediaFragment>;

export function fragment(options: MockMediaFragmentData): MediaFragment {
  const frag = new Fragment(PlaylistLevelType.MAIN, '');
  Object.assign(frag, { level: 0 }, options);
  return frag as MediaFragment;
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

export const mockFragmentsWithDiscos = mockFragments.concat([
  fragment({
    programDateTime: 1505502691523,
    level: 2,
    duration: 5.0,
    start: 25.0,
    sn: 5,
    cc: 2,
  }),
  fragment({
    programDateTime: 1505502696523,
    level: 2,
    duration: 5.0,
    start: 30.0,
    sn: 6,
    cc: 2,
  }),
  fragment({
    programDateTime: 1505502701523,
    level: 2,
    duration: 5.0,
    start: 35.0,
    sn: 7,
    cc: 2,
  }),
]);
