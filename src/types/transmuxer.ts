import { RemuxerResult } from './remuxer';
import { HlsChunkPerformanceTiming } from './loader';
import { SourceBufferListener, SourceBufferName } from './buffer';

export interface TransmuxerResult {
    remuxResult: RemuxerResult
    chunkMeta: ChunkMetadata
}

export class ChunkMetadata {
    public level: number;
    public sn: number;
    public id: number;
    public size: number;

    public transmuxing: HlsChunkPerformanceTiming = { start: 0, executeStart: 0, executeEnd: 0, end: 0 };
    public buffering:  { [key in SourceBufferName]: HlsChunkPerformanceTiming } = {
        audio: { start: 0, executeStart: 0, executeEnd: 0, end: 0 },
        video: { start: 0, executeStart: 0, executeEnd: 0, end: 0 },
        audiovideo: { start: 0, executeStart: 0, executeEnd: 0, end: 0 }
    };

    constructor (level, sn, id, size = 0) {
        this.level = level;
        this.sn = sn;
        this.id = id;
        this.size = size;
    }
}