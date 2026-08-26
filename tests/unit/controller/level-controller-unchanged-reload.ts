import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import LevelController from '../../../src/controller/level-controller';
import { ErrorDetails } from '../../../src/errors';
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

use(sinonChai);

// A reload that liveMaxUnchangedPlaylistRefresh drops never reaches the
// merge, but the stream controller installs it anyway. Its fragments are the
// previous playlist's, so the timeline they carry has to be the one that
// playlist had.

type ParseWithPrevious = (
  playlist: string,
  baseurl: string,
  id: number,
  type: PlaylistLevelType,
  levelUrlId: number,
  multivariantVariableList: null,
  previous: LevelDetails | null,
) => LevelDetails;

describe('LevelController dropping an unchanged reload of reused fragments', function () {
  const sandbox = sinon.createSandbox();
  const url = 'http://example.com/live/playlist.m3u8';
  let hls: HlsMock;
  let levelController: LevelController;

  const playlist = `#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:10
#EXTINF:6.000,
segment-10.mp4
#EXTINF:6.000,
segment-11.mp4
#EXTINF:6.000,
segment-12.mp4
`;
  const parse = (previous: LevelDetails | null) =>
    (M3U8Parser.parseLevelPlaylist as unknown as ParseWithPrevious)(
      playlist,
      url,
      0,
      PlaylistLevelType.MAIN,
      0,
      null,
      previous,
    );

  beforeEach(function () {
    const MediaSource = getMediaSource();
    hls = new HlsMock({ liveMaxUnchangedPlaylistRefresh: 1 });
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
  }

  it('leaves the timeline the previous playlist had', function () {
    const previous = parse(null);
    loaded(previous);
    addSliding(previous, 100);
    const starts = previous.fragments.map((f) => f.start);

    const reload = parse(previous);
    expect(reload.fragments).to.have.lengthOf(3);
    reload.fragments.forEach((frag, i) => {
      expect(frag, `fragment ${i}`).to.equal(previous.fragments[i]);
    });
    loaded(reload, previous);

    expect(hls.trigger).to.have.been.calledWith(
      Events.ERROR,
      sinon.match({ details: ErrorDetails.PLAYLIST_UNCHANGED_ERROR }),
    );
    expect(reload.fragments.map((f) => f.start)).to.deep.equal(starts);
    expect(reload.fragments.map((f) => f.playlistOffset)).to.deep.equal([
      0, 6, 12,
    ]);
    expect(reload.fragments.map((f) => f.duration)).to.deep.equal([6, 6, 6]);
  });
});
