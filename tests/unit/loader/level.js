const assert = require('assert');
import Level from '../../../src/loader/level';

describe('Level Class tests', function () {
  it('sets programDateTime to true when the first fragment has valid pdt', function () {
    const level = new Level();
    level.fragments = [{ programDateTime: 1 }];
    assert.strictEqual(level.hasProgramDateTime, true);
  });

  it('sets programDateTime to false when no fragments is empty', function () {
    const level = new Level();
    assert.strictEqual(level.hasProgramDateTime, false);
  });

  it('sets programDateTime to false when the first fragment has an invalid pdt', function () {
    const level = new Level();
    level.fragments = [{ programDateTime: 'foo' }];
    assert.strictEqual(level.hasProgramDateTime, false);
  });
});
