import * as URLToolkit from 'url-toolkit';

import { Fragment, Part } from './fragment';
import { LevelDetails } from './level-details';
import { LevelKey } from './level-key';

import { AttrList } from '../utils/attr-list';
import { logger } from '../utils/logger';
import type { CodecType } from '../utils/codecs';
import { isCodecType } from '../utils/codecs';
import type {
  MediaPlaylist,
  AudioGroup,
  MediaPlaylistType,
} from '../types/media-playlist';
import type { PlaylistLevelType } from '../types/loader';
import type { LevelAttributes, LevelParsed } from '../types/level';

type M3U8ParserFragments = Array<Fragment | null>;

// https://regex101.com is your friend
const MASTER_PLAYLIST_REGEX =
  /#EXT-X-STREAM-INF:([^\r\n]*)(?:[\r\n](?:#[^\r\n]*)?)*([^\r\n]+)|#EXT-X-SESSION-DATA:([^\r\n]*)[\r\n]+/g;
const MASTER_PLAYLIST_MEDIA_REGEX = /#EXT-X-MEDIA:(.*)/g;

const LEVEL_PLAYLIST_REGEX_FAST = new RegExp(
  [
    /#EXTINF:\s*(\d*(?:\.\d+)?)(?:,(.*)\s+)?/.source, // duration (#EXTINF:<duration>,<title>), group 1 => duration, group 2 => title
    /(?!#) *(\S[\S ]*)/.source, // segment URI, group 3 => the URI (note newline is not eaten)
    /#EXT-X-BYTERANGE:*(.+)/.source, // next segment's byterange, group 4 => range spec (x@y)
    /#EXT-X-PROGRAM-DATE-TIME:(.+)/.source, // next segment's program date/time group 5 => the datetime spec
    /#.*/.source, // All other non-segment oriented tags will match with all groups empty
  ].join('|'),
  'g'
);

const LEVEL_PLAYLIST_REGEX_SLOW = new RegExp(
  [
    /#(EXTM3U)/.source,
    /#EXT-X-(PLAYLIST-TYPE):(.+)/.source,
    /#EXT-X-(MEDIA-SEQUENCE): *(\d+)/.source,
    /#EXT-X-(SKIP):(.+)/.source,
    /#EXT-X-(TARGETDURATION): *(\d+)/.source,
    /#EXT-X-(KEY):(.+)/.source,
    /#EXT-X-(START):(.+)/.source,
    /#EXT-X-(ENDLIST)/.source,
    /#EXT-X-(DISCONTINUITY-SEQ)UENCE: *(\d+)/.source,
    /#EXT-X-(DIS)CONTINUITY/.source,
    /#EXT-X-(VERSION):(\d+)/.source,
    /#EXT-X-(MAP):(.+)/.source,
    /#EXT-X-(SERVER-CONTROL):(.+)/.source,
    /#EXT-X-(PART-INF):(.+)/.source,
    /#EXT-X-(GAP)/.source,
    /#EXT-X-(BITRATE):\s*(\d+)/.source,
    /#EXT-X-(PART):(.+)/.source,
    /#EXT-X-(PRELOAD-HINT):(.+)/.source,
    /#EXT-X-(RENDITION-REPORT):(.+)/.source,
    /(#)([^:]*):(.*)/.source,
    /(#)(.*)(?:.*)\r?\n?/.source,
  ].join('|')
);

const MP4_REGEX_SUFFIX = /\.(mp4|m4s|m4v|m4a)$/i;

function isMP4Url(url: string): boolean {
  return MP4_REGEX_SUFFIX.test(URLToolkit.parseURL(url)?.path ?? '');
}

export default class M3U8Parser {
  static findGroup(
    groups: Array<AudioGroup>,
    mediaGroupId: string
  ): AudioGroup | undefined {
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (group.id === mediaGroupId) {
        return group;
      }
    }
  }

  static convertAVC1ToAVCOTI(codec) {
    // Convert avc1 codec string from RFC-4281 to RFC-6381 for MediaSource.isTypeSupported
    const avcdata = codec.split('.');
    if (avcdata.length > 2) {
      let result = avcdata.shift() + '.';
      result += parseInt(avcdata.shift()).toString(16);
      result += ('000' + parseInt(avcdata.shift()).toString(16)).substr(-4);
      return result;
    }
    return codec;
  }

  static resolve(url, baseUrl) {
    return URLToolkit.buildAbsoluteURL(baseUrl, url, { alwaysNormalize: true });
  }

  static parseMasterPlaylist(string: string, baseurl: string) {
    const levels: Array<LevelParsed> = [];
    const sessionData: Record<string, AttrList> = {};
    let hasSessionData = false;
    MASTER_PLAYLIST_REGEX.lastIndex = 0;

    let result: RegExpExecArray | null;
    while ((result = MASTER_PLAYLIST_REGEX.exec(string)) != null) {
      if (result[1]) {
        // '#EXT-X-STREAM-INF' is found, parse level tag  in group 1
        const attrs = new AttrList(result[1]);
        const level: LevelParsed = {
          attrs,
          bitrate:
            attrs.decimalInteger('AVERAGE-BANDWIDTH') ||
            attrs.decimalInteger('BANDWIDTH'),
          name: attrs.NAME,
          url: M3U8Parser.resolve(result[2], baseurl),
        };

        const resolution = attrs.decimalResolution('RESOLUTION');
        if (resolution) {
          level.width = resolution.width;
          level.height = resolution.height;
        }

        setCodecs(
          (attrs.CODECS || '').split(/[ ,]+/).filter((c) => c),
          level
        );

        if (level.videoCodec && level.videoCodec.indexOf('avc1') !== -1) {
          level.videoCodec = M3U8Parser.convertAVC1ToAVCOTI(level.videoCodec);
        }

        levels.push(level);
      } else if (result[3]) {
        // '#EXT-X-SESSION-DATA' is found, parse session data in group 3
        const sessionAttrs = new AttrList(result[3]);
        if (sessionAttrs['DATA-ID']) {
          hasSessionData = true;
          sessionData[sessionAttrs['DATA-ID']] = sessionAttrs;
        }
      }
    }
    return {
      levels,
      sessionData: hasSessionData ? sessionData : null,
    };
  }

  static parseMasterPlaylistMedia(
    string: string,
    baseurl: string,
    type: MediaPlaylistType,
    groups: Array<AudioGroup> = []
  ): Array<MediaPlaylist> {
    let result: RegExpExecArray | null;
    const medias: Array<MediaPlaylist> = [];
    let id = 0;
    MASTER_PLAYLIST_MEDIA_REGEX.lastIndex = 0;
    while ((result = MASTER_PLAYLIST_MEDIA_REGEX.exec(string)) !== null) {
      const attrs = new AttrList(result[1]) as LevelAttributes;
      if (attrs.TYPE === type) {
        const media: MediaPlaylist = {
          attrs,
          bitrate: 0,
          id: id++,
          groupId: attrs['GROUP-ID'],
          instreamId: attrs['INSTREAM-ID'],
          name: attrs.NAME || attrs.LANGUAGE || '',
          type,
          default: attrs.bool('DEFAULT'),
          autoselect: attrs.bool('AUTOSELECT'),
          forced: attrs.bool('FORCED'),
          lang: attrs.LANGUAGE,
          url: attrs.URI ? M3U8Parser.resolve(attrs.URI, baseurl) : '',
        };

        if (groups.length) {
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
    return medias;
  }

  static parseLevelPlaylist(
    string: string,
    baseurl: string,
    id: number,
    type: PlaylistLevelType,
    levelUrlId: number
  ): LevelDetails {
    const level = new LevelDetails(baseurl);
    const fragments: M3U8ParserFragments = level.fragments;
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
    let levelkey: LevelKey | undefined;
    let firstPdtIndex = -1;
    let createNextFrag = false;

    LEVEL_PLAYLIST_REGEX_FAST.lastIndex = 0;
    level.m3u8 = string;

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
          if (levelkey) {
            frag.levelkey = levelkey;
          }
          frag.sn = currentSN;
          frag.level = id;
          frag.cc = discontinuityCounter;
          frag.urlId = levelUrlId;
          fragments.push(frag);
          // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
          frag.relurl = (' ' + result[3]).slice(1);
          assignProgramDateTime(frag, prevFrag);
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
            const skipAttrs = new AttrList(value1);
            const skippedSegments =
              skipAttrs.decimalInteger('SKIPPED-SEGMENTS');
            if (Number.isFinite(skippedSegments)) {
              level.skippedSegments = skippedSegments;
              // This will result in fragments[] containing undefined values, which we will fill in with `mergeDetails`
              for (let i = skippedSegments; i--; ) {
                fragments.unshift(null);
              }
              currentSN += skippedSegments;
            }
            const recentlyRemovedDateranges = skipAttrs.enumeratedString(
              'RECENTLY-REMOVED-DATERANGES'
            );
            if (recentlyRemovedDateranges) {
              level.recentlyRemovedDateranges =
                recentlyRemovedDateranges.split('\t');
            }
            break;
          }
          case 'TARGETDURATION':
            level.targetduration = parseFloat(value1);
            break;
          case 'VERSION':
            level.version = parseInt(value1);
            break;
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
          case 'DIS':
            discontinuityCounter++;
          /* falls through */
          case 'GAP':
            frag.tagList.push([tag]);
            break;
          case 'BITRATE':
            frag.tagList.push([tag, value1]);
            break;
          case 'DISCONTINUITY-SEQ':
            discontinuityCounter = parseInt(value1);
            break;
          case 'KEY': {
            // https://tools.ietf.org/html/rfc8216#section-4.3.2.4
            const keyAttrs = new AttrList(value1);
            const decryptmethod = keyAttrs.enumeratedString('METHOD');
            const decrypturi = keyAttrs.URI;
            const decryptiv = keyAttrs.hexadecimalInteger('IV');
            const decryptkeyformatversions =
              keyAttrs.enumeratedString('KEYFORMATVERSIONS');
            const decryptkeyid = keyAttrs.enumeratedString('KEYID');
            // From RFC: This attribute is OPTIONAL; its absence indicates an implicit value of "identity".
            const decryptkeyformat =
              keyAttrs.enumeratedString('KEYFORMAT') ?? 'identity';

            const unsupportedKnownKeyformatsInManifest = [
              'com.apple.streamingkeydelivery',
              'com.microsoft.playready',
              'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed', // widevine (v2)
              'com.widevine', // earlier widevine (v1)
            ];

            if (
              unsupportedKnownKeyformatsInManifest.indexOf(decryptkeyformat) >
              -1
            ) {
              logger.warn(
                `Keyformat ${decryptkeyformat} is not supported from the manifest`
              );
              continue;
            } else if (decryptkeyformat !== 'identity') {
              // We are supposed to skip keys we don't understand.
              // As we currently only officially support identity keys
              // from the manifest we shouldn't save any other key.
              continue;
            }

            // TODO: multiple keys can be defined on a fragment, and we need to support this
            // for clients that support both playready and widevine
            if (decryptmethod) {
              // TODO: need to determine if the level key is actually a relative URL
              // if it isn't, then we should instead construct the LevelKey using fromURI.
              levelkey = LevelKey.fromURL(baseurl, decrypturi);
              if (
                decrypturi &&
                ['AES-128', 'SAMPLE-AES', 'SAMPLE-AES-CENC'].indexOf(
                  decryptmethod
                ) >= 0
              ) {
                levelkey.method = decryptmethod;
                levelkey.keyFormat = decryptkeyformat;

                if (decryptkeyid) {
                  levelkey.keyID = decryptkeyid;
                }

                if (decryptkeyformatversions) {
                  levelkey.keyFormatVersions = decryptkeyformatversions;
                }

                // Initialization Vector (IV)
                levelkey.iv = decryptiv;
              }
            }
            break;
          }
          case 'START': {
            const startAttrs = new AttrList(value1);
            const startTimeOffset =
              startAttrs.decimalFloatingPoint('TIME-OFFSET');
            // TIME-OFFSET can be 0
            if (Number.isFinite(startTimeOffset)) {
              level.startTimeOffset = startTimeOffset;
            }
            break;
          }
          case 'MAP': {
            const mapAttrs = new AttrList(value1);
            frag.relurl = mapAttrs.URI;
            if (mapAttrs.BYTERANGE) {
              frag.setByteRange(mapAttrs.BYTERANGE);
            }
            frag.level = id;
            frag.sn = 'initSegment';
            if (levelkey) {
              frag.levelkey = levelkey;
            }
            frag.initSegment = null;
            currentInitSegment = frag;
            createNextFrag = true;
            break;
          }
          case 'SERVER-CONTROL': {
            const serverControlAttrs = new AttrList(value1);
            level.canBlockReload = serverControlAttrs.bool('CAN-BLOCK-RELOAD');
            level.canSkipUntil = serverControlAttrs.optionalFloat(
              'CAN-SKIP-UNTIL',
              0
            );
            level.canSkipDateRanges =
              level.canSkipUntil > 0 &&
              serverControlAttrs.bool('CAN-SKIP-DATERANGES');
            level.partHoldBack = serverControlAttrs.optionalFloat(
              'PART-HOLD-BACK',
              0
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
            const part = new Part(
              new AttrList(value1),
              frag,
              baseurl,
              index,
              previousFragmentPart
            );
            partList.push(part);
            frag.duration += part.duration;
            break;
          }
          case 'PRELOAD-HINT': {
            const preloadHintAttrs = new AttrList(value1);
            level.preloadHint = preloadHintAttrs;
            break;
          }
          case 'RENDITION-REPORT': {
            const renditionReportAttrs = new AttrList(value1);
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
        level.fragmentHint = prevFrag;
      }
    } else if (level.partList) {
      assignProgramDateTime(frag, prevFrag);
      frag.cc = discontinuityCounter;
      level.fragmentHint = frag;
    }
    const fragmentLength = fragments.length;
    const firstFragment = fragments[0];
    const lastFragment = fragments[fragmentLength - 1];
    totalduration += level.skippedSegments * level.targetduration;
    if (totalduration > 0 && fragmentLength && lastFragment) {
      level.averagetargetduration = totalduration / fragmentLength;
      const lastSn = lastFragment.sn;
      level.endSN = lastSn !== 'initSegment' ? lastSn : 0;
      if (firstFragment) {
        level.startCC = firstFragment.cc;
        if (!firstFragment.initSegment) {
          // this is a bit lurky but HLS really has no other way to tell us
          // if the fragments are TS or MP4, except if we download them :/
          // but this is to be able to handle SIDX.
          if (
            level.fragments.every(
              (frag) => frag.relurl && isMP4Url(frag.relurl)
            )
          ) {
            logger.warn(
              'MP4 fragments found but no init segment (probably no MAP, incomplete M3U8), trying to fetch SIDX'
            );
            frag = new Fragment(type, baseurl);
            frag.relurl = lastFragment.relurl;
            frag.level = id;
            frag.sn = 'initSegment';
            firstFragment.initSegment = frag;
            level.needSidxRanges = true;
          }
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
    level.endCC = discontinuityCounter;

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
    }

    return level;
  }
}

function setCodecs(codecs: Array<string>, level: LevelParsed) {
  ['video', 'audio', 'text'].forEach((type: CodecType) => {
    const filtered = codecs.filter((codec) => isCodecType(codec, type));
    if (filtered.length) {
      const preferred = filtered.filter((codec) => {
        return (
          codec.lastIndexOf('avc1', 0) === 0 ||
          codec.lastIndexOf('mp4a', 0) === 0
        );
      });
      level[`${type}Codec`] = preferred.length > 0 ? preferred[0] : filtered[0];

      // remove from list
      codecs = codecs.filter((codec) => filtered.indexOf(codec) === -1);
    }
  });

  level.unknownCodecs = codecs;
}

function assignCodec(media, groupItem, codecProperty) {
  const codecValue = groupItem[codecProperty];
  if (codecValue) {
    media[codecProperty] = codecValue;
  }
}

function backfillProgramDateTimes(
  fragments: M3U8ParserFragments,
  firstPdtIndex: number
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

function assignProgramDateTime(frag, prevFrag) {
  if (frag.rawProgramDateTime) {
    frag.programDateTime = Date.parse(frag.rawProgramDateTime);
  } else if (prevFrag?.programDateTime) {
    frag.programDateTime = prevFrag.endProgramDateTime;
  }

  if (!Number.isFinite(frag.programDateTime)) {
    frag.programDateTime = null;
    frag.rawProgramDateTime = null;
  }
}
