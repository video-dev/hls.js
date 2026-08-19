/* eslint-disable mocha/no-mocha-arrows */
import { expect } from 'chai';
import { parseISO8601 } from '../../../src/utils/datetime';

describe('parseISO8601At', () => {
  it('should parse a date with milliseconds', () => {
    const s = '2026-03-27T20:19:25.447Z';
    const expected = Date.UTC(2026, 2, 27, 20, 19, 25, 447);
    expect(parseISO8601(s)).to.eq(expected);
  });

  it('should parse a date without milliseconds', () => {
    const s = '2026-01-01T00:00:00Z';
    const expected = Date.UTC(2026, 0, 1, 0, 0, 0, 0);
    expect(parseISO8601(s)).to.eq(expected);
  });

  it('should match native Date.parse for a full timestamp', () => {
    const dateStr = '2024-12-31T23:59:59.999Z';
    expect(parseISO8601(dateStr)).to.eq(Date.parse(dateStr));
  });

  it('should parse 1-digit fractional seconds as hundreds of ms', () => {
    const s = '2026-03-27T20:19:25.4Z';
    const expected = Date.UTC(2026, 2, 27, 20, 19, 25, 400);
    expect(parseISO8601(s)).to.eq(expected);
  });

  it('should parse 2-digit fractional seconds as tens of ms', () => {
    const s = '2026-03-27T20:19:25.44Z';
    const expected = Date.UTC(2026, 2, 27, 20, 19, 25, 440);
    expect(parseISO8601(s)).to.eq(expected);
  });

  it('should truncate microsecond precision to milliseconds', () => {
    const s = '2026-03-27T20:19:25.447123Z';
    const expected = Date.UTC(2026, 2, 27, 20, 19, 25, 447);
    expect(parseISO8601(s)).to.eq(expected);
  });

  it('should parse positive timezone offset +HH:MM', () => {
    const s = '2010-02-19T14:54:23.031+08:00';
    const expected = Date.UTC(2010, 1, 19, 6, 54, 23, 31);
    expect(parseISO8601(s)).to.eq(expected);
  });

  it('should parse negative timezone offset -HH:MM', () => {
    const s = '2026-03-27T15:19:25.447-05:00';
    const expected = Date.UTC(2026, 2, 27, 20, 19, 25, 447);
    expect(parseISO8601(s)).to.eq(expected);
  });

  it('should parse timezone offset without colon ±HHMM', () => {
    const s = '2026-03-27T15:19:25.447-0500';
    const expected = Date.UTC(2026, 2, 27, 20, 19, 25, 447);
    expect(parseISO8601(s)).to.eq(expected);
  });

  it('should parse timezone offset with non-zero minutes', () => {
    const s = '2026-03-27T20:49:25.000+05:30';
    const expected = Date.UTC(2026, 2, 27, 15, 19, 25, 0);
    expect(parseISO8601(s)).to.eq(expected);
  });

  it('should parse timezone offset without fractional seconds', () => {
    const s = '2026-03-27T15:19:25-05:00';
    const expected = Date.UTC(2026, 2, 27, 20, 19, 25, 0);
    expect(parseISO8601(s)).to.eq(expected);
  });

  it('should match native Date.parse for timezone offsets', () => {
    const dateStr = '2010-02-19T14:54:23.031+08:00';
    expect(parseISO8601(dateStr)).to.eq(Date.parse(dateStr));
  });

  it('should treat no timezone indicator as UTC', () => {
    const s = '2026-03-27T20:19:25.447';
    const expected = Date.UTC(2026, 2, 27, 20, 19, 25, 447);
    expect(parseISO8601(s)).to.eq(expected);
  });

  it('should return NaN for a malformed timezone offset', () => {
    expect(parseISO8601('2026-03-27T20:19:25.447+')).to.be.NaN;
  });

  it('should return NaN for an empty string', () => {
    expect(parseISO8601('')).to.be.NaN;
  });

  it('should return NaN for a completely garbled string', () => {
    expect(parseISO8601('not-a-date-at-all')).to.be.NaN;
  });

  it('should return NaN for non-numeric year', () => {
    expect(parseISO8601('ABCD-03-27T20:19:25.447Z')).to.be.NaN;
  });

  it('should return NaN for non-numeric month', () => {
    expect(parseISO8601('2026-XX-27T20:19:25.447Z')).to.be.NaN;
  });

  it('should return NaN for non-numeric tz hours', () => {
    expect(parseISO8601('2026-03-27T20:19:25.447+XX:00')).to.be.NaN;
  });

  it('should return NaN for non-numeric tz minutes', () => {
    expect(parseISO8601('2026-03-27T20:19:25.447+05:XX')).to.be.NaN;
  });
});
