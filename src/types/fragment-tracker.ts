import Fragment, { Part } from '../loader/fragment';
import type { SourceBufferName } from './buffer';

export interface FragmentEntity {
  body: Fragment,
  part: Part | null,
  range: { [key in SourceBufferName]: FragmentBufferedRange }
  buffered: boolean
}

export interface FragmentTimeRange {
  startPTS: number
  endPTS: number
}

export interface FragmentBufferedRange {
  time: Array<FragmentTimeRange>
  partial: boolean
}
