import { SourceBufferName } from './buffer';
import { ChunkMetadata } from './transmuxer';
import Fragment from '../loader/fragment';

export interface BufferAppendingEventPayload {
  type: SourceBufferName;
  data: Uint8Array;
  frag: Fragment;
  chunkMeta: ChunkMetadata
}
