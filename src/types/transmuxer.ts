import { RemuxerResult } from './remuxer';

export interface TransmuxerResult {
    remuxResult: RemuxerResult
    chunkMeta: ChunkMetadata
}

export class ChunkMetadata {
    public level: number;
    public sn: number;

    constructor (level, sn) {
        this.level = level;
        this.sn = sn;
    }
}