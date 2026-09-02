import { expect } from 'chai';
import { AttrList } from '../../../src/utils/attr-list';
import { matchesOption } from '../../../src/utils/rendition-helper';
import type {
  AudioSelectionOption,
  MediaAttributes,
  MediaPlaylist,
} from '../../../src/types/media-playlist';

function makeTrack(overrides: Partial<MediaPlaylist>): MediaPlaylist {
  return {
    attrs: new AttrList({}) as MediaAttributes,
    bitrate: 0,
    autoselect: false,
    default: false,
    forced: false,
    groupId: 'g',
    id: 0,
    name: 'n',
    type: 'AUDIO',
    url: '',
    ...overrides,
  } as MediaPlaylist;
}

describe('matchesOption', function () {
  it('only enforces assocLang when the option specifies it', function () {
    const track = makeTrack({ lang: 'en', assocLang: 'fr' });

    // An option requesting a different assocLang must not match, even when it
    // does not constrain lang.
    const differentAssoc: AudioSelectionOption = { assocLang: 'de' };
    expect(matchesOption(differentAssoc, track)).to.equal(false);

    // An option that constrains lang but not assocLang must still match a
    // track that happens to carry an assocLang.
    const langOnly: AudioSelectionOption = { lang: 'en' };
    expect(matchesOption(langOnly, track)).to.equal(true);

    // A matching assocLang still matches.
    const sameAssoc: AudioSelectionOption = { assocLang: 'fr' };
    expect(matchesOption(sameAssoc, track)).to.equal(true);
  });
});
