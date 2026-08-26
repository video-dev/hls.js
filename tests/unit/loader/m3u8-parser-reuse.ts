import { expect } from 'chai';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { PlaylistLevelType } from '../../../src/types/loader';
import type { Fragment } from '../../../src/loader/fragment';
import type { LevelDetails } from '../../../src/loader/level-details';

// Reloads whose text a byte-for-byte region match alone would get wrong, and
// the state the parser has to carry across a kept region. A parse that kept
// fragments is already on the timeline, so `start` is the merge's to check.

type ParseWithPrevious = (
  playlist: string,
  baseurl: string,
  id: number,
  type: PlaylistLevelType,
  levelUrlId: number,
  multivariantVariableList: null,
  previous: LevelDetails | null,
) => LevelDetails;

const URL = 'http://example.com/live/playlist.m3u8';

function parse(text: string, previous: LevelDetails | null, url = URL) {
  return (M3U8Parser.parseLevelPlaylist as unknown as ParseWithPrevious)(
    text,
    url,
    0,
    PlaylistLevelType.MAIN,
    0,
    null,
    previous,
  );
}

function header(startSN: number, tags = '') {
  return `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:${startSN}
${tags}`;
}

function segment(sn: number, tags = '', query = '') {
  return `${tags}#EXTINF:6.000,\nsegment-${sn}.mp4${query}\n`;
}

function snapshot(frag: Fragment | null) {
  return (
    frag && {
      sn: frag.sn,
      cc: frag.cc,
      relurl: frag.relurl,
      url: frag.url,
      playlistOffset: frag.playlistOffset,
      duration: frag.duration,
      rawProgramDateTime: frag.rawProgramDateTime,
      programDateTime: frag.programDateTime,
      init: frag.initSegment?.relurl ?? null,
    }
  );
}

function expectSameAsFresh(reused: LevelDetails, fresh: LevelDetails) {
  expect(reused.playlistParsingError).to.equal(fresh.playlistParsingError);
  expect(reused.startCC).to.equal(fresh.startCC);
  expect(reused.endCC).to.equal(fresh.endCC);
  expect(reused.fragments.map(snapshot)).to.deep.equal(
    fresh.fragments.map(snapshot),
  );
}

describe('M3U8Parser.parseLevelPlaylist with the previous details', function () {
  it('does not mistake a URI grown by a query for its previous region', function () {
    const previous = parse(header(10) + segment(10) + segment(11), null);
    const text = header(11) + segment(11, '', '?t=1') + segment(12, '', '?t=1');
    const reused = parse(text, previous);
    expectSameAsFresh(reused, parse(text, null));
    expect(reused.fragments[0].relurl).to.equal('segment-11.mp4?t=1');
    expect(reused.fragments[0]).to.not.equal(previous.fragments[1]);
    expect(previous.fragments[1].relurl).to.equal('segment-11.mp4');
  });

  it('parses again without the previous details when EXT-X-DISCONTINUITY-SEQUENCE follows a segment', function () {
    const previous = parse(
      header(10) + segment(10) + segment(11) + segment(12),
      null,
    );
    const text =
      header(11) +
      segment(11) +
      segment(12, '#EXT-X-DISCONTINUITY-SEQUENCE:5\n') +
      segment(13);
    const reused = parse(text, previous);
    expectSameAsFresh(reused, parse(text, null));
    expect(reused.fragments.map((f) => f.cc)).to.deep.equal([5, 5, 5]);
    expect(previous.fragments.map((f) => f.cc)).to.deep.equal([0, 0, 0]);
    expect(reused.fragments[0]).to.not.equal(previous.fragments[1]);
  });

  it('carries a date-time tag ahead of the map onto the segment after it', function () {
    const withMap = (sn: number) =>
      header(
        sn,
        `#EXT-X-PROGRAM-DATE-TIME:2024-01-01T00:00:${sn}.000Z\n#EXT-X-MAP:URI="init.mp4"\n`,
      ) +
      segment(sn) +
      segment(sn + 1) +
      segment(sn + 2);
    const previous = parse(withMap(10), null);
    const reused = parse(withMap(11), previous);
    expectSameAsFresh(reused, parse(withMap(11), null));
    expect(reused.fragments[0].rawProgramDateTime).to.equal(
      '2024-01-01T00:00:11.000Z',
    );
    expect(reused.fragments[0].initSegment).to.equal(
      previous.fragments[0].initSegment,
    );
    expect(reused.fragments[1]).to.equal(previous.fragments[2]);
    expect(reused.fragments[2]).to.not.equal(previous.fragments[3]);
  });

  it('keeps the segments after a map that follows a discontinuity', function () {
    const previous = parse(
      header(10, '#EXT-X-MAP:URI="init-0.mp4"\n') +
        segment(10) +
        segment(11, '#EXT-X-DISCONTINUITY\n#EXT-X-MAP:URI="init-1.mp4"\n') +
        segment(12),
      null,
    );
    const text =
      header(
        11,
        '#EXT-X-DISCONTINUITY-SEQUENCE:1\n#EXT-X-MAP:URI="init-1.mp4"\n',
      ) +
      segment(11) +
      segment(12) +
      segment(13);
    const reused = parse(text, previous);
    expectSameAsFresh(reused, parse(text, null));
    expect(reused.fragments[0]).to.equal(previous.fragments[1]);
    expect(reused.fragments[1]).to.equal(previous.fragments[2]);
    expect(reused.fragments[2].initSegment).to.equal(
      previous.fragments[1].initSegment,
    );
  });

  it('moves kept fragments to the URL the playlist was reloaded from', function () {
    const text = header(10) + segment(10) + segment(11);
    const previous = parse(text, null, `${URL}?t=1`);
    const reused = parse(text, previous, `${URL}?t=2`);
    expect(reused.fragments[0]).to.equal(previous.fragments[0]);
    expect(reused.fragments[0].baseurl).to.equal(`${URL}?t=2`);
    expect(reused.fragments[1].baseurl).to.equal(`${URL}?t=2`);
  });

  it('leaves the previous details alone when nothing is kept and the URL changed', function () {
    const previous = parse(
      header(10) + segment(10) + segment(11),
      null,
      `${URL}?t=1`,
    );
    const text = header(11) + segment(11, '', '?t=2') + segment(12, '', '?t=2');
    const reused = parse(text, previous, `${URL}?t=2`);
    expectSameAsFresh(reused, parse(text, null, `${URL}?t=2`));
    expect(reused.fragments[0].baseurl).to.equal(`${URL}?t=2`);
    expect(previous.fragments[0].baseurl).to.equal(`${URL}?t=1`);
  });
});
