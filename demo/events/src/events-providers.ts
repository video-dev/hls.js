import type { HlsListeners } from '../../../dist/hls.js';

export const hlsJsEvents = Object.values(
  self.Hls.Events
) as (keyof HlsListeners)[];
