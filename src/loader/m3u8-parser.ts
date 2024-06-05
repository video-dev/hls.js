import { buildAbsoluteURL } from 'url-toolkit';
import { DateRange } from './date-range';
import { Fragment, MediaFragment, Part } from './fragment';
import { LevelDetails } from './level-details';
import { LevelKey } from './level-key';
import { AttrList } from '../utils/attr-list';
import { logger } from '../utils/logger';
import {
  addVariableDefinition,
  hasVariableReferences,
  importVariableDefinition,
  substituteVariables,
} from '../utils/variable-substitution';
import { isCodecType } from '../utils/codecs';
import type { CodecType } from '../utils/codecs';
import type { MediaPlaylist, MediaAttributes } from '../types/media-playlist';
import type { PlaylistLevelType } from '../types/loader';
import type { LevelAttributes, LevelParsed, VariableMap } from '../types/level';
import type { ContentSteeringOptions } from '../types/events';

type M3U8ParserFragments = Array<Fragment | null>;

export type ParsedMultivariantPlaylist = {
  contentSteering: ContentSteeringOptions | null;
  levels: LevelParsed[];
  playlistParsingError: Error | null;
  sessionData: Record<string, AttrList> | null;
  sessionKeys: LevelKey[] | null;
  startTimeOffset: number | null;
  variableList: VariableMap | null;
  hasVariableRefs: boolean;
};

type ParsedMultivariantMediaOptions = {
  AUDIO?: MediaPlaylist[];
  SUBTITLES?: MediaPlaylist[];
  'CLOSED-CAPTIONS'?: MediaPlaylist[];
};

const MASTER_PLAYLIST_REGEX =
  /#EXT-X-STREAM-INF:([^\r\n]*)(?:[\r\n](?:#[^\r\n]*)?)*([^\r\n]+)|#EXT-X-(SESSION-DATA|SESSION-KEY|DEFINE|CONTENT-STEERING|START):([^\r\n]*)[\r\n]+/g;
const MASTER_PLAYLIST_MEDIA_REGEX = /#EXT-X-MEDIA:(.*)/g;

const IS_MEDIA_PLAYLIST = /^#EXT(?:INF|-X-TARGETDURATION):/m; // Handle empty Media Playlist (first EXTINF not signaled, but TARGETDURATION present)

