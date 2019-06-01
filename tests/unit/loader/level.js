import Level from '../../../src/loader/level';

describe('Level Class tests', function () {
  it('sets programDateTime to true when the first fragment has valid pdt', function () {
    const level = new Level();
    level.fragments = [{ programDateTime: 1 }];
    expect(level.hasProgramDateTime).to.be.true;
  });

  it('sets programDateTime to false when no fragments is empty', function () {
    const level = new Level();
    expect(level.hasProgramDateTime).to.be.false;
  });

  it('sets programDateTime to false when the first fragment has an invalid pdt', function () {
    const level = new Level();
    level.fragments = [{ programDateTime: 'foo' }];
    expect(level.hasProgramDateTime).to.be.false;
  });
});
