import Fragment from '../loader/fragment';
import { SourceBufferName } from './buffer';

export interface FragmentEntity {
  body: Fragment
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