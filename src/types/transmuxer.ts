import { RemuxerResult } from './remuxer';
import { HlsChunkPerformanceTiming } from './loader';
import { SourceBufferName } from './buffer';

export interface TransmuxerResult {
    remuxResult: RemuxerResult
    chunkMeta: ChunkMetadata
}

export class ChunkMetadata {
    public level: number;
    public sn: number;
    public part: number;
    public id: number;
    public size: number;
    public transmuxing: HlsChunkPerformanceTiming = getNewPerformanceTiming();
    public buffering: { [key in SourceBufferName]: HlsChunkPerformanceTiming } = {
      audio: getNewPerformanceTiming(),
      video: getNewPerformanceTiming(),
      audiovideo: getNewPerformanceTiming()
    };

    constructor (level, sn, id, size = 0, part = -1) {
      this.level = level;
      this.sn = sn;
      this.id = id;
      this.size = size;
      this.part = part;
    }
}

function getNewPerformanceTiming (): HlsChunkPerformanceTiming {
  return { start: 0, executeStart: 0, executeEnd: 0, end: 0 };
}
