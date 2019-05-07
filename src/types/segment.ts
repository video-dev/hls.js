import { SourceBufferName } from './buffer';

export interface Segment {
  type: SourceBufferName;
  data: ArrayBuffer;
  parent: string;
  content: string;
}
