import { expect } from 'chai';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { PlaylistLevelType } from '../../../src/types/loader';
import {
  mergeDetails,
  updateFragPTSDTS,
} from '../../../src/utils/level-helper';
import { logger } from '../../../src/utils/logger';
import type { LevelDetails } from '../../../src/loader/level-details';

// State a reload carries, and state it must not. A reused fragment is the same
// object as last time, so anything the player set on it at runtime outlives the
// reload unless the parse or the merge clears it. Master rebuilds the fragment
// and therefore clears it; these pin that the reuse path agrees.

type ParseWithPrevious = (
  playlist: string,
  baseurl: string,
  id: number,
  type: PlaylistLevelType,
  levelUrlId: number,
  multivariantVariableList: null,
  previous: LevelDetails | null,
) => LevelDetails;

describe('live reload fragment reuse ownership', function () {
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

  // A window the player has loaded: PTS-adjusted timing on the segments it
  // buffered, which is what the previous details holds when a reload arrives.
  function loadedWindow() {
    const details = parse(playlist(10), null);
    // Spaced by the measured duration, not the declared one: updateFromToPTS
    // takes each fragment's duration from the next one's start, so a window
    // spaced 6.0 apart would drift-correct back to the declared 6.0 and there
    // would be nothing for a reload to lose.
    details.fragments.forEach((frag, i) => {
      const start = i * 6.04;
      const end = start + 6.04;
      updateFragPTSDTS(details, frag, start, end, start, end, false, logger);
    });
    return details;
  }

  it('does not carry a runtime gap or deltaPTS across a reload', function () {
    const fresh = loadedWindow();
    const reused = loadedWindow();
    // The player marked a buffered segment as a gap and measured its drift.
    [fresh, reused].forEach((details) => {
      details.fragments[2].gap = true;
      details.fragments[2].deltaPTS = 0.25;
    });
    const freshReload = parse(playlist(11), null);
    freshReload.reloaded(fresh);
    mergeDetails(fresh, freshReload, logger);
    const reusedReload = parse(playlist(11), reused);
    reusedReload.reloaded(reused);
    mergeDetails(reused, reusedReload, logger);
    expect(reusedReload.fragments[1].gap).to.equal(
      freshReload.fragments[1].gap,
    );
    expect(reusedReload.fragments[1].deltaPTS).to.equal(
      freshReload.fragments[1].deltaPTS,
    );
  });

  it('leaves the previous window on its measured timing when a reload is dropped', function () {
    const previous = loadedWindow();
    const before = previous.fragments.map((frag) => ({
      sn: frag.sn,
      start: frag.start,
      duration: frag.duration,
      end: frag.end,
      startPTS: frag.startPTS,
      endPTS: frag.endPTS,
      programDateTime: frag.programDateTime,
    }));
    expect(before[2].duration).to.be.closeTo(6.04, 0.001);
    // A reload the controller drops after it was parsed: it is never merged,
    // and the previous details stays installed and in use.
    const dropped = parse(playlist(11), previous);
    expect(dropped.playlistParsingError).to.equal(null);
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
