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
  AudioTracksUpdatedData,
  LevelsUpdatedData,
  ManifestLoadedData,
  ManifestParsedData,
  SubtitleTracksUpdatedData,
} from '../../../src/types/events';
import type { Level } from '../../../src/types/level';
import type { MediaPlaylist } from '../../../src/types/media-playlist';
import type { SteeringManifest } from '../../../src/controller/content-steering-controller';
import type { LoaderResponse } from '../../../src/types/loader';

import sinon from 'sinon';
import chai from 'chai';
import sinonChai from 'sinon-chai';
import { getMediaSource } from '../../../src/utils/mediasource-helper';

chai.use(sinonChai);
const expect = chai.expect;

const MediaSource = getMediaSource();

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
    // @ts-ignore
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
      contentSteeringController.startLoad();
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
      loadSteeringManifest(
        {
          TTL: 100,
          'RELOAD-URI': 'http://beta.example2.com/manifest.json',
        },
        contentSteeringController
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

    it('filteres Variants (Levels) by initial Pathway', function () {
      expect(manifestParsedData)
        .to.have.property('levels')
        .that.has.lengthOf(10);
      expect(manifestParsedData.firstLevel).to.equal(0);
      expect(manifestParsedData.levels[0].pathwayId).to.equal('Bar');
      expect(levelController.levels, 'LevelController levels').to.have.lengthOf(
        10
      );
    });

    it('filteres Variants (Levels) by Pathway Priority by emitting LEVELS_UPDATED', function () {
      expect(manifestParsedData.levels[0].pathwayId).to.equal('Bar');
      loadSteeringManifest(
        {
          'PATHWAY-PRIORITY': ['Baz', 'Foo', 'Bar'],
        },
        contentSteeringController
      );
      expect(hls.trigger.callCount, 'events triggered').to.equal(7);
      expect(hls.getEventData(0).name).to.equal(Events.MANIFEST_PARSED);
      const parsedEvent = hls.getEventData(0);
      expect(parsedEvent.payload)
        .to.have.property('audioTracks')
        .that.has.lengthOf(6, 'MANIFEST_PARSED audioTracks');

      expect(hls.getEventData(1).name).to.equal(
        Events.STEERING_MANIFEST_LOADED
      );
      const steeringManifestLoadedEvent = hls.getEventData(1);
      expect(steeringManifestLoadedEvent.payload).to.have.property('url');
      expect(steeringManifestLoadedEvent.payload).to.have.property(
        'steeringManifest'
      );

      expect(hls.getEventData(2).name).to.equal(Events.LEVELS_UPDATED);
      const updatedEvent = hls.getEventData(2);
      const eventData = updatedEvent.payload as LevelsUpdatedData;
      expect(eventData)
        .to.have.property('levels')
        .that.has.lengthOf(10, 'LEVELS_UPDATED levels');
      expect(eventData.levels[0].pathwayId).to.equal('Baz');

      expect(hls.getEventData(3).name).to.equal(Events.LEVEL_SWITCHING);
      const switchingEvent = hls.getEventData(3);
      expect(switchingEvent.payload).to.nested.include({
        'attrs.PATHWAY-ID': 'Baz',
      });
      expect(switchingEvent.payload).to.deep.include({
        audioGroupIds: ['AAC-baz'],
        textGroupIds: ['subs-baz'],
        uri: 'http://www.baz.com/tier6.m3u8',
      });

      expect(hls.getEventData(4).name).to.equal(Events.AUDIO_TRACKS_UPDATED);
      expect(hls.getEventData(5).name).to.equal(Events.AUDIO_TRACK_SWITCHING);
      expect(hls.getEventData(6).name).to.equal(Events.SUBTITLE_TRACKS_UPDATED);
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
      it('clones the Base Pathway', function () {
        expect(
          contentSteeringController.levels,
          'Content Steering variants'
        ).to.have.lengthOf(30);
        loadSteeringManifest(
          {
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
          contentSteeringController
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

        expect(hls.getEventData(1).name).to.equal(
          Events.STEERING_MANIFEST_LOADED
        );
        const steeringManifestLoadedEvent = hls.getEventData(1);
        expect(steeringManifestLoadedEvent.payload).to.have.property('url');
        expect(steeringManifestLoadedEvent.payload).to.have.property(
          'steeringManifest'
        );

        expect(hls.getEventData(2).name).to.equal(Events.LEVELS_UPDATED);
        const updatedEvent = hls.getEventData(2);
        const eventData = updatedEvent.payload as LevelsUpdatedData;
        expect(eventData)
          .to.have.property('levels')
          .that.has.lengthOf(10, 'LEVELS_UPDATED levels');
        expect(eventData.levels[0].pathwayId).to.equal('Buzz');

        expect(hls.getEventData(3).name).to.equal(Events.LEVEL_SWITCHING);
        const switchingEvent = hls.getEventData(3);
        expect(switchingEvent.payload).to.nested.include({
          'attrs.PATHWAY-ID': 'Buzz',
        });
        expect(switchingEvent.payload).to.deep.include({
          audioGroupIds: ['AAC-foo_clone_Buzz'],
          textGroupIds: ['subs-foo_clone_Buzz'],
          uri: 'http://www.buzz.com/tier6.m3u8',
        });

        expect(hls.getEventData(4).name).to.equal(Events.AUDIO_TRACKS_UPDATED);
        expect(hls.getEventData(5).name).to.equal(Events.AUDIO_TRACK_SWITCHING);
        expect(hls.getEventData(6).name).to.equal(
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

      it('appends PARAMS to Rendition URIs in UTF-8 order, replacing existing param values in place', function () {
        contentSteeringController.levels?.forEach((level) => {
          level.url[0] += '?foo=bar';
        });
        expect(contentSteeringController.levels?.[0].uri).to.equal(
          'http://www.foo.com/tier6.m3u8?foo=bar'
        );
        loadSteeringManifest(
          {
            'PATHWAY-PRIORITY': ['Buzz', 'Foo', 'Bar', 'Baz'],
            'PATHWAY-CLONES': [
              {
                ID: 'Buzz',
                'BASE-ID': 'Foo',
                'URI-REPLACEMENT': {
                  PARAMS: {
                    foo: 'baz',
                    beta: 'test',
                    app: 'player',
                  },
                },
              },
            ],
          },
          contentSteeringController
        );

        expect(hls.getEventData(1).name).to.equal(
          Events.STEERING_MANIFEST_LOADED
        );
        const steeringManifestLoadedEvent = hls.getEventData(1);
        expect(steeringManifestLoadedEvent.payload).to.have.property('url');
        expect(steeringManifestLoadedEvent.payload).to.have.property(
          'steeringManifest'
        );

        expect(hls.getEventData(2).name).to.equal(Events.LEVELS_UPDATED);
        const updatedEvent = hls.getEventData(2);
        const eventData = updatedEvent.payload as LevelsUpdatedData;
        expect(eventData)
          .to.have.property('levels')
          .that.has.lengthOf(10, 'LEVELS_UPDATED levels');
        expect(eventData.levels[0].pathwayId).to.equal('Buzz');
        expect(eventData.levels[0].uri).to.equal(
          'http://www.foo.com/tier6.m3u8?foo=baz&app=player&beta=test'
        );
      });

      it('sets the URI of Variants with STABLE-VARIANT-ID to the corresponding key-value pair in PER-VARIANT-URIS', function () {
        loadSteeringManifest(
          {
            'PATHWAY-PRIORITY': ['Buzz', 'Foo', 'Bar', 'Baz'],
            'PATHWAY-CLONES': [
              {
                ID: 'Buzz',
                'BASE-ID': 'Foo',
                'URI-REPLACEMENT': {
                  'PER-VARIANT-URIS': {
                    foo1: 'http://www.buzz.com/1.m3u8?fallback=true',
                    foo2: 'http://www.buzz.com/2.m3u8?fallback=true',
                    foo3: 'http://www.buzz.com/3.m3u8?fallback=true',
                  },
                },
              },
            ],
          },
          contentSteeringController
        );

        expect(hls.getEventData(1).name).to.equal(
          Events.STEERING_MANIFEST_LOADED
        );
        const steeringManifestLoadedEvent = hls.getEventData(1);
        expect(steeringManifestLoadedEvent.payload).to.have.property('url');
        expect(steeringManifestLoadedEvent.payload).to.have.property(
          'steeringManifest'
        );

        expect(hls.getEventData(2).name).to.equal(Events.LEVELS_UPDATED);
        const updatedEvent = hls.getEventData(2);
        expect(updatedEvent.payload)
          .to.have.property('levels')
          .that.has.lengthOf(10, 'LEVELS_UPDATED levels');
        const eventData = updatedEvent.payload as LevelsUpdatedData;
        expect(eventData.levels[0].pathwayId).to.equal('Buzz');
        expect(eventData.levels[0].attrs['STABLE-VARIANT-ID']).to.equal('foo1');
        expect(eventData.levels[0].uri).to.equal(
          'http://www.buzz.com/1.m3u8?fallback=true'
        );
        expect(eventData.levels[1].attrs['STABLE-VARIANT-ID']).to.equal('foo2');
        expect(eventData.levels[1].uri).to.equal(
          'http://www.buzz.com/2.m3u8?fallback=true'
        );
        expect(eventData.levels[2].attrs['STABLE-VARIANT-ID']).to.equal('foo3');
        expect(eventData.levels[2].uri).to.equal(
          'http://www.buzz.com/3.m3u8?fallback=true'
        );
        expect(eventData.levels[3].attrs['STABLE-VARIANT-ID']).to.equal('foo4');
        expect(eventData.levels[3].uri).to.equal(
          'http://www.foo.com/tier10.m3u8'
        );
      });

      it('sets the URI of Renditions with STABLE-RENDITION-ID to the corresponding key-value pair in PER-RENDITION-URIS', function () {
        loadSteeringManifest(
          {
            'PATHWAY-PRIORITY': ['Buzz', 'Foo', 'Bar', 'Baz'],
            'PATHWAY-CLONES': [
              {
                ID: 'Buzz',
                'BASE-ID': 'Foo',
                'URI-REPLACEMENT': {
                  'PER-RENDITION-URIS': {
                    'audio-foo1':
                      'http://z.buzz.com/audio_aac.m3u8?fallback=true',
                    'audio-foo2':
                      'http://z.buzz.com/audio_ec3.m3u8?fallback=true',
                    'subs-foo1': 'http://z.buzz.com/subs-en.m3u8?fallback=true',
                    'subs-foo2': 'http://z.buzz.com/subs-it.m3u8?fallback=true',
                  },
                },
              },
            ],
          },
          contentSteeringController
        );
        expect(
          audioTrackController.tracks,
          'AudioTrackController tracks'
        ).to.have.lengthOf(8);
        expect(audioTrackController.tracks[6].attrs['PATHWAY-ID']).to.equal(
          'Buzz'
        );
        expect(
          audioTrackController.tracks[6].attrs['STABLE-RENDITION-ID']
        ).to.equal('audio-foo1');
        expect(audioTrackController.tracks[6].groupId).to.equal(
          'AAC-foo_clone_Buzz'
        );
        expect(audioTrackController.tracks[6].url).to.equal(
          'http://z.buzz.com/audio_aac.m3u8?fallback=true'
        );
        expect(audioTrackController.tracks[7].attrs['PATHWAY-ID']).to.equal(
          'Buzz'
        );
        expect(
          audioTrackController.tracks[7].attrs['STABLE-RENDITION-ID']
        ).to.equal('audio-foo2');
        expect(audioTrackController.tracks[7].groupId).to.equal(
          'EC3-foo_clone_Buzz'
        );
        expect(audioTrackController.tracks[7].url).to.equal(
          'http://z.buzz.com/audio_ec3.m3u8?fallback=true'
        );

        expect(hls.getEventData(4).name).to.equal(Events.AUDIO_TRACKS_UPDATED);
        const audioTracksEvent = hls.getEventData(4);
        const eventData = audioTracksEvent.payload as AudioTracksUpdatedData;
        expect(eventData)
          .to.have.property('audioTracks')
          .that.has.lengthOf(1, 'AUDIO_TRACKS_UPDATED audioTracks');
        expect(eventData.audioTracks[0].attrs['PATHWAY-ID']).to.equal('Buzz');
        expect(eventData.audioTracks[0].attrs['STABLE-RENDITION-ID']).to.equal(
          'audio-foo1'
        );
        expect(eventData.audioTracks[0].url).to.equal(
          'http://z.buzz.com/audio_aac.m3u8?fallback=true'
        );

        expect(
          subtitleTrackController.tracks,
          'SubtitleTrackController tracks'
        ).to.have.lengthOf(8);
        expect(hls.getEventData(6).name).to.equal(
          Events.SUBTITLE_TRACKS_UPDATED
        );
        const subtitleTracksEvent = hls.getEventData(6);
        const subsEventData =
          subtitleTracksEvent.payload as SubtitleTracksUpdatedData;
        expect(subsEventData)
          .to.have.property('subtitleTracks')
          .that.has.lengthOf(2, 'SUBTITLE_TRACKS_UPDATED subtitleTracks');
        expect(subsEventData.subtitleTracks[0].attrs['PATHWAY-ID']).to.equal(
          'Buzz'
        );
        expect(
          subsEventData.subtitleTracks[0].attrs['STABLE-RENDITION-ID']
        ).to.equal('subs-foo1');
        expect(subsEventData.subtitleTracks[0].url).to.equal(
          'http://z.buzz.com/subs-en.m3u8?fallback=true'
        );
        expect(subsEventData.subtitleTracks[1].attrs['PATHWAY-ID']).to.equal(
          'Buzz'
        );
        expect(
          subsEventData.subtitleTracks[1].attrs['STABLE-RENDITION-ID']
        ).to.equal('subs-foo2');
        expect(subsEventData.subtitleTracks[1].url).to.equal(
          'http://z.buzz.com/subs-it.m3u8?fallback=true'
        );
      });

      it('clones other pathway clones that appear ealier in PATHWAY-CLONES array', function () {
        loadSteeringManifest(
          {
            'PATHWAY-PRIORITY': ['Bear', 'Foo', 'Bar', 'Baz', 'Buzz'],
            'PATHWAY-CLONES': [
              {
                ID: 'Buzz',
                'BASE-ID': 'Foo',
                'URI-REPLACEMENT': {
                  HOST: 'www.buzz.com',
                  PARAMS: {
                    cloned: 'buzz',
                  },
                  'PER-VARIANT-URIS': {
                    foo2: 'http://www.buzz.com/2.m3u8?fallback=true',
                  },
                },
              },
              {
                ID: 'Bear',
                'BASE-ID': 'Buzz',
                'URI-REPLACEMENT': {
                  HOST: 'www.bear.com',
                },
              },
            ],
          },
          contentSteeringController
        );

        expect(hls.getEventData(1).name).to.equal(
          Events.STEERING_MANIFEST_LOADED
        );
        const steeringManifestLoadedEvent = hls.getEventData(1);
        expect(steeringManifestLoadedEvent.payload).to.have.property('url');
        expect(steeringManifestLoadedEvent.payload).to.have.property(
          'steeringManifest'
        );

        expect(hls.getEventData(2).name).to.equal(Events.LEVELS_UPDATED);
        const updatedEvent = hls.getEventData(2);
        expect(updatedEvent.payload)
          .to.have.property('levels')
          .that.has.lengthOf(10, 'LEVELS_UPDATED levels');
        const eventData = updatedEvent.payload as LevelsUpdatedData;
        expect(eventData.levels[0].pathwayId).to.equal('Bear');
        expect(eventData.levels[0].uri).to.equal(
          'http://www.bear.com/tier6.m3u8?cloned=buzz'
        );
        expect(eventData.levels[1].attrs['STABLE-VARIANT-ID']).to.equal('foo2');
        expect(eventData.levels[1].uri).to.equal(
          'http://www.bear.com/2.m3u8?fallback=true&cloned=buzz'
        );

        expect(hls.getEventData(4).name).to.equal(Events.AUDIO_TRACKS_UPDATED);
        const audioTracksEvent = hls.getEventData(4);
        const audioEventData =
          audioTracksEvent.payload as AudioTracksUpdatedData;
        expect(audioEventData.audioTracks[0].attrs['PATHWAY-ID']).to.equal(
          'Bear'
        );
        expect(audioEventData.audioTracks[0].url).to.equal(
          'http://www.bear.com/audio_aac.m3u8?cloned=buzz'
        );

        expect(hls.getEventData(6).name).to.equal(
          Events.SUBTITLE_TRACKS_UPDATED
        );
        const subtitleTracksEvent = hls.getEventData(6);
        const subsEventData =
          subtitleTracksEvent.payload as SubtitleTracksUpdatedData;
        expect(subsEventData.subtitleTracks[0].attrs['PATHWAY-ID']).to.equal(
          'Bear'
        );
        expect(subsEventData.subtitleTracks[0].url).to.equal(
          'http://www.bear.com/subs-en.m3u8?cloned=buzz'
        );
      });

      it('ignores empty HOST', function () {
        loadSteeringManifest(
          {
            'PATHWAY-PRIORITY': ['Buzz', 'Foo', 'Bar', 'Baz'],
            'PATHWAY-CLONES': [
              {
                ID: 'Buzz',
                'BASE-ID': 'Foo',
                'URI-REPLACEMENT': {
                  HOST: '',
                },
              },
            ],
          },
          contentSteeringController
        );

        expect(hls.getEventData(1).name).to.equal(
          Events.STEERING_MANIFEST_LOADED
        );
        const steeringManifestLoadedEvent = hls.getEventData(1);
        expect(steeringManifestLoadedEvent.payload).to.have.property('url');
        expect(steeringManifestLoadedEvent.payload).to.have.property(
          'steeringManifest'
        );

        expect(hls.getEventData(2).name).to.equal(Events.LEVELS_UPDATED);
        const updatedEvent = hls.getEventData(2);
        const eventData = updatedEvent.payload as LevelsUpdatedData;
        expect(eventData.levels[0].pathwayId).to.equal('Buzz');
        expect(eventData.levels[0].uri).to.equal(
          'http://www.foo.com/tier6.m3u8'
        );
      });

      it('ignores empty PARAM names', function () {
        loadSteeringManifest(
          {
            'PATHWAY-PRIORITY': ['Buzz', 'Foo', 'Bar', 'Baz'],
            'PATHWAY-CLONES': [
              {
                ID: 'Buzz',
                'BASE-ID': 'Foo',
                'URI-REPLACEMENT': {
                  PARAMS: {
                    'not-empty': 'ok',
                    '': 'not-ok',
                  },
                },
              },
            ],
          },
          contentSteeringController
        );

        expect(hls.getEventData(1).name).to.equal(
          Events.STEERING_MANIFEST_LOADED
        );
        const steeringManifestLoadedEvent = hls.getEventData(1);
        expect(steeringManifestLoadedEvent.payload).to.have.property('url');
        expect(steeringManifestLoadedEvent.payload).to.have.property(
          'steeringManifest'
        );

        expect(hls.getEventData(2).name).to.equal(Events.LEVELS_UPDATED);
        const updatedEvent = hls.getEventData(2);
        const eventData = updatedEvent.payload as LevelsUpdatedData;
        expect(eventData.levels[0].pathwayId).to.equal('Buzz');
        expect(eventData.levels[0].uri).to.equal(
          'http://www.foo.com/tier6.m3u8?not-empty=ok'
        );
      });

      it('ignores missing Pathway BASE-IDs', function () {
        loadSteeringManifest(
          {
            'PATHWAY-PRIORITY': ['Buzz', 'Foo', 'Bar', 'Baz'],
            'PATHWAY-CLONES': [
              {
                ID: 'Buzz',
                'BASE-ID': 'Not-Found',
                'URI-REPLACEMENT': {
                  HOST: 'www.buzz.com',
                },
              },
            ],
          },
          contentSteeringController
        );
        expect(
          contentSteeringController.levels,
          'Content Steering variants'
        ).to.have.lengthOf(30);

        expect(hls.getEventData(1).name).to.equal(
          Events.STEERING_MANIFEST_LOADED
        );
        const steeringManifestLoadedEvent = hls.getEventData(1);
        expect(steeringManifestLoadedEvent.payload).to.have.property('url');
        expect(steeringManifestLoadedEvent.payload).to.have.property(
          'steeringManifest'
        );

        expect(hls.getEventData(2).name).to.equal(Events.LEVELS_UPDATED);
        const updatedEvent = hls.getEventData(2);
        const eventData = updatedEvent.payload as LevelsUpdatedData;
        expect(eventData.levels[0].pathwayId).to.equal('Foo');
        expect(eventData.levels[0].uri).to.equal(
          'http://www.foo.com/tier6.m3u8'
        );
      });

      it('only clones Pathway Clones with the same ID once', function () {
        loadSteeringManifest(
          {
            'PATHWAY-PRIORITY': ['Buzz', 'Foo', 'Bar', 'Baz'],
            'PATHWAY-CLONES': [
              {
                ID: 'Buzz',
                'BASE-ID': 'Foo',
                'URI-REPLACEMENT': {
                  HOST: 'www.buzz-1.com',
                },
              },
              {
                ID: 'Buzz',
                'BASE-ID': 'Baz',
                'URI-REPLACEMENT': {
                  HOST: 'www.buzz-2.com',
                },
              },
              {
                ID: 'Foo',
                'BASE-ID': 'Baz',
                'URI-REPLACEMENT': {
                  HOST: 'www.foo-2.com',
                },
              },
            ],
          },
          contentSteeringController
        );
        loadSteeringManifest(
          {
            'PATHWAY-PRIORITY': ['Buzz', 'Foo', 'Bar', 'Baz'],
            'PATHWAY-CLONES': [
              {
                ID: 'Buzz',
                'BASE-ID': 'Bar',
                'URI-REPLACEMENT': {
                  HOST: 'www.buzz-3.com',
                },
              },
            ],
          },
          contentSteeringController
        );
        expect(
          contentSteeringController.levels,
          'Content Steering variants'
        ).to.have.lengthOf(40);

        expect(hls.getEventData(1).name).to.equal(
          Events.STEERING_MANIFEST_LOADED
        );
        const steeringManifestLoadedEvent = hls.getEventData(1);
        expect(steeringManifestLoadedEvent.payload).to.have.property('url');
        expect(steeringManifestLoadedEvent.payload).to.have.property(
          'steeringManifest'
        );

        expect(hls.getEventData(2).name).to.equal(Events.LEVELS_UPDATED);
        const updatedEvent = hls.getEventData(2);
        const eventData = updatedEvent.payload as LevelsUpdatedData;
        expect(eventData.levels[0].pathwayId).to.equal('Buzz');
        expect(eventData.levels[0].uri).to.equal(
          'http://www.buzz-1.com/tier6.m3u8'
        );
      });
    });
  });
});

function loadSteeringManifest(
  partialManifest: Partial<SteeringManifest>,
  steering: ConentSteeringControllerTestable
) {
  steering.startLoad();
  const response: LoaderResponse = {
    url: '',
    data: {
      VERSION: 1,
      TTL: 300,
      ...partialManifest,
    },
  };
  steering.loader.callbacks?.onSuccess(
    response,
    new LoadStats(),
    steering.loader.context as any,
    null
  );
}
