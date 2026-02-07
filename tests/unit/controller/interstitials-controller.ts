import { config as chaiConfig, expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import InterstitialsController from '../../../src/controller/interstitials-controller';
import { Events } from '../../../src/events';
import Hls from '../../../src/hls';
import { TimelineOccupancy } from '../../../src/loader/interstitial-event';
import M3U8Parser from '../../../src/loader/m3u8-parser';
import { Level } from '../../../src/types/level';
import { PlaylistLevelType } from '../../../src/types/loader';
import { AttrList } from '../../../src/utils/attr-list';
import { MockMediaElement } from '../../mocks/mock-media';
import type { HlsConfig } from '../../../src/config';
import type { InterstitialScheduleItem } from '../../../src/controller/interstitials-schedule';
import type {
  ComponentAPI,
  NetworkComponentAPI,
} from '../../../src/types/component-api';

use(sinonChai);
chaiConfig.truncateThreshold = 0;

type HlsTestable = Omit<Hls, 'networkControllers' | 'coreComponents'> & {
  coreComponents: ComponentAPI[];
  networkControllers: NetworkComponentAPI[];
  trigger: Hls['trigger'] & sinon.SinonSpy;
};

class HLSTestPlayer extends Hls {
  constructor(config: Partial<HlsConfig>) {
    super(config);
    const hlsTestable = this as unknown as HlsTestable;
    hlsTestable.networkControllers.forEach((component) => component.destroy());
    hlsTestable.networkControllers.length = 0;
    hlsTestable.coreComponents.forEach((component) => component.destroy());
    hlsTestable.coreComponents.length = 0;
    hlsTestable.on(Events.MEDIA_ATTACHING, (t, data) => {
      data.media.src = '';
    });
    hlsTestable.on(Events.MEDIA_DETACHING, () => {
      const media = hlsTestable.media;
      if (media) {
        media.removeAttribute('src');
        media.load();
      }
    });
  }
}

function expectItemToHaveProperties(
  schedule: InterstitialScheduleItem[],
  itemIndex: number,
  expected: Record<string, number | string | object | null>,
) {
  const item = schedule[itemIndex];
  Object.keys(expected).forEach((key) => {
    // Use deep equals on all properties except for InterstitialEvents ('event' and 'nextEvent')
    if (key === 'event' || key === 'nextEvent' || key === 'previousEvent') {
      expect(item, 'Schedule Index ' + itemIndex)
        .to.be.an('object')
        .which.has.property(key);
      const debug =
        `Schedule Index ${itemIndex} ['${key}']:` +
        JSON.stringify(
          item,
          (key, value) =>
            key === 'nextEvent' || key === 'previousEvent' || key === 'event'
              ? `${key} <${value ? value.identifier : value}>`
              : value,
          2,
        );
      const expectedValue = expected[key];
      if (expectedValue === null) {
        expect(item[key], debug).is.null;
      } else {
        expect(item[key], debug).includes(expectedValue);
      }
    } else {
      expect(item, 'Schedule Index ' + itemIndex)
        .to.be.an('object')
        .which.has.property(key)
        .which.deep.equals(
          expected[key],
          `Schedule Index ${itemIndex} ['${key}']:` +
            JSON.stringify(
              item,
              (key, value) =>
                key === 'nextEvent' ||
                key === 'previousEvent' ||
                key === 'event'
                  ? `${key} <${value ? value.identifier : value}>`
                  : value,
              2,
            ),
        );
    }
  });
}

function expectScheduleToInclude(
  schedule: InterstitialScheduleItem[],
  itemAssertions: Record<string, number | string | object | null>[],
) {
  expect(schedule).to.have.lengthOf(itemAssertions.length);
  itemAssertions.forEach((assertion, i) => {
    expectItemToHaveProperties(schedule, i, assertion);
  });
}

describe('InterstitialsController', function () {
  const sandbox = sinon.createSandbox();
  let hls: HlsTestable;
  let interstitialsController: InterstitialsController;

  function getTriggerCalls() {
    return hls.trigger.getCalls().map((_call) => _call.args[0]);
  }

  function attachMediaToHls() {
    const media = new MockMediaElement();
    hls.attachMedia(media as unknown as HTMLMediaElement);
    (hls as any).bufferController.media = media;
    hls.trigger(Events.MEDIA_ATTACHED, {
      media: media as unknown as HTMLMediaElement,
      mediaSource: {} as any,
    });
    return media;
  }

  function setLoadedLevelDetails(playlist: string) {
    const details = M3U8Parser.parseLevelPlaylist(
      playlist,
      'http://example.com/playlist.m3u8',
      0,
      PlaylistLevelType.MAIN,
      0,
      null,
    );
    expect(details.playlistParsingError).to.equal(null);
    const attrs = new AttrList({});
    const level = new Level({
      name: '',
      url: '',
      attrs,
      bitrate: 0,
    });
    level.details = details;
    (hls as any).levelController._levels[0] = level;
    (hls as any).streamController.startPosition = details.live
      ? details.totalduration - details.targetduration * 3
      : 0;
    hls.trigger(Events.LEVEL_UPDATED, {
      details,
      level: 0,
    });
    return details;
  }

  beforeEach(function () {
    hls = new HLSTestPlayer({
      // debug: true,
      debug: {
        trace: () => null,
        debug: () => null,
        log: () => null,
        warn: () => null,
        info: () => null,
        error: () => null,
      },
    }) as unknown as HlsTestable;
    interstitialsController = new InterstitialsController(
      hls as unknown as Hls,
      HLSTestPlayer,
    );
    sandbox.spy(hls, 'trigger');
  });

  afterEach(function () {
    hls.destroy();
    interstitialsController.destroy();
    sandbox.restore();
  });

  describe('Interstitial Parsing and Schedule', function () {
    it('should parse Interstitial Events from LevelDetails and produce a schedule', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:6
#EXT-X-PROGRAM-DATE-TIME:2020-01-01T11:00:00.000Z
#EXT-X-DATERANGE:ID="0",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:04.000Z",DURATION=30,X-ASSET-URI="https://example.com/ad1.m3u8",X-RESTRICT="SKIP,JUMP",X-SNAP="OUT,IN"
#EXTINF:6,
fileSequence3.ts
#EXTINF:6,
fileSequence4.ts
#EXT-X-ENDLIST`;
      attachMediaToHls();
      hls.trigger.resetHistory();
      setLoadedLevelDetails(playlist);
      const insterstitials = interstitialsController.interstitialsManager;
      if (!insterstitials) {
        expect(insterstitials, 'interstitialsManager').to.be.an('object');
        return;
      }
      const schedule = insterstitials.schedule;
      expect(insterstitials.bufferingIndex).to.equal(0, 'bufferingIndex');
      expect(insterstitials.playingIndex).to.equal(0, 'playingIndex');
      expect(insterstitials.events).is.an('array').which.has.lengthOf(1);
      expect(schedule).is.an('array').which.has.lengthOf(2);
      const interstitialEvent = insterstitials.events[0];
      expect(interstitialEvent.identifier).to.equal('0');
      expect(interstitialEvent.restrictions.jump).to.equal(true);
      expect(interstitialEvent.restrictions.skip).to.equal(true);
      expect(interstitialEvent.snapOptions.out).to.equal(true);
      expect(interstitialEvent.snapOptions.in).to.equal(true);
      expectScheduleToInclude(schedule, [
        {
          previousEvent: null,
          nextEvent: {
            identifier: '0',
          },
          start: 0,
          end: 6,
          playout: {
            start: 0,
            end: 6,
          },
          integrated: {
            start: 0,
            end: 6,
          },
        },
        {
          event: {
            identifier: '0',
          },
          start: 6,
          end: 36,
          playout: {
            start: 6,
            end: 36,
          },
          integrated: {
            start: 6,
            end: 6,
          },
        },
      ]);
      expect(interstitialEvent).to.equal(schedule[1].event);
      const eventsTriggered = getTriggerCalls();
      expect(eventsTriggered).to.deep.equal(
        [
          Events.LEVEL_UPDATED,
          Events.INTERSTITIALS_UPDATED,
          Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
        ],
        `Actual events after asset-list`,
      );
    });

    it('X-RESUME-OFFSET values of interstitials scheduled at the same time are cumulative', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-VERSION:6
#EXT-X-PROGRAM-DATE-TIME:2020-01-01T11:00:00.000Z
#EXT-X-DATERANGE:ID="0",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:00.000Z",DURATION=5,X-ASSET-URI="https://example.com/index1.m3u8",X-TIMELINE-OCCUPIES=RANGE
#EXT-X-DATERANGE:ID="1",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:00.000Z",DURATION=25,X-ASSET-URI="https://example.com/index2.m3u8",X-TIMELINE-OCCUPIES=RANGE
#EXTINF:10,
fileSequence1.ts
#EXTINF:10,
fileSequence2.ts
#EXTINF:10,
fileSequence3.ts
#EXT-X-DATERANGE:ID="2",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:31.000Z",DURATION=3,X-RESUME-OFFSET=0,X-ASSET-URI="https://example.com/index3.m3u8",X-TIMELINE-OCCUPIES=RANGE
#EXT-X-DATERANGE:ID="3",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:31.000Z",DURATION=3,X-ASSET-URI="https://example.com/index4.m3u8",X-TIMELINE-OCCUPIES=RANGE
#EXT-X-DATERANGE:ID="4",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:31.000Z",DURATION=3,X-RESUME-OFFSET=4,X-ASSET-URI="https://example.com/index5.m3u8",X-TIMELINE-OCCUPIES=RANGE
#EXTINF:10,
fileSequence4.ts
#EXT-X-ENDLIST`;
      setLoadedLevelDetails(playlist);
      const insterstitials = interstitialsController.interstitialsManager;
      if (!insterstitials) {
        expect(insterstitials, 'interstitialsManager').to.be.an('object');
        return;
      }
      const events = insterstitials.events;
      const schedule = insterstitials.schedule;
      expect(events).is.an('array').which.has.lengthOf(5);
      expect(schedule)
        .is.an('array')
        .which.has.lengthOf(
          7,
          `Schedule items: ${schedule.map((item) => `${item.start}-${item.end}`).join(', ')}`,
        );
      const eventAssertions = [
        {
          startTime: 0,
          duration: 5,
          resumeOffset: NaN,
          resumeTime: 5,
        },
        {
          startTime: 0,
          duration: 25,
          resumeOffset: NaN,
          resumeTime: 30,
        },
        {
          startTime: 31,
          duration: 3,
          resumeOffset: 0,
          resumeTime: 31,
        },
        {
          startTime: 31,
          duration: 3,
          resumeOffset: NaN,
          resumeTime: 34,
        },
        {
          startTime: 31,
          duration: 3,
          resumeOffset: 4,
          resumeTime: 38,
        },
      ];
      eventAssertions.forEach((assertions, i) => {
        expect(events[i].identifier).to.equal('' + i);
        expect(events[i], `Interstitial Event "${i}"`).to.deep.include(
          assertions,
        );
      });
      expectScheduleToInclude(schedule, [
        {
          event: {
            identifier: '0',
          },
          start: 0,
          end: 5,
          playout: {
            start: 0,
            end: 5,
          },
          integrated: {
            start: 0,
            end: 5,
          },
        },
        {
          event: {
            identifier: '1',
          },
          start: 5,
          end: 30,
          playout: {
            start: 5,
            end: 30,
          },
          integrated: {
            start: 5,
            end: 30,
          },
        },
        {
          previousEvent: {
            identifier: '1',
          },
          nextEvent: {
            identifier: '2',
          },
          start: 30,
          end: 31,
          playout: {
            start: 30,
            end: 31,
          },
          integrated: {
            start: 30,
            end: 31,
          },
        },
        {
          event: {
            identifier: '2',
          },
          start: 31,
          end: 31,
          playout: {
            start: 31,
            end: 34,
          },
          integrated: {
            start: 31,
            end: 34,
          },
        },
        {
          event: {
            identifier: '3',
          },
          start: 31,
          end: 34,
          playout: {
            start: 34,
            end: 37,
          },
          integrated: {
            start: 34,
            end: 37,
          },
        },
        {
          event: {
            identifier: '4',
          },
          start: 34,
          end: 38,
          playout: {
            start: 37,
            end: 40,
          },
          integrated: {
            start: 37,
            end: 40,
          },
        },
        {
          previousEvent: {
            identifier: '4',
          },
          nextEvent: null,
          start: 38,
          end: 40,
          playout: {
            start: 40,
            end: 42,
          },
          integrated: {
            start: 40,
            end: 42,
          },
        },
      ]);
    });

    it('negative X-RESUME-OFFSET values', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-VERSION:6
#EXT-X-PROGRAM-DATE-TIME:2020-01-01T11:00:00.000Z
#EXT-X-DATERANGE:ID="1",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:05.000Z",DURATION=10,X-RESUME-OFFSET=-5,X-ASSET-URI="https://example.com/index1.m3u8"
#EXTINF:10,
fileSequence1.ts
#EXT-X-DATERANGE:ID="2",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:10.000Z",DURATION=5,X-ASSET-URI="https://example.com/index2.m3u8"
#EXT-X-DATERANGE:ID="3",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:10.000Z",DURATION=5,X-RESUME-OFFSET=-3,X-ASSET-URI="https://example.com/index3.m3u8"
#EXTINF:10,
fileSequence2.ts
#EXT-X-DATERANGE:ID="4",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:20.000Z",DURATION=5,X-RESUME-OFFSET=-1,X-ASSET-URI="https://example.com/index4.m3u8"
#EXT-X-DATERANGE:ID="5",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:20.000Z",DURATION=5,X-ASSET-URI="https://example.com/index5.m3u8"
#EXTINF:10,
fileSequence3.ts
#EXT-X-ENDLIST`;
      setLoadedLevelDetails(playlist);
      const insterstitials = interstitialsController.interstitialsManager;
      if (!insterstitials) {
        expect(insterstitials, 'interstitialsManager').to.be.an('object');
        return;
      }
      const events = insterstitials.events;
      const schedule = insterstitials.schedule;
      expect(events).is.an('array').which.has.lengthOf(5);
      const scheduleDebugString = `Schedule items: ${schedule.map((item) => `[${item.event ? 'I' : 'P'}:${item.start}-${item.end}]`).join(', ')}`;
      expect(schedule)
        .is.an('array')
        .which.has.lengthOf(9, scheduleDebugString);
      [
        'primary',
        '1',
        'primary',
        '2',
        '3',
        'primary',
        '4',
        '5',
        'primary',
      ].forEach((typeOrIdentifier, i) => {
        if (typeOrIdentifier === 'primary') {
          expect(
            schedule[i],
            `Expected to find a primary segment at index ${i}: ${scheduleDebugString}`,
          ).to.have.property('nextEvent');
        } else {
          expect(
            schedule[i],
            `Expected to find an Interstitial at index ${i}: ${scheduleDebugString}`,
          )
            .to.have.property('event')
            .which.has.property('identifier')
            .which.equals(typeOrIdentifier);
        }
      });
      const eventAssertions = [
        {
          startTime: 5,
          duration: 10,
          resumeOffset: -5,
          resumeTime: 0,
        },
        {
          startTime: 10,
          duration: 5,
          resumeOffset: NaN,
          resumeTime: 15,
        },
        {
          startTime: 10,
          duration: 5,
          cumulativeDuration: 5,
          resumeOffset: -3,
          resumeTime: 12,
        },
        {
          startTime: 20,
          duration: 5,
          resumeOffset: -1,
          resumeTime: 19,
        },
        {
          startTime: 20,
          duration: 5,
          resumeOffset: NaN,
          resumeTime: 24,
        },
      ];
      eventAssertions.forEach((assertions, i) => {
        expect(events[i].identifier).to.equal('' + (i + 1));
        expect(
          events[i],
          `Interstitial Event "${events[i].identifier}"`,
        ).to.deep.include(assertions);
      });
      expectScheduleToInclude(schedule, [
        {
          previousEvent: null,
          nextEvent: {
            identifier: '1',
          },
          start: 0,
          end: 5,
          playout: {
            start: 0,
            end: 5,
          },
          integrated: {
            start: 0,
            end: 5,
          },
        },
        {
          event: {
            identifier: '1',
          },
          start: 5,
          end: 0,
          playout: {
            start: 5,
            end: 15,
          },
          integrated: {
            start: 5,
            end: 5,
          },
        },
        {
          previousEvent: {
            identifier: '1',
          },
          nextEvent: {
            identifier: '2',
          },
          start: 0,
          end: 10,
          playout: {
            start: 15,
            end: 25,
          },
          integrated: {
            start: 5,
            end: 15,
          },
        },
        {
          event: {
            identifier: '2',
          },
          start: 10,
          end: 15,
          playout: {
            start: 25,
            end: 30,
          },
          integrated: {
            start: 15,
            end: 15,
          },
        },
        {
          event: {
            identifier: '3',
          },
          start: 15,
          end: 12,
          playout: {
            start: 30,
            end: 35,
          },
          integrated: {
            start: 15,
            end: 15,
          },
        },
        {
          nextEvent: {
            identifier: '4',
          },
          start: 12,
          end: 20,
          playout: {
            start: 35,
            end: 43,
          },
          integrated: {
            start: 15,
            end: 23,
          },
        },
        {
          event: {
            identifier: '4',
          },
          start: 20,
          end: 19,
          playout: {
            start: 43,
            end: 48,
          },
          integrated: {
            start: 23,
            end: 23,
          },
        },
        {
          event: {
            identifier: '5',
          },
          start: 19,
          end: 24,
          playout: {
            start: 48,
            end: 53,
          },
          integrated: {
            start: 23,
            end: 23,
          },
        },
        {
          previousEvent: {
            identifier: '5',
          },
          nextEvent: null,
          start: 24,
          end: 30,
          playout: {
            start: 53,
            end: 59,
          },
          integrated: {
            start: 23,
            end: 29,
          },
        },
      ]);
    });

    it('should schedule preroll (CUE="PRE") interstitials at the start of the program (VOD default 0) with correct start and resume time for all events', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-VERSION:10
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-PROGRAM-DATE-TIME:2021-01-04T05:00:00.000Z
#EXT-X-DATERANGE:ID="ad1",CLASS="com.apple.hls.interstitial",START-DATE="2021-01-04T05:00:05.000Z",DURATION=15,X-ASSET-LIST="https://example.com/asset_list.json",X-RESUME-OFFSET=0,X-CUE="PRE"
#EXT-X-DATERANGE:ID="ad2",CLASS="com.apple.hls.interstitial",START-DATE="2021-01-04T05:00:10.000Z",DURATION=30,X-ASSET-LIST="https://example.com/asset_list.json",X-RESUME-OFFSET=0,X-TIMELINE-OCCUPIES="RANGE"
#EXT-X-MAP:URI="fileSequence0.mp4"
#EXTINF:10,
fileSequence1.mp4
#EXTINF:10,
fileSequence2.mp4
#EXTINF:10,
fileSequence3.mp4
#EXT-X-ENDLIST`;
      attachMediaToHls();
      hls.trigger.resetHistory();
      setLoadedLevelDetails(playlist);
      const insterstitials = interstitialsController.interstitialsManager;
      if (!insterstitials) {
        expect(insterstitials, 'interstitialsManager').to.be.an('object');
        return;
      }
      const schedule = insterstitials.schedule;
      expect(insterstitials.bufferingIndex).to.equal(0, 'bufferingIndex');
      expect(insterstitials.playingIndex).to.equal(0, 'playingIndex');
      expect(insterstitials.events).is.an('array').which.has.lengthOf(2);
      expect(schedule).is.an('array').which.has.lengthOf(4);
      expect(insterstitials.events[0].identifier).to.equal('ad1');
      expect(insterstitials.events[1].identifier).to.equal('ad2');
      expect(insterstitials.events[0]).to.equal(schedule[0].event);
      expect(insterstitials.events[1]).to.equal(schedule[2].event);

      expectScheduleToInclude(schedule, [
        {
          event: {
            identifier: 'ad1',
          },
          start: 0,
          end: 0,
          playout: {
            start: 0,
            end: 15,
          },
          integrated: {
            start: 0,
            end: 0,
          },
        },
        {
          previousEvent: {
            identifier: 'ad1',
          },
          nextEvent: {
            identifier: 'ad2',
          },
          start: 0,
          end: 10,
          playout: {
            start: 15,
            end: 25,
          },
          integrated: {
            start: 0,
            end: 10,
          },
        },
        {
          event: {
            identifier: 'ad2',
          },
          start: 10,
          end: 10,
          playout: {
            start: 25,
            end: 55,
          },
          integrated: {
            start: 10,
            end: 40,
          },
        },
        {
          previousEvent: {
            identifier: 'ad2',
          },
          nextEvent: null,
          start: 10,
          end: 30,
          playout: {
            start: 55,
            end: 75,
          },
          integrated: {
            start: 40,
            end: 60,
          },
        },
      ]);
    });

    it('should exclude date ranges that start after the end of the primary playlist from the schedule and schedule item references', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-VERSION:10
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-PROGRAM-DATE-TIME:2021-01-04T05:00:00.000Z
#EXT-X-DATERANGE:ID="ad1",CLASS="com.apple.hls.interstitial",START-DATE="2021-01-04T05:00:00.000Z",DURATION=15,X-ASSET-LIST="https://example.com/asset_list.json",X-RESUME-OFFSET=0
#EXT-X-DATERANGE:ID="ad2",CLASS="com.apple.hls.interstitial",START-DATE="2021-01-04T05:00:50.000Z",DURATION=30,X-ASSET-LIST="https://example.com/asset_list.json",X-RESUME-OFFSET=0
#EXT-X-MAP:URI="fileSequence0.mp4"
#EXTINF:10,
fileSequence1.mp4
#EXTINF:10,
fileSequence2.mp4
#EXTINF:10,
fileSequence3.mp4
#EXT-X-ENDLIST`;
      setLoadedLevelDetails(playlist);
      const insterstitials = interstitialsController.interstitialsManager;
      if (!insterstitials) {
        expect(insterstitials, 'interstitialsManager').to.be.an('object');
        return;
      }
      const schedule = insterstitials.schedule;
      expect(insterstitials.events).is.an('array').which.has.lengthOf(2);
      expect(schedule).is.an('array').which.has.lengthOf(2);
      expect(insterstitials.events[0].identifier).to.equal('ad1');
      expect(insterstitials.events[1].identifier).to.equal('ad2');
      expect(insterstitials.events[0]).to.equal(schedule[0].event);

      expectScheduleToInclude(schedule, [
        {
          event: {
            identifier: 'ad1',
          },
          start: 0,
          end: 0,
          playout: {
            start: 0,
            end: 15,
          },
          integrated: {
            start: 0,
            end: 0,
          },
        },
        {
          previousEvent: {
            identifier: 'ad1',
          },
          nextEvent: null,
          start: 0,
          end: 30,
          playout: {
            start: 15,
            end: 45,
          },
          integrated: {
            start: 0,
            end: 30,
          },
        },
      ]);
    });

    describe('should parse timeline style and content may vary', function () {
      it('default values', function () {
        const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:6
#EXT-X-PROGRAM-DATE-TIME:2020-01-01T11:00:00.000Z
#EXT-X-DATERANGE:ID="0",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:04.000Z",DURATION=30,X-ASSET-URI="http://example.com/ad1.m3u8"
#EXTINF:6,
fileSequence3.ts
#EXTINF:6,
fileSequence4.ts
#EXT-X-ENDLIST`;
        setLoadedLevelDetails(playlist);
        const insterstitials = interstitialsController.interstitialsManager;
        if (!insterstitials) {
          expect(insterstitials, 'interstitialsManager').to.be.an('object');
          return;
        }
        const schedule = insterstitials.schedule;
        const events = insterstitials.events;
        expect(events).is.an('array').which.has.lengthOf(1);
        expect(schedule).is.an('array').which.has.lengthOf(2);
        expect(events[0]).to.deep.include({
          identifier: '0',
          timelineOccupancy: TimelineOccupancy.Point,
          supplementsPrimary: false,
          contentMayVary: true,
        });
        expect(insterstitials.primary).to.include({
          duration: 12,
        });
        expect(insterstitials.integrated).to.include({
          duration: 4,
        });
        expectScheduleToInclude(schedule, [
          {
            nextEvent: {
              identifier: '0',
            },
            start: 0,
            end: 4,
            playout: {
              start: 0,
              end: 4,
            },
            integrated: {
              start: 0,
              end: 4,
            },
          },
          {
            event: {
              identifier: '0',
            },
            start: 4,
            end: 34,
            playout: {
              start: 4,
              end: 34,
            },
            integrated: {
              start: 4,
              end: 4,
            },
          },
        ]);
      });

      it('attribute values', function () {
        const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-VERSION:6
#EXT-X-PROGRAM-DATE-TIME:2020-01-01T11:00:00.000Z
#EXT-X-DATERANGE:ID="0",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:04.000Z",DURATION=30,X-ASSET-URI="http://example.com/ad1.m3u8",X-TIMELINE-STYLE="HIGHLIGHT",X-TIMELINE-OCCUPIES="POINT"
#EXT-X-DATERANGE:ID="1",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:04.000Z",DURATION=30,X-ASSET-URI="http://example.com/ad1.m3u8",X-TIMELINE-STYLE="HIGHLIGHT",X-TIMELINE-OCCUPIES="RANGE",X-CONTENT-MAY-VARY="YES"
#EXT-X-DATERANGE:ID="2",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:04.000Z",DURATION=30,X-ASSET-URI="http://example.com/ad1.m3u8",X-TIMELINE-STYLE="PRIMARY",X-TIMELINE-OCCUPIES="RANGE",X-CONTENT-MAY-VARY="NO"
#EXT-X-DATERANGE:ID="3",CLASS="com.apple.hls.interstitial",START-DATE="2020-01-01T11:00:04.000Z",DURATION=30,X-ASSET-URI="http://example.com/ad1.m3u8",X-CONTENT-MAY-VARY="NO"
#EXTINF:6,
fileSequence3.ts
#EXTINF:6,
fileSequence4.ts
#EXT-X-ENDLIST`;
        const eventAssertions = [
          {
            timelineOccupancy: TimelineOccupancy.Point,
            supplementsPrimary: false,
            contentMayVary: true,
          },
          {
            timelineOccupancy: TimelineOccupancy.Range,
            supplementsPrimary: false,
            contentMayVary: true,
          },
          {
            timelineOccupancy: TimelineOccupancy.Range,
            supplementsPrimary: true,
            contentMayVary: false,
          },
          {
            timelineOccupancy: TimelineOccupancy.Point,
            supplementsPrimary: false,
            contentMayVary: false,
          },
        ];
        setLoadedLevelDetails(playlist);
        const insterstitials = interstitialsController.interstitialsManager;
        if (!insterstitials) {
          expect(insterstitials, 'interstitialsManager').to.be.an('object');
          return;
        }
        const schedule = insterstitials.schedule;
        const events = insterstitials.events;
        expect(events).is.an('array').which.has.lengthOf(4);
        expect(schedule).is.an('array').which.has.lengthOf(5);
        eventAssertions.forEach((assertions, i) => {
          expect(events[i].identifier).to.equal('' + i);
          expect(events[i], `Interstitial Event "${i}"`).to.deep.include(
            assertions,
          );
        });
        expect(insterstitials.primary).to.include({
          duration: 12,
        });
        expect(insterstitials.integrated).to.include({
          duration: 64,
        });
        expectScheduleToInclude(schedule, [
          {
            previousEvent: null,
            nextEvent: {
              identifier: '0',
            },
            start: 0,
            end: 4,
            playout: {
              start: 0,
              end: 4,
            },
            integrated: {
              start: 0,
              end: 4,
            },
          },
          {
            event: {
              identifier: '0',
            },
            start: 4,
            end: 34,
            playout: {
              start: 4,
              end: 34,
            },
            integrated: {
              start: 4,
              end: 4,
            },
          },
          {
            event: {
              identifier: '1',
            },
            start: 34,
            end: 64,
            playout: {
              start: 34,
              end: 64,
            },
            integrated: {
              start: 4,
              end: 34,
            },
          },
          {
            event: {
              identifier: '2',
            },
            start: 64,
            end: 94,
            playout: {
              start: 64,
              end: 94,
            },
            integrated: {
              start: 34,
              end: 64,
            },
          },
          {
            event: {
              identifier: '3',
            },
            start: 94,
            end: 124,
            playout: {
              start: 94,
              end: 124,
            },
            integrated: {
              start: 64,
              end: 64,
            },
          },
        ]);
      });
    });
  });

  describe('Interstitial Playback and API Events', function () {
    const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-VERSION:7
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-PROGRAM-DATE-TIME:2024-02-23T15:00:00.000Z
#EXT-X-DATERANGE:ID="pre",CLASS="com.apple.hls.interstitial",START-DATE="2024-02-23T15:00:00.000Z",DURATION=37,X-ASSET-URI="https://example.com/pre.m3u8",X-RESUME-OFFSET=0,CUE="PRE"
#EXT-X-MAP:URI="fileSequence0.mp4"
#EXTINF:9.20920,	
#EXT-X-BITRATE:1701
fileSequence1.mp4
#EXTINF:8.37503,	
#EXT-X-BITRATE:1810
fileSequence2.mp4
#EXTINF:8.80880,	
#EXT-X-BITRATE:1824
fileSequence3.mp4
#EXT-X-DATERANGE:ID="mid-30",CLASS="com.apple.hls.interstitial",START-DATE="2024-02-23T15:00:30.000Z",DURATION=16,X-ASSET-LIST="https://example.com/mid-list.json"
#EXTINF:9.70970,	
#EXT-X-BITRATE:1768
fileSequence4.mp4
#EXTINF:9.10910,	
#EXT-X-BITRATE:621
fileSequence5.mp4`;

    it('should begin preroll on attach', function () {
      setLoadedLevelDetails(playlist);
      const insterstitials = interstitialsController.interstitialsManager;
      if (!insterstitials) {
        expect(insterstitials, 'interstitialsManager').to.be.an('object');
        return;
      }
      expect(insterstitials.events).is.an('array').which.has.lengthOf(2);
      expect(insterstitials.schedule).is.an('array').which.has.lengthOf(4);
      const callsWithPrerollBeforeAttach = getTriggerCalls();
      expect(callsWithPrerollBeforeAttach).to.deep.equal(
        [Events.LEVEL_UPDATED, Events.INTERSTITIALS_UPDATED],
        `Actual events before attach`,
      );
      hls.trigger.resetHistory();
      expect(insterstitials.bufferingIndex).to.equal(-1, 'bufferingIndex');
      expect(insterstitials.playingIndex).to.equal(-1, 'playingIndex');
      attachMediaToHls();
      const callsWithPrerollAfterAttach = getTriggerCalls();
      const expectedEvents = [
        Events.MEDIA_ATTACHING,
        Events.MEDIA_ATTACHED,
        Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
        Events.INTERSTITIAL_ASSET_PLAYER_CREATED,
        Events.INTERSTITIAL_STARTED,
        Events.INTERSTITIAL_ASSET_STARTED,
        Events.MEDIA_DETACHING,
        Events.MEDIA_DETACHED,
      ];
      expect(callsWithPrerollAfterAttach).to.deep.equal(
        expectedEvents,
        `Actual events after attach`,
      );
      expect(insterstitials.bufferingIndex).to.equal(0, 'bufferingIndex');
      expect(insterstitials.playingIndex).to.equal(0, 'playingIndex');
      expect(
        insterstitials.interstitialPlayer,
        `interstitialPlayer`,
      ).to.include({
        playingIndex: 0,
        currentTime: 0,
        duration: 37,
      });
      expect(
        insterstitials.interstitialPlayer?.scheduleItem?.event,
        `interstitialPlayer.scheduleItem`,
      ).to.include({ identifier: 'pre' });
    });

    it('should handle empty asset-lists with resume offset', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-VERSION:7
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PROGRAM-DATE-TIME:2024-02-23T15:00:00.000Z
#EXT-X-DATERANGE:ID="start",CLASS="com.apple.hls.interstitial",START-DATE="2024-02-23T15:00:00.000Z",DURATION=5,X-ASSET-LIST="https://example.com/empty.json",X-RESUME-OFFSET=5
#EXT-X-MAP:URI="fileSequence0.mp4"
#EXTINF:5,	
fileSequence1.mp4
#EXTINF:5,	
fileSequence2.mp4
#EXTINF:5,	
fileSequence3.mp4
#EXT-X-ENDLIST`;
      attachMediaToHls();

      setLoadedLevelDetails(playlist);
      const insterstitials = interstitialsController.interstitialsManager;
      if (!insterstitials) {
        expect(insterstitials, 'interstitialsManager').to.be.an('object');
        return;
      }
      expect(insterstitials.events).is.an('array').which.has.lengthOf(1);
      expect(insterstitials.schedule).is.an('array').which.has.lengthOf(2);
      const callsBeforeAttach = getTriggerCalls();
      expect(callsBeforeAttach).to.deep.equal(
        [
          Events.MEDIA_ATTACHING,
          Events.MEDIA_ATTACHED,
          Events.LEVEL_UPDATED,
          Events.INTERSTITIALS_UPDATED,
          Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
          Events.ASSET_LIST_LOADING,
          Events.INTERSTITIAL_STARTED,
        ],
        `Actual events before asset-list`,
      );
      hls.trigger.resetHistory();
      expect(insterstitials.bufferingIndex).to.equal(0, 'bufferingIndex a');
      expect(insterstitials.playingIndex).to.equal(0, 'playingIndex a');
      expect(insterstitials.primary.currentTime).to.equal(0, 'timelinePos a');

      // Load empty asset-list
      const interstitial = insterstitials.events[0];
      interstitial.assetListResponse = { ASSETS: [] };
      hls.trigger(Events.ASSET_LIST_LOADED, {
        event: interstitial,
        assetListResponse: interstitial.assetListResponse,
        networkDetails: new Response('ok'),
      });
      const callsAfterAttach = getTriggerCalls();
      expect(callsAfterAttach).to.deep.equal(
        [
          Events.ASSET_LIST_LOADED,
          Events.INTERSTITIALS_UPDATED,
          Events.INTERSTITIAL_ENDED,
          Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
          Events.INTERSTITIALS_PRIMARY_RESUMED,
        ],
        `Actual events after asset-list`,
      );
      expect(insterstitials.bufferingIndex).to.equal(1, 'bufferingIndex b');
      expect(insterstitials.playingIndex).to.equal(1, 'playingIndex b');
      expect(insterstitials.primary.currentTime).to.equal(5, 'timelinePos b');
    });

    it('should handle empty asset-lists without resume offset, ignoring date range tag duration', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-VERSION:7
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PROGRAM-DATE-TIME:2024-02-23T15:00:00.000Z
#EXT-X-DATERANGE:ID="start",CLASS="com.apple.hls.interstitial",START-DATE="2024-02-23T15:00:00.000Z",DURATION=5,X-ASSET-LIST="https://example.com/empty.json"
#EXT-X-MAP:URI="fileSequence0.mp4"
#EXTINF:5,
fileSequence1.mp4
#EXTINF:5,
fileSequence2.mp4
#EXTINF:5,
fileSequence3.mp4
#EXT-X-ENDLIST`;
      attachMediaToHls();

      setLoadedLevelDetails(playlist);
      const insterstitials = interstitialsController.interstitialsManager;
      if (!insterstitials) {
        expect(insterstitials, 'interstitialsManager').to.be.an('object');
        return;
      }
      expect(insterstitials.events).is.an('array').which.has.lengthOf(1);
      expect(insterstitials.schedule).is.an('array').which.has.lengthOf(2);
      const callsBeforeAttach = getTriggerCalls();
      expect(callsBeforeAttach).to.deep.equal(
        [
          Events.MEDIA_ATTACHING,
          Events.MEDIA_ATTACHED,
          Events.LEVEL_UPDATED,
          Events.INTERSTITIALS_UPDATED,
          Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
          Events.ASSET_LIST_LOADING,
          Events.INTERSTITIAL_STARTED,
        ],
        `Actual events before asset-list`,
      );
      hls.trigger.resetHistory();
      expect(insterstitials.bufferingIndex).to.equal(0, 'bufferingIndex a');
      expect(insterstitials.playingIndex).to.equal(0, 'playingIndex a');
      expect(insterstitials.primary.currentTime).to.equal(0, 'timelinePos a');

      // Load empty asset-list
      const interstitial = insterstitials.events[0];
      interstitial.assetListResponse = { ASSETS: [] };
      hls.trigger(Events.ASSET_LIST_LOADED, {
        event: interstitial,
        assetListResponse: interstitial.assetListResponse,
        networkDetails: new Response('ok'),
      });
      const callsAfterAttach = getTriggerCalls();
      expect(callsAfterAttach).to.deep.equal(
        [
          Events.ASSET_LIST_LOADED,
          Events.INTERSTITIALS_UPDATED,
          Events.INTERSTITIAL_ENDED,
          Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
          Events.INTERSTITIALS_PRIMARY_RESUMED,
        ],
        `Actual events after asset-list`,
      );
      expect(insterstitials.bufferingIndex).to.equal(1, 'bufferingIndex b');
      expect(insterstitials.playingIndex).to.equal(1, 'playingIndex b');
      expect(insterstitials.primary.currentTime).to.equal(
        0,
        'playback should resume primary at 0 because no interstitial played',
      );
    });

    it('should resume at start plus resumption-offset (start + duration and attach after level updated)', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-VERSION:7
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PROGRAM-DATE-TIME:2024-02-23T15:00:00.000Z
#EXT-X-MAP:URI="fileSequence0.mp4"
#EXTINF:10,	
fileSequence1.mp4
#EXTINF:10,	
fileSequence2.mp4
#EXTINF:10,	
fileSequence3.mp4
#EXT-X-DATERANGE:ID="mid-10",CLASS="com.apple.hls.interstitial",START-DATE="2024-02-23T15:00:30.000Z",DURATION=10,X-ASSET-LIST="https://example.com/mid.json"
#EXTINF:10,	
fileSequence4.mp4
#EXTINF:10,	
fileSequence5.mp4
#EXTINF:10,	
fileSequence6.mp4`;

      // Loaded playlist (before attaching media)
      setLoadedLevelDetails(playlist);
      const insterstitials = interstitialsController.interstitialsManager;
      if (!insterstitials) {
        expect(insterstitials, 'interstitialsManager').to.be.an('object');
        return;
      }
      expect(insterstitials.events).is.an('array').which.has.lengthOf(1);
      expect(insterstitials.schedule).is.an('array').which.has.lengthOf(3);
      const eventsBeforeAttach = getTriggerCalls();
      expect(eventsBeforeAttach).to.deep.equal(
        [Events.LEVEL_UPDATED, Events.INTERSTITIALS_UPDATED],
        `Actual events before attach`,
      );
      expect(insterstitials.bufferingIndex).to.equal(-1, 'bufferingIndex');
      expect(insterstitials.playingIndex).to.equal(-1, 'playingIndex');
      expect(insterstitials.primary.currentTime).to.equal(0, 'timelinePos');

      // Attach media
      hls.trigger.resetHistory();
      attachMediaToHls();
      const eventsAfterAttach = getTriggerCalls();
      const expectedEvents = [
        Events.MEDIA_ATTACHING,
        Events.MEDIA_ATTACHED,
        Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
        Events.ASSET_LIST_LOADING,
        Events.INTERSTITIAL_STARTED,
      ];
      expect(eventsAfterAttach).to.deep.equal(
        expectedEvents,
        `Actual events after attach`,
      );
      expect(insterstitials.bufferingIndex).to.equal(1, 'bufferingIndex a');
      expect(insterstitials.playingIndex).to.equal(1, 'playingIndex a');
      expect(insterstitials.primary.currentTime).to.equal(30, 'timelinePos a');

      // Load asset-list
      hls.trigger.resetHistory();
      const interstitial = insterstitials.events[0];
      interstitial.assetListResponse = {
        ASSETS: [{ URI: '', DURATION: '10' }],
      };
      hls.trigger(Events.ASSET_LIST_LOADED, {
        event: interstitial,
        assetListResponse: interstitial.assetListResponse,
        networkDetails: new Response('ok'),
      });
      const callsAfterAttach = getTriggerCalls();
      expect(callsAfterAttach).to.deep.equal(
        [
          Events.ASSET_LIST_LOADED,
          Events.INTERSTITIAL_ASSET_PLAYER_CREATED,
          Events.INTERSTITIAL_ASSET_STARTED,
          Events.MEDIA_DETACHING,
          Events.MEDIA_DETACHED,
        ],
        `Actual events after asset-list`,
      );

      // skip to end of interstitial
      hls.trigger.resetHistory();
      insterstitials.skip();
      const eventsAfterSkip = getTriggerCalls();
      const expectedSkipEvents = [
        Events.INTERSTITIAL_ASSET_ENDED,
        Events.INTERSTITIAL_ENDED,
        Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
      ].concat(
        interstitial.appendInPlace
          ? [Events.INTERSTITIALS_PRIMARY_RESUMED]
          : [Events.MEDIA_ATTACHING, Events.INTERSTITIALS_PRIMARY_RESUMED],
      );
      expect(eventsAfterSkip).to.deep.equal(
        expectedSkipEvents,
        `Actual events after skip`,
      );
      expect(insterstitials.bufferingIndex).to.equal(2, 'bufferingIndex b');
      expect(insterstitials.playingIndex).to.equal(2, 'playingIndex b');
      expect(insterstitials.primary.currentTime).to.equal(
        interstitial.appendInPlace ? 40.001 : 40,
        'timelinePos b',
      );
    });

    it('should resume at start plus resumption-offset (start + duration w/ CUE="ONCE" and attach on start)', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-VERSION:7
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PROGRAM-DATE-TIME:2024-02-23T15:00:00.000Z
#EXT-X-MAP:URI="fileSequence0.mp4"
#EXTINF:10,	
fileSequence1.mp4
#EXTINF:10,	
fileSequence2.mp4
#EXTINF:10,	
fileSequence3.mp4
#EXT-X-DATERANGE:ID="mid-10",CLASS="com.apple.hls.interstitial",START-DATE="2024-02-23T15:00:30.000Z",DURATION=10,X-ASSET-LIST="https://example.com/mid.json",CUE="ONCE"
#EXTINF:10,	
fileSequence4.mp4
#EXTINF:10,	
fileSequence5.mp4
#EXTINF:10,	
fileSequence6.mp4`;

      // Attach media
      attachMediaToHls();
      expect(
        interstitialsController.interstitialsManager,
        'interstitialsManager before level updated',
      )
        .to.deep.include({
          events: [],
          schedule: [],
          playerQueue: [],
        })
        .which.has.property('primary')
        .which.includes({ bufferedEnd: 0, currentTime: 0, duration: 0 });

      const eventsAfterAttach = getTriggerCalls();
      const expectedEvents = [Events.MEDIA_ATTACHING, Events.MEDIA_ATTACHED];
      expect(eventsAfterAttach).to.deep.equal(
        expectedEvents,
        `Actual events after attach`,
      );

      // Loaded playlist
      hls.trigger.resetHistory();
      setLoadedLevelDetails(playlist);
      const insterstitials = interstitialsController.interstitialsManager;
      if (!insterstitials) {
        expect(insterstitials, 'interstitialsManager').to.be.an('object');
        return;
      }
      expect(insterstitials.events).is.an('array').which.has.lengthOf(1);
      expect(insterstitials.schedule).is.an('array').which.has.lengthOf(3);
      const eventsAfterPlaylist = getTriggerCalls();
      expect(eventsAfterPlaylist).to.deep.equal(
        [
          Events.LEVEL_UPDATED,
          Events.INTERSTITIALS_UPDATED,
          Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
          Events.ASSET_LIST_LOADING,
          Events.INTERSTITIAL_STARTED,
        ],
        `Actual events before attach`,
      );
      expect(insterstitials.bufferingIndex).to.equal(1, 'bufferingIndex a');
      expect(insterstitials.playingIndex).to.equal(1, 'playingIndex a');
      expect(insterstitials.primary.currentTime).to.equal(30, 'timelinePos a');

      // Load asset-list
      hls.trigger.resetHistory();
      const interstitial = insterstitials.events[0];
      interstitial.assetListResponse = {
        ASSETS: [{ URI: '', DURATION: '10' }],
      };
      hls.trigger(Events.ASSET_LIST_LOADED, {
        event: interstitial,
        assetListResponse: interstitial.assetListResponse,
        networkDetails: new Response('ok'),
      });
      const callsAfterAttach = getTriggerCalls();
      expect(callsAfterAttach).to.deep.equal(
        [
          Events.ASSET_LIST_LOADED,
          Events.INTERSTITIAL_ASSET_PLAYER_CREATED,
          Events.INTERSTITIAL_ASSET_STARTED,
          Events.MEDIA_DETACHING,
          Events.MEDIA_DETACHED,
        ],
        `Actual events after asset-list`,
      );

      // skip to end of interstitial
      hls.trigger.resetHistory();
      insterstitials.skip();
      const eventsAfterSkip = getTriggerCalls();
      const expectedSkipEvents = [
        Events.INTERSTITIAL_ASSET_ENDED,
        Events.INTERSTITIAL_ENDED,
        Events.INTERSTITIALS_UPDATED, // removed Interstitial with CUE="ONCE"
        Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
        Events.MEDIA_ATTACHING,
        Events.INTERSTITIALS_PRIMARY_RESUMED,
      ];
      expect(eventsAfterSkip).to.deep.equal(
        expectedSkipEvents,
        `Actual events after skip`,
      );
      // Removing the CUE="ONCE" interstitial changes the `schedule` items, but does not remove it from `events`
      expect(insterstitials.events).is.an('array').which.has.lengthOf(1);
      expect(insterstitials.schedule).is.an('array').which.has.lengthOf(1);
      expect(insterstitials.bufferingIndex).to.equal(0, 'bufferingIndex b');
      expect(insterstitials.playingIndex).to.equal(0, 'playingIndex b');
      expect(insterstitials.primary.currentTime).to.equal(40, 'timelinePos b');
    });

    it('should report correct playhead position in event callbacks between items and assets', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-VERSION:7
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PROGRAM-DATE-TIME:2024-02-23T15:00:00.000Z
#EXT-X-MAP:URI="fileSequence0.mp4"
#EXTINF:10,	
fileSequence1.mp4
#EXTINF:10,	
fileSequence2.mp4
#EXTINF:10,	
fileSequence3.mp4
#EXT-X-DATERANGE:ID="mid-10",CLASS="com.apple.hls.interstitial",START-DATE="2024-02-23T15:00:30.000Z",DURATION=15,X-RESUME-OFFSET=10,X-TIMELINE-OCCUPIES=RANGE,X-ASSET-LIST="https://example.com/mid.json"
#EXTINF:10,	
fileSequence4.mp4
#EXTINF:10,	
fileSequence5.mp4
#EXTINF:10,	
fileSequence6.mp4
#EXT-X-ENDLIST`;

      const im = interstitialsController.interstitialsManager;
      if (!im) {
        expect(im, 'interstitialsManager').to.be.an('object');
        return;
      }
      const primary = 'primary';
      const integrated = 'integrated';
      const interstitialPlayer = 'interstitialPlayer';
      const expectIm = (property: string, context: string) =>
        expect(im[property], `interstitialsManager.${property} @${context}`);
      const expectAssetPlayer = (assetListIndex: number, context: string) => {
        const assetPlayersPath =
          'interstitialsManager.interstitialPlayer.assetPlayers';
        expectIm(interstitialPlayer, context)
          .to.have.property('assetPlayers')
          .which.is.an('array')
          .that.has.lengthOf.above(assetListIndex, assetPlayersPath);
        return expect(
          im.interstitialPlayer?.assetPlayers[assetListIndex],
          `${assetPlayersPath}[${assetListIndex}] @${context}`,
        ).to.be.an('object');
      };
      const logIm = (context: string) =>
        hls.logger.info(
          `primary.currentTime ${im.primary.currentTime | 0} intg.currentTime ${im.integrated.currentTime | 0} pi: ${im.playingIndex} bi: ${im.bufferingIndex} @${context}`,
        );

      hls.on(Events.INTERSTITIALS_UPDATED, (t) => {
        logIm(t);
        expectIm(primary, t).to.include({ currentTime: 0, bufferedEnd: 0 });
        expectIm(integrated, t).to.include({ currentTime: 0, bufferedEnd: 0 });
        expectIm(interstitialPlayer, t).to.be.null;
      });
      hls.on(Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY, (t, data) => {
        const bufferingIndex = data.bufferingIndex;
        const e = `${t}_${bufferingIndex}`;
        logIm(e);
        if (bufferingIndex === 0) {
          // buffered to primary
          expectIm(primary, e).to.include({ currentTime: 0, bufferedEnd: 0 });
          expectIm(integrated, e).to.include({
            currentTime: 0,
            bufferedEnd: 0,
          });
          expectIm(interstitialPlayer, e).to.be.null;
        } else if (bufferingIndex === 1) {
          // buffered to interstitial
          expectIm(primary, e).to.include({ currentTime: 30, bufferedEnd: 30 });
          expectIm(integrated, e).to.include({
            currentTime: 30,
            bufferedEnd: 30,
          });
          expectIm(interstitialPlayer, e).to.include({
            playingIndex: -1,
            currentTime: 0,
            duration: 15,
          });
        } else if (bufferingIndex === 2) {
          // buffered to primary (interstitial ended)
          expectIm(primary, e).to.include({ currentTime: 40, bufferedEnd: 40 });
          expectIm(integrated, e).to.include({
            currentTime: 45,
            bufferedEnd: 45,
          });
          expectIm(interstitialPlayer, e).to.be.null;
        }
      });
      hls.on(Events.INTERSTITIAL_STARTED, (t) => {
        logIm(t);
        expectIm(primary, t).to.include({ currentTime: 30, bufferedEnd: 30 });
        expectIm(integrated, t).to.include({
          currentTime: 30,
          bufferedEnd: 30,
        });
        expectIm(interstitialPlayer, t).to.not.be.null;
        expect(im.interstitialPlayer?.assetPlayers).to.have.lengthOf(0);
        expectIm(interstitialPlayer, t).to.include({
          playingIndex: -1,
          currentTime: 0,
          duration: 15,
        });
      });
      hls.on(Events.ASSET_LIST_LOADED, (t) => {
        logIm(t);
        expectIm(primary, t).to.include({ currentTime: 30, bufferedEnd: 30 });
        expectIm(integrated, t).to.include({
          currentTime: 30,
          bufferedEnd: 30,
        });
        expectIm(interstitialPlayer, t).to.not.be.null;
        expect(im.interstitialPlayer?.assetPlayers).to.have.lengthOf(3);
        expectIm(interstitialPlayer, t).to.include({
          playingIndex: 0,
          currentTime: 0,
          duration: 15,
        });
      });
      hls.on(Events.INTERSTITIAL_ASSET_PLAYER_CREATED, (t, data) => {
        const assetListIndex = data.assetListIndex;
        const e = `${t}_${assetListIndex}`;
        logIm(e);
        expectIm(primary, e).to.include({ currentTime: 30 });
        expectIm(integrated, e).to.include({ currentTime: 30 });
        expectIm(interstitialPlayer, e).to.not.be.null;
        expectAssetPlayer(assetListIndex, e).to.include({
          currentTime: 0,
          bufferedEnd: 0,
          duration: 5,
          interstitialId: 'mid-10',
          startOffset: assetListIndex * 5,
          destroyed: false,
        });
      });
      hls.on(Events.INTERSTITIAL_ASSET_STARTED, (t, data) => {
        const assetListIndex = data.assetListIndex;
        const e = `${t}_${assetListIndex}`;
        logIm(e);
        if (assetListIndex === 0) {
          expectIm(primary, e).to.include({ currentTime: 30, bufferedEnd: 30 });
          expectIm(integrated, e).to.include({
            currentTime: 30,
            bufferedEnd: 30,
          });
        } else if (assetListIndex === 1) {
          expectIm(primary, e).to.include({ currentTime: 30, bufferedEnd: 30 });
          expectIm(integrated, e).to.include({
            currentTime: 35,
            bufferedEnd: 35,
          });
        } else if (assetListIndex === 2) {
          expectIm(primary, e).to.include({ currentTime: 30, bufferedEnd: 30 });
          expectIm(integrated, e).to.include({
            currentTime: 40,
            bufferedEnd: 40,
          });
        }
        expectIm(interstitialPlayer, e).to.not.be.null;
        expectIm(interstitialPlayer, e).to.include({
          playingIndex: assetListIndex,
          currentTime: assetListIndex * 5,
          duration: 15,
        });
        expectAssetPlayer(assetListIndex, e).to.include({
          currentTime: 0,
          bufferedEnd: 0,
          duration: 5,
          interstitialId: 'mid-10',
          startOffset: assetListIndex * 5,
          destroyed: false,
        });
      });
      hls.on(Events.INTERSTITIAL_ASSET_ENDED, (t, data) => {
        const assetListIndex = data.assetListIndex;
        const e = `${t}_${assetListIndex}`;
        logIm(e);
        if (assetListIndex === 0) {
          expectIm(primary, e).to.include({ currentTime: 30, bufferedEnd: 30 });
          expectIm(integrated, e).to.include({
            currentTime: 35,
            bufferedEnd: 35,
          });
        } else if (assetListIndex === 1) {
          expectIm(primary, e).to.include({ currentTime: 30, bufferedEnd: 30 });
          expectIm(integrated, e).to.include({
            currentTime: 40,
            bufferedEnd: 40,
          });
        } else if (assetListIndex === 2) {
          expectIm(primary, e).to.include({ currentTime: 40, bufferedEnd: 40 });
          expectIm(integrated, e).to.include({
            currentTime: 45,
            bufferedEnd: 45,
          });
        }
        expectIm(interstitialPlayer, t).to.not.be.null;
        expectIm(interstitialPlayer, t).to.include({
          playingIndex: assetListIndex,
          currentTime: 5 + assetListIndex * 5,
          duration: 15,
        });
        expectAssetPlayer(assetListIndex, t).to.include({
          currentTime: 5,
          bufferedEnd: 5,
          duration: 5,
          interstitialId: 'mid-10',
          startOffset: assetListIndex * 5,
          destroyed: false,
        });
      });
      hls.on(Events.INTERSTITIAL_ENDED, (t) => {
        logIm(t);
        expectIm(primary, t).to.include({ currentTime: 40, bufferedEnd: 40 });
        expectIm(integrated, t).to.include({
          currentTime: 45,
          bufferedEnd: 45,
        });
        expectIm(interstitialPlayer, t).to.not.be.null;
      });
      hls.on(Events.INTERSTITIALS_PRIMARY_RESUMED, (t) => {
        logIm(t);
        expectIm(primary, t).to.include({ currentTime: 40, bufferedEnd: 40 });
        expectIm(integrated, t).to.include({
          currentTime: 45,
          bufferedEnd: 45,
        });
        expectIm(interstitialPlayer, t).to.be.null;
      });
      hls.on(Events.MEDIA_ATTACHING, (t) => {
        const playingIndex = im.playingIndex;
        logIm(`${t} playingIndex ${playingIndex}`);
        if (playingIndex < 2) {
          expectIm(primary, t).to.include({ currentTime: 0, bufferedEnd: 0 });
          expectIm(integrated, t).to.include({
            currentTime: 0,
            bufferedEnd: 0,
          });
          expectIm(interstitialPlayer, t).to.be.null;
        } else {
          expectIm(primary, t).to.include({ currentTime: 40, bufferedEnd: 40 });
          expectIm(integrated, t).to.include({
            currentTime: 45,
            bufferedEnd: 45,
          });
          expectIm(interstitialPlayer, t).to.be.null;
        }
      });
      hls.on(Events.MEDIA_ATTACHED, (t) => {
        logIm(t);
        expectIm(primary, t).to.include({ currentTime: 0, bufferedEnd: 0 });
        expectIm(integrated, t).to.include({ currentTime: 0, bufferedEnd: 0 });
        expectIm(interstitialPlayer, t).to.be.null;
      });
      hls.once(Events.MEDIA_DETACHING, (t) => {
        logIm(t);
        expectIm(primary, t).to.include({ currentTime: 30, bufferedEnd: 30 });
        expectIm(integrated, t).to.include({
          currentTime: 30,
          bufferedEnd: 30,
        });
      });

      // Loaded playlist (before attaching media)
      setLoadedLevelDetails(playlist);

      expect(im.events).is.an('array').which.has.lengthOf(1);
      expect(im.schedule).is.an('array').which.has.lengthOf(3);
      const eventsBeforeAttach = getTriggerCalls();
      expect(eventsBeforeAttach).to.deep.equal(
        [Events.LEVEL_UPDATED, Events.INTERSTITIALS_UPDATED],
        `Actual events before attach`,
      );
      expect(im.bufferingIndex).to.equal(-1, 'bufferingIndex');
      expect(im.playingIndex).to.equal(-1, 'playingIndex');
      expectIm(primary, 'before attach').to.include({
        currentTime: 0,
        bufferedEnd: 0,
      });
      expectIm(integrated, 'before attach').to.include({
        currentTime: 0,
        bufferedEnd: 0,
      });

      // Attach media
      hls.trigger.resetHistory();
      const media = attachMediaToHls();
      media.__timeUpdate(10);
      logIm('timeupdate-10');
      expectIm(primary, 'media@10').to.include({
        currentTime: 10,
        bufferedEnd: 10,
      });
      expectIm(integrated, 'media@10').to.include({
        currentTime: 10,
        bufferedEnd: 10,
      });
      const eventsAfterAttach = getTriggerCalls();
      const expectedEvents = [
        Events.MEDIA_ATTACHING,
        Events.MEDIA_ATTACHED,
        Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
      ];
      expect(eventsAfterAttach).to.deep.equal(
        expectedEvents,
        `Actual events after attach`,
      );
      // Advance to interstitial
      hls.trigger.resetHistory();
      media.__timeUpdate(30);
      logIm('timeupdate-30');

      const eventsAfterPlayback = getTriggerCalls();
      const expectedEventsAfterPlayback = [
        Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
        Events.ASSET_LIST_LOADING,
        Events.INTERSTITIAL_STARTED,
      ];
      expect(eventsAfterPlayback).to.deep.equal(
        expectedEventsAfterPlayback,
        `Actual events after playback to interstitial`,
      );
      expect(im.bufferingIndex).to.equal(1, 'bufferingIndex a');
      expect(im.playingIndex).to.equal(1, 'playingIndex a');
      expectIm(primary, 'media@30').to.include({ currentTime: 30 });
      expectIm(integrated, 'media@30').to.include({ currentTime: 30 });

      // Load asset-list
      hls.trigger.resetHistory();
      const interstitial = im.events[0];
      interstitial.assetListResponse = {
        ASSETS: [
          { URI: 'http://example.com/a.m3u8', DURATION: '5' },
          { URI: 'http://example.com/b.m3u8', DURATION: '5' },
          { URI: 'http://example.com/c.m3u8', DURATION: '5' },
        ],
      };
      hls.trigger(Events.ASSET_LIST_LOADED, {
        event: interstitial,
        assetListResponse: interstitial.assetListResponse,
        networkDetails: new Response('ok'),
      });
      const callsAfterAssetsLoaded = getTriggerCalls();
      expect(callsAfterAssetsLoaded).to.deep.equal(
        [
          Events.ASSET_LIST_LOADED,
          Events.INTERSTITIAL_ASSET_PLAYER_CREATED,
          Events.INTERSTITIAL_ASSET_PLAYER_CREATED,
          Events.INTERSTITIAL_ASSET_PLAYER_CREATED,
          Events.INTERSTITIAL_ASSET_STARTED,
          Events.MEDIA_DETACHING,
          Events.MEDIA_DETACHED,
        ],
        `Actual events after asset-list`,
      );
      expect(im.interstitialPlayer, `interstitialPlayer`).to.not.be.null;

      // Advance assets
      const advanceAsset = (
        sequence: string,
        assetIndex: number,
        integratedTimePlusThree: number,
      ) => {
        hls.trigger.resetHistory();

        media.__timeUpdate(media.currentTime + 3);
        logIm(`${sequence} asset@3`);
        expectIm(primary, `${sequence} asset@3`).to.include({
          currentTime: 30,
        });
        expectIm(integrated, `${sequence} asset@3`).to.include({
          currentTime: integratedTimePlusThree,
        });
        expectIm(
          interstitialPlayer,
          `interstitialPlayer ${sequence} asset@3`,
        ).to.include({
          playingIndex: assetIndex,
          currentTime: integratedTimePlusThree - 30,
          duration: 15,
        });
        media.__timeUpdate(media.currentTime + 2);
        const assetPlayerHls =
          im.interstitialPlayer?.assetPlayers[assetIndex]?.hls;
        expect(assetPlayerHls, 'asset player is defined').to.not.be.null;
        // end asset playback
        assetPlayerHls?.trigger(Events.MEDIA_ENDED, {
          stalled: false,
        });
        const eventsBetweenAssets = getTriggerCalls();
        const expectedEventsBetweensAssets = [
          Events.INTERSTITIAL_ASSET_ENDED,
          Events.INTERSTITIAL_ASSET_STARTED,
        ];
        expect(eventsBetweenAssets).to.deep.equal(
          expectedEventsBetweensAssets,
          `Actual events after ${sequence} asset`,
        );
      };
      // To second asset
      advanceAsset('first', 0, 33);
      // To third asset
      advanceAsset('second', 1, 38);

      // Advance to primary
      hls.trigger.resetHistory();

      media.__timeUpdate(media.currentTime + 5);
      expectIm(primary, `third asset@5`).to.include({ currentTime: 30 });
      expectIm(integrated, `third asset@5`).to.include({ currentTime: 45 });
      expectIm(
        interstitialPlayer,
        `interstitialPlayer third asset@5`,
      ).to.include({ playingIndex: 2, currentTime: 15, duration: 15 });

      const assetPlayerHls = im.interstitialPlayer?.assetPlayers[2]?.hls;
      expect(assetPlayerHls, 'last asset player is defined').to.not.be.null;
      // end last asset playback
      assetPlayerHls?.trigger(Events.MEDIA_ENDED, {
        stalled: false,
      });
      const eventsAfterLastAsset = getTriggerCalls();
      const expectedEndLastAssetEvents = [
        Events.INTERSTITIAL_ASSET_ENDED,
        Events.INTERSTITIAL_ENDED,
        Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
        Events.MEDIA_ATTACHING,
        Events.INTERSTITIALS_PRIMARY_RESUMED,
      ];
      expect(eventsAfterLastAsset).to.deep.equal(
        expectedEndLastAssetEvents,
        `Actual events after last asset`,
      );
      expect(im.bufferingIndex).to.equal(2, 'bufferingIndex after skip');
      expect(im.playingIndex).to.equal(2, 'playingIndex after skip');
      expectIm(primary, `after break`).to.include({ currentTime: 40 });
      expectIm(integrated, `after break`).to.include({ currentTime: 45 });
      media.__timeUpdate(50);
      expectIm(primary, `media@50`).to.include({ currentTime: 50 });
      expectIm(integrated, `media@50`).to.include({ currentTime: 55 });
      logIm('timeupdate-50');
    });
  });

  describe('Live start', function () {
    it('request asset-list with _HLS_start_offset when joining', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-VERSION:7
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PROGRAM-DATE-TIME:2024-02-23T15:00:00.000Z
#EXT-X-MAP:URI="fileSequence0.mp4"
#EXTINF:10,	
fileSequence1.mp4
#EXTINF:10,	
fileSequence2.mp4
#EXT-X-DATERANGE:ID="mid-live",CLASS="com.apple.hls.interstitial",START-DATE="2024-02-23T15:00:20.000Z",DURATION=30,X-ASSET-LIST="https://example.com/mid.json"
#EXTINF:10,	
fileSequence3.mp4
#EXTINF:10,	
fileSequence4.mp4
#EXTINF:10,	
fileSequence5.mp4
#EXTINF:10,	
fileSequence6.mp4`;

      // Loaded playlist (before attaching media)
      setLoadedLevelDetails(playlist);
      const insterstitials = interstitialsController.interstitialsManager;
      if (!insterstitials) {
        expect(insterstitials, 'interstitialsManager').to.be.an('object');
        return;
      }
      expect(insterstitials.events).is.an('array').which.has.lengthOf(1);
      expect(insterstitials.schedule).is.an('array').which.has.lengthOf(3);

      // Capture asset-list request
      const loadSpy = sandbox.spy(hls.config.loader.prototype, 'load');
      const primaryId = hls.sessionId;

      // Attach media
      hls.trigger.resetHistory();
      attachMediaToHls();
      const eventsAfterAttach = getTriggerCalls();
      const expectedEvents = [
        Events.MEDIA_ATTACHING,
        Events.MEDIA_ATTACHED,
        Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
        Events.ASSET_LIST_LOADING,
        Events.INTERSTITIAL_STARTED,
      ];
      expect(loadSpy).calledOnce;
      const assetListUrl = loadSpy.getCalls()[0].args[0].url;
      expect(
        assetListUrl,
        '_HLS_primary_id and _HLS_start_offset match',
      ).to.equal(
        `https://example.com/mid.json?_HLS_primary_id=${primaryId}&_HLS_start_offset=10`,
      );
      expect(eventsAfterAttach).to.deep.equal(
        expectedEvents,
        `Actual events after attach`,
      );
      expect(insterstitials.bufferingIndex).to.equal(1, 'bufferingIndex a');
      expect(insterstitials.playingIndex).to.equal(1, 'playingIndex a');
      expect(insterstitials.primary.currentTime).to.equal(30, 'timelinePos a');

      // Load asset-list
      hls.trigger.resetHistory();
      const interstitial = insterstitials.events[0];
      interstitial.assetListResponse = {
        ASSETS: [{ URI: 'https://example.com/midroll.m3u8', DURATION: '30' }],
      };
      hls.trigger(Events.ASSET_LIST_LOADED, {
        event: interstitial,
        assetListResponse: interstitial.assetListResponse,
        networkDetails: new Response('ok'),
      });
      const eventsAfterAssetListLoaded = getTriggerCalls();
      expect(eventsAfterAssetListLoaded).to.deep.equal(
        [
          Events.ASSET_LIST_LOADED,
          Events.INTERSTITIAL_ASSET_PLAYER_CREATED,
          Events.INTERSTITIAL_ASSET_STARTED,
          Events.MEDIA_DETACHING,
          Events.MEDIA_DETACHED,
        ],
        `Actual events after asset-list`,
      );
      expect(insterstitials.bufferingIndex).to.equal(1, 'bufferingIndex b');
      expect(insterstitials.playingIndex).to.equal(1, 'playingIndex b');
      expect(insterstitials.primary.currentTime).to.equal(30, 'timelinePos b');
      expect(
        insterstitials.interstitialPlayer,
        `interstitialPlayer`,
      ).to.include({
        playingIndex: 0,
        currentTime: 0,
        duration: 30,
      });
      expect(
        insterstitials.interstitialPlayer?.scheduleItem?.event,
        `interstitialPlayer.scheduleItem`,
      ).to.include({ identifier: 'mid-live' });
      expect(
        insterstitials.interstitialPlayer?.assetPlayers,
        `interstitialPlayer.assetPlayers[]`,
      ).to.have.lengthOf(1);
      expect(
        insterstitials.interstitialPlayer?.assetPlayers[0]?.hls?.url,
        `interstitialPlayer.assetPlayers[0].hls.url`,
      ).to.equal(
        `https://example.com/midroll.m3u8?_HLS_primary_id=${primaryId}`,
      );
    });
  });
});
