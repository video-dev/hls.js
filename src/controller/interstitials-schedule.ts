import { findFragmentByPTS } from './fragment-finders';
import {
  type BaseData,
  InterstitialEvent,
  InterstitialId,
  TimelineOccupancy,
} from '../loader/interstitial-event';
import type { DateRange } from '../loader/date-range';
import type { MediaSelection } from '../types/media-playlist';

export type InterstitialScheduleEventItem = {
  event: InterstitialEvent;
  start: number;
  end: number;
  playout: {
    start: number;
    end: number;
  };
  integrated: {
    start: number;
    end: number;
  };
};

export type InterstitialSchedulePrimaryItem = {
  nextEvent: InterstitialEvent | null;
  previousEvent: InterstitialEvent | null;
  event?: undefined;
  start: number;
  end: number;
  playout: {
    start: number;
    end: number;
  };
  integrated: {
    start: number;
    end: number;
  };
};

export type InterstitialScheduleItem =
  | InterstitialScheduleEventItem
  | InterstitialSchedulePrimaryItem;

export type InterstitialScheduleDurations = {
  primary: number;
  playout: number;
  integrated: number;
};

export type TimelineType = 'primary' | 'playout' | 'integrated';

type ScheduleUpdateCallback = (removed: InterstitialEvent[]) => void;

export class InterstitialsSchedule {
  private onScheduleUpdate: ScheduleUpdateCallback;
  private eventMap: Record<string, InterstitialEvent> = {};
  public events: InterstitialEvent[] | null = null;
  public items: InterstitialScheduleItem[] | null = null;
  public durations: InterstitialScheduleDurations = {
    primary: 0,
    playout: 0,
    integrated: 0,
  };

  constructor(onScheduleUpdate: ScheduleUpdateCallback) {
    this.onScheduleUpdate = onScheduleUpdate;
  }

  public destroy() {
    this.reset();
    // @ts-ignore
    this.onScheduleUpdate = null;
  }

  public reset() {
    this.eventMap = {};
    this.setDurations(0, 0, 0);
    if (this.events) {
      this.events.forEach((interstitial) => interstitial.reset());
    }
    this.events = this.items = null;
  }

  get duration(): number {
    const items = this.items;
    return items ? items[items.length - 1].end : 0;
  }

  get length(): number {
    return this.items ? this.items.length : 0;
  }

  public getEvent(
    identifier: InterstitialId | undefined,
  ): InterstitialEvent | null {
    return identifier ? this.eventMap[identifier] || null : null;
  }

  public hasEvent(identifier: InterstitialId): boolean {
    return identifier in this.eventMap;
  }

  public findItemIndex(item: InterstitialScheduleItem, time?: number): number {
    if (item.event) {
      // Find Event Item
      return this.findEventIndex(item.event.identifier);
    }
    // Find Primary Item
    let index = -1;
    if (item.nextEvent) {
      index = this.findEventIndex(item.nextEvent.identifier) - 1;
    } else if (item.previousEvent) {
      index = this.findEventIndex(item.previousEvent.identifier) + 1;
    }
    const items = this.items;
    if (items) {
      if (!items[index]) {
        if (time === undefined) {
          time = item.start;
        }
        index = this.findItemIndexAtTime(time);
      }
      // Only return index of a Primary Item
      while (index >= 0 && items[index]?.event) {
        index--;
      }
    }
    return index;
  }

