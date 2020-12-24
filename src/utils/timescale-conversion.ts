const MPEG_TS_CLOCK_FREQ_HZ = 90000;

export function toTimescaleFromBase(
  value,
  destScale: number,
  srcBase: number = 1,
  round: boolean = false
): number {
  const result = value * destScale * srcBase; // equivalent to `(value * scale) / (1 / base)`
  return round ? Math.round(result) : result;
}

export function toTimescaleFromScale(
  value,
  destScale: number,
  srcScale: number = 1,
  round: boolean = false
): number {
  return toTimescaleFromBase(value, destScale, 1 / srcScale, round);
}

export function toMsFromMpegTsClock(
  value: number,
  round: boolean = false
): number {
  return toTimescaleFromBase(value, 1000, 1 / MPEG_TS_CLOCK_FREQ_HZ, round);
}

export function toMpegTsClockFromTimescale(
  value: number,
  srcScale: number = 1
): number {
  return toTimescaleFromBase(value, MPEG_TS_CLOCK_FREQ_HZ, 1 / srcScale);
}
