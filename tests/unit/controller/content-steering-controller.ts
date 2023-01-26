import ContentSteeringController from '../../../src/controller/content-steering-controller';
import { Events } from '../../../src/events';
import { LoadStats } from '../../../src/loader/load-stats';
import HlsMock from '../../mocks/hls.mock';
import { MockXhr } from '../../mocks/loader.mock';
import { multivariantPlaylistWithPathways } from './level-controller';
import M3U8Parser, {
  ParsedMultivariantPlaylist,
} from '../../../src/loader/m3u8-parser';
import LevelController from '../../../src/controller/level-controller';
import AudioTrackController from '../../../src/controller/audio-track-controller';
import SubtitleTrackController from '../../../src/controller/subtitle-track-controller';
import type {
  ManifestLoadedData,
  ManifestParsedData,
} from '../../../src/types/events';
import type { Level } from '../../../src/types/level';
import type { MediaPlaylist } from '../../../src/types/media-playlist';

import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';

chai.use(sinonChai);
const expect = chai.expect;

type ConentSteeringControllerTestable = Omit<
  ContentSteeringController,
  | 'enabled'
  | 'timeToLoad'
  | 'updated'
  | 'uri'
  | 'pathwayId'
  | 'loader'
  | 'reloadTimer'
  | 'levels'
  | 'audioTracks'
  | 'subtitleTracks'
  | 'onManifestLoading'
  | 'onManifestLoaded'
> & {
  enabled: boolean;
  timeToLoad: number;
  updated: number;
  uri: string | null;
  pathwayId: string;
  loader: MockXhr;
  reloadTimer: number;
  levels: Level[] | null;
  audioTracks: MediaPlaylist[] | null;
  subtitleTracks: MediaPlaylist[] | null;
  onManifestLoading: () => void;
  onManifestLoaded: (event: string, data: Partial<ManifestLoadedData>) => void;
};

