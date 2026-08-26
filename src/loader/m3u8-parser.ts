import { buildAbsoluteURL } from 'url-toolkit';
import { DateRange } from './date-range';
import { Fragment, Part } from './fragment';
import { LevelDetails } from './level-details';
import { LevelKey } from './level-key';
import { AttrList } from '../utils/attr-list';
import { isCodecType } from '../utils/codecs';
import {
  assignProgramDateTime,
  mapDateRanges,
  mapFragmentIntersection,
  notEqualAfterStrippingQueries,
} from '../utils/level-helper';
import { logger } from '../utils/logger';
import {
  addVariableDefinition,
  hasVariableReferences,
  importVariableDefinition,
  substituteVariables,
} from '../utils/variable-substitution';
import type { Base, MediaFragment } from './fragment';
import type { ContentSteeringOptions } from '../types/events';
import type {
  CodecsParsed,
  IFrameAttributes,
  LevelAttributes,
  LevelParsed,
  VariableMap,
} from '../types/level';
import type { PlaylistLevelType } from '../types/loader';
import type { MediaAttributes, MediaPlaylist } from '../types/media-playlist';
import type { CodecType } from '../utils/codecs';

type M3U8ParserFragments = Array<Fragment | null>;

export type ParsedMultivariantPlaylist = {
  contentSteering: ContentSteeringOptions | null;
  levels: LevelParsed[];
  iframeVariants: LevelParsed[];
  playlistParsingError: Error | null;
  sessionData: Record<string, AttrList> | null;
  sessionKeys: LevelKey[] | null;
  startTimeOffset: number | null;
  variableList: VariableMap | null;
  hasVariableRefs: boolean;
};

export type ParsedMultivariantMediaOptions = {
  AUDIO?: MediaPlaylist[];
  SUBTITLES?: MediaPlaylist[];
  'CLOSED-CAPTIONS'?: MediaPlaylist[];
};

type LevelKeys = { [key: string]: LevelKey | undefined };

const MASTER_PLAYLIST_REGEX =
  /#EXT-X-STREAM-INF:([^\r\n]*)(?:[\r\n](?:#[^\r\n]*)?)*([^\r\n]+)|#EXT-X-(I-FRAME-STREAM-INF|SESSION-DATA|SESSION-KEY|DEFINE|CONTENT-STEERING|START):([^\r\n]*)(?:[\r\n]+|$)/g;
const MASTER_PLAYLIST_MEDIA_REGEX = /#EXT-X-MEDIA:(.*)/g;

const IS_MEDIA_PLAYLIST = /^#EXT(?:INF|-X-TARGETDURATION):/m; // Handle empty Media Playlist (first EXTINF not signaled, but TARGETDURATION present)

