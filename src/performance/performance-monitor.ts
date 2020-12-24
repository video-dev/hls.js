/*
 * Push the performance monitor as the last core component in hls.ts
 * so that it is the last class to handle events.
 *
 * coreComponents.push(new PerformanceMonitor(this));
 *
 * TODO: Add this to the demo page or a performance test page
 */

import { Events } from '../events';
import { logger } from '../utils/logger';
import Hls from '../hls';
import type { FragBufferedData } from '../types/events';

export default class PerformanceMonitor {
  private hls: Hls;

  constructor(hls: Hls) {
    this.hls = hls;
    this.hls.on(Events.FRAG_BUFFERED, this.onFragBuffered);
  }

  destroy() {
    this.hls.off(Events.FRAG_BUFFERED);
  }

  onFragBuffered(event: Events.FRAG_BUFFERED, data: FragBufferedData) {
    logFragStats(data);
  }
}

function logFragStats(data: FragBufferedData) {
  const { frag, part } = data;
  const stats = part ? part.stats : frag.stats;
  const tLoad = stats.loading.end - stats.loading.start;
  const tBuffer = stats.buffering.end - stats.buffering.start;
  const tParse = stats.parsing.end - stats.parsing.start;
  const tTotal = stats.buffering.end - stats.loading.start;

  logger.log(`[performance-monitor]: Stats for fragment ${frag.sn} ${
    part ? ' part ' + part.index : ''
  } of level ${frag.level}:
        Size:                       ${(stats.total / 1024).toFixed(3)} kB
        Chunk Count:                ${stats.chunkCount}

        Request:                    ${stats.loading.start.toFixed(3)} ms
        First Byte:                 ${stats.loading.first.toFixed(3)} ms
        Parse Start                 ${stats.parsing.start.toFixed(3)} ms
        Buffering Start:            ${stats.buffering.start.toFixed(3)} ms
        First Buffer:               ${stats.buffering.first.toFixed(3)} ms
        Parse End:                  ${stats.parsing.end.toFixed(3)} ms
        Buffering End:              ${stats.buffering.end.toFixed(3)} ms

        Load Duration:              ${tLoad.toFixed(3)} ms
        Parse Duration:             ${tParse.toFixed(3)} ms
        Buffer Duration:            ${tBuffer.toFixed(3)} ms
        End-To-End Duration:        ${tTotal.toFixed(3)} ms`);
}
