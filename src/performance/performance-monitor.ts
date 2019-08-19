import EventHandler from '../event-handler';
import Events from '../events';
import Fragment from '../loader/fragment';
import { logger } from '../utils/logger';

export default class PerformanceMonitor extends EventHandler {
  constructor (hls) {
    super(hls,
      Events.FRAG_BUFFERED
    );
    this.hls = hls;
  }

  onFragBuffered (data: { frag: Fragment }) {
    logFragStats(data.frag);
  }
}

function logFragStats (frag: Fragment) {
  const stats = frag.stats;
  const tLoad = stats.loading.end - stats.loading.start;
  const tBuffer = stats.buffering.end - stats.buffering.start;
  const tParse = stats.parsing.end - stats.parsing.start;
  const tTotal = stats.buffering.end - stats.loading.start;


  logger.log(`[performance-monitor]: Stats for fragment ${frag.sn} of level ${frag.level}:
        Size:                       ${((stats.total / 1024)).toFixed(3)} kB
        Chunk Count:                ${stats.chunkCount}
        
        Request:                    ${stats.loading.start.toFixed(3)} ms
        First Byte:                 ${stats.loading.first.toFixed(3)} ms
        Parse Start                 ${stats.parsing.start.toFixed(3)} ms
        Buffering Start:            ${stats.buffering.start.toFixed(3)} ms
        First Buffer:               ${stats.buffering.first.toFixed(3)} ms
        Parse End:                  ${stats.parsing.end.toFixed(3)} ms
        Buffering End:              ${stats.buffering.end.toFixed(3)} ms

        Load Duration:              ${tLoad.toFixed(3)} ms
        Parse Duration:             ${(tParse).toFixed(3)} ms
        Buffer Duration:            ${(tBuffer).toFixed(3)} ms
        End-To-End Duration:        ${(tTotal).toFixed(3)} ms`);
}