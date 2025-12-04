import { expect } from 'chai';
import sinon from 'sinon';
import { Row } from '../../../src/utils/cea-608-parser';

describe('CEA-608 Parser - Row', function () {
  let mockLogger: any;
  let row: Row;
  const NR_COLS = 100;

  beforeEach(function () {
    mockLogger = {
      log: sinon.stub(),
      time: null,
      verboseLevel: 0,
    };
    row = new Row(mockLogger);
  });

  describe('setCursor', function () {
    it('should clamp negative cursor position to 0', function () {
      row.setCursor(-1);
      expect(row.pos).to.equal(0);
      expect(mockLogger.log).to.have.been.calledWith(
        sinon.match.any,
        'Negative cursor position -1',
      );
    });

    it('should clamp cursor position equal to NR_COLS to NR_COLS - 1', function () {
      row.setCursor(NR_COLS);
      expect(row.pos).to.equal(NR_COLS - 1);
      expect(mockLogger.log).to.have.been.calledWith(
        sinon.match.any,
        `Too large cursor position ${NR_COLS}`,
      );
    });

    it('should clamp cursor position greater than NR_COLS to NR_COLS - 1', function () {
      row.setCursor(NR_COLS + 10);
      expect(row.pos).to.equal(NR_COLS - 1);
      expect(mockLogger.log).to.have.been.calledWith(
        sinon.match.any,
        `Too large cursor position ${NR_COLS + 10}`,
      );
    });

    it('should allow valid cursor positions within bounds', function () {
      row.setCursor(0);
      expect(row.pos).to.equal(0);

      row.setCursor(50);
      expect(row.pos).to.equal(50);

      row.setCursor(NR_COLS - 1);
      expect(row.pos).to.equal(NR_COLS - 1);
    });

    it('should not log when cursor position is valid', function () {
      mockLogger.log.resetHistory();
      row.setCursor(50);
      expect(mockLogger.log).to.not.have.been.called;
    });
  });

  describe('moveCursor', function () {
    beforeEach(function () {
      // Set initial pen state for testing
      row.currPenState.foreground = 'red';
    });

    it('should clamp movement that would exceed NR_COLS', function () {
      row.setCursor(NR_COLS - 5);
      row.moveCursor(10); // Would go to NR_COLS + 5, should clamp to NR_COLS - 1
      expect(row.pos).to.equal(NR_COLS - 1);
    });

    it('should clamp movement from position at NR_COLS - 1', function () {
      row.setCursor(NR_COLS - 1);
      row.moveCursor(5); // Should clamp to NR_COLS - 1
      expect(row.pos).to.equal(NR_COLS - 1);
    });

    it('should allow movement within bounds', function () {
      row.setCursor(50);
      row.moveCursor(10);
      expect(row.pos).to.equal(60);
    });

    it('should allow movement to exactly NR_COLS - 1', function () {
      row.setCursor(95);
      row.moveCursor(4);
      expect(row.pos).to.equal(NR_COLS - 1);
    });

    it('should set pen state for positions between old and new when relPos > 1', function () {
      row.setCursor(10);
      row.moveCursor(5);
      // Should set pen state for positions 11, 12, 13, 14 (not including newPos which is 15)
      for (let i = 11; i < 15; i++) {
        expect(row.chars[i].penState.foreground).to.equal('red');
      }
    });

    it('should not set pen state when relPos <= 1', function () {
      row.setCursor(10);
      // Reset pen state for position 11
      row.chars[11].penState.foreground = 'white';
      row.moveCursor(1);
      // Should not have set pen state for position 11
      expect(row.chars[11].penState.foreground).to.equal('white');
    });

    it('should not access out of bounds when moving from near end', function () {
      row.setCursor(NR_COLS - 2);
      // This should not throw or access out of bounds
      expect(() => {
        row.moveCursor(5);
      }).to.not.throw();
      expect(row.pos).to.equal(NR_COLS - 1);
    });

    it('should handle backward movement correctly', function () {
      row.setCursor(50);
      row.moveCursor(-10);
      expect(row.pos).to.equal(40);
    });

    it('should handle backward movement that would go negative', function () {
      row.setCursor(5);
      row.moveCursor(-10);
      expect(row.pos).to.equal(0); // Clamped by setCursor
    });

    it('should not set pen state for backward movement', function () {
      row.setCursor(20);
      row.chars[15].penState.foreground = 'white';
      row.moveCursor(-5);
      // Should not have modified pen state for backward movement
      expect(row.chars[15].penState.foreground).to.equal('white');
    });
  });

  describe('setPenStyles', function () {
    it('should not access out of bounds when cursor is at NR_COLS - 1', function () {
      row.setCursor(NR_COLS - 1);
      // This should not throw or access out of bounds
      expect(() => {
        row.setPenStyles({ foreground: 'blue' });
      }).to.not.throw();
      expect(row.chars[NR_COLS - 1].penState.foreground).to.equal('blue');
    });
  });

  describe('insertChar', function () {
    it('should allow insertion at NR_COLS - 1 and clamp cursor position', function () {
      row.setCursor(NR_COLS - 1);
      mockLogger.log.resetHistory();
      row.insertChar(0x41); // 'A'
      // Character should be inserted successfully
      expect(row.chars[NR_COLS - 1].uchar).to.equal('A');
      // Cursor should stay clamped at NR_COLS - 1 after moveCursor(1)
      expect(row.pos).to.equal(NR_COLS - 1);
      // Should log that cursor position was clamped
      expect(mockLogger.log).to.have.been.calledWith(
        sinon.match.any,
        `Too large cursor position ${NR_COLS}`,
      );
    });

    it('should allow insertion at valid positions', function () {
      row.setCursor(50);
      row.insertChar(0x41); // 'A'
      expect(row.chars[50].uchar).to.equal('A');
      expect(row.pos).to.equal(51);
    });

    it('should not access out of bounds when inserting at boundary', function () {
      row.setCursor(NR_COLS - 1);
      // This should not throw or access out of bounds
      expect(() => {
        row.insertChar(0x42); // 'B'
      }).to.not.throw();
      expect(row.chars[NR_COLS - 1].uchar).to.equal('B');
    });
  });
});
