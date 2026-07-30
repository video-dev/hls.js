import { parseInitSegment } from './mp4-tools';
import type { InitData } from './mp4-tools';

const parsedInitData = new WeakMap<Uint8Array, InitData>();

export function parseAndCacheInitData(initSegment: Uint8Array): InitData {
  const initData = parseInitSegment(initSegment);
  parsedInitData.set(initSegment, initData);
  return initData;
}

export function consumeInitData(initSegment: Uint8Array): InitData {
  const initData = parsedInitData.get(initSegment);
  if (initData) {
    parsedInitData.delete(initSegment);
    return initData;
  }
  return parseInitSegment(initSegment);
}
