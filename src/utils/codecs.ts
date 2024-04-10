import { getMediaSource } from './mediasource-helper';

// from http://mp4ra.org/codecs.html
// values indicate codec selection preference (lower is higher priority)
const sampleEntryCodesISO = {
  audio: {
    a3ds: 1,
    'ac-3': 0.95,
    'ac-4': 1,
    alac: 0.9,
    alaw: 1,
    dra1: 1,
    'dts+': 1,
    'dts-': 1,
    dtsc: 1,
    dtse: 1,
    dtsh: 1,
    'ec-3': 0.9,
    enca: 1,
    fLaC: 0.9, // MP4-RA listed codec entry for FLAC
    flac: 0.9, // legacy browser codec name for FLAC
    FLAC: 0.9, // some manifests may list "FLAC" with Apple's tools
    g719: 1,
    g726: 1,
    m4ae: 1,
    mha1: 1,
    mha2: 1,
    mhm1: 1,
    mhm2: 1,
    mlpa: 1,
    mp4a: 1,
    'raw ': 1,
    Opus: 1,
    opus: 1, // browsers expect this to be lowercase despite MP4RA says 'Opus'
    samr: 1,
    sawb: 1,
    sawp: 1,
    sevc: 1,
    sqcp: 1,
    ssmv: 1,
    twos: 1,
    ulaw: 1,
  },
  video: {
    avc1: 1,
    avc2: 1,
    avc3: 1,
    avc4: 1,
    avcp: 1,
    av01: 0.8,
    drac: 1,
    dva1: 1,
    dvav: 1,
    dvh1: 0.7,
    dvhe: 0.7,
    encv: 1,
    hev1: 0.75,
    hvc1: 0.75,
    mjp2: 1,
    mp4v: 1,
    mvc1: 1,
    mvc2: 1,
    mvc3: 1,
    mvc4: 1,
    resv: 1,
    rv60: 1,
    s263: 1,
    svc1: 1,
    svc2: 1,
    'vc-1': 1,
    vp08: 1,
    vp09: 0.9,
  },
  text: {
    stpp: 1,
    wvtt: 1,
  },
} as const;

export type CodecType = 'audio' | 'video';

export function isCodecType(codec: string, type: CodecType): boolean {
  const typeCodes = sampleEntryCodesISO[type];
  return !!typeCodes && !!typeCodes[codec.slice(0, 4)];
}

export function areCodecsMediaSourceSupported(
  codecs: string,
  type: CodecType,
  preferManagedMediaSource = true,
): boolean {
  return !codecs
    .split(',')
    .some(
      (codec) =>
        !isCodecMediaSourceSupported(codec, type, preferManagedMediaSource),
    );
}

function isCodecMediaSourceSupported(
  codec: string,
  type: CodecType,
  preferManagedMediaSource = true,
): boolean {
  const MediaSource = getMediaSource(preferManagedMediaSource);
  return MediaSource?.isTypeSupported(mimeTypeForCodec(codec, type)) ?? false;
}

export function mimeTypeForCodec(codec: string, type: CodecType): string {
  return `${type}/mp4;codecs="${codec}"`;
}

export function videoCodecPreferenceValue(
  videoCodec: string | undefined,
): number {
  if (videoCodec) {
    const fourCC = videoCodec.substring(0, 4);
    return sampleEntryCodesISO.video[fourCC];
  }
  return 2;
}

export function codecsSetSelectionPreferenceValue(codecSet: string): number {
  return codecSet.split(',').reduce((num, fourCC) => {
    const preferenceValue = sampleEntryCodesISO.video[fourCC];
    if (preferenceValue) {
      return (preferenceValue * 2 + num) / (num ? 3 : 2);
    }
    return (sampleEntryCodesISO.audio[fourCC] + num) / (num ? 2 : 1);
  }, 0);
}

interface CodecNameCache {
  flac?: string;
  opus?: string;
}

const CODEC_COMPATIBLE_NAMES: CodecNameCache = {};

type LowerCaseCodecType = 'flac' | 'opus';

function getCodecCompatibleNameLower(
  lowerCaseCodec: LowerCaseCodecType,
  preferManagedMediaSource = true,
): string {
  if (CODEC_COMPATIBLE_NAMES[lowerCaseCodec]) {
    return CODEC_COMPATIBLE_NAMES[lowerCaseCodec]!;
  }

  // Idealy fLaC and Opus would be first (spec-compliant) but
  // some browsers will report that fLaC is supported then fail.
  // see: https://bugs.chromium.org/p/chromium/issues/detail?id=1422728
  const codecsToCheck = {
    flac: ['flac', 'fLaC', 'FLAC'],
    opus: ['opus', 'Opus'],
  }[lowerCaseCodec];

  for (let i = 0; i < codecsToCheck.length; i++) {
    if (
      isCodecMediaSourceSupported(
        codecsToCheck[i],
        'audio',
        preferManagedMediaSource,
      )
    ) {
      CODEC_COMPATIBLE_NAMES[lowerCaseCodec] = codecsToCheck[i];
      return codecsToCheck[i];
    }
  }

  return lowerCaseCodec;
}

const AUDIO_CODEC_REGEXP = /flac|opus/i;
export function getCodecCompatibleName(
  codec: string,
  preferManagedMediaSource = true,
): string {
  return codec.replace(AUDIO_CODEC_REGEXP, (m) =>
    getCodecCompatibleNameLower(
      m.toLowerCase() as LowerCaseCodecType,
      preferManagedMediaSource,
    ),
  );
}

export function pickMostCompleteCodecName(
  parsedCodec: string,
  levelCodec: string | undefined,
): string | undefined {
  // Parsing of mp4a codecs strings in mp4-tools from media is incomplete as of d8c6c7a
  // so use level codec is parsed codec is unavailable or incomplete
  if (parsedCodec && parsedCodec !== 'mp4a') {
    return parsedCodec;
  }
  return levelCodec ? levelCodec.split(',')[0] : levelCodec;
}

export function convertAVC1ToAVCOTI(codec: string) {
  // Convert avc1 codec string from RFC-4281 to RFC-6381 for MediaSource.isTypeSupported
  const avcdata = codec.split('.');
  if (avcdata.length > 2) {
    let result = avcdata.shift() + '.';
    result += parseInt(avcdata.shift() as string).toString(16);
    result += ('000' + parseInt(avcdata.shift() as string).toString(16)).slice(
      -4,
    );
    return result;
  }
  return codec;
}
