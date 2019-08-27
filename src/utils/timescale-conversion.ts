const MPEG_TS_CLOCK_FREQ_HZ = 90000;

export function toTimescaleFromBase (value, destScale: number, srcBase: number = 1): number {
  return value * destScale * srcBase; // equivalent to `(value * scale) / (1 / base)`
}

export function toMsFromMpegTsClock (value: number, round: boolean = true): number {
  const result = toTimescaleFromBase(value, 1000, 1 / MPEG_TS_CLOCK_FREQ_HZ);
  return round ? Math.round(result) : result;
}

export function toMpegTsClockFromTimescale (value: number, srcScale: number = 1) {
  return toTimescaleFromBase(value, MPEG_TS_CLOCK_FREQ_HZ, 1 / srcScale);
}
