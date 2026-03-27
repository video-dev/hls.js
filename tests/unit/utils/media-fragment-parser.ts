import { expect } from 'chai';
import { parseMediaFragment } from '../../../src/utils/media-fragment-parser';

describe('parseMediaFragment', function () {
  describe('URLs without fragments', function () {
    it('should return undefined when no fragment present', function () {
      const result = parseMediaFragment('http://example.com/video.m3u8');
      expect(result.temporalFragment).to.be.undefined;
    });

    it('should handle URLs with query parameters but no fragment', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8?token=abc123',
      );
      expect(result.temporalFragment).to.be.undefined;
    });

    it('should handle empty fragment', function () {
      const result = parseMediaFragment('http://example.com/video.m3u8#');
      expect(result.temporalFragment).to.be.undefined;
    });
  });

  describe('Basic temporal fragments', function () {
    it('should parse start and end times', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=10,20',
      );
      expect(result.temporalFragment).to.deep.equal({ start: 10, end: 20 });
    });

    it('should parse start-only fragment', function () {
      const result = parseMediaFragment('http://example.com/video.m3u8#t=10');
      expect(result.temporalFragment).to.deep.equal({ start: 10 });
    });

    it('should parse end-only fragment', function () {
      const result = parseMediaFragment('http://example.com/video.m3u8#t=,20');
      expect(result.temporalFragment).to.deep.equal({ end: 20 });
    });

    it('should parse fractional seconds', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=10.5,20.75',
      );
      expect(result.temporalFragment).to.deep.equal({
        start: 10.5,
        end: 20.75,
      });
    });

    it('should handle zero start time', function () {
      const result = parseMediaFragment('http://example.com/video.m3u8#t=0,10');
      expect(result.temporalFragment).to.deep.equal({ start: 0, end: 10 });
    });
  });

  describe('NPT prefix support', function () {
    it('should handle npt: prefix with start and end', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=npt:15,25',
      );
      expect(result.temporalFragment).to.deep.equal({ start: 15, end: 25 });
    });

    it('should handle npt: prefix with start only', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=npt:30',
      );
      expect(result.temporalFragment).to.deep.equal({ start: 30 });
    });

    it('should handle npt: prefix with end only', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=npt:,20',
      );
      expect(result.temporalFragment).to.deep.equal({ end: 20 });
    });
  });

  describe('Time format parsing (MM:SS and HH:MM:SS)', function () {
    it('should parse HH:MM:SS format', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=0:02:00,0:03:30',
      );
      expect(result.temporalFragment).to.deep.equal({ start: 120, end: 210 });
    });

    it('should parse HH:MM:SS with fractional seconds', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=1:30:45.5,1:35:00.25',
      );
      expect(result.temporalFragment).to.deep.equal({
        start: 5445.5,
        end: 5700.25,
      });
    });

    it('should parse MM:SS format', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=02:00,03:30',
      );
      expect(result.temporalFragment).to.deep.equal({ start: 120, end: 210 });
    });

    it('should parse MM:SS with fractional seconds', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=30:45.5,35:00.25',
      );
      expect(result.temporalFragment).to.deep.equal({
        start: 1845.5,
        end: 2100.25,
      });
    });

    it('should handle hours > 9', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=10:00:00,12:30:00',
      );
      expect(result.temporalFragment).to.deep.equal({
        start: 36000,
        end: 45000,
      });
    });
  });

  describe('Multiple occurrences (last wins per W3C spec)', function () {
    it('should use last occurrence when multiple t parameters exist', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=5&t=15,25',
      );
      expect(result.temporalFragment).to.deep.equal({ start: 15, end: 25 });
    });

    it('should use last occurrence with start-only parameters', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=10&t=20',
      );
      expect(result.temporalFragment).to.deep.equal({ start: 20 });
    });

    it('should use last occurrence with mixed formats', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=10&t=npt:20,30',
      );
      expect(result.temporalFragment).to.deep.equal({ start: 20, end: 30 });
    });

    it('should use last valid occurrence, ignoring invalid ones', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=5,10&t=invalid&t=15,25',
      );
      expect(result.temporalFragment).to.deep.equal({ start: 15, end: 25 });
    });
  });

  describe('Invalid temporal fragments', function () {
    it('should reject when start >= end', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=20,10',
      );
      expect(result.temporalFragment).to.be.undefined;
    });

    it('should reject when start equals end', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=10,10',
      );
      expect(result.temporalFragment).to.be.undefined;
    });

    it('should reject invalid time format', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=abc,def',
      );
      expect(result.temporalFragment).to.be.undefined;
    });

    it('should reject minutes >= 60 in MM:SS format', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=60:00,70:00',
      );
      expect(result.temporalFragment).to.be.undefined;
    });

    it('should reject seconds >= 60 in MM:SS format', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=00:60,00:65',
      );
      expect(result.temporalFragment).to.be.undefined;
    });

    it('should reject minutes >= 60 in HH:MM:SS format', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=1:60:00,2:00:00',
      );
      expect(result.temporalFragment).to.be.undefined;
    });

    it('should reject seconds >= 60 in HH:MM:SS format', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=1:00:60,2:00:00',
      );
      expect(result.temporalFragment).to.be.undefined;
    });

    it('should reject malformed fragments with too many parts', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=10,20,30',
      );
      expect(result.temporalFragment).to.be.undefined;
    });
  });

  describe('Fragment parameters and URL compatibility', function () {
    it('should preserve query parameters', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8?token=abc#t=10,20',
      );
      expect(result.temporalFragment).to.deep.equal({ start: 10, end: 20 });
    });

    it('should extract temporal fragments from mixed fragment parameters', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=10,20&track=video&id=main',
      );
      expect(result.temporalFragment).to.deep.equal({ start: 10, end: 20 });
    });

    it('should ignore non-temporal fragment parameters', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#track=video&id=main',
      );
      expect(result.temporalFragment).to.be.undefined;
    });
  });
});