const LEVEL_PLAYLIST_REGEX_FAST = new RegExp(
  [
    /#EXTINF:\s*(\d*(?:\.\d+)?)(?:,(.*)\s+)?/.source, // duration (#EXTINF:<duration>,<title>), group 1 => duration, group 2 => title
    /(?!#) *(\S[^\r\n]*)/.source, // segment URI, group 3 => the URI (note newline is not eaten)
    /#.*/.source, // All other non-segment oriented tags will match with all groups empty
  ].join('|'),
  'g',
);

// What a parse remembers so that the next reload of the same playlist can keep
// the fragments it already built. A media segment is a pure function of the
// playlist text from the end of the previous segment's URI line to the end of
// its own (its region) and of the parser state entering that region, so a
// region that comes back byte for byte, entered in the same state, is the
// fragment already in hand.
//
// Six lanes per fragment, indexed the same way as `fragments`:
const LANE_END = 0; // offset in `text` just past the region's URI line
const LANE_LENGTH = 1; // region length; 0 marks a region that must be parsed
const LANE_CC = 2; // discontinuity counter entering the region
const LANE_CC_OUT = 3; // and leaving it
const LANE_BITRATE = 4; // EXT-X-BITRATE value entering the region
const LANE_DURATION = 5; // EXTINF duration as this playlist declares it
const LANES = 6;

type Generation = {
  details: LevelDetails;
  text: string;
  startSN: number;
  // As parsed; the merge may since have put loaded instances from older
  // parses into `details.fragments`, which the regions say nothing about.
  fragments: M3U8ParserFragments;
  lanes: number[];
};

// Held weakly and off to the side: the shape of LevelDetails is public API and
// no other module has any business knowing that reuse happens at all.
const generations: WeakMap<LevelDetails, Generation> = new WeakMap();

const LEVEL_PLAYLIST_REGEX_SLOW = new RegExp(
  [
    /#EXT-X-(PROGRAM-DATE-TIME|BYTERANGE|DATERANGE|DEFINE|KEY|MAP|PART|PART-INF|PLAYLIST-TYPE|PRELOAD-HINT|RENDITION-REPORT|SERVER-CONTROL|SKIP|START):(.+)/
      .source,
    /#EXT-X-(BITRATE|DISCONTINUITY-SEQUENCE|MEDIA-SEQUENCE|TARGETDURATION|VERSION): *(\d+)/
      .source,
    /#EXT-X-(DISCONTINUITY|ENDLIST|GAP|INDEPENDENT-SEGMENTS|I-FRAMES-ONLY)/
      .source,
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
      iframeVariants: [],
      playlistParsingError: null,
      sessionData: null,
      sessionKeys: null,
      startTimeOffset: null,
      variableList: null,
      hasVariableRefs,
    };
    const levelsWithKnownCodecs: LevelParsed[] = [];

    MASTER_PLAYLIST_REGEX.lastIndex = 0;
    if (!string.startsWith('#EXTM3U')) {
      parsed.playlistParsingError = new Error('no EXTM3U delimiter');
      return parsed;
    }
    let result: RegExpExecArray | null;
    while ((result = MASTER_PLAYLIST_REGEX.exec(string)) != null) {
      if (result[1]) {
        // '#EXT-X-STREAM-INF' is found, parse level tag  in group 1
        const attrs = new AttrList(result[1], parsed) as LevelAttributes;
        const level = createVariant(
          attrs,
          result[2],
          baseurl,
          parsed,
          levelsWithKnownCodecs,
        );
        if (level) {
          parsed.levels.push(level);
        }
      } else if (result[3]) {
        const tag = result[3];
        const attributes = result[4];
        switch (tag) {
          case 'I-FRAME-STREAM-INF':
            {
              const attrs = new AttrList(
                attributes,
                parsed,
              ) as IFrameAttributes;
              const iframeVariant = createVariant(
                attrs,
                attrs.URI,
                baseurl,
                parsed,
                levelsWithKnownCodecs,
                true,
              );
              if (iframeVariant) {
                parsed.iframeVariants.push(iframeVariant);
              }
            }
            break;
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
        const groups:
          | (typeof groupsByType)[keyof typeof groupsByType]
          | undefined = groupsByType[type];
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
    previous?: LevelDetails | null,
  ): LevelDetails {
    // `previous` is the last parse of this playlist, offered so that the
    // segments it already built can be kept. A reload that cannot keep them
    // safely is parsed again without it, once.
    return (
      (previous
        ? M3U8Parser.parseMediaPlaylist(
            string,
            baseurl,
            id,
            type,
            levelUrlId,
            multivariantVariableList,
            previous,
          )
        : null) ||
      (M3U8Parser.parseMediaPlaylist(
        string,
        baseurl,
        id,
        type,
        levelUrlId,
        multivariantVariableList,
        null,
      ) as LevelDetails)
    );
  }

  // Null when fragments taken from `previous` turned out not to be keepable;
  // nothing of `previous` has been written to then.
  private static parseMediaPlaylist(
    string: string,
    baseurl: string,
    id: number,
    type: PlaylistLevelType,
    levelUrlId: number,
    multivariantVariableList: VariableMap | null,
    previous: LevelDetails | null,
  ): LevelDetails | null {
    const level = new LevelDetails(baseurl);
    const fragments: M3U8ParserFragments = level.fragments;
    const programDateTimes: MediaFragment[] = [];
    // The most recent init segment seen (applies to all subsequent segments)
    let currentInitSegment: Fragment | null = null;
    let currentSN = 0;
    let currentPart = 0;
    let totalduration = 0;
    let discontinuityCounter = 0;
    let currentBitrate = 0;
    let prevFrag: Fragment | null = null;
    let result: RegExpExecArray | RegExpMatchArray | null;
    let i: number;
    let levelkeys: LevelKeys | undefined;
    let firstPdtIndex = -1;
    let createNextFrag = false;
    let nextByteRange: string | null = null;
    // A date-time tag that preceded an EXT-X-MAP, for the segment after it
    let initProgramDateTime: string | null = null;
    let serverControlAttrs: AttrList | undefined;

    LEVEL_PLAYLIST_REGEX_FAST.lastIndex = 0;
    level.m3u8 = string;
    level.hasVariableRefs = __USE_VARIABLE_SUBSTITUTION__
      ? hasVariableReferences(string)
      : false;
    if (LEVEL_PLAYLIST_REGEX_FAST.exec(string)?.[0] !== '#EXTM3U') {
      level.playlistParsingError = new Error(
        'Missing format identifier #EXTM3U',
      );
      return level;
    }

    // The previous parse, when fragments may be kept from it. Fragments built
    // by this parse get their own `base`; a kept fragment stays on the base it
    // was built with, whose URL commit moves to this playlist's. Nothing of
    // the previous parse is written to before commit.
    const source = previous && reuseSource(previous, level);
    const base: Base = { url: baseurl };
    const lanes: number[] = [];
    let reused = 0;
    let regionStart = LEVEL_PLAYLIST_REGEX_FAST.lastIndex;
    let regionCC = 0;
    let regionBitrate = 0;
    let regionOpaque = false;
    let sharedKeys = false;
    let prevPartIndex = 0;
    let frag: Fragment = new Fragment(type, base);

    for (;;) {
      // With nothing of the next segment parsed yet: if the text ahead is
      // the region that produced a fragment last time, and the state entering
      // it is the state that parse entered it in, that fragment is this
      // segment. Take it and step over the region.
      if (
        source !== null &&
        nextByteRange === null &&
        initProgramDateTime === null &&
        !level.skippedSegments &&
        !level.iframesOnly &&
        (createNextFrag ||
          (frag.duration === 0 &&
            frag.tagList.length === 0 &&
            frag.byteRange.length === 0))
      ) {
        const index = currentSN - source.startSN;
        const lane = index * LANES;
        const length = index < 0 ? 0 : source.lanes[lane + LANE_LENGTH];
        const candidate = length ? source.fragments[index] : null;
        const at = LEVEL_PLAYLIST_REGEX_FAST.lastIndex;
        const end = at + length;
        if (
          candidate?.level === id &&
          candidate.levelkeys === levelkeys &&
          candidate.initSegment === currentInitSegment &&
          source.lanes[lane + LANE_CC] === discontinuityCounter &&
          candidate.cc === source.lanes[lane + LANE_CC_OUT] &&
          source.lanes[lane + LANE_BITRATE] === currentBitrate &&
          // the URI line has to end where the region does
          (end === string.length ||
            string.charCodeAt(end) === 10 ||
            string.charCodeAt(end) === 13) &&
          string.substring(at, end) ===
            source.text.substring(
              source.lanes[lane + LANE_END] - length,
              source.lanes[lane + LANE_END],
            )
        ) {
          const duration = source.lanes[lane + LANE_DURATION];
          if (candidate.rawProgramDateTime) {
            if (firstPdtIndex === -1) {
              firstPdtIndex = fragments.length;
            }
            programDateTimes.push(candidate as MediaFragment);
          }
          if (levelkeys) {
            setFragLevelKeys(candidate, levelkeys, level);
          }
          const previousParts = source.details.partList;
          if (previousParts !== null) {
            while (
              prevPartIndex < previousParts.length &&
              previousParts[prevPartIndex].fragment.sn < currentSN
            ) {
              prevPartIndex++;
            }
            while (
              prevPartIndex < previousParts.length &&
              previousParts[prevPartIndex].fragment === candidate
            ) {
              (level.partList || (level.partList = [])).push(
                previousParts[prevPartIndex++],
              );
            }
          }
          fragments.push(candidate);
          lanes.push(
            end,
            length,
            discontinuityCounter,
            candidate.cc,
            currentBitrate,
            duration,
          );
          discontinuityCounter = candidate.cc;
          prevFrag = candidate;
          totalduration += duration;
          currentSN++;
          currentPart = 0;
          reused++;
          regionStart = end;
          regionCC = discontinuityCounter;
          regionBitrate = currentBitrate;
          regionOpaque = false;
          LEVEL_PLAYLIST_REGEX_FAST.lastIndex = end;
          createNextFrag = true;
          continue;
        }
      }
      if (createNextFrag) {
        createNextFrag = false;
        frag = new Fragment(type, base);
        // setup the next fragment for part loading
        frag.playlistOffset = totalduration;
        frag.setStart(totalduration);
        frag.sn = currentSN;
        frag.cc = discontinuityCounter;
        if (currentBitrate) {
          frag.bitrate = currentBitrate;
        }
        frag.level = id;
        if (currentInitSegment) {
          frag.initSegment = currentInitSegment;
          if (initProgramDateTime) {
            frag.rawProgramDateTime = initProgramDateTime;
            initProgramDateTime = null;
          }
          if (nextByteRange) {
            frag.setByteRange(nextByteRange);
            nextByteRange = null;
          }
        }
      }

      result = LEVEL_PLAYLIST_REGEX_FAST.exec(string);
      if (result === null) {
        break;
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
          frag.playlistOffset = totalduration;
          frag.setStart(totalduration);
          if (levelkeys) {
            setFragLevelKeys(frag, levelkeys, level);
          }
          frag.sn = currentSN;
          frag.level = id;
          frag.cc = discontinuityCounter;
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

          const byteRange = frag.byteRange;
          if (byteRange.length === 2) {
            frag.bitrate =
              (((byteRange[1] - byteRange[0]) * 8) / frag.duration) | 0;
          }

          // Create implicit init segment for ByteRange addressed MPEG2-TS I-FRAME segments (PMT bytes)
          if (
            level.iframesOnly &&
            byteRange[0] &&
            currentInitSegment?.cc !== discontinuityCounter
          ) {
            const init = new Fragment(type, base);
            init.relurl = frag.relurl;
            init.setByteRange(`${Math.min(byteRange[0], 7 * 188)}@0`);
            init.level = id;
            init.sn = 'initSegment';
            if (levelkeys) {
              init.levelkeys = levelkeys;
              if (levelkeys.identity) {
                (init as any)._decryptdata =
                  levelkeys.identity.getDecryptData(0);
              }
            }
            currentInitSegment = init;
            frag.initSegment = currentInitSegment;
          }
          fragments.push(frag);
          const regionEnd = LEVEL_PLAYLIST_REGEX_FAST.lastIndex;
          lanes.push(
            regionEnd,
            regionOpaque ? 0 : regionEnd - regionStart,
            regionCC,
            discontinuityCounter,
            regionBitrate,
            frag.duration,
          );
          regionStart = regionEnd;
          regionCC = discontinuityCounter;
          regionBitrate = currentBitrate;
          regionOpaque = false;

          createNextFrag = true;
        }
      } else {
        result = result[0].match(LEVEL_PLAYLIST_REGEX_SLOW);
        if (!result) {
          logger.warn('No matches on slow regex match for level playlist!');
          continue;
        }
        for (i = 1; i < result.length; i++) {
          if ((result[i] as any) !== undefined) {
            break;
          }
        }

        // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
        const tag = (' ' + result[i]).slice(1);
        const value1 = (' ' + result[i + 1]).slice(1);
        const value2 = result[i + 2] ? (' ' + result[i + 2]).slice(1) : null;

        switch (tag) {
          case 'BYTERANGE':
            if (prevFrag) {
              frag.setByteRange(value1, prevFrag);
            } else {
              frag.setByteRange(value1);
            }
            break;
          case 'PROGRAM-DATE-TIME':
            // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
            frag.rawProgramDateTime = value1;
            frag.tagList.push(['PROGRAM-DATE-TIME', value1]);
            if (firstPdtIndex === -1) {
              firstPdtIndex = fragments.length;
            }
            break;
          case 'PLAYLIST-TYPE':
            if (level.type) {
              assignMultipleMediaPlaylistTagOccuranceError(level, tag, result);
            }
            level.type = value1.toUpperCase();
            break;
          case 'MEDIA-SEQUENCE':
            if (level.startSN !== 0) {
              assignMultipleMediaPlaylistTagOccuranceError(level, tag, result);
            } else if (prevFrag !== null) {
              // a real Media Segment (not an EXT-X-SKIP placeholder) precedes this tag
              assignMustAppearBeforeSegmentsError(level, tag, result);
            }
            level.startSN = parseInt(value1);
            // include skipped segments so the first real fragment keeps its sequence
            // number when EXT-X-SKIP is declared before EXT-X-MEDIA-SEQUENCE
            currentSN = level.startSN + level.skippedSegments;
            break;
          case 'SKIP': {
            if (level.skippedSegments) {
              assignMultipleMediaPlaylistTagOccuranceError(level, tag, result);
            }
            const skipAttrs = new AttrList(value1, level);
            const skippedSegments =
              skipAttrs.decimalInteger('SKIPPED-SEGMENTS');
            if (Number.isFinite(skippedSegments)) {
              level.skippedSegments += skippedSegments;
              // This will result in fragments[] containing undefined values, which we will fill in with `mergeDetails`
              for (let i = skippedSegments; i--; ) {
                fragments.push(null);
                lanes.push(0, 0, 0, 0, 0, 0);
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
            if (level.targetduration !== 0) {
              assignMultipleMediaPlaylistTagOccuranceError(level, tag, result);
            }
            level.targetduration = Math.max(parseInt(value1), 1);
            break;
          case 'VERSION':
            if (level.version !== null) {
              assignMultipleMediaPlaylistTagOccuranceError(level, tag, result);
            }
            level.version = parseInt(value1);
            break;
          case 'INDEPENDENT-SEGMENTS':
            break;
          case 'I-FRAMES-ONLY':
            level.iframesOnly = true;
            break;
          case 'ENDLIST':
            if (!level.live) {
              assignMultipleMediaPlaylistTagOccuranceError(level, tag, result);
            }
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
            currentBitrate = parseInt(value1) * 1000;
            if (Number.isFinite(currentBitrate)) {
              frag.bitrate = currentBitrate;
            } else {
              currentBitrate = 0;
            }
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
              logger.log(
                `Ignoring invalid DATERANGE tag: ${dateRange.invalidReason}: ${value1}`,
              );
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
            if (level.startCC !== 0) {
              assignMultipleMediaPlaylistTagOccuranceError(level, tag, result);
            }
            level.startCC = discontinuityCounter = parseInt(value1);
            if (reused) {
              // renumbers segments taken from the previous parse
              return null;
            }
            fragments.forEach(
              (frag) => frag && (frag.cc = discontinuityCounter),
            );
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
              const currentKey = levelkeys[levelKey.keyFormat];
              // Ignore duplicate playlist KEY tags
              if (!currentKey?.matches(levelKey)) {
                if (currentKey || sharedKeys) {
                  levelkeys = Object.assign({}, levelkeys);
                  sharedKeys = false;
                }
                levelkeys[levelKey.keyFormat] = levelKey;
              }
              if (source !== null) {
                const previousKeys = reuseKeys(levelkeys, source, currentSN);
                if (previousKeys !== levelkeys) {
                  levelkeys = previousKeys;
                  sharedKeys = true;
                }
              }
            } else {
              logger.warn(
                `[Keys] Ignoring unsupported EXT-X-KEY tag: "${value1}"${__USE_EME_DRM__ ? '' : ' (light build)'}`,
              );
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
              const init = new Fragment(type, base);
              setInitSegment(init, mapAttrs, id, levelkeys);
              currentInitSegment = reuseInitSegment(
                init,
                source,
                currentSN,
                discontinuityCounter,
              );
              frag.initSegment = currentInitSegment;
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
              initProgramDateTime = frag.rawProgramDateTime;
              frag.rawProgramDateTime = null;
              currentInitSegment = reuseInitSegment(
                frag,
                source,
                currentSN,
                discontinuityCounter,
              );
              createNextFrag = true;
            }
            currentInitSegment.cc = discontinuityCounter;
            break;
          }
          case 'SERVER-CONTROL': {
            if (serverControlAttrs) {
              assignMultipleMediaPlaylistTagOccuranceError(level, tag, result);
            }
            serverControlAttrs = new AttrList(value1);
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
            if (level.partTarget) {
              assignMultipleMediaPlaylistTagOccuranceError(level, tag, result);
            }
            const partInfAttrs = new AttrList(value1);
            level.partTarget = partInfAttrs.decimalFloatingPoint('PART-TARGET');
            break;
          }
          case 'PART': {
            let partList = level.partList;
            if (!partList) {
              partList = level.partList = [];
            }
            const previousPart =
              currentPart > 0 ? partList[partList.length - 1] : undefined;
            const index = currentPart++;
            const partAttrs = new AttrList(value1, level);
            const part = new Part(
              partAttrs,
              frag as MediaFragment,
              base,
              index,
              previousPart,
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

        // A region can be stepped over on a reload only when every tag in it
        // describes the segment. These five do. Any other moves level state
        // (EXT-X-MAP among them: the merge repoints init segments, so a
        // fragment cannot say which one its own map declared), and a region
        // has to be entered after it: the segment's region begins there while
        // nothing of the segment has been parsed yet, and is otherwise closed.
        if (
          tag !== 'PROGRAM-DATE-TIME' &&
          tag !== 'DISCONTINUITY' &&
          tag !== 'GAP' &&
          tag !== 'PART' &&
          tag !== '#'
        ) {
          if (
            createNextFrag ||
            (frag.duration === 0 &&
              frag.tagList.length === 0 &&
              frag.byteRange.length === 0)
          ) {
            regionStart = LEVEL_PLAYLIST_REGEX_FAST.lastIndex;
            regionCC = discontinuityCounter;
            regionBitrate = currentBitrate;
            regionOpaque = false;
          } else {
            regionOpaque = true;
          }
        }
      }
    }
    if (prevFrag && !prevFrag.relurl) {
      fragments.pop();
      lanes.length -= LANES;
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
    if (!level.targetduration) {
      level.playlistParsingError = new Error(`Missing Target Duration`);
    }
    const fragmentLength = fragments.length;
    const firstFragment = fragments[0];
    const lastFragment = fragments[fragmentLength - 1];
    totalduration += level.skippedSegments * level.targetduration;
    const hasSegments = totalduration > 0 && fragmentLength > 0;
    if (hasSegments && lastFragment) {
      level.averagetargetduration = totalduration / fragmentLength;
      const lastSn = lastFragment.sn;
      level.endSN = lastSn !== 'initSegment' ? lastSn : 0;
    }
    // Fragments taken from the previous parse are written to only now, once
    // nothing can send this reload back for a plain parse.
    if (
      source !== null &&
      reused &&
      !commit(level, source, lanes, base, baseurl)
    ) {
      return null;
    }
    if (hasSegments && lastFragment) {
      if (!level.live) {
        lastFragment.endList = true;
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
        backfillProgramDateTimes(
          fragments,
          firstPdtIndex,
          firstPdtIndex > fragmentLength - 1 ? frag : null,
        );
        if (firstFragment) {
          programDateTimes.unshift(firstFragment as MediaFragment);
        }
      }
    }
    if (level.fragmentHint) {
      totalduration += level.fragmentHint.duration;
    }
    level.totalduration = totalduration;
    if (programDateTimes.length && level.dateRangeTagCount && firstFragment) {
      mapDateRanges(programDateTimes, level);
    }

    level.endCC = discontinuityCounter;

    generations.set(level, {
      details: level,
      text: string,
      startSN: level.startSN,
      fragments: fragments.slice(),
      lanes,
    });

    return level;
  }
}

// The previous parse of this playlist when fragments may be kept from it. A
// details object rewritten by a failed delta merge no longer indexes its
// lanes, and variable references can resolve differently between reloads.
function reuseSource(
  previous: LevelDetails,
  level: LevelDetails,
): Generation | null {
  const generation = generations.get(previous);
  return generation?.startSN === previous.startSN &&
    previous.live &&
    !previous.hasVariableRefs &&
    !level.hasVariableRefs &&
    !notEqualAfterStrippingQueries(previous.url, level.url)
    ? generation
    : null;
}

function noop() {}

// Commits a parse that took fragments from `source`, writing what differs for
// a segment that did not change: where it sits in this playlist and on the
// timeline (at the start the previous parse gave the segment this one begins
// with, which is where `adjustSliding` would put it), the declared duration
// the merge derives PTS from, the date-time chain, and the playlist URL.
// False, with nothing written, when the reload cannot land where a plain
// parse would: it did not parse; it is a delta update, whose skipped segments
// the merge fills in from the previous playlist, at the previous URL; it
// ended; it starts before the previous window; or the merge would reject it,
// and a rejected reload has to leave the previous playlist alone.
function commit(
  level: LevelDetails,
  source: Generation,
  lanes: number[],
  base: Base,
  baseurl: string,
): boolean {
  const old = source.details;
  const anchor = old.fragments[level.startSN - old.startSN] as
    | MediaFragment
    | undefined;
  if (
    level.playlistParsingError !== null ||
    level.skippedSegments > 0 ||
    !level.live ||
    !anchor
  ) {
    return false;
  }
  mapFragmentIntersection(old, level, noop);
  if (level.playlistParsingError !== null) {
    return false;
  }
  level.appliedTimelineOffset = old.appliedTimelineOffset;
  const fragments = level.fragments;
  const sliding = anchor.start;
  let offset = 0;
  let prev: Fragment | null = null;
  for (let i = 0; i < fragments.length; i++) {
    const fragment = fragments[i];
    const duration = lanes[i * LANES + LANE_DURATION];
    place(fragment, duration, offset, sliding, prev);
    if (fragment.base !== base && fragment.base.url !== baseurl) {
      // a kept fragment: move its playlist URL to this reload's
      fragment.base.url = baseurl;
    }
    offset += duration;
    prev = fragment;
  }
  const hint = level.fragmentHint;
  if (hint) {
    place(hint, hint.duration, offset, sliding, prev);
  }
  return true;
}

function place(
  fragment: Fragment,
  duration: number,
  offset: number,
  sliding: number,
  prev: Fragment | null,
) {
  fragment.setDuration(duration);
  fragment.playlistOffset = offset;
  fragment.setStart(offset + sliding);
  if (!fragment.rawProgramDateTime) {
    fragment.programDateTime = prev?.programDateTime
      ? prev.endProgramDateTime
      : null;
  }
}

// Init segments and key sets are the two things a fragment points at that the
// playlist declares once and every segment shares. Keeping the previous parse's
// object when the tag describes the same one is what lets a segment be checked
// against it with a pointer comparison instead of a field walk, and is one
// fewer object per reload.
function reuseInitSegment(
  init: Fragment,
  source: Generation | null,
  sn: number,
  cc: number,
): Fragment {
  // `relurl` equality implies url equality: `reuseSource` only offers a
  // previous parse whose playlist URL differs at most in its query, which
  // resolution drops.
  const candidate = source?.fragments[sn - source.startSN]?.initSegment;
  if (
    candidate &&
    candidate.relurl === init.relurl &&
    candidate.cc === cc &&
    candidate.levelkeys === init.levelkeys &&
    candidate.byteRangeStartOffset === init.byteRangeStartOffset &&
    candidate.byteRangeEndOffset === init.byteRangeEndOffset
  ) {
    return candidate;
  }
  return init;
}

function reuseKeys(keys: LevelKeys, source: Generation, sn: number): LevelKeys {
  const candidate = source.fragments[sn - source.startSN]?.levelkeys;
  if (candidate && candidate !== keys) {
    const formats = Object.keys(keys);
    if (
      formats.length === Object.keys(candidate).length &&
      formats.every((format) => candidate[format]?.matches(keys[format]!))
    ) {
      return candidate;
    }
  }
  return keys;
}

function createVariant(
  attrs: LevelAttributes | IFrameAttributes,
  tUri: string | undefined,
  baseurl: string,
  parsed: ParsedMultivariantPlaylist,
  levelsWithKnownCodecs: LevelParsed[],
  iframes?: boolean,
): LevelParsed | null {
  if (tUri === undefined) {
    // URI line or attribute is required. Ignore entry if missing.
    return null;
  }
  const uri = __USE_VARIABLE_SUBSTITUTION__
    ? substituteVariables(parsed, tUri)
    : tUri;
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
  const supplementalCodecs = attrs['SUPPLEMENTAL-CODECS'];
  if (supplementalCodecs) {
    level.supplemental = {};
    setCodecs(supplementalCodecs, level.supplemental);
  }
  if (!level.unknownCodecs?.length) {
    levelsWithKnownCodecs.push(level);
  }
  if (iframes) {
    level.iframes = true;
  }
  return level;
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
    keyAttrs.KEYID,
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
  level: CodecsParsed,
) {
  let codecs = (codecsAttributeValue || '').split(/[ ,]+/).filter((c) => c);
  ['video', 'audio', 'text', 'image'].forEach((type: CodecType) => {
    const filtered = codecs.filter((codec) => isCodecType(codec, type));
    if (filtered.length) {
      // Comma separated list of all codecs for type
      level[`${type}Codec`] = filtered.map((c) => c.split('/')[0]).join(',');
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
  fragPrev: Fragment | null,
) {
  fragPrev ||= fragments[firstPdtIndex];
  if (!fragPrev) {
    return;
  }
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

function setInitSegment(
  frag: Fragment,
  mapAttrs: AttrList,
  id: number,
  levelkeys: LevelKeys | undefined,
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
  levelkeys: LevelKeys,
  level: LevelDetails,
) {
  frag.levelkeys = levelkeys;
  const { encryptedFragments } = level;
  if (
    (!encryptedFragments.length ||
      encryptedFragments[encryptedFragments.length - 1].levelkeys !==
        levelkeys) &&
    Object.keys(levelkeys).some(
      (format) => levelkeys[format]!.isCommonEncryption,
    )
  ) {
    encryptedFragments.push(frag);
  }
}

function assignMultipleMediaPlaylistTagOccuranceError(
  level: LevelDetails,
  tag: string,
  result: string[],
) {
  level.playlistParsingError = new Error(
    `#EXT-X-${tag} must not appear more than once (${result[0]})`,
  );
}

function assignMustAppearBeforeSegmentsError(
  level: LevelDetails,
  tag: string,
  result: string[],
) {
  level.playlistParsingError = new Error(
    `#EXT-X-${tag} must appear before the first Media Segment (${result[0]})`,
  );
}
