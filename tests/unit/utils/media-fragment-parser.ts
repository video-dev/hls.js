import { expect } from 'chai';
import { parseMediaFragment } from '../../../src/utils/media-fragment-parser';

describe('parseMediaFragment', function () {
  describe('URLs without fragments', function () {
    it('should return URL as-is when no fragment present', function () {
      const result = parseMediaFragment('http://example.com/video.m3u8');
      expect(result.temporalFragment).to.be.undefined;
    });

    it('should handle URLs with query parameters but no fragment', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8?token=abc123',
      );
      expect(result.temporalFragment).to.be.undefined;
    });
  });

  describe('Simple temporal fragments', function () {
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
  });

  describe('HH:MM:SS format', function () {
    it('should parse hhmmss format', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=0:02:00,0:03:30',
      );
      expect(result.temporalFragment).to.deep.equal({ start: 120, end: 210 });
    });

    it('should parse hhmmss with fractional seconds', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=1:30:45.5,1:35:00.25',
      );
      expect(result.temporalFragment).to.deep.equal({
        start: 5445.5,
        end: 5700.25,
      });
    });

    it('should parse mmss format', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=02:00,03:30',
      );
      expect(result.temporalFragment).to.deep.equal({ start: 120, end: 210 });
    });

    it('should parse mmss with fractional seconds', function () {
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

    it('should reject minutes >= 60 in mmss format', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=60:00,70:00',
      );
      expect(result.temporalFragment).to.be.undefined;
    });

    it('should reject seconds >= 60 in mmss format', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=00:60,00:65',
      );
      expect(result.temporalFragment).to.be.undefined;
    });

    it('should reject minutes >= 60 in hhmmss format', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=1:60:00,2:00:00',
      );
      expect(result.temporalFragment).to.be.undefined;
    });

    it('should reject seconds >= 60 in hhmmss format', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=1:00:60,2:00:00',
      );
      expect(result.temporalFragment).to.be.undefined;
    });
  });

  describe('Edge cases', function () {
    it('should handle zero start time', function () {
      const result = parseMediaFragment('http://example.com/video.m3u8#t=0,10');
      expect(result.temporalFragment).to.deep.equal({ start: 0, end: 10 });
    });

    it('should preserve query parameters', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8?token=abc#t=10,20',
      );
      expect(result.temporalFragment).to.deep.equal({ start: 10, end: 20 });
    });

    it('should handle multiple fragment parameters (extract temporal only)', function () {
      const result = parseMediaFragment(
        'http://example.com/video.m3u8#t=10,20&track=video',
      );
      expect(result.temporalFragment).to.deep.equal({ start: 10, end: 20 });
    });

    it('should handle empty fragment', function () {
      const result = parseMediaFragment('http://example.com/video.m3u8#');
      expect(result.temporalFragment).to.be.undefined;
    });
  });
});
