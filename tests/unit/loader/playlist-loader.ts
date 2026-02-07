import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import LevelController from '../../../src/controller/level-controller';
import { Events } from '../../../src/events';
import { LoadStats } from '../../../src/loader/load-stats';
import PlaylistLoader from '../../../src/loader/playlist-loader';
import HlsMock from '../../mocks/hls.mock';
import { multivariantPlaylistWithPathways } from '../controller/level-controller';
import type Hls from '../../../src/hls';
import type {
  LoaderCallbacks,
  LoaderConfiguration,
  PlaylistLoaderContext,
} from '../../../src/types/loader';

use(sinonChai);

describe('PlaylistLoader tests', function () {
  const sandbox = sinon.createSandbox();
  let hls: Hls; // HlsMock
  let playlistLoader: PlaylistLoader;
  let levelController: LevelController; // level-controller finishes manifest parsing
  let response;

  beforeEach(function () {
    hls = new HlsMock({}) as unknown as Hls;
    playlistLoader = new PlaylistLoader(hls);
    levelController = new LevelController(hls, null);
  });

  afterEach(function () {
    sandbox.restore();
    playlistLoader.destroy();
    levelController.destroy();
  });

  it('handles multivariant playlist loading and parsing (with level-controller) on MANIFEST_LOADING', function () {
    return new Promise<void>((resolve, reject) => {
      const stats = new LoadStats();
      const networkDetails = new Response('ok');
      sinon.stub(playlistLoader as any, 'createInternalLoader').returns({
        load: (
          context: PlaylistLoaderContext,
          config: LoaderConfiguration,
          callback: LoaderCallbacks<PlaylistLoaderContext>,
        ) => {
          expect(context.type).eq('manifest');
          Promise.resolve()
            .then(() => {
              response = { data: multivariantPlaylistWithPathways };
              callback.onSuccess(response, stats, context, networkDetails);
            })
            .catch(reject);
        },
        abort: () => {},
      });

      hls.on(Events.MANIFEST_LOADED, (type, data) => {
        expect(data).includes({
          url: 'http://example.cpm/program.m3u8',
          stats,
          networkDetails,
          captions: undefined,
          sessionData: null,
          sessionKeys: null,
          startTimeOffset: null,
          variableList: null,
        });
        expect(data.levels, 'levels.length').to.have.lengthOf(30);
        expect(data.audioTracks, 'audioTracks.length').to.have.lengthOf(6);
        expect(data.subtitles, 'subtitles.length').to.have.lengthOf(6);
        expect(data.contentSteering, 'contentSteering').to.includes({
          uri: 'http://example.com/manifest.json',
          pathwayId: 'Bar',
        });
        expect(stats.parsing.start, 'parsing.start').to.be.greaterThan(0);
        expect(stats.parsing.end, 'parsing.end').to.be.greaterThanOrEqual(
          stats.parsing.start,
        );

        resolve();
      });

      hls.trigger(Events.MANIFEST_LOADING, {
        url: 'http://example.cpm/program.m3u8',
      });
    });
  });
});
