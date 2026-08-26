import { buildAbsoluteURL } from 'url-toolkit';
import { DateRange } from './date-range';
import { Fragment, Part } from './fragment';
import { LevelDetails } from './level-details';
import { LevelKey } from './level-key';
import { AttrList } from '../utils/attr-list';
import { isCodecType } from '../utils/codecs';
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
// fragment that is already in hand.
//
// Six lanes per fragment, indexed the same way as LevelDetails.fragments:
const LANE_END = 0; // offset in `text` just past the region's URI line
const LANE_LENGTH = 1; // region length; 0 marks a region that must be parsed
const LANE_CC = 2; // discontinuity counter entering the region
const LANE_BITRATE = 3; // EXT-X-BITRATE value entering the region
const LANE_DURATION = 4; // EXTINF duration as this playlist declares it
const LANE_INIT = 5; // 1 when the region declares its own init segment
const LANES = 6;

type Generation = { text: string; startSN: number; lanes: number[] };

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
    let serverControlAttrs: AttrList | undefined;
    // Where the last segment's date-time range ends. Kept here rather than read
    // back from the fragment, whose `duration` is the value the merge derived
    // from PTS once it has been through a reload.
    let prevEndPdt: number | null = null;

    // `source` is the previous parse when this reload may keep fragments from
    // it, and null otherwise; `base` is then shared with it, so that one write
    // at commit moves every fragment to the new playlist URL. Until commit
    // nothing here writes to the previous parse.
    const source = reuseSource(previous, baseurl);
    const base: Base = source ? previous!.fragments[0].base : { url: baseurl };
    const lanes: number[] = [];
    let reused = 0;
    let regionStart = 0;
    let regionCC = 0;
    let regionBitrate = 0;
    let regionOpaque = false;
    let regionOwnInit = false;
    let sharedKeys = false;
    let prevPartIndex = 0;
    let frag: Fragment = new Fragment(type, base);

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
    regionStart = LEVEL_PLAYLIST_REGEX_FAST.lastIndex;
    for (;;) {
      // A segment boundary with nothing parsed into `frag` yet. If the text
      // ahead is the text that produced a fragment last time and the state
      // entering it is the state that parse had, that fragment is this segment:
      // take it, and step over its region rather than rebuilding it.
      if (
        source !== null &&
        (createNextFrag ||
          (fragments.length === 0 &&
            frag.duration === 0 &&
            frag.tagList.length === 0)) &&
        nextByteRange === null &&
        !level.skippedSegments &&
        !level.iframesOnly &&
        !level.hasVariableRefs
      ) {
        const index = currentSN - previous!.startSN;
        const lane = index * LANES;
        const length = index >= 0 ? source.lanes[lane + LANE_LENGTH] : 0;
        const candidate: Fragment | undefined = length
          ? previous!.fragments[index]
          : undefined;
        const at = LEVEL_PLAYLIST_REGEX_FAST.lastIndex;
        if (
          candidate !== undefined &&
          candidate.sn === currentSN &&
          candidate.level === id &&
          candidate.base === base &&
          candidate.levelkeys === levelkeys &&
          (source.lanes[lane + LANE_INIT] === 1 ||
            candidate.initSegment === currentInitSegment) &&
          source.lanes[lane + LANE_CC] === discontinuityCounter &&
          source.lanes[lane + LANE_BITRATE] === currentBitrate &&
          (candidate.rawProgramDateTime !== null ||
            candidate.programDateTime === prevEndPdt) &&
          sameText(
            string,
            at,
            source.text,
            source.lanes[lane + LANE_END],
            length,
          )
        ) {
          const duration = source.lanes[lane + LANE_DURATION];
          if (candidate.rawProgramDateTime) {
            if (firstPdtIndex === -1) {
              firstPdtIndex = fragments.length;
            }
            programDateTimes.push(candidate as MediaFragment);
          }
          const pdt = candidate.programDateTime;
          prevEndPdt = pdt
            ? pdt + (Number.isFinite(duration) ? duration : 0) * 1000
            : null;
          if (levelkeys) {
            setFragLevelKeys(candidate, levelkeys, level);
          }
          // The only level state a region may carry: everything else in it
          // belongs to the segment and is already on the fragment.
          discontinuityCounter = candidate.cc;
          currentInitSegment = candidate.initSegment;
          const previousParts = previous!.partList;
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
            at + length,
            length,
            source.lanes[lane + LANE_CC],
            currentBitrate,
            duration,
            source.lanes[lane + LANE_INIT],
          );
          prevFrag = candidate;
          totalduration += duration;
          currentSN++;
          currentPart = 0;
          reused++;
          regionStart = at + length;
          regionCC = discontinuityCounter;
          regionBitrate = currentBitrate;
          regionOpaque = false;
          regionOwnInit = false;
          LEVEL_PLAYLIST_REGEX_FAST.lastIndex = regionStart;
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
          if (currentInitSegment.rawProgramDateTime) {
            frag.rawProgramDateTime = currentInitSegment.rawProgramDateTime;
            currentInitSegment.rawProgramDateTime = null;
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
          if (frag.rawProgramDateTime) {
            programDateTimes.push(frag as MediaFragment);
          } else if (prevEndPdt !== null) {
            frag.programDateTime = prevEndPdt;
          }
          const pdt = frag.programDateTime;
          prevEndPdt = pdt
            ? pdt + (Number.isFinite(frag.duration) ? frag.duration : 0) * 1000
            : null;
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
            regionBitrate,
            frag.duration,
            regionOwnInit ? 1 : 0,
          );
          regionStart = regionEnd;
          regionCC = discontinuityCounter;
          regionBitrate = currentBitrate;
          regionOpaque = false;
          regionOwnInit = false;

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

        // A region can only be stepped over on a reload when every tag in it
        // describes the segment. These six do; the rest move level state that
        // stepping over the region would lose, so they close it for reuse.
        regionOpaque ||=
          tag !== 'PROGRAM-DATE-TIME' &&
          tag !== 'DISCONTINUITY' &&
          tag !== 'GAP' &&
          tag !== 'MAP' &&
          tag !== 'PART' &&
          tag !== '#';

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
                const previousKeys = reuseKeys(levelkeys, previous!, currentSN);
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
            regionOwnInit = true;
            if (frag.duration) {
              // Initial segment tag is after segment duration tag.
              //   #EXTINF: 6.0
              //   #EXT-X-MAP:URI="init.mp4
              const init = new Fragment(type, base);
              setInitSegment(init, mapAttrs, id, levelkeys);
              currentInitSegment = reuseInitSegment(
                init,
                source && previous!,
                currentSN,
                discontinuityCounter,
              );
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
              currentInitSegment = reuseInitSegment(
                frag,
                source && previous!,
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
      if (frag.rawProgramDateTime) {
        programDateTimes.push(frag as MediaFragment);
      } else if (prevEndPdt !== null) {
        frag.programDateTime = prevEndPdt;
      }
      frag.cc = discontinuityCounter;
      level.fragmentHint = frag as MediaFragment;
      if (levelkeys) {
        setFragLevelKeys(frag, levelkeys, level);
      }
    }
    if (!level.targetduration) {
      level.playlistParsingError = new Error(`Missing Target Duration`);
    }
    if (source !== null && (reused > 0 || base.url !== baseurl)) {
      if (level.playlistParsingError !== null || !continuous(previous!, level)) {
        // A reload the merge would reject, or one that did not parse, must
        // leave the previous playlist alone. Nothing has been written to it
        // yet, so dropping this attempt for a plain parse is the whole undo.
        return M3U8Parser.parseLevelPlaylist(
          string,
          baseurl,
          id,
          type,
          levelUrlId,
          multivariantVariableList,
        );
      }
      // Commit. Where the segment sits in this playlist, and which URL the
      // playlist is at, are the only things that differ for a segment that
      // did not change; the duration goes back to the declared one so the
      // merge derives PTS from the same starting point either way.
      let offset = 0;
      for (let j = 0; j < fragments.length; j++) {
        const fragment = fragments[j] as Fragment;
        const duration = lanes[j * LANES + LANE_DURATION];
        fragment.setDuration(duration);
        fragment.playlistOffset = offset;
        fragment.setStart(offset);
        offset += duration;
      }
      base.url = baseurl;
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

    generations.set(level, { text: string, startSN: level.startSN, lanes });

    return level;
  }
}

// The previous parse of this playlist when its fragments may be kept, or null.
// A reload that cannot rebuild the same graph is turned away here, once, rather
// than being caught segment by segment: a delta update, a playlist that moved,
// one whose details were rewritten by the merge, or one that failed to parse.
function reuseSource(
  previous: LevelDetails | null | undefined,
  baseurl: string,
): Generation | null {
  if (
    !previous ||
    previous.playlistParsingError !== null ||
    !previous.live ||
    !previous.fragments[0] ||
    !sameUpToQuery(previous.url, baseurl)
  ) {
    return null;
  }
  const generation = generations.get(previous);
  if (
    !generation ||
    generation.text !== previous.m3u8 ||
    generation.startSN !== previous.startSN
  ) {
    return null;
  }
  return generation;
}

// `length` characters of `text` from `at`, against the same number ending at
// `end` of `previous`. Compared in place: slicing them would allocate, and a
// sliced string kept on a fragment is a leak (#939).
function sameText(
  text: string,
  at: number,
  previous: string,
  end: number,
  length: number,
): boolean {
  if (at + length > text.length) {
    return false;
  }
  const offset = end - length;
  for (let i = length; i--; ) {
    if (text.charCodeAt(at + i) !== previous.charCodeAt(offset + i)) {
      return false;
    }
  }
  return true;
}

// True when the two playlists agree about every segment they have in common.
// `mergeDetails` rejects the reload when they do not, and a rejected reload has
// to leave the previous playlist untouched, so this is what decides whether
// fragments may be shared with it at all.
function continuous(previous: LevelDetails, level: LevelDetails): boolean {
  const newFragments = level.fragments;
  if (!newFragments.length) {
    return true;
  }
  const oldFragments = previous.fragments;
  const oldHint = previous.fragmentHint;
  const newHint = level.fragmentHint;
  const newStartSN = newFragments[0].sn;
  const last = Math.min(
    oldHint ? oldHint.sn : previous.endSN,
    newHint ? newHint.sn : newFragments[newFragments.length - 1].sn,
  );
  for (let sn = Math.max(previous.startSN, newStartSN); sn <= last; sn++) {
    const oldFrag =
      oldFragments[sn - previous.startSN] ||
      (oldHint?.sn === sn ? oldHint : null);
    const newFrag =
      newFragments[sn - newStartSN] || (newHint?.sn === sn ? newHint : null);
    if (oldFrag && newFrag && oldFrag !== newFrag) {
      if (
        oldFrag.cc !== newFrag.cc ||
        (oldFrag.relurl !== undefined &&
          !sameUpToQuery(oldFrag.relurl, newFrag.relurl))
      ) {
        return false;
      }
    }
  }
  return true;
}

// Equality of two URLs ignoring the query, matching what the merge compares
// segment URIs with, without the two strings it would allocate to do it.
function sameUpToQuery(uri: string, other: string | undefined): boolean {
  if (uri === other) {
    return true;
  }
  if (other === undefined) {
    return false;
  }
  const end = queryStart(uri);
  if (end !== queryStart(other)) {
    return false;
  }
  for (let i = end; i--; ) {
    if (uri.charCodeAt(i) !== other.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}

function queryStart(uri: string): number {
  const index = uri.lastIndexOf('?');
  return index === -1 ? uri.length : index;
}

// Init segments and key sets are the two things a fragment points at that the
// playlist declares once and every segment shares. Keeping the previous parse's
// object when the tag describes the same one is what lets a segment be checked
// against it with a pointer comparison instead of a field walk, and is one
// fewer object per reload.
function reuseInitSegment(
  init: Fragment,
  previous: LevelDetails | null,
  sn: number,
  cc: number,
): Fragment {
  const candidate = previous?.fragments[sn - previous.startSN]?.initSegment;
  if (
    candidate &&
    candidate.base === init.base &&
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

function reuseKeys(
  keys: LevelKeys,
  previous: LevelDetails,
  sn: number,
): LevelKeys {
  const candidate = previous.fragments[sn - previous.startSN]?.levelkeys;
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

export function mapDateRanges(
  programDateTimes: MediaFragment[],
  details: LevelDetails,
) {
  // Make sure DateRanges are mapped to a ProgramDateTime tag that applies a date to a segment that overlaps with its start date
  let programDateTimeCount = programDateTimes.length;
  if (!programDateTimeCount) {
    if (details.hasProgramDateTime) {
      const lastFragment = details.fragments[details.fragments.length - 1];
      programDateTimes.push(lastFragment);
      programDateTimeCount++;
    } else {
      // no segments with EXT-X-PROGRAM-DATE-TIME references in playlist history
      return;
    }
  }
  const lastProgramDateTime = programDateTimes[programDateTimeCount - 1];
  const playlistEnd = details.live ? Infinity : details.totalduration;
  const dateRangeIds = Object.keys(details.dateRanges);
  for (let i = dateRangeIds.length; i--; ) {
    const dateRange = details.dateRanges[dateRangeIds[i]]!;
    const startDateTime = dateRange.startDate.getTime();
    dateRange.tagAnchor = lastProgramDateTime.ref;
    for (let j = programDateTimeCount; j--; ) {
      if (programDateTimes[j]?.sn < details.startSN) {
        break;
      }
      const fragment = findFragmentWithStartDate(
        details,
        startDateTime,
        programDateTimes,
        j,
        playlistEnd,
      );
      if (fragment) {
        dateRange.tagAnchor = fragment.ref;
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
): MediaFragment | null {
  const pdtFragment = programDateTimes[index] as MediaFragment | undefined;
  if (pdtFragment) {
    // find matching range between PDT tags
    const pdtStart = pdtFragment.programDateTime as number;
    if (startDateTime >= pdtStart || index === 0) {
      const durationBetweenPdt =
        (programDateTimes[index + 1]?.start || endTime) - pdtFragment.start;
      if (startDateTime <= pdtStart + durationBetweenPdt * 1000) {
        // map to fragment with date-time range
        const startIndex = pdtFragment.sn - details.startSN;
        const fragments = details.fragments;
        if (startIndex >= 0 && startIndex < fragments.length) {
          if (fragments.length > programDateTimes.length) {
            const endSegment =
              programDateTimes[index + 1] || fragments[fragments.length - 1];
            const endIndex = Math.min(
              endSegment.sn - details.startSN,
              fragments.length - 1,
            );
            for (let i = endIndex; i > startIndex; i--) {
              const fragStartDateTime = fragments[i].programDateTime as number;
              if (
                startDateTime >= fragStartDateTime &&
                startDateTime < fragStartDateTime + fragments[i].duration * 1000
              ) {
                return fragments[i];
              }
            }
          }
          return fragments[startIndex];
        }
      }
    }
  }
  return null;
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

export function assignProgramDateTime(
  frag: MediaFragment,
  prevFrag: MediaFragment | null,
  programDateTimes: MediaFragment[],
) {
  if (frag.rawProgramDateTime) {
    programDateTimes.push(frag);
  } else if (prevFrag?.programDateTime) {
    frag.programDateTime = prevFrag.endProgramDateTime;
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
