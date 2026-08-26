import { expect } from 'chai';
import sinon from 'sinon';
import LevelController from '../../../src/controller/level-controller';
import { Events } from '../../../src/events';
import { LoadStats } from '../../../src/loader/load-stats';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { Level } from '../../../src/types/level';
import { PlaylistLevelType } from '../../../src/types/loader';
import { addSliding } from '../../../src/utils/level-helper';
import { getMediaSource } from '../../../src/utils/mediasource-helper';
import HlsMock from '../../mocks/hls.mock';
import { parsedLevel } from '../../mocks/mock-level';
import type { LevelDetails } from '../../../src/loader/level-details';
import type { LevelLoadedData } from '../../../src/types/events';

// The controller's pre-merge timelineOffset block and mergeDetails run on
// every live reload. With fragment reuse the fragments they touch are the
// previous ones, so a reuse-aligned reload has to land exactly where master
// lands a fresh one, whether the configured offset changed or not.

type ParseWithPrevious = (
  playlist: string,
  baseurl: string,
  id: number,
  type: PlaylistLevelType,
  levelUrlId: number,
  multivariantVariableList: null,
  previous: LevelDetails | null,
) => LevelDetails;

describe('LevelController with reused playlist fragments', function () {
  const sandbox = sinon.createSandbox();
  const url = 'http://example.com/live/playlist.m3u8';
  let hls: HlsMock;
  let levelController: LevelController;

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

  const lowLatency = (startSN: number) => {
    let out = `#EXTM3U
#EXT-X-VERSION:9
#EXT-X-TARGETDURATION:4
#EXT-X-PART-INF:PART-TARGET=1.0
#EXT-X-MEDIA-SEQUENCE:${startSN}
`;
    for (let i = 0; i < 4; i++) {
      out += `#EXTINF:4.000,\nsegment-${startSN + i}.mp4\n`;
    }
    out +=
      '#EXT-X-PART:DURATION=1.00000,URI="part-a.mp4",INDEPENDENT=YES\n' +
      '#EXT-X-PRELOAD-HINT:TYPE=PART,URI="part-b.mp4"\n';
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

  beforeEach(function () {
    const MediaSource = getMediaSource();
    hls = new HlsMock({});
    levelController = new LevelController(hls as any, null);
    (levelController as any).onParsedComplete = () => {};
    hls.levelController = levelController as any;
    // @ts-ignore
    sandbox.stub(MediaSource, 'isTypeSupported').returns(true);
  });

  afterEach(function () {
    sandbox.restore();
    levelController.destroy();
  });

  function loaded(details: LevelDetails, previous?: LevelDetails) {
    const level = new Level(parsedLevel({ bitrate: 100000, url }));
    const data: LevelLoadedData = {
      details,
      id: 0,
      level: 0,
      levelInfo: level,
      networkDetails: null,
      stats: new LoadStats(),
      deliveryDirectives: null,
    };
    (levelController as any).playlistLoaded(0, data, previous);
    return details.fragments.map((f) => f.start);
  }

  function previousWithSliding(offset: number) {
    hls.config.timelineOffset = offset;
    const previous = parse(playlist(10), null);
    loaded(previous);
    // Live sliding accumulated by earlier reloads.
    addSliding(previous, 100);
    return previous;
  }

  it('keeps the carried timeline when the offset is unchanged', function () {
    const previous = previousWithSliding(0);
    const fresh = parse(playlist(11), null);
    const expected = loaded(fresh, previous);
    const reusedPrevious = previousWithSliding(0);
    const reused = parse(playlist(11), reusedPrevious);
    expect(loaded(reused, reusedPrevious)).to.deep.equal(expected);
    expect(reused.fragments[0].start).to.equal(106);
  });

  it('lands a changed offset where a fresh reload lands', function () {
    const previous = previousWithSliding(0);
    hls.config.timelineOffset = 10;
    const fresh = parse(playlist(11), null);
    const expected = loaded(fresh, previous);
    const reusedPrevious = previousWithSliding(0);
    hls.config.timelineOffset = 10;
    const reused = parse(playlist(11), reusedPrevious);
    expect(loaded(reused, reusedPrevious)).to.deep.equal(expected);
  });

  it('applies a configured offset to a fresh live reload as master does', function () {
    const previous = previousWithSliding(0);
    hls.config.timelineOffset = 10;
    const fresh = parse(playlist(11), null);
    expect(loaded(fresh, previous)).to.deep.equal([116, 122, 128, 134, 140]);
  });

  [0, 10].forEach((offset) => {
    it(`places the fragment hint where a fresh reload places it (timelineOffset ${offset})`, function () {
      hls.config.timelineOffset = offset;
      const freshPrevious = M3U8Parser.parseLevelPlaylist(
        lowLatency(10),
        url,
        0,
        PlaylistLevelType.MAIN,
        0,
        null,
      );
      loaded(freshPrevious);
      const fresh = M3U8Parser.parseLevelPlaylist(
        lowLatency(11),
        url,
        0,
        PlaylistLevelType.MAIN,
        0,
        null,
      );
      loaded(fresh, freshPrevious);
      const reusedPrevious = parse(lowLatency(10), null);
      loaded(reusedPrevious);
      const reused = parse(lowLatency(11), reusedPrevious);
      loaded(reused, reusedPrevious);
      // The reload kept fragments (its first segment is the previous one).
      expect(reused.fragments[0]).to.equal(reusedPrevious.fragments[1]);
      expect(reused.fragmentHint?.start).to.equal(fresh.fragmentHint?.start);
      expect(reused.edge).to.equal(fresh.edge);
    });
  });
});
