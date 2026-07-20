import type { SourceBufferName } from './buffer';
import type { FragLoadedData } from './events';
import type { MediaFragment } from '../loader/fragment';

export interface FragmentEntity {
  body: MediaFragment;
  // appendedPTS is the latest buffered presentation time within the fragment's time range.
  // It is used to determine: which fragment is appended at any given position, and hls.currentLevel.
  appendedPTS: number | null;
  loaded: FragLoadedData | null;
  buffered: boolean;
  range: { [key in SourceBufferName | 'subs']: FragmentBufferedRange };
  // Buffered coverage and append count of a partial fragment, used to mark
  // fragments as gaps after repeated appends without buffered range growth
  partialAppends: { covered: number; count: number } | null;
}

export interface FragmentTimeRange {
  startPTS: number;
  endPTS: number;
}

export interface FragmentBufferedRange {
  time: Array<FragmentTimeRange>;
  partial: boolean;
}
