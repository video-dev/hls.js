import { expect } from 'chai';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { PlaylistLevelType } from '../../../src/types/loader';
import { updateFragPTSDTS } from '../../../src/utils/level-helper';
import { logger } from '../../../src/utils/logger';
import type { LevelDetails } from '../../../src/loader/level-details';

// A committed reload the controller then drops (max unchanged reloads, a
// LEVEL_LOADED for a level that is no longer current) must leave the
// installed window on the timing the player measured. The window here has
// really drifted from its declared durations, so that a write of declared
// timing onto a kept fragment cannot hide behind equal values: measured
// starts are spaced 6.04s apart while the playlist declares 6.0.

type ParseWithPrevious = (
  playlist: string,
  baseurl: string,
  id: number,
  type: PlaylistLevelType,
  levelUrlId: number,
  multivariantVariableList: null,
  previous: LevelDetails | null,
) => LevelDetails;

describe('live reload fragment reuse ownership (drifted window)', function () {
  const url = 'http://example.com/live/playlist.m3u8';

  const playlist = (startSN: number) => {
    let out = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:${startSN}
`;
    for (let i = 0; i < 5; i++) {
      out += `#EXTINF:6.000,\nsegment-${startSN + i}.mp4\n`;
    }
    return out;
  };

  const parse = (text: string, previous: LevelDetails | null) =>
    (M3U8Parser.parseLevelPlaylist as unknown as ParseWithPrevious)(
      text,
      url,
      0,
      PlaylistLevelType.MAIN,
      0,
      null,
      previous,
    );

  it('leaves the previous window on its measured timing when a committed reload is dropped', function () {
    const previous = parse(playlist(10), null);
    previous.fragments.forEach((frag, i) => {
      const start = i * 6.04;
      const end = start + 6.04;
      updateFragPTSDTS(previous, frag, start, end, start, end, false, logger);
    });
    const before = previous.fragments.map((frag) => ({
      sn: frag.sn,
      start: frag.start,
      duration: frag.duration,
      end: frag.end,
      startPTS: frag.startPTS,
      endPTS: frag.endPTS,
      programDateTime: frag.programDateTime,
    }));
    expect(before[2].start).to.be.closeTo(12.08, 0.001);
    expect(before[2].duration).to.be.closeTo(6.04, 0.001);
    const dropped = parse(playlist(11), previous);
    expect(dropped.playlistParsingError).to.equal(null);
    // The parse committed: it kept the previous window's fragments.
    expect(dropped.fragments[0]).to.equal(previous.fragments[1]);
    previous.fragments.forEach((frag, i) => {
      const was = before[i];
      expect(frag.sn, `sn ${was.sn}`).to.equal(was.sn);
      expect(frag.start, `start ${was.sn}`).to.equal(was.start);
      expect(frag.duration, `duration ${was.sn}`).to.equal(was.duration);
      expect(frag.end, `end ${was.sn}`).to.equal(was.end);
      expect(frag.startPTS, `startPTS ${was.sn}`).to.equal(was.startPTS);
      expect(frag.endPTS, `endPTS ${was.sn}`).to.equal(was.endPTS);
      expect(frag.programDateTime, `pdt ${was.sn}`).to.equal(
        was.programDateTime,
      );
    });
    expect(previous.edge).to.equal(before[before.length - 1].end);
  });
});
