import { AttrList } from '../../src/utils/attr-list';
import type { LevelParsed } from '../../src/types/level';

export function parsedLevel(
  options: Partial<LevelParsed> & { bitrate: number },
): LevelParsed {
  const { bitrate, height } = options;
  const level: LevelParsed = {
    attrs: new AttrList({ BANDWIDTH: bitrate }),
    bitrate,
    name: `${height}-${bitrate}`,
    url: `${bitrate}.m3u8`,
  };
  return Object.assign(level, options);
}
