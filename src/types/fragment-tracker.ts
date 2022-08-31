import type { Fragment } from '../loader/fragment';
import type { SourceBufferName } from './buffer';
import type { FragLoadedData } from './events';

export interface FragmentEntity {
  body: Fragment;
  loaded: FragLoadedData | null;
  buffered: boolean;
  range: { [key in SourceBufferName]: FragmentBufferedRange };
}

export interface FragmentTimeRange {
  startPTS: number;
  endPTS: number;
}

export interface FragmentBufferedRange {
  time: Array<FragmentTimeRange>;
  partial: boolean;
}
