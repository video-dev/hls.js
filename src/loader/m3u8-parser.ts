import * as URLToolkit from 'url-toolkit';

import Fragment from './fragment';
import LevelDetails from './level-details';
import LevelKey from './level-key';

import AttrList from '../utils/attr-list';
import { logger } from '../utils/logger';
import { isCodecType, CodecType } from '../utils/codecs';
import { MediaPlaylist, AudioGroup, MediaPlaylistType } from '../types/media-playlist';
import { PlaylistLevelType } from '../types/loader';
import { LevelAttributes } from '../types/level';

/**
 * M3U8 parser
 * @module
 */

// https://regex101.com is your friend
const MASTER_PLAYLIST_REGEX = /#EXT-X-STREAM-INF:([^\n\r]*)[\r\n]+([^\r\n]+)|#EXT-X-SESSION-DATA:([^\n\r]*)[\r\n]+/g;
const MASTER_PLAYLIST_MEDIA_REGEX = /#EXT-X-MEDIA:(.*)/g;

const LEVEL_PLAYLIST_REGEX_FAST = new RegExp([
  /#EXTINF:\s*(\d*(?:\.\d+)?)(?:,(.*)\s+)?/.source, // duration (#EXTINF:<duration>,<title>), group 1 => duration, group 2 => title
  /(?!#)([\S+ ?]+)/.source, // segment URI, group 3 => the URI (note newline is not eaten)
  /#EXT-X-BYTERANGE:*(.+)/.source, // next segment's byterange, group 4 => range spec (x@y)
  /#EXT-X-PROGRAM-DATE-TIME:(.+)/.source, // next segment's program date/time group 5 => the datetime spec
  /#.*/.source // All other non-segment oriented tags will match with all groups empty
].join('|'), 'g');

const LEVEL_PLAYLIST_REGEX_SLOW = new RegExp([
  /#(EXTM3U)/.source,
  /#EXT-X-(PLAYLIST-TYPE):(.+)/.source,
  /#EXT-X-(MEDIA-SEQUENCE): *(\d+)/.source,
  /#EXT-X-(TARGETDURATION): *(\d+)/.source,
  /#EXT-X-(KEY):(.+)/.source,
  /#EXT-X-(START):(.+)/.source,
  /#EXT-X-(ENDLIST)/.source,
  /#EXT-X-(DISCONTINUITY-SEQ)UENCE: *(\d+)/.source,
  /#EXT-X-(DIS)CONTINUITY/.source,
  /#EXT-X-(VERSION):(\d+)/.source,
  /#EXT-X-(MAP):(.+)/.source,
  /(#)([^:]*):(.*)/.source,
  /(#)(.*)(?:.*)\r?\n?/.source
].join('|'));

const MP4_REGEX_SUFFIX = /\.(mp4|m4s|m4v|m4a)$/i;

export default class M3U8Parser {
  static findGroup (groups: Array<AudioGroup>, mediaGroupId: string): AudioGroup | undefined {
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (group.id === mediaGroupId) {
        return group;
      }
    }
  }

  static convertAVC1ToAVCOTI (codec) {
    const avcdata = codec.split('.');
    let result;
    if (avcdata.length > 2) {
      result = avcdata.shift() + '.';
      result += parseInt(avcdata.shift()).toString(16);
      result += ('000' + parseInt(avcdata.shift()).toString(16)).substr(-4);
    } else {
      result = codec;
    }
    return result;
  }

  static resolve (url, baseUrl) {
    return URLToolkit.buildAbsoluteURL(baseUrl, url, { alwaysNormalize: true });
  }

  static parseMasterPlaylist (string: string, baseurl: string) {
    // TODO(typescript-level)
    const levels: Array<any> = [];
    const sessionData: Record<string, AttrList> = {};
    let hasSessionData = false;
    MASTER_PLAYLIST_REGEX.lastIndex = 0;

    // TODO(typescript-level)
    function setCodecs (codecs: Array<string>, level: any) {
      ['video', 'audio', 'text'].forEach((type: CodecType) => {
        const filtered = codecs.filter((codec) => isCodecType(codec, type));
        if (filtered.length) {
          const preferred = filtered.filter((codec) => {
            return codec.lastIndexOf('avc1', 0) === 0 || codec.lastIndexOf('mp4a', 0) === 0;
          });
          level[`${type}Codec`] = preferred.length > 0 ? preferred[0] : filtered[0];

          // remove from list
          codecs = codecs.filter((codec) => filtered.indexOf(codec) === -1);
        }
      });

      level.unknownCodecs = codecs;
    }

    let result: RegExpExecArray | null;
    while ((result = MASTER_PLAYLIST_REGEX.exec(string)) != null) {
      if (result[1]) {
        // '#EXT-X-STREAM-INF' is found, parse level tag  in group 1

        // TODO(typescript-level)
        const level: any = {};

        const attrs = level.attrs = new AttrList(result[1]);
        level.url = M3U8Parser.resolve(result[2], baseurl);

        const resolution = attrs.decimalResolution('RESOLUTION');
        if (resolution) {
          level.width = resolution.width;
          level.height = resolution.height;
        }
        level.bitrate = attrs.decimalInteger('AVERAGE-BANDWIDTH') || attrs.decimalInteger('BANDWIDTH');
        level.name = attrs.NAME;

        setCodecs([].concat((attrs.CODECS || '').split(/[ ,]+/)), level);

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
      sessionData: hasSessionData ? sessionData : null
    };
  }

  static parseMasterPlaylistMedia (string: string, baseurl: string, type: MediaPlaylistType, groups: Array<AudioGroup> = []): Array<MediaPlaylist> {
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
          default: (attrs.DEFAULT === 'YES'),
          autoselect: (attrs.AUTOSELECT === 'YES'),
          forced: (attrs.FORCED === 'YES'),
          lang: attrs.LANGUAGE,
          url: attrs.URI ? M3U8Parser.resolve(attrs.URI, baseurl) : ''
        };

        if (groups.length) {
          // If there are audio or text groups signalled in the manifest, let's look for a matching codec string for this track
          // If we don't find the track signalled, lets use the first audio groups codec we have
          // Acting as a best guess
          const groupCodec = M3U8Parser.findGroup(groups, media.groupId as string) || groups[0];
          assignCodec(media, groupCodec, 'audioCodec');
          assignCodec(media, groupCodec, 'textCodec');
        }

        medias.push(media);
      }
    }
    return medias;
  }

  static parseLevelPlaylist (string: string, baseurl: string, id: number, type: PlaylistLevelType, levelUrlId: number): LevelDetails {
    let currentSN = 0;
    let totalduration = 0;
    const level = new LevelDetails(baseurl);
    let discontinuityCounter = 0;
    let prevFrag: Fragment | null = null;
    let frag: Fragment | null = new Fragment();
    let result: RegExpExecArray | RegExpMatchArray | null;
    let i: number;
    let levelkey: LevelKey | undefined;

    let firstPdtIndex: number | null = null;

    LEVEL_PLAYLIST_REGEX_FAST.lastIndex = 0;

    while ((result = LEVEL_PLAYLIST_REGEX_FAST.exec(string)) !== null) {
      const duration = result[1];
      if (duration) { // INF
        frag.duration = parseFloat(duration);
        // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
        const title = (' ' + result[2]).slice(1);
        frag.title = title || null;
        frag.tagList.push(title ? ['INF', duration, title] : ['INF', duration]);
      } else if (result[3]) { // url
        if (Number.isFinite(frag.duration)) {
          const sn = currentSN++;
          frag.type = type;
          frag.start = totalduration;
          if (levelkey) {
            frag.levelkey = levelkey;
          }
          frag.sn = sn;
          frag.level = id;
          frag.cc = discontinuityCounter;
          frag.urlId = levelUrlId;
          frag.baseurl = baseurl;
          // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
          frag.relurl = (' ' + result[3]).slice(1);
          assignProgramDateTime(frag, prevFrag);

          level.fragments.push(frag);
          prevFrag = frag;
          totalduration += frag.duration;

          frag = new Fragment();
        }
      } else if (result[4]) { // X-BYTERANGE
        const data = (' ' + result[4]).slice(1);
        if (prevFrag) {
          frag.setByteRange(data, prevFrag);
        } else {
          frag.setByteRange(data);
        }
      } else if (result[5]) { // PROGRAM-DATE-TIME
        // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
        frag.rawProgramDateTime = (' ' + result[5]).slice(1);
        frag.tagList.push(['PROGRAM-DATE-TIME', frag.rawProgramDateTime]);
        if (firstPdtIndex === null) {
          firstPdtIndex = level.fragments.length;
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
        const value1 = (' ' + result[i + 1]).slice(1);
        const value2 = (' ' + result[i + 2]).slice(1);

        switch (result[i]) {
        case '#':
          frag.tagList.push(value2 ? [value1, value2] : [value1]);
          break;
        case 'PLAYLIST-TYPE':
          level.type = value1.toUpperCase();
          break;
        case 'MEDIA-SEQUENCE':
          currentSN = level.startSN = parseInt(value1);
          break;
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
        case 'DIS':
          discontinuityCounter++;
          frag.tagList.push(['DIS']);
          break;
        case 'DISCONTINUITY-SEQ':
          discontinuityCounter = parseInt(value1);
          break;
        case 'KEY': {
          // https://tools.ietf.org/html/rfc8216#section-4.3.2.4
          const decryptparams = value1;
          const keyAttrs = new AttrList(decryptparams);
          const decryptmethod = keyAttrs.enumeratedString('METHOD');
          const decrypturi = keyAttrs.URI;
          const decryptiv = keyAttrs.hexadecimalInteger('IV');
          const decryptkeyformatversions = keyAttrs.enumeratedString('KEYFORMATVERSIONS');
          const decryptkeyid = keyAttrs.enumeratedString('KEYID');
          // From RFC: This attribute is OPTIONAL; its absence indicates an implicit value of "identity".
          const decryptkeyformat = keyAttrs.enumeratedString('KEYFORMAT') ?? 'identity';

          const unsupportedKnownKeyformatsInManifest = [
            'com.apple.streamingkeydelivery',
            'com.microsoft.playready',
            'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed', // widevine (v2)
            'com.widevine' // earlier widevine (v1)
          ];

          if (unsupportedKnownKeyformatsInManifest.includes(decryptkeyformat)) {
            logger.warn(`Keyformat ${decryptkeyformat} is not supported from the manifest`);
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
            if ((decrypturi) && (['AES-128', 'SAMPLE-AES', 'SAMPLE-AES-CENC'].indexOf(decryptmethod) >= 0)) {
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
          const startTimeOffset = startAttrs.decimalFloatingPoint('TIME-OFFSET');
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
          frag.baseurl = baseurl;
          frag.level = id;
          frag.type = type;
          frag.sn = 'initSegment';
          if (levelkey) {
            frag.levelkey = levelkey;
          }
          level.initSegment = frag;
          frag = new Fragment();
          frag.rawProgramDateTime = level.initSegment.rawProgramDateTime;
          break;
        }
        default:
          logger.warn(`line parsed but not handled: ${result}`);
          break;
        }
      }
    }
    frag = prevFrag;
    // logger.log('found ' + level.fragments.length + ' fragments');
    if (frag && !frag.relurl) {
      level.fragments.pop();
      totalduration -= frag.duration;
    }
    level.totalduration = totalduration;
    if (totalduration > 0 && level.fragments.length) {
      level.averagetargetduration = totalduration / level.fragments.length;
    }
    level.endSN = currentSN - 1;
    level.startCC = level.fragments[0] ? level.fragments[0].cc : 0;
    level.endCC = discontinuityCounter;

    if (!level.initSegment && level.fragments.length) {
      // this is a bit lurky but HLS really has no other way to tell us
      // if the fragments are TS or MP4, except if we download them :/
      // but this is to be able to handle SIDX.
      if (level.fragments.every((frag) => MP4_REGEX_SUFFIX.test(frag.relurl))) {
        logger.warn('MP4 fragments found but no init segment (probably no MAP, incomplete M3U8), trying to fetch SIDX');

        frag = new Fragment();
        frag.relurl = level.fragments[0].relurl;
        frag.baseurl = baseurl;
        frag.level = id;
        frag.type = type;
        frag.sn = 'initSegment';

        level.initSegment = frag;
        level.needSidxRanges = true;
      }
    }

    /**
     * Backfill any missing PDT values
       "If the first EXT-X-PROGRAM-DATE-TIME tag in a Playlist appears after
       one or more Media Segment URIs, the client SHOULD extrapolate
       backward from that tag (using EXTINF durations and/or media
       timestamps) to associate dates with those segments."
     * We have already extrapolated forward, but all fragments up to the first instance of PDT do not have their PDTs
     * computed.
     */
    if (firstPdtIndex) {
      backfillProgramDateTimes(level.fragments, firstPdtIndex);
    }

    return level;
  }
}

function assignCodec (media, groupItem, codecProperty) {
  const codecValue = groupItem[codecProperty];
  if (codecValue) {
    media[codecProperty] = codecValue;
  }
}

function backfillProgramDateTimes (fragments, startIndex) {
  let fragPrev = fragments[startIndex];
  for (let i = startIndex - 1; i >= 0; i--) {
    const frag = fragments[i];
    frag.programDateTime = fragPrev.programDateTime - (frag.duration * 1000);
    fragPrev = frag;
  }
}

function assignProgramDateTime (frag, prevFrag) {
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