const LEVEL_PLAYLIST_REGEX_FAST = new RegExp(
  [
    /#EXTINF:\s*(\d*(?:\.\d+)?)(?:,(.*)\s+)?/.source, // duration (#EXTINF:<duration>,<title>), group 1 => duration, group 2 => title
    /(?!#) *(\S[^\r\n]*)/.source, // segment URI, group 3 => the URI (note newline is not eaten)
    /#EXT-X-BYTERANGE:*(.+)/.source, // next segment's byterange, group 4 => range spec (x@y)
    /#EXT-X-PROGRAM-DATE-TIME:(.+)/.source, // next segment's program date/time group 5 => the datetime spec
    /#.*/.source, // All other non-segment oriented tags will match with all groups empty
  ].join('|'),
  'g',
);

const LEVEL_PLAYLIST_REGEX_SLOW = new RegExp(
  [
    /#(EXTM3U)/.source,
    /#EXT-X-(DATERANGE|DEFINE|KEY|MAP|PART|PART-INF|PLAYLIST-TYPE|PRELOAD-HINT|RENDITION-REPORT|SERVER-CONTROL|SKIP|START):(.+)/
      .source,
    /#EXT-X-(BITRATE|DISCONTINUITY-SEQUENCE|MEDIA-SEQUENCE|TARGETDURATION|VERSION): *(\d+)/
      .source,
    /#EXT-X-(DISCONTINUITY|ENDLIST|GAP|INDEPENDENT-SEGMENTS)/.source,
    /(#)([^:]*):(.*)/.source,
    /(#)(.*)(?:.*)\r?\n?/.source,
  ].join('|'),
);

export default class M3U8Parser {
  static findGroup(
    groups: (
      | { id?: string; audioCodec?: string }
      | { id?: string; textCodec?: string }
    )[],
    mediaGroupId: string,
  ):
    | { id?: string; audioCodec?: string }
    | { id?: string; textCodec?: string }
    | undefined {
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (group.id === mediaGroupId) {
        return group;
      }
    }
  }

  static resolve(url, baseUrl) {
    return buildAbsoluteURL(baseUrl, url, { alwaysNormalize: true });
  }

  static isMediaPlaylist(str: string): boolean {
    return IS_MEDIA_PLAYLIST.test(str);
  }

  static parseMasterPlaylist(
    string: string,
    baseurl: string,
  ): ParsedMultivariantPlaylist {
    const hasVariableRefs = __USE_VARIABLE_SUBSTITUTION__
      ? hasVariableReferences(string)
      : false;
    const parsed: ParsedMultivariantPlaylist = {
      contentSteering: null,
      levels: [],
      playlistParsingError: null,
      sessionData: null,
      sessionKeys: null,
      startTimeOffset: null,
      variableList: null,
      hasVariableRefs,
    };
    const levelsWithKnownCodecs: LevelParsed[] = [];

    MASTER_PLAYLIST_REGEX.lastIndex = 0;

    let result: RegExpExecArray | null;
    while ((result = MASTER_PLAYLIST_REGEX.exec(string)) != null) {
      if (result[1]) {
        // '#EXT-X-STREAM-INF' is found, parse level tag  in group 1
        const attrs = new AttrList(result[1], parsed) as LevelAttributes;
        const uri = __USE_VARIABLE_SUBSTITUTION__
          ? substituteVariables(parsed, result[2])
          : result[2];
        const level: LevelParsed = {
          attrs,
          bitrate:
            attrs.decimalInteger('BANDWIDTH') ||
            attrs.decimalInteger('AVERAGE-BANDWIDTH'),
          name: attrs.NAME,
          url: M3U8Parser.resolve(uri, baseurl),
        };

        const resolution = attrs.decimalResolution('RESOLUTION');
        if (resolution) {
          level.width = resolution.width;
          level.height = resolution.height;
        }

        setCodecs(attrs.CODECS, level);

        if (!level.unknownCodecs?.length) {
          levelsWithKnownCodecs.push(level);
        }

        parsed.levels.push(level);
      } else if (result[3]) {
        const tag = result[3];
        const attributes = result[4];
        switch (tag) {
          case 'SESSION-DATA': {
            // #EXT-X-SESSION-DATA
            const sessionAttrs = new AttrList(attributes, parsed);
            const dataId = sessionAttrs['DATA-ID'];
            if (dataId) {
              if (parsed.sessionData === null) {
                parsed.sessionData = {};
              }
              parsed.sessionData[dataId] = sessionAttrs;
            }
            break;
          }
          case 'SESSION-KEY': {
            // #EXT-X-SESSION-KEY
            const sessionKey = parseKey(attributes, baseurl, parsed);
            if (sessionKey.encrypted && sessionKey.isSupported()) {
              if (parsed.sessionKeys === null) {
                parsed.sessionKeys = [];
              }
              parsed.sessionKeys.push(sessionKey);
            } else {
              logger.warn(
                `[Keys] Ignoring invalid EXT-X-SESSION-KEY tag: "${attributes}"`,
              );
            }
            break;
          }
          case 'DEFINE': {
            // #EXT-X-DEFINE
            if (__USE_VARIABLE_SUBSTITUTION__) {
              const variableAttributes = new AttrList(attributes, parsed);
              addVariableDefinition(parsed, variableAttributes, baseurl);
            }
            break;
          }
          case 'CONTENT-STEERING': {
            // #EXT-X-CONTENT-STEERING
            const contentSteeringAttributes = new AttrList(attributes, parsed);
            parsed.contentSteering = {
              uri: M3U8Parser.resolve(
                contentSteeringAttributes['SERVER-URI'],
                baseurl,
              ),
              pathwayId: contentSteeringAttributes['PATHWAY-ID'] || '.',
            };
            break;
          }
          case 'START': {
            // #EXT-X-START
            parsed.startTimeOffset = parseStartTimeOffset(attributes);
            break;
          }
          default:
            break;
        }
      }
    }
    // Filter out levels with unknown codecs if it does not remove all levels
    const stripUnknownCodecLevels =
      levelsWithKnownCodecs.length > 0 &&
      levelsWithKnownCodecs.length < parsed.levels.length;

    parsed.levels = stripUnknownCodecLevels
      ? levelsWithKnownCodecs
      : parsed.levels;
    if (parsed.levels.length === 0) {
      parsed.playlistParsingError = new Error('no levels found in manifest');
    }

    return parsed;
  }

  static parseMasterPlaylistMedia(
    string: string,
    baseurl: string,
    parsed: ParsedMultivariantPlaylist,
  ): ParsedMultivariantMediaOptions {
    let result: RegExpExecArray | null;
    const results: ParsedMultivariantMediaOptions = {};
    const levels = parsed.levels;
    const groupsByType = {
      AUDIO: levels.map((level: LevelParsed) => ({
        id: level.attrs.AUDIO,
        audioCodec: level.audioCodec,
      })),
      SUBTITLES: levels.map((level: LevelParsed) => ({
        id: level.attrs.SUBTITLES,
        textCodec: level.textCodec,
      })),
      'CLOSED-CAPTIONS': [],
    };
    let id = 0;
    MASTER_PLAYLIST_MEDIA_REGEX.lastIndex = 0;
    while ((result = MASTER_PLAYLIST_MEDIA_REGEX.exec(string)) !== null) {
      const attrs = new AttrList(result[1], parsed) as MediaAttributes;
      const type = attrs.TYPE;
      if (type) {
        const groups: (typeof groupsByType)[keyof typeof groupsByType] =
          groupsByType[type];
        const medias: MediaPlaylist[] = results[type] || [];
        results[type] = medias;
        const lang = attrs.LANGUAGE;
        const assocLang = attrs['ASSOC-LANGUAGE'];
        const channels = attrs.CHANNELS;
        const characteristics = attrs.CHARACTERISTICS;
        const instreamId = attrs['INSTREAM-ID'];
        const media: MediaPlaylist = {
          attrs,
          bitrate: 0,
          id: id++,
          groupId: attrs['GROUP-ID'] || '',
          name: attrs.NAME || lang || '',
          type,
          default: attrs.bool('DEFAULT'),
          autoselect: attrs.bool('AUTOSELECT'),
          forced: attrs.bool('FORCED'),
          lang,
          url: attrs.URI ? M3U8Parser.resolve(attrs.URI, baseurl) : '',
        };
        if (assocLang) {
          media.assocLang = assocLang;
        }
        if (channels) {
          media.channels = channels;
        }
        if (characteristics) {
          media.characteristics = characteristics;
        }
        if (instreamId) {
          media.instreamId = instreamId;
        }

        if (groups?.length) {
          // If there are audio or text groups signalled in the manifest, let's look for a matching codec string for this track
          // If we don't find the track signalled, lets use the first audio groups codec we have
          // Acting as a best guess
          const groupCodec =
            M3U8Parser.findGroup(groups, media.groupId as string) || groups[0];
          assignCodec(media, groupCodec, 'audioCodec');
          assignCodec(media, groupCodec, 'textCodec');
        }

        medias.push(media);
      }
    }
    return results;
  }

  static parseLevelPlaylist(
    string: string,
    baseurl: string,
    id: number,
    type: PlaylistLevelType,
    levelUrlId: number,
    multivariantVariableList: VariableMap | null,
  ): LevelDetails {
    const level = new LevelDetails(baseurl);
    const fragments: M3U8ParserFragments = level.fragments;
    const programDateTimes: MediaFragment[] = [];
    // The most recent init segment seen (applies to all subsequent segments)
    let currentInitSegment: Fragment | null = null;
    let currentSN = 0;
    let currentPart = 0;
    let totalduration = 0;
    let discontinuityCounter = 0;
    let prevFrag: Fragment | null = null;
    let frag: Fragment = new Fragment(type, baseurl);
    let result: RegExpExecArray | RegExpMatchArray | null;
    let i: number;
    let levelkeys: { [key: string]: LevelKey } | undefined;
    let firstPdtIndex = -1;
    let createNextFrag = false;
    let nextByteRange: string | null = null;

    LEVEL_PLAYLIST_REGEX_FAST.lastIndex = 0;
    level.m3u8 = string;
    level.hasVariableRefs = __USE_VARIABLE_SUBSTITUTION__
      ? hasVariableReferences(string)
      : false;

    while ((result = LEVEL_PLAYLIST_REGEX_FAST.exec(string)) !== null) {
      if (createNextFrag) {
        createNextFrag = false;
        frag = new Fragment(type, baseurl);
        // setup the next fragment for part loading
        frag.start = totalduration;
        frag.sn = currentSN;
        frag.cc = discontinuityCounter;
        frag.level = id;
        if (currentInitSegment) {
          frag.initSegment = currentInitSegment;
          frag.rawProgramDateTime = currentInitSegment.rawProgramDateTime;
          currentInitSegment.rawProgramDateTime = null;
          if (nextByteRange) {
            frag.setByteRange(nextByteRange);
            nextByteRange = null;
          }
        }
      }

      const duration = result[1];
      if (duration) {
        // INF
        frag.duration = parseFloat(duration);
        // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
        const title = (' ' + result[2]).slice(1);
        frag.title = title || null;
        frag.tagList.push(title ? ['INF', duration, title] : ['INF', duration]);
      } else if (result[3]) {
        // url
        if (Number.isFinite(frag.duration)) {
          frag.start = totalduration;
          if (levelkeys) {
            setFragLevelKeys(frag, levelkeys, level);
          }
          frag.sn = currentSN;
          frag.level = id;
          frag.cc = discontinuityCounter;
          fragments.push(frag);
          // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
          const uri = (' ' + result[3]).slice(1);
          frag.relurl = __USE_VARIABLE_SUBSTITUTION__
            ? substituteVariables(level, uri)
            : uri;
          assignProgramDateTime(
            frag as MediaFragment,
            prevFrag as MediaFragment,
            programDateTimes,
          );
          prevFrag = frag;
          totalduration += frag.duration;
          currentSN++;
          currentPart = 0;
          createNextFrag = true;
        }
      } else if (result[4]) {
        // X-BYTERANGE
        const data = (' ' + result[4]).slice(1);
        if (prevFrag) {
          frag.setByteRange(data, prevFrag);
        } else {
          frag.setByteRange(data);
        }
      } else if (result[5]) {
        // PROGRAM-DATE-TIME
        // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
        frag.rawProgramDateTime = (' ' + result[5]).slice(1);
        frag.tagList.push(['PROGRAM-DATE-TIME', frag.rawProgramDateTime]);
        if (firstPdtIndex === -1) {
          firstPdtIndex = fragments.length;
        }
      } else {
        result = result[0].match(LEVEL_PLAYLIST_REGEX_SLOW);
        if (!result) {
          logger.warn('No matches on slow regex match for level playlist!');
          continue;
        }
        for (i = 1; i < result.length; i++) {
          if (typeof result[i] !== 'undefined') {
            break;
          }
        }

        // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
        const tag = (' ' + result[i]).slice(1);
        const value1 = (' ' + result[i + 1]).slice(1);
        const value2 = result[i + 2] ? (' ' + result[i + 2]).slice(1) : '';

        switch (tag) {
          case 'PLAYLIST-TYPE':
            level.type = value1.toUpperCase();
            break;
          case 'MEDIA-SEQUENCE':
            currentSN = level.startSN = parseInt(value1);
            break;
          case 'SKIP': {
            if (level.skippedSegments) {
              level.playlistParsingError = new Error(
                `#EXT-X-SKIP MUST NOT appear more than once in a Playlist`,
              );
            }
            const skipAttrs = new AttrList(value1, level);
            const skippedSegments =
              skipAttrs.decimalInteger('SKIPPED-SEGMENTS');
            if (Number.isFinite(skippedSegments)) {
              level.skippedSegments += skippedSegments;
              // This will result in fragments[] containing undefined values, which we will fill in with `mergeDetails`
              for (let i = skippedSegments; i--; ) {
                fragments.push(null);
              }
              currentSN += skippedSegments;
            }
            const recentlyRemovedDateranges = skipAttrs.enumeratedString(
              'RECENTLY-REMOVED-DATERANGES',
            );
            if (recentlyRemovedDateranges) {
              level.recentlyRemovedDateranges = (
                level.recentlyRemovedDateranges || []
              ).concat(recentlyRemovedDateranges.split('\t'));
            }
            break;
          }
          case 'TARGETDURATION':
            level.targetduration = Math.max(parseInt(value1), 1);
            break;
          case 'VERSION':
            level.version = parseInt(value1);
            break;
          case 'INDEPENDENT-SEGMENTS':
          case 'EXTM3U':
            break;
          case 'ENDLIST':
            level.live = false;
            break;
          case '#':
            if (value1 || value2) {
              frag.tagList.push(value2 ? [value1, value2] : [value1]);
            }
            break;
          case 'DISCONTINUITY':
            discontinuityCounter++;
            frag.tagList.push(['DIS']);
            break;
          case 'GAP':
            frag.gap = true;
            frag.tagList.push([tag]);
            break;
          case 'BITRATE':
            frag.tagList.push([tag, value1]);
            break;
          case 'DATERANGE': {
            const dateRangeAttr = new AttrList(value1, level);
            const dateRange = new DateRange(
              dateRangeAttr,
              level.dateRanges[dateRangeAttr.ID],
              level.dateRangeTagCount,
            );
            level.dateRangeTagCount++;
            if (dateRange.isValid || level.skippedSegments) {
              level.dateRanges[dateRange.id] = dateRange;
            } else {
              logger.warn(`Ignoring invalid DATERANGE tag: "${value1}"`);
            }
            // Add to fragment tag list for backwards compatibility (< v1.2.0)
            frag.tagList.push(['EXT-X-DATERANGE', value1]);
            break;
          }
          case 'DEFINE': {
            if (__USE_VARIABLE_SUBSTITUTION__) {
              const variableAttributes = new AttrList(value1, level);
              if ('IMPORT' in variableAttributes) {
                importVariableDefinition(
                  level,
                  variableAttributes,
                  multivariantVariableList,
                );
              } else {
                addVariableDefinition(level, variableAttributes, baseurl);
              }
            }
            break;
          }

          case 'DISCONTINUITY-SEQUENCE':
            discontinuityCounter = parseInt(value1);
            break;
          case 'KEY': {
            const levelKey = parseKey(value1, baseurl, level);
            if (levelKey.isSupported()) {
              if (levelKey.method === 'NONE') {
                levelkeys = undefined;
                break;
              }
              if (!levelkeys) {
                levelkeys = {};
              }
              if (levelkeys[levelKey.keyFormat]) {
                levelkeys = Object.assign({}, levelkeys);
              }
              levelkeys[levelKey.keyFormat] = levelKey;
            } else {
              logger.warn(`[Keys] Ignoring invalid EXT-X-KEY tag: "${value1}"`);
            }
            break;
          }
          case 'START':
            level.startTimeOffset = parseStartTimeOffset(value1);
            break;
          case 'MAP': {
            const mapAttrs = new AttrList(value1, level);
            if (frag.duration) {
              // Initial segment tag is after segment duration tag.
              //   #EXTINF: 6.0
              //   #EXT-X-MAP:URI="init.mp4
              const init = new Fragment(type, baseurl);
              setInitSegment(init, mapAttrs, id, levelkeys);
              currentInitSegment = init;
              frag.initSegment = currentInitSegment;
              if (
                currentInitSegment.rawProgramDateTime &&
                !frag.rawProgramDateTime
              ) {
                frag.rawProgramDateTime = currentInitSegment.rawProgramDateTime;
              }
            } else {
              // Initial segment tag is before segment duration tag
              // Handle case where EXT-X-MAP is declared after EXT-X-BYTERANGE
              const end = frag.byteRangeEndOffset;
              if (end) {
                const start = frag.byteRangeStartOffset as number;
                nextByteRange = `${end - start}@${start}`;
              } else {
                nextByteRange = null;
              }
              setInitSegment(frag, mapAttrs, id, levelkeys);
              currentInitSegment = frag;
              createNextFrag = true;
            }
            currentInitSegment.cc = discontinuityCounter;
            break;
          }
          case 'SERVER-CONTROL': {
            const serverControlAttrs = new AttrList(value1);
            level.canBlockReload = serverControlAttrs.bool('CAN-BLOCK-RELOAD');
            level.canSkipUntil = serverControlAttrs.optionalFloat(
              'CAN-SKIP-UNTIL',
              0,
            );
            level.canSkipDateRanges =
              level.canSkipUntil > 0 &&
              serverControlAttrs.bool('CAN-SKIP-DATERANGES');
            level.partHoldBack = serverControlAttrs.optionalFloat(
              'PART-HOLD-BACK',
              0,
            );
            level.holdBack = serverControlAttrs.optionalFloat('HOLD-BACK', 0);
            break;
          }
          case 'PART-INF': {
            const partInfAttrs = new AttrList(value1);
            level.partTarget = partInfAttrs.decimalFloatingPoint('PART-TARGET');
            break;
          }
          case 'PART': {
            let partList = level.partList;
            if (!partList) {
              partList = level.partList = [];
            }
            const previousFragmentPart =
              currentPart > 0 ? partList[partList.length - 1] : undefined;
            const index = currentPart++;
            const partAttrs = new AttrList(value1, level);
            const part = new Part(
              partAttrs,
              frag as MediaFragment,
              baseurl,
              index,
              previousFragmentPart,
            );
            partList.push(part);
            frag.duration += part.duration;
            break;
          }
          case 'PRELOAD-HINT': {
            const preloadHintAttrs = new AttrList(value1, level);
            level.preloadHint = preloadHintAttrs;
            break;
          }
          case 'RENDITION-REPORT': {
            const renditionReportAttrs = new AttrList(value1, level);
            level.renditionReports = level.renditionReports || [];
            level.renditionReports.push(renditionReportAttrs);
            break;
          }
          default:
            logger.warn(`line parsed but not handled: ${result}`);
            break;
        }
      }
    }
    if (prevFrag && !prevFrag.relurl) {
      fragments.pop();
      totalduration -= prevFrag.duration;
      if (level.partList) {
        level.fragmentHint = prevFrag as MediaFragment;
      }
    } else if (level.partList) {
      assignProgramDateTime(
        frag as MediaFragment,
        prevFrag as MediaFragment,
        programDateTimes,
      );
      frag.cc = discontinuityCounter;
      level.fragmentHint = frag as MediaFragment;
      if (levelkeys) {
        setFragLevelKeys(frag, levelkeys, level);
      }
    }
    const fragmentLength = fragments.length;
    const firstFragment = fragments[0];
    const lastFragment = fragments[fragmentLength - 1];
    totalduration += level.skippedSegments * level.targetduration;
    if (totalduration > 0 && fragmentLength && lastFragment) {
      level.averagetargetduration = totalduration / fragmentLength;
      const lastSn = lastFragment.sn;
      level.endSN = lastSn !== 'initSegment' ? lastSn : 0;
      if (!level.live) {
        lastFragment.endList = true;
      }
      if (firstFragment) {
        level.startCC = firstFragment.cc;
      }
      /**
       * Backfill any missing PDT values
       * "If the first EXT-X-PROGRAM-DATE-TIME tag in a Playlist appears after
       * one or more Media Segment URIs, the client SHOULD extrapolate
       * backward from that tag (using EXTINF durations and/or media
       * timestamps) to associate dates with those segments."
       * We have already extrapolated forward, but all fragments up to the first instance of PDT do not have their PDTs
       * computed.
       */
      if (firstPdtIndex > 0) {
        backfillProgramDateTimes(fragments, firstPdtIndex);
        if (firstFragment) {
          programDateTimes.unshift(firstFragment as MediaFragment);
        }
      }
    } else {
      level.endSN = 0;
      level.startCC = 0;
    }
    if (level.fragmentHint) {
      totalduration += level.fragmentHint.duration;
    }
    level.totalduration = totalduration;
    if (programDateTimes.length && level.dateRangeTagCount && firstFragment) {
      mapDateRanges(programDateTimes, level);
    }

    level.endCC = discontinuityCounter;

    return level;
  }
}

export function mapDateRanges(
  programDateTimes: MediaFragment[],
  details: LevelDetails,
) {
  // Make sure DateRanges are mapped to a ProgramDateTime tag that applies a date to a segment that overlaps with its start date
  const programDateTimeCount = programDateTimes.length;
  const lastProgramDateTime = programDateTimes[programDateTimeCount - 1];
  const playlistEnd = details.live ? Infinity : details.totalduration;
  const dateRangeIds = Object.keys(details.dateRanges);
  for (let i = dateRangeIds.length; i--; ) {
    const dateRange = details.dateRanges[dateRangeIds[i]];
    const startDateTime = dateRange.startDate.getTime();
    dateRange.tagAnchor = lastProgramDateTime;
    for (let j = programDateTimeCount; j--; ) {
      const fragIndex = findFragmentWithStartDate(
        details,
        startDateTime,
        programDateTimes,
        j,
        playlistEnd,
      );
      if (fragIndex !== -1) {
        dateRange.tagAnchor = details.fragments[fragIndex];
        break;
      }
    }
  }
}

function findFragmentWithStartDate(
  details: LevelDetails,
  startDateTime: number,
  programDateTimes: MediaFragment[],
  index: number,
  endTime: number,
): number {
  const pdtFragment = programDateTimes[index];
  if (pdtFragment) {
    // find matching range between PDT tags
    const durationBetweenPdt =
      (programDateTimes[index + 1]?.start || endTime) - pdtFragment.start;
    const pdtStart = pdtFragment.programDateTime as number;
    if (
      (startDateTime >= pdtStart || index === 0) &&
      startDateTime <= pdtStart + durationBetweenPdt * 1000
    ) {
      // map to fragment with date-time range
      const startIndex = programDateTimes[index].sn - details.startSN;
      const fragments = details.fragments;
      if (fragments.length > programDateTimes.length) {
        const endSegment =
          programDateTimes[index + 1] || fragments[fragments.length - 1];
        const endIndex = endSegment.sn - details.startSN;
        for (let i = endIndex; i > startIndex; i--) {
          const fragStartDateTime = fragments[i].programDateTime as number;
          if (
            startDateTime >= fragStartDateTime &&
            startDateTime < fragStartDateTime + fragments[i].duration * 1000
          ) {
            return i;
          }
        }
      }
      return startIndex;
    }
  }
  return -1;
}

function parseKey(
  keyTagAttributes: string,
  baseurl: string,
  parsed: ParsedMultivariantPlaylist | LevelDetails,
): LevelKey {
  // https://tools.ietf.org/html/rfc8216#section-4.3.2.4
  const keyAttrs = new AttrList(keyTagAttributes, parsed);
  const decryptmethod = keyAttrs.METHOD ?? '';
  const decrypturi = keyAttrs.URI;
  const decryptiv = keyAttrs.hexadecimalInteger('IV');
  const decryptkeyformatversions = keyAttrs.KEYFORMATVERSIONS;
  // From RFC: This attribute is OPTIONAL; its absence indicates an implicit value of "identity".
  const decryptkeyformat = keyAttrs.KEYFORMAT ?? 'identity';

  if (decrypturi && keyAttrs.IV && !decryptiv) {
    logger.error(`Invalid IV: ${keyAttrs.IV}`);
  }
  // If decrypturi is a URI with a scheme, then baseurl will be ignored
  // No uri is allowed when METHOD is NONE
  const resolvedUri = decrypturi ? M3U8Parser.resolve(decrypturi, baseurl) : '';
  const keyFormatVersions = (
    decryptkeyformatversions ? decryptkeyformatversions : '1'
  )
    .split('/')
    .map(Number)
    .filter(Number.isFinite);

  return new LevelKey(
    decryptmethod,
    resolvedUri,
    decryptkeyformat,
    keyFormatVersions,
    decryptiv,
  );
}

function parseStartTimeOffset(startAttributes: string): number | null {
  const startAttrs = new AttrList(startAttributes);
  const startTimeOffset = startAttrs.decimalFloatingPoint('TIME-OFFSET');
  if (Number.isFinite(startTimeOffset)) {
    return startTimeOffset;
  }
  return null;
}

function setCodecs(
  codecsAttributeValue: string | undefined,
  level: LevelParsed,
) {
  let codecs = (codecsAttributeValue || '').split(/[ ,]+/).filter((c) => c);
  ['video', 'audio', 'text'].forEach((type: CodecType) => {
    const filtered = codecs.filter((codec) => isCodecType(codec, type));
    if (filtered.length) {
      // Comma separated list of all codecs for type
      level[`${type}Codec`] = filtered.join(',');
      // Remove known codecs so that only unknownCodecs are left after iterating through each type
      codecs = codecs.filter((codec) => filtered.indexOf(codec) === -1);
    }
  });
  level.unknownCodecs = codecs;
}

function assignCodec(
  media: MediaPlaylist,
  groupItem: { audioCodec?: string; textCodec?: string },
  codecProperty: 'audioCodec' | 'textCodec',
) {
  const codecValue = groupItem[codecProperty];
  if (codecValue) {
    media[codecProperty] = codecValue;
  }
}

function backfillProgramDateTimes(
  fragments: M3U8ParserFragments,
  firstPdtIndex: number,
) {
  let fragPrev = fragments[firstPdtIndex] as Fragment;
  for (let i = firstPdtIndex; i--; ) {
    const frag = fragments[i];
    // Exit on delta-playlist skipped segments
    if (!frag) {
      return;
    }
    frag.programDateTime =
      (fragPrev.programDateTime as number) - frag.duration * 1000;
    fragPrev = frag;
  }
}

export function assignProgramDateTime(
  frag: MediaFragment,
  prevFrag: MediaFragment | null,
  programDateTimes: MediaFragment[],
) {
  if (frag.rawProgramDateTime) {
    frag.programDateTime = Date.parse(frag.rawProgramDateTime);
    if (!Number.isFinite(frag.programDateTime)) {
      frag.programDateTime = null;
      frag.rawProgramDateTime = null;
      return;
    }
    programDateTimes.push(frag);
  } else if (prevFrag?.programDateTime) {
    frag.programDateTime = prevFrag.endProgramDateTime;
  }
}

function setInitSegment(
  frag: Fragment,
  mapAttrs: AttrList,
  id: number,
  levelkeys: { [key: string]: LevelKey } | undefined,
) {
  frag.relurl = mapAttrs.URI;
  if (mapAttrs.BYTERANGE) {
    frag.setByteRange(mapAttrs.BYTERANGE);
  }
  frag.level = id;
  frag.sn = 'initSegment';
  if (levelkeys) {
    frag.levelkeys = levelkeys;
  }
  frag.initSegment = null;
}

function setFragLevelKeys(
  frag: Fragment,
  levelkeys: { [key: string]: LevelKey },
  level: LevelDetails,
) {
  frag.levelkeys = levelkeys;
  const { encryptedFragments } = level;
  if (
    (!encryptedFragments.length ||
      encryptedFragments[encryptedFragments.length - 1].levelkeys !==
        levelkeys) &&
    Object.keys(levelkeys).some(
      (format) => levelkeys![format].isCommonEncryption,
    )
  ) {
    encryptedFragments.push(frag);
  }
}