describe('ContentSteeringController', function () {
  const sandbox = sinon.createSandbox();
  let hls: HlsMock;
  let contentSteeringController: ConentSteeringControllerTestable;

  beforeEach(function () {
    hls = new HlsMock({
      loader: MockXhr,
    });
    contentSteeringController = new ContentSteeringController(
      hls as any
    ) as unknown as ConentSteeringControllerTestable;
    sandbox.stub(MediaSource, 'isTypeSupported').returns(true);
  });

  afterEach(function () {
    sandbox.restore();
    contentSteeringController.destroy();
  });

  describe('HLS.js integration', function () {
    it('resets on MANIFEST_LOADING', function () {
      contentSteeringController.enabled = false;
      contentSteeringController.timeToLoad = 500;
      contentSteeringController.updated = 3;
      contentSteeringController.uri = 'http://example.com/manifest.json';
      contentSteeringController.pathwayId = 'pathway-2';
      contentSteeringController.onManifestLoading();
      expect(contentSteeringController.enabled).to.be.true;
      expect(contentSteeringController.timeToLoad).to.equal(300);
      expect(contentSteeringController.updated).to.equal(0);
      expect(contentSteeringController.uri).to.be.null;
      expect(contentSteeringController.pathwayId).to.equal('.');
    });

    it('accepts contentSteering options on MANIFEST_LOADED', function () {
      contentSteeringController.onManifestLoaded(Events.MANIFEST_LOADED, {
        contentSteering: {
          uri: 'http://example.com/manifest.json',
          pathwayId: 'pathway-2',
        },
      });
      expect(contentSteeringController.uri).to.equal(
        'http://example.com/manifest.json'
      );
      expect(contentSteeringController.pathwayId).to.equal('pathway-2');
    });

    it('implements startLoad', function () {
      expect(contentSteeringController.startLoad).to.be.a('function');
      contentSteeringController.onManifestLoaded(Events.MANIFEST_LOADED, {
        contentSteering: {
          uri: 'http://example.com/manifest.json',
          pathwayId: 'pathway-2',
        },
      });
      contentSteeringController.stopLoad();
      expect(contentSteeringController).to.have.property('loader').that.is.null;
      contentSteeringController.startLoad();
      expect(contentSteeringController).to.have.property('loader').that.is.not
        .null;
    });

    it('implements stopLoad', function () {
      contentSteeringController.onManifestLoaded(Events.MANIFEST_LOADED, {
        contentSteering: {
          uri: 'http://example.com/manifest.json',
          pathwayId: 'pathway-2',
        },
      });
      expect(contentSteeringController.stopLoad).to.be.a('function');
      contentSteeringController.stopLoad();
      expect(contentSteeringController).to.have.property('loader').that.is.null;
    });

    it('implements destroy', function () {
      expect(contentSteeringController.destroy).to.be.a('function');
      contentSteeringController.destroy();
      expect(contentSteeringController).to.have.property('hls').that.is.null;
    });
  });

  describe('Steering Manifest', function () {
    it('loads the steering manifest', function () {
      contentSteeringController.onManifestLoaded(Events.MANIFEST_LOADED, {
        contentSteering: {
          uri: 'http://example.com/manifest.json',
          pathwayId: 'pathway-2',
        },
      });
      expect(contentSteeringController.loader)
        .to.have.property('context')
        .that.deep.includes(
          {
            url: 'http://example.com/manifest.json?_HLS_pathway=pathway-2&_HLS_throughput=500000',
          },
          JSON.stringify(contentSteeringController.loader.context)
        );
    });

    it('schedules a refresh', function () {
      contentSteeringController.onManifestLoaded(Events.MANIFEST_LOADED, {
        contentSteering: {
          uri: 'http://example.com/manifest.json',
          pathwayId: 'pathway-2',
        },
      });
      expect(contentSteeringController.uri).to.equal(
        'http://example.com/manifest.json'
      );
      expect(contentSteeringController.updated).to.equal(0);
      expect(contentSteeringController.timeToLoad).to.equal(300);
      expect(contentSteeringController.reloadTimer).to.equal(-1);
      contentSteeringController.loader.callbacks?.onSuccess(
        {
          data: {
            VERSION: 1,
            TTL: 100,
            'RELOAD-URI': 'http://beta.example2.com/manifest.json',
          },
        } as any,
        new LoadStats(),
        contentSteeringController.loader.context as any,
        null
      );
      expect(contentSteeringController.uri, 'updates the uri').to.equal(
        'http://beta.example2.com/manifest.json'
      );
      expect(contentSteeringController.updated).to.be.gt(0);
      expect(
        contentSteeringController.timeToLoad,
        'updates the timeToLoad'
      ).to.equal(100);
      expect(contentSteeringController.reloadTimer).to.be.gt(-1);
    });
  });

  describe('Pathway Gouping', function () {
    let levelController;
    let audioTrackController;
    let subtitleTrackController;
    let parsedMultivariant: ParsedMultivariantPlaylist;
    let manifestParsedData: ManifestParsedData;

    beforeEach(function () {
      parsedMultivariant = M3U8Parser.parseMasterPlaylist(
        multivariantPlaylistWithPathways,
        'http://example.com/main.m3u8'
      );
      const parsedMediaOptions = M3U8Parser.parseMasterPlaylistMedia(
        multivariantPlaylistWithPathways,
        'http://example.com/main.m3u8',
        parsedMultivariant
      );
      const manifestLoadedData = {
        contentSteering: parsedMultivariant.contentSteering,
        levels: parsedMultivariant.levels,
        audioTracks: parsedMediaOptions.AUDIO,
        subtitles: parsedMediaOptions.SUBTITLES,
      };
      levelController = hls.levelController = new LevelController(
        hls as any,
        contentSteeringController as any
      );
      audioTrackController = hls.audioTrackController =
        new AudioTrackController(hls as any);
      subtitleTrackController = hls.subtitleTrackController =
        new SubtitleTrackController(hls as any);
      hls.nextAutoLevel = 0;
      contentSteeringController.onManifestLoaded(
        Events.MANIFEST_LOADED,
        manifestLoadedData
      );
      levelController.onManifestLoaded(
        Events.MANIFEST_LOADED,
        manifestLoadedData
      );
      const { payload } = hls.getEventData(0) as {
        name: string;
        payload: ManifestParsedData;
      };
      manifestParsedData = payload;
    });

    afterEach(function () {
      levelController.destroy();
      audioTrackController.destroy();
      subtitleTrackController.destroy();
    });

    it('Filteres Variants (Levels) by initial Pathway', function () {
      expect(manifestParsedData)
        .to.have.property('levels')
        .that.has.lengthOf(10);
      expect(manifestParsedData.firstLevel).to.equal(0);
      expect(manifestParsedData.levels[0].pathwayId).to.equal('Bar');
      expect(levelController.levels, 'LevelController levels').to.have.lengthOf(
        10
      );
    });

    it('Filteres Variants (Levels) by Pathway Priority by emitting LEVELS_UPDATED', function () {
      expect(manifestParsedData.levels[0].pathwayId).to.equal('Bar');
      contentSteeringController.loader.callbacks?.onSuccess(
        {
          data: {
            VERSION: 1,
            TTL: 300,
            'PATHWAY-PRIORITY': ['Baz', 'Foo', 'Bar'],
          },
        } as any,
        new LoadStats(),
        contentSteeringController.loader.context as any,
        null
      );
      expect(hls.trigger.callCount, 'events triggered').to.equal(6);
      expect(hls.getEventData(0).name).to.equal(Events.MANIFEST_PARSED);
      const parsedEvent = hls.getEventData(0);
      expect(parsedEvent.payload)
        .to.have.property('audioTracks')
        .that.has.lengthOf(6, 'MANIFEST_PARSED audioTracks');

      expect(hls.getEventData(1).name).to.equal(Events.LEVELS_UPDATED);
      const updatedEvent = hls.getEventData(1);
      expect(updatedEvent.payload)
        .to.have.property('levels')
        .that.has.lengthOf(10, 'LEVELS_UPDATED levels');
      expect(updatedEvent.payload.levels[0].pathwayId).to.equal('Baz');

      expect(hls.getEventData(2).name).to.equal(Events.LEVEL_SWITCHING);
      const switchingEvent = hls.getEventData(2);
      expect(switchingEvent.payload).to.nested.include({
        'attrs.PATHWAY-ID': 'Baz',
      });
      expect(switchingEvent.payload).to.deep.include({
        audioGroupIds: ['AAC-baz'],
        textGroupIds: ['subs-baz'],
        uri: 'http://www.baz.com/tier6.m3u8',
      });

      expect(hls.getEventData(3).name).to.equal(Events.AUDIO_TRACKS_UPDATED);
      expect(hls.getEventData(4).name).to.equal(Events.AUDIO_TRACK_SWITCHING);
      expect(hls.getEventData(5).name).to.equal(Events.SUBTITLE_TRACKS_UPDATED);
      expect(levelController.levels, 'LevelController levels').to.have.lengthOf(
        10
      );
      expect(levelController.levels[0].uri).to.equal(
        'http://www.baz.com/tier6.m3u8'
      );
      expect(
        contentSteeringController.levels,
        'Content Steering variants'
      ).to.have.lengthOf(30);
      expect(
        contentSteeringController.audioTracks,
        'Content Steering audio tracks'
      ).to.have.lengthOf(6);
      expect(
        contentSteeringController.subtitleTracks,
        'Content Steering subtitle tracks'
      ).to.have.lengthOf(6);
    });

    describe('Pathway Cloning', function () {
      it('Clones the Base Pathway', function () {
        expect(
          contentSteeringController.levels,
          'Content Steering variants'
        ).to.have.lengthOf(30);
        contentSteeringController.loader.callbacks?.onSuccess(
          {
            data: {
              VERSION: 1,
              TTL: 300,
              'PATHWAY-PRIORITY': ['Buzz', 'Foo', 'Bar', 'Baz'],
              'PATHWAY-CLONES': [
                {
                  ID: 'Buzz',
                  'BASE-ID': 'Foo',
                  'URI-REPLACEMENT': {
                    HOST: 'www.buzz.com',
                  },
                },
              ],
            },
          } as any,
          new LoadStats(),
          contentSteeringController.loader.context as any,
          null
        );
        expect(
          contentSteeringController.levels,
          'Content Steering variants'
        ).to.have.lengthOf(40);
        expect(
          contentSteeringController.audioTracks,
          'Content Steering audio tracks'
        ).to.have.lengthOf(8);
        expect(
          contentSteeringController.subtitleTracks,
          'Content Steering subtitle tracks'
        ).to.have.lengthOf(8);
        expect(hls.getEventData(1).name).to.equal(Events.LEVELS_UPDATED);
        const updatedEvent = hls.getEventData(1);
        expect(updatedEvent.payload)
          .to.have.property('levels')
          .that.has.lengthOf(10, 'LEVELS_UPDATED levels');
        expect(updatedEvent.payload.levels[0].pathwayId).to.equal('Buzz');

        expect(hls.getEventData(2).name).to.equal(Events.LEVEL_SWITCHING);
        const switchingEvent = hls.getEventData(2);
        expect(switchingEvent.payload).to.nested.include({
          'attrs.PATHWAY-ID': 'Buzz',
        });
        expect(switchingEvent.payload).to.deep.include({
          audioGroupIds: ['AAC-foo_clone_Buzz'],
          textGroupIds: ['subs-foo_clone_Buzz'],
          uri: 'http://www.buzz.com/tier6.m3u8',
        });

        expect(hls.getEventData(3).name).to.equal(Events.AUDIO_TRACKS_UPDATED);
        expect(hls.getEventData(4).name).to.equal(Events.AUDIO_TRACK_SWITCHING);
        expect(hls.getEventData(5).name).to.equal(
          Events.SUBTITLE_TRACKS_UPDATED
        );

        expect(
          levelController.levels,
          'LevelController levels'
        ).to.have.lengthOf(10);
        expect(levelController.levels[0].uri).to.equal(
          'http://www.buzz.com/tier6.m3u8'
        );
      });

    });
  });
});
