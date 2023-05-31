import { getMediaSource } from './mediasource-helper';

// from http://mp4ra.org/codecs.html
const sampleEntryCodesISO = {
  audio: {
    a3ds: true,
    'ac-3': true,
    'ac-4': true,
    alac: true,
    alaw: true,
    dra1: true,
    'dts+': true,
    'dts-': true,
    dtsc: true,
    dtse: true,
    dtsh: true,
    'ec-3': true,
    enca: true,
    fLaC: true, // MP4-RA listed codec entry for FLAC
    flac: true, // legacy browser codec name for FLAC
    FLAC: true, // some manifests may list "FLAC" with Apple's tools
    g719: true,
    g726: true,
    m4ae: true,
    mha1: true,
    mha2: true,
    mhm1: true,
    mhm2: true,
    mlpa: true,
    mp4a: true,
    'raw ': true,
    Opus: true,
    opus: true, // browsers expect this to be lowercase despite MP4RA says 'Opus'
    samr: true,
    sawb: true,
    sawp: true,
    sevc: true,
    sqcp: true,
    ssmv: true,
    twos: true,
    ulaw: true,
  },
  video: {
    avc1: true,
    avc2: true,
    avc3: true,
    avc4: true,
    avcp: true,
    av01: true,
    drac: true,
    dva1: true,
    dvav: true,
    dvh1: true,
    dvhe: true,
    encv: true,
    hev1: true,
    hvc1: true,
    mjp2: true,
    mp4v: true,
    mvc1: true,
    mvc2: true,
    mvc3: true,
    mvc4: true,
    resv: true,
    rv60: true,
    s263: true,
    svc1: true,
    svc2: true,
    'vc-1': true,
    vp08: true,
    vp09: true,
  },
  text: {
    stpp: true,
    wvtt: true,
  },
};

const MediaSource = getMediaSource();

export type CodecType = 'audio' | 'video';

export function isCodecType(codec: string, type: CodecType): boolean {
  const typeCodes = sampleEntryCodesISO[type];
  return !!typeCodes && typeCodes[codec.slice(0, 4)] === true;
}

export function isCodecSupportedInMp4(codec: string, type: CodecType): boolean {
  return (
    MediaSource?.isTypeSupported(`${type || 'video'}/mp4;codecs="${codec}"`) ??
    false
  );
}

interface CodecNameCache {
  flac?: string;
  opus?: string;
}

const CODEC_COMPATIBLE_NAMES: CodecNameCache = {};

type LowerCaseCodecType = 'flac' | 'opus';

function getCodecCompatibleNameLower(
  lowerCaseCodec: LowerCaseCodecType
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
    if (isCodecSupportedInMp4(codecsToCheck[i], 'audio')) {
      CODEC_COMPATIBLE_NAMES[lowerCaseCodec] = codecsToCheck[i];
      return codecsToCheck[i];
    }
  }

  return lowerCaseCodec;
}

const AUDIO_CODEC_REGEXP = /flac|opus/i;
export function getCodecCompatibleName(codec: string): string {
  return codec.replace(AUDIO_CODEC_REGEXP, (m) =>
    getCodecCompatibleNameLower(m.toLowerCase() as LowerCaseCodecType)
  );
}
