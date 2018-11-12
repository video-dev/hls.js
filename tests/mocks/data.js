export const mockFragments = [
  {
    programDateTime: 1505502661523,
    endProgramDateTime: 1505502666523,
    level: 2,
    duration: 5.000,
    start: 0,
    sn: 0,
    cc: 0
  },
  // Discontinuity with PDT 1505502671523 which does not exist in level 1 as per fragPrevious
  {
    programDateTime: 1505502671523,
    endProgramDateTime: 1505502676523,
    level: 2,
    duration: 5.000,
    start: 5.000,
    sn: 1,
    cc: 1
  },
  {
    programDateTime: 1505502676523,
    endProgramDateTime: 1505502681523,
    level: 2,
    duration: 5.000,
    start: 10.000,
    sn: 2,
    cc: 1
  },
  {
    programDateTime: 1505502681523,
    endProgramDateTime: 1505502686523,
    level: 2,
    duration: 5.000,
    start: 15.000,
    sn: 3,
    cc: 1
  },
  {
    programDateTime: 1505502686523,
    endProgramDateTime: 1505502691523,
    level: 2,
    duration: 5.000,
    start: 20.000,
    sn: 4,
    cc: 1
  }
];