  public findItemIndexAtTime(
    timelinePos: number,
    timelineType?: TimelineType,
  ): number {
    const items = this.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        let timeRange: { start: number; end: number } = items[i];
        if (timelineType && timelineType !== 'primary') {
          timeRange = timeRange[timelineType];
        }
        if (
          timelinePos === timeRange.start ||
          (timelinePos > timeRange.start && timelinePos < timeRange.end)
        ) {
          return i;
        }
      }
    }
    return -1;
  }

  public findJumpRestrictedIndex(startIndex: number, endIndex: number): number {
    const items = this.items;
    if (items) {
      for (let i = startIndex; i <= endIndex; i++) {
        if (!items[i]) {
          break;
        }
        const event = items[i].event;
        if (event?.restrictions.jump && !event.appendInPlace) {
          return i;
        }
      }
    }
    return -1;
  }

  public findEventIndex(identifier: InterstitialId): number {
    const items = this.items;
    if (items) {
      for (let i = items.length; i--; ) {
        if (items[i].event?.identifier === identifier) {
          return i;
        }
      }
    }
    return -1;
  }

  public findAssetIndex(event: InterstitialEvent, timelinePos: number): number {
    const assetList = event.assetList;
    const length = assetList.length;
    if (length > 1) {
      for (let i = 0; i < length; i++) {
        const asset = assetList[i];
        if (!asset.error) {
          const timelineStart = asset.timelineStart;
          if (
            timelinePos === timelineStart ||
            (timelinePos > timelineStart &&
              timelinePos < timelineStart + (asset.duration || 0))
          ) {
            return i;
          }
        }
      }
    }
    return 0;
  }

  public get assetIdAtEnd(): string | null {
    const interstitialAtEnd = this.items?.[this.length - 1]?.event;
    if (interstitialAtEnd) {
      const assetList = interstitialAtEnd.assetList;
      const assetAtEnd = assetList[assetList.length - 1];
      if (assetAtEnd) {
        return assetAtEnd.identifier;
      }
    }
    return null;
  }

  public parseInterstitialDateRanges(mediaSelection: MediaSelection) {
    const details = mediaSelection.main.details!;
    const { dateRanges } = details;
    const previousInterstitialEvents = this.events;
    const interstitialEvents = this.parseDateRanges(dateRanges, {
      url: details.url,
    });
    const ids = Object.keys(dateRanges);
    const removedInterstitials = previousInterstitialEvents
      ? previousInterstitialEvents.filter(
          (event) => !ids.includes(event.identifier),
        )
      : [];
    if (interstitialEvents.length) {
      // pre-rolls, post-rolls, and events with the same start time are played in playlist tag order
      // all other events are ordered by start time
      interstitialEvents.sort((a, b) => {
        const aPre = a.cue.pre;
        const aPost = a.cue.post;
        const bPre = b.cue.pre;
        const bPost = b.cue.post;
        if (aPre && !bPre) {
          return -1;
        }
        if (bPre && !aPre) {
          return 1;
        }
        if (aPost && !bPost) {
          return 1;
        }
        if (bPost && !aPost) {
          return -1;
        }
        if (!aPre && !bPre && !aPost && !bPost) {
          const startA = a.startTime;
          const startB = b.startTime;
          if (startA !== startB) {
            return startA - startB;
          }
        }
        return a.dateRange.tagOrder - b.dateRange.tagOrder;
      });
    }
    this.events = interstitialEvents;

    // Clear removed DateRanges from buffered list (kills playback of active Interstitials)
    removedInterstitials.forEach((interstitial) => {
      this.removeEvent(interstitial);
    });

    this.updateSchedule(mediaSelection, removedInterstitials);
  }

  public updateSchedule(
    mediaSelection: MediaSelection,
    removedInterstitials: InterstitialEvent[] = [],
  ) {
    const events = this.events || [];
    if (events.length || removedInterstitials.length) {
      const currentItems = this.items;
      const updatedItems = this.parseSchedule(events, mediaSelection);
      const updated =
        removedInterstitials.length ||
        currentItems?.length !== updatedItems.length ||
        updatedItems.some((item, i) => {
          return (
            Math.abs(item.playout.start - currentItems[i].playout.start) >
              0.005 ||
            Math.abs(item.playout.end - currentItems[i].playout.end) > 0.005
          );
        });
      if (updated) {
        this.items = updatedItems;
        // call interstitials-controller onScheduleUpdated()
        this.onScheduleUpdate(removedInterstitials);
      }
    }
  }

  private parseDateRanges(
    dateRanges: Record<string, DateRange>,
    baseData: BaseData,
  ): InterstitialEvent[] {
    const interstitialEvents: InterstitialEvent[] = [];
    const ids = Object.keys(dateRanges);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const dateRange = dateRanges[id];
      if (dateRange.isInterstitial) {
        let interstitial = this.eventMap[id];
        if (interstitial) {
          // Update InterstitialEvent already parsed and mapped
          // This retains already loaded duration and loaded asset list info
          interstitial.setDateRange(dateRange);
        } else {
          interstitial = new InterstitialEvent(dateRange, baseData);
          this.eventMap[id] = interstitial;
        }
        interstitialEvents.push(interstitial);
      }
    }
    return interstitialEvents;
  }

  private parseSchedule(
    interstitialEvents: InterstitialEvent[],
    mediaSelection: MediaSelection,
  ): InterstitialScheduleItem[] {
    const schedule: InterstitialScheduleItem[] = [];
    const details = mediaSelection.main.details!;
    const primaryDuration = details.live ? Infinity : details.edge;
    let playoutDuration = 0;

    // Filter events that have errored from the schedule (Primary fallback)
    interstitialEvents = interstitialEvents.filter((event) => !event.error);
    if (interstitialEvents.length) {
      // Update Schedule
      this.resolveOffsets(interstitialEvents, mediaSelection);

      // Populate Schedule with Interstitial Event and Primary Segment Items
      let primaryPosition = 0;
      let integratedTime = 0;
      interstitialEvents.forEach((interstitial, i) => {
        const preroll = interstitial.cue.pre;
        const postroll = interstitial.cue.post;
        const previousEvent = interstitialEvents[i - 1] || null;
        const appendInPlace = interstitial.appendInPlace;
        const eventStart = postroll
          ? primaryDuration
          : interstitial.startOffset;
        const interstitialDuration = interstitial.duration;
        const timelineDuration =
          interstitial.timelineOccupancy === TimelineOccupancy.Range
            ? interstitialDuration
            : 0;
        const resumptionOffset = interstitial.resumptionOffset;
        const inSameStartTimeSequence = previousEvent?.startTime === eventStart;

        if (preroll || (!postroll && eventStart <= 0)) {
          // preroll or in-progress midroll
          const start = eventStart + interstitial.cumulativeDuration;
          const end =
            start + (appendInPlace ? interstitialDuration : resumptionOffset);
          const integratedStart = integratedTime;
          integratedTime += timelineDuration;
          interstitial.timelineStart = start;
          const playoutStart = playoutDuration;
          playoutDuration += interstitialDuration;
          schedule.push({
            event: interstitial,
            start,
            end,
            playout: {
              start: playoutStart,
              end: playoutDuration,
            },
            integrated: {
              start: integratedStart,
              end: integratedTime,
            },
          });
        } else if (eventStart <= primaryDuration) {
          if (primaryPosition < eventStart && !inSameStartTimeSequence) {
            // primary segment
            const timelineStart = primaryPosition;
            const integratedStart = integratedTime;
            const segmentDuration = eventStart - primaryPosition;
            integratedTime += segmentDuration;
            const playoutStart = playoutDuration;
            playoutDuration += segmentDuration;
            const primarySegment = {
              previousEvent: interstitialEvents[i - 1] || null,
              nextEvent: interstitial,
              start: timelineStart,
              end: timelineStart + segmentDuration,
              playout: {
                start: playoutStart,
                end: playoutDuration,
              },
              integrated: {
                start: integratedStart,
                end: integratedTime,
              },
            };

            schedule.push(primarySegment);
          }
          // midroll / postroll
          const start = eventStart;
          let end =
            start + (appendInPlace ? interstitialDuration : resumptionOffset);
          if (postroll) {
            end = start;
          }
          interstitial.timelineStart = start;
          const integratedStart = integratedTime;
          integratedTime += timelineDuration;
          const playoutStart = playoutDuration;
          playoutDuration += interstitialDuration;
          schedule.push({
            event: interstitial,
            start,
            end,
            playout: {
              start: playoutStart,
              end: playoutDuration,
            },
            integrated: {
              start: integratedStart,
              end: integratedTime,
            },
          });
        } else {
          // Interstitial starts after end of primary VOD - not included in schedule
          return;
        }
        const resumeTime = interstitial.resumeTime;
        if (postroll || resumeTime > primaryDuration) {
          primaryPosition = primaryDuration;
        } else {
          primaryPosition = resumeTime;
        }
      });
      if (primaryPosition < primaryDuration) {
        // last primary segment
        const timelineStart = primaryPosition;
        const integratedStart = integratedTime;
        const segmentDuration = primaryDuration - primaryPosition;
        integratedTime += segmentDuration;
        const playoutStart = playoutDuration;
        playoutDuration += segmentDuration;
        schedule.push({
          previousEvent: interstitialEvents[interstitialEvents.length - 1],
          nextEvent: null,
          start: primaryPosition,
          end: timelineStart + segmentDuration,
          playout: {
            start: playoutStart,
            end: playoutDuration,
          },
          integrated: {
            start: integratedStart,
            end: integratedTime,
          },
        });
      }
      this.setDurations(primaryDuration, playoutDuration, integratedTime);
    } else {
      // no interstials - schedule is one primary segment
      const start = 0;
      schedule.push({
        previousEvent: null,
        nextEvent: null,
        start,
        end: primaryDuration,
        playout: {
          start,
          end: primaryDuration,
        },
        integrated: {
          start,
          end: primaryDuration,
        },
      });
      this.setDurations(primaryDuration, primaryDuration, primaryDuration);
    }
    return schedule;
  }

  private setDurations(primary: number, playout: number, integrated: number) {
    this.durations = {
      primary,
      playout,
      integrated,
    };
  }

  private resolveOffsets(
    interstitialEvents: InterstitialEvent[],
    mediaSelection: MediaSelection,
  ) {
    const details = mediaSelection.main.details!;
    const primaryDuration = details.live ? Infinity : details.edge;

    // First resolve cumulative resumption offsets for Interstitials that start at the same DateTime
    let cumulativeDuration = 0;
    let lastScheduledStart = -1;
    interstitialEvents.forEach((interstitial, i) => {
      const preroll = interstitial.cue.pre;
      const postroll = interstitial.cue.post;
      const eventStart = preroll
        ? 0
        : postroll
          ? primaryDuration
          : interstitial.startTime;
      this.updateAssetDurations(interstitial);

      // X-RESUME-OFFSET values of interstitials scheduled at the same time are cumulative
      const inSameStartTimeSequence = lastScheduledStart === eventStart;
      if (inSameStartTimeSequence) {
        interstitial.cumulativeDuration = cumulativeDuration;
      } else {
        cumulativeDuration = 0;
        lastScheduledStart = eventStart;
      }
      if (!postroll && interstitial.snapOptions.in) {
        // FIXME: Include audio playlist in snapping
        interstitial.resumeAnchor =
          findFragmentByPTS(
            null,
            details.fragments,
            interstitial.startOffset + interstitial.resumptionOffset,
            0,
            0,
          ) || undefined;
      }

      // Check if primary fragments align with resumption offset and disable appendInPlace if they do not
      if (interstitial.appendInPlace) {
        const alignedSegmentStart = this.primaryCanResumeInPlaceAt(
          interstitial,
          mediaSelection,
        );
        if (!alignedSegmentStart) {
          interstitial.appendInPlace = false;
        }
      }
      if (!interstitial.appendInPlace) {
        // abutting Interstitials must use the same MediaSource strategy, this applies to all whether or not they are back to back:
        for (let j = i - 1; i--; ) {
          if (
            interstitialEvents[j].resumeTime >=
            interstitialEvents[j + 1].startTime
          ) {
            interstitialEvents[j].appendInPlace = false;
          }
        }
      }
      // Update cumulativeDuration for next abutting interstitial with the same start date
      const resumeOffset = Number.isFinite(interstitial.resumeOffset)
        ? interstitial.resumeOffset
        : interstitial.duration;
      cumulativeDuration += resumeOffset;
    });
  }

  private primaryCanResumeInPlaceAt(
    interstitial: InterstitialEvent,
    mediaSelection: MediaSelection,
  ): boolean {
    const resumesInPlaceAt =
      interstitial.startTime + interstitial.resumptionOffset;
    if (Math.abs(interstitial.resumeTime - resumesInPlaceAt) > 0.1) {
      return false;
    }
    const time = interstitial.resumeTime;
    return (
      !mediaSelection ||
      !Object.keys(mediaSelection).some((playlistType) => {
        const details = mediaSelection[playlistType].details;
        if (time > details.edge) {
          return false;
        }
        const startFragment = findFragmentByPTS(null, details.fragments, time);
        return (
          !startFragment ||
          !(
            Math.abs(startFragment.start - time) < 0.2 ||
            Math.abs(startFragment.end - time) < 0.2
          )
        );
      })
    );
  }

  private updateAssetDurations(interstitial: InterstitialEvent) {
    const eventStart = interstitial.timelineStart;
    let sumDuration = 0;
    let hasUnknownDuration = false;
    let hasErrors = false;
    interstitial.assetList.forEach((asset, i) => {
      const timelineStart = eventStart + sumDuration;
      asset.startOffset = sumDuration;
      asset.timelineStart = timelineStart;
      hasUnknownDuration ||= asset.duration === null;
      hasErrors ||= !!asset.error;
      const duration = asset.error ? 0 : (asset.duration as number) || 0;
      sumDuration += duration;
    });
    // Use the sum of known durations when it is greater than the stated duration
    if (hasUnknownDuration && !hasErrors) {
      interstitial.duration = Math.max(sumDuration, interstitial.duration);
    } else {
      interstitial.duration = sumDuration;
    }
  }

  private removeEvent(interstitial: InterstitialEvent) {
    interstitial.reset();
    delete this.eventMap[interstitial.identifier];
  }
}
