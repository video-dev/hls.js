import chai from 'chai';
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
import type { HlsConfig } from '../../../src/config';
import type { InterstitialScheduleItem } from '../../../src/controller/interstitials-schedule';
import type {
  ComponentAPI,
  NetworkComponentAPI,
} from '../../../src/types/component-api';

chai.use(sinonChai);
const expect = chai.expect;

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
  }
}

class MockMediaElement {
  public currentTime: number = 0;
  public duration: number = Infinity;
  public textTracks: any[] = [];
  addEventListener() {}
  removeEventListener() {}
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

  function setLoadedLevelDetails(playlist: string) {
    const details = M3U8Parser.parseLevelPlaylist(
      playlist,
      'http://example.com/playlist.m3u8',
      0,
      PlaylistLevelType.MAIN,
      0,
      null,
    );
    const attrs = new AttrList({});
    const level = new Level({
      name: '',
      url: '',
      attrs,
      bitrate: 0,
    });
    (hls as any).levelController._levels[0] = level;
    level.details = details;
    return details;
  }

  beforeEach(function () {
    hls = new HLSTestPlayer({
      debug: true,
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
      const details = setLoadedLevelDetails(playlist);
      hls.trigger(Events.LEVEL_UPDATED, {
        details,
        level: 0,
      });
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
      if (!insterstitials.events || !schedule) {
        return;
      }
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
      expect(hls.trigger).to.have.callCount(3);
      expect(hls.trigger).to.have.been.calledWith(Events.LEVEL_UPDATED);
      expect(hls.trigger).to.have.been.calledWith(Events.INTERSTITIALS_UPDATED);
      expect(hls.trigger).to.have.been.calledWith(
        Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
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
      const details = setLoadedLevelDetails(playlist);
      hls.trigger(Events.LEVEL_UPDATED, {
        details,
        level: 0,
      });
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
          `Schedule items: ${schedule?.map((item) => `${item.start}-${item.end}`).join(', ')}`,
        );
      if (!events || !schedule) {
        return;
      }
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
      const details = setLoadedLevelDetails(playlist);
      hls.trigger(Events.LEVEL_UPDATED, {
        details,
        level: 0,
      });
      const insterstitials = interstitialsController.interstitialsManager;
      if (!insterstitials) {
        expect(insterstitials, 'interstitialsManager').to.be.an('object');
        return;
      }
      const events = insterstitials.events;
      const schedule = insterstitials.schedule;
      expect(events).is.an('array').which.has.lengthOf(5);
      const scheduleDebugString = `Schedule items: ${schedule?.map((item) => `[${item.event ? 'I' : 'P'}:${item.start}-${item.end}]`).join(', ')}`;
      expect(schedule)
        .is.an('array')
        .which.has.lengthOf(9, scheduleDebugString);
      if (!events || !schedule) {
        return;
      }
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
            schedule?.[i],
            `Expected to find a primary segment at index ${i}: ${scheduleDebugString}`,
          ).to.have.property('nextEvent');
        } else {
          expect(
            schedule?.[i],
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
      const details = setLoadedLevelDetails(playlist);
      hls.trigger(Events.LEVEL_UPDATED, {
        details,
        level: 0,
      });
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
      if (!insterstitials.events || !schedule) {
        return;
      }
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
      const details = setLoadedLevelDetails(playlist);
      hls.trigger(Events.LEVEL_UPDATED, {
        details,
        level: 0,
      });
      const insterstitials = interstitialsController.interstitialsManager;
      if (!insterstitials) {
        expect(insterstitials, 'interstitialsManager').to.be.an('object');
        return;
      }
      const schedule = insterstitials.schedule;
      expect(insterstitials.events).is.an('array').which.has.lengthOf(2);
      expect(schedule).is.an('array').which.has.lengthOf(2);
      if (!insterstitials.events || !schedule) {
        return;
      }
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
        const details = setLoadedLevelDetails(playlist);
        hls.trigger(Events.LEVEL_UPDATED, {
          details,
          level: 0,
        });
        const insterstitials = interstitialsController.interstitialsManager;
        if (!insterstitials) {
          expect(insterstitials, 'interstitialsManager').to.be.an('object');
          return;
        }
        const schedule = insterstitials.schedule;
        const events = insterstitials.events;
        expect(events).is.an('array').which.has.lengthOf(1);
        expect(schedule).is.an('array').which.has.lengthOf(2);
        if (!events || !schedule) {
          return;
        }
        expect(events[0]).to.deep.include({
          identifier: '0',
          timelineOccupancy: TimelineOccupancy.Point,
          supplementsPrimary: false,
          contentMayVary: true,
        });
        expect(insterstitials.primary).to.include({
          duration: 12,
        });
        expect(insterstitials.playout).to.include({
          duration: 34,
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
        const details = setLoadedLevelDetails(playlist);
        hls.trigger(Events.LEVEL_UPDATED, {
          details,
          level: 0,
        });
        const insterstitials = interstitialsController.interstitialsManager;
        if (!insterstitials) {
          expect(insterstitials, 'interstitialsManager').to.be.an('object');
          return;
        }
        const schedule = insterstitials.schedule;
        const events = insterstitials.events;
        expect(events).is.an('array').which.has.lengthOf(4);
        expect(schedule).is.an('array').which.has.lengthOf(5);
        if (!events || !schedule) {
          return;
        }
        eventAssertions.forEach((assertions, i) => {
          expect(events[i].identifier).to.equal('' + i);
          expect(events[i], `Interstitial Event "${i}"`).to.deep.include(
            assertions,
          );
        });
        expect(insterstitials.primary).to.include({
          duration: 12,
        });
        expect(insterstitials.playout).to.include({
          duration: 124,
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
#EXT-X-DATERANGE:ID="mid-30",CLASS="com.apple.hls.interstitial",START-DATE="2024-02-23T15:00:30.000Z",DURATION=16,X-ASSET-LIST="https://example.com/mid-list.m3u8"
#EXTINF:9.70970,	
#EXT-X-BITRATE:1768
fileSequence4.mp4
#EXTINF:9.10910,	
#EXT-X-BITRATE:621
fileSequence5.mp4`;

    it('should begin preroll on attach', function () {
      const details = setLoadedLevelDetails(playlist);
      hls.trigger(Events.LEVEL_UPDATED, {
        details,
        level: 0,
      });
      const insterstitials = interstitialsController.interstitialsManager;
      if (!insterstitials) {
        expect(insterstitials, 'interstitialsManager').to.be.an('object');
        return;
      }
      expect(insterstitials.events).is.an('array').which.has.lengthOf(2);
      expect(insterstitials.schedule).is.an('array').which.has.lengthOf(4);
      if (!insterstitials.events || !insterstitials.schedule) {
        return;
      }
      const callsWithPrerollBeforeAttach = getTriggerCalls();
      expect(callsWithPrerollBeforeAttach).to.deep.equal(
        [
          Events.LEVEL_UPDATED,
          Events.INTERSTITIALS_UPDATED,
          Events.INTERSTITIAL_ASSET_PLAYER_CREATED,
          Events.INTERSTITIAL_STARTED,
        ],
        `Actual events before attach: ${callsWithPrerollBeforeAttach.join(', ')}`,
      );
      hls.trigger.resetHistory();
      expect(insterstitials.bufferingIndex).to.equal(0, 'bufferingIndex');
      expect(insterstitials.playingIndex).to.equal(0, 'playingIndex');
      const media = new MockMediaElement();
      hls.attachMedia(media as unknown as HTMLMediaElement);
      (hls as any).bufferController.media = media;
      hls.trigger(Events.MEDIA_ATTACHED, {
        media: media as unknown as HTMLMediaElement,
        mediaSource: {} as any,
      });
      const callsWithPrerollAfterAttach = getTriggerCalls();
      const expectedEvents = [
        Events.MEDIA_ATTACHING,
        Events.MEDIA_ATTACHED,
        Events.INTERSTITIAL_ASSET_STARTED,
        Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
        Events.MEDIA_DETACHING,
      ];
      expect(callsWithPrerollAfterAttach).to.deep.equal(
        expectedEvents,
        `Actual events after attach: ${callsWithPrerollAfterAttach.join(', ')}`,
      );
      expect(insterstitials.bufferingIndex).to.equal(0, 'bufferingIndex');
      expect(insterstitials.playingIndex).to.equal(0, 'playingIndex');
    });

    it('should handle empty asset-lists', function () {
      const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-VERSION:7
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PROGRAM-DATE-TIME:2024-02-23T15:00:00.000Z
#EXT-X-DATERANGE:ID="start",CLASS="com.apple.hls.interstitial",START-DATE="2024-02-23T15:00:00.000Z",DURATION=5,X-ASSET-LIST="https://example.com/empty.m3u8",X-RESUME-OFFSET=5
#EXT-X-MAP:URI="fileSequence0.mp4"
#EXTINF:5,	
fileSequence1.mp4
#EXTINF:5,	
fileSequence2.mp4
#EXTINF:5,	
fileSequence3.mp4
#EXT-X-ENDLIST`;
      const media = new MockMediaElement();
      hls.attachMedia(media as unknown as HTMLMediaElement);
      (hls as any).bufferController.media = media;
      hls.trigger(Events.MEDIA_ATTACHED, {
        media: media as unknown as HTMLMediaElement,
        mediaSource: {} as any,
      });

      const details = setLoadedLevelDetails(playlist);
      hls.trigger(Events.LEVEL_UPDATED, {
        details,
        level: 0,
      });
      const insterstitials = interstitialsController.interstitialsManager;
      if (!insterstitials) {
        expect(insterstitials, 'interstitialsManager').to.be.an('object');
        return;
      }
      expect(insterstitials.events).is.an('array').which.has.lengthOf(1);
      expect(insterstitials.schedule).is.an('array').which.has.lengthOf(2);
      if (!insterstitials.events || !insterstitials.schedule) {
        return;
      }
      const callsBeforeAttach = getTriggerCalls();
      expect(callsBeforeAttach).to.deep.equal(
        [
          Events.MEDIA_ATTACHING,
          Events.MEDIA_ATTACHED,
          Events.LEVEL_UPDATED,
          Events.INTERSTITIALS_UPDATED,
          Events.ASSET_LIST_LOADING,
          Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
          Events.INTERSTITIAL_STARTED,
        ],
        `Actual events before asset-list: ${callsBeforeAttach.join(', ')}`,
      );
      hls.trigger.resetHistory();
      expect(insterstitials.bufferingIndex).to.equal(0, 'bufferingIndex');
      expect(insterstitials.playingIndex).to.equal(0, 'playingIndex');

      // Load empty asset-list
      const interstitial = insterstitials.events[0];
      interstitial.assetListResponse = { ASSETS: [] };
      hls.trigger(Events.ASSET_LIST_LOADED, {
        event: interstitial,
        assetListResponse: interstitial.assetListResponse,
        networkDetails: {},
      });
      const callsAfterAttach = getTriggerCalls();
      expect(callsAfterAttach).to.deep.equal(
        [
          Events.ASSET_LIST_LOADED,
          Events.INTERSTITIAL_ENDED,
          Events.INTERSTITIALS_BUFFERED_TO_BOUNDARY,
          Events.INTERSTITIALS_PRIMARY_RESUMED,
        ],
        `Actual events after asset-list: ${callsAfterAttach.join(', ')}`,
      );
      expect(insterstitials.bufferingIndex).to.equal(1, 'bufferingIndex');
      expect(insterstitials.playingIndex).to.equal(1, 'playingIndex');
    });
  });
});
