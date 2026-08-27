import { expect } from 'chai';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { PlaylistLevelType } from '../../../src/types/loader';
import { mergeDetails } from '../../../src/utils/level-helper';
import { logger } from '../../../src/utils/logger';
import type { LevelDetails } from '../../../src/loader/level-details';

// The parser replays mergeDetails' discontinuity renumbering rule over the
// lanes when it keeps fragments across a window that slid past a
// discontinuity without EXT-X-DISCONTINUITY-SEQUENCE. The condition is
// shared (canRenumberDiscontinuitySequence), the walk is not; this pins the
// two against each other, so an edit to the merge's rule that the parser
// does not follow fails here instead of drifting silently.

type ParseWithPrevious = (
  playlist: string,
  baseurl: string,
  id: number,
  type: PlaylistLevelType,
  levelUrlId: number,
  multivariantVariableList: null,
  previous: LevelDetails | null,
) => LevelDetails;

describe('live reload fragment reuse discontinuity renumbering', function () {
  const url = 'http://example.com/live/playlist.m3u8';
  const COUNT = 6;

  const playlist = (startSN: number, disco: number) => {
    let out = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:${startSN}
`;
    for (let i = 0; i < COUNT; i++) {
      const sn = startSN + i;
      if (sn === disco) {
        out += '#EXT-X-DISCONTINUITY\n';
      }
      out += `#EXTINF:6.000,\nsegment-${sn}.mp4\n`;
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

  it('lands where the merge renumbers a fresh reload, keeping fragments', function () {
    // The window slides up to and then past a discontinuity before sn 12.
    // Once sn 12 leads the window the tag is gone, the declared counters
    // restart at 0, and the merge renumbers the fresh parse from the
    // previous window. The reused parse must land identically while still
    // keeping the previous fragments.
    let fresh = parse(playlist(11, 12), null);
    let reused = parse(playlist(11, 12), null);
    let kept = 0;
    const startSNs = [12, 13, 14];
    for (let i = 0; i < startSNs.length; i++) {
      const reload = playlist(startSNs[i], 12);
      const nextFresh = parse(reload, null);
      const nextReused = parse(reload, reused);
      kept = nextReused.fragments.filter(
        (frag) => reused.fragments.indexOf(frag) !== -1,
      ).length;
      nextFresh.reloaded(fresh);
      nextReused.reloaded(reused);
      mergeDetails(fresh, nextFresh, logger);
      mergeDetails(reused, nextReused, logger);
      fresh = nextFresh;
      reused = nextReused;
    }
    expect(fresh.playlistParsingError).to.equal(null);
    expect(reused.playlistParsingError).to.equal(null);
    // The declared counters of the last reload are all 0; the merge carries
    // the previous window's numbering instead.
    expect(fresh.fragments.map((frag) => frag.cc)).to.deep.equal([
      1, 1, 1, 1, 1, 1,
    ]);
    expect(reused.fragments.map((frag) => frag.cc)).to.deep.equal(
      fresh.fragments.map((frag) => frag.cc),
    );
    expect(reused.fragments.map((frag) => frag.start)).to.deep.equal(
      fresh.fragments.map((frag) => frag.start),
    );
    expect(reused.endCC).to.equal(fresh.endCC);
    expect(reused.startCC).to.equal(fresh.startCC);
    // The parser path was exercised: the last reload, whose kept counters
    // sit a window shift above what its playlist declares, kept fragments
    // rather than restarting into a fresh parse.
    expect(kept).to.be.greaterThan(0);
  });

  it('restarts rather than renumber under a declared discontinuity sequence', function () {
    // With EXT-X-DISCONTINUITY-SEQUENCE declared the merge may not renumber,
    // and neither may the parser: a reload whose kept counters would need a
    // shift is parsed fresh so the merge rejects it the way it always has.
    const withSequence = (startSN: number, sequence: number) =>
      `#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-TARGETDURATION:6\n#EXT-X-DISCONTINUITY-SEQUENCE:${sequence}\n#EXT-X-MEDIA-SEQUENCE:${startSN}\n` +
      Array.from(
        { length: COUNT },
        (_, i) => `#EXTINF:6.000,\nsegment-${startSN + i}.mp4\n`,
      ).join('');
    const previous = parse(withSequence(10, 1), null);
    const reloadText = withSequence(11, 2);
    const fresh = parse(reloadText, null);
    const reused = parse(reloadText, previous);
    expect(
      reused.fragments.filter((frag) => previous.fragments.indexOf(frag) !== -1)
        .length,
      'nothing kept across a sequence jump',
    ).to.equal(0);
    expect(reused.fragments.map((frag) => frag.cc)).to.deep.equal(
      fresh.fragments.map((frag) => frag.cc),
    );
  });
});
