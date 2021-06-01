import Hls from '../../../src/hls';
import { Events } from '../../../src/events';
import {
  FragmentTracker,
  FragmentState,
} from '../../../src/controller/fragment-tracker';
import { PlaylistLevelType } from '../../../src/types/loader';
import { ChunkMetadata } from '../../../src/types/transmuxer';
import { Fragment, ElementaryStreamTypes } from '../../../src/loader/fragment';
import { LoadStats } from '../../../src/loader/load-stats';
import type {
  BufferAppendedData,
  FragBufferedData,
  FragLoadedData,
} from '../../../src/types/events';

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';

chai.use(sinonChai);
const expect = chai.expect;

describe('FragmentTracker', function () {
  describe('getPartialFragment', function () {
    const hls = new Hls({});
    const fragmentTracker = new FragmentTracker(hls);

    const fragment = createMockFragment(
      {
        startPTS: 0,
        endPTS: 1,
        sn: 1,
        level: 1,
        type: PlaylistLevelType.MAIN,
      },
      [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
    );

    triggerFragLoaded(hls, fragment);

    hls.trigger(
      Events.BUFFER_APPENDED,
      createBufferAppendedData([
        {
          startPTS: 0,
          endPTS: 0.5,
        },
      ])
    );

    hls.trigger(Events.FRAG_BUFFERED, createFragBufferedData(fragment, true));

    it('detects fragments that partially loaded', function () {
      // Get the partial fragment at a time
      const partialFragment1 = fragmentTracker.getPartialFragment(0);
      expect(partialFragment1).to.equal(fragment);
      const partialFragment2 = fragmentTracker.getPartialFragment(0.5);
      expect(partialFragment2).to.equal(fragment);
      const partialFragment3 = fragmentTracker.getPartialFragment(1);
      expect(partialFragment3).to.equal(fragment);
    });

    it('returns null when time is not inside partial fragment', function () {
      const partialFragment = fragmentTracker.getPartialFragment(1.5);
      expect(partialFragment).to.not.exist;
    });
  });

  describe('getState', function () {
    const hls = new Hls({});
    const fragmentTracker = new FragmentTracker(hls);

    const addFragment = function (): Fragment {
      const fragment = createMockFragment(
        {
          startPTS: 0,
          endPTS: 1,
          sn: 1,
          level: 0,
          type: PlaylistLevelType.MAIN,
        },
        [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
      );
      triggerFragLoaded(hls, fragment);
      return fragment;
    };

    it('detects fragments that never loaded', function () {
      const fragment = addFragment();
      expect(fragmentTracker.getState(fragment)).to.equal(
        FragmentState.APPENDING
      );
    });

    it('detects fragments that loaded properly', function () {
      const fragment = addFragment();
      hls.trigger(
        Events.BUFFER_APPENDED,
        createBufferAppendedData([
          {
            startPTS: 0,
            endPTS: 1,
          },
        ])
      );

      hls.trigger(Events.FRAG_BUFFERED, createFragBufferedData(fragment, true));

      expect(fragmentTracker.getState(fragment)).to.equal(FragmentState.OK);
    });

    it('detects partial fragments', function () {
      const fragment = addFragment();
      hls.trigger(
        Events.BUFFER_APPENDED,
        createBufferAppendedData([
          {
            startPTS: 0.5,
            endPTS: 2,
          },
        ])
      );

      hls.trigger(Events.FRAG_BUFFERED, createFragBufferedData(fragment, true));

      expect(fragmentTracker.getState(fragment)).to.equal(
        FragmentState.PARTIAL
      );
    });

    it('removes evicted partial fragments', function () {
      const fragment = addFragment();
      hls.trigger(
        Events.BUFFER_APPENDED,
        createBufferAppendedData([
          {
            startPTS: 0.5,
            endPTS: 2,
          },
        ])
      );

      hls.trigger(Events.FRAG_BUFFERED, createFragBufferedData(fragment, true));

      expect(fragmentTracker.getState(fragment)).to.equal(
        FragmentState.PARTIAL
      );

      // Trim the buffer
      hls.trigger(
        Events.BUFFER_APPENDED,
        createBufferAppendedData([
          {
            startPTS: 0.75,
            endPTS: 2,
          },
        ])
      );

      expect(fragmentTracker.getState(fragment)).to.equal(
        FragmentState.NOT_LOADED
      );
    });
  });

  describe('getBufferedFrag', function () {
    let hls;
    /** @type {FragmentTracker} */
    let fragmentTracker;
    beforeEach(function () {
      hls = new Hls({});
      fragmentTracker = new FragmentTracker(hls);
    });
    it('should return buffered fragment if found it', function () {
      const fragments = [
        // 0-1
        createMockFragment(
          {
            startPTS: 0,
            endPTS: 1,
            sn: 1,
            level: 1,
            type: PlaylistLevelType.MAIN,
          },
          [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
        ),
        // 1-2
        createMockFragment(
          {
            startPTS: 1,
            endPTS: 2,
            sn: 2,
            level: 1,
            type: PlaylistLevelType.MAIN,
          },
          [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
        ),
        // 2-3
        createMockFragment(
          {
            startPTS: 2,
            endPTS: 3,
            sn: 3,
            level: 1,
            type: PlaylistLevelType.MAIN,
          },
          [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
        ),
      ];
      // load fragments to buffered
      hls.trigger(
        Events.BUFFER_APPENDED,
        createBufferAppendedData([
          {
            startPTS: 0,
            endPTS: 3,
          },
        ])
      );
      fragments.forEach((fragment) => {
        triggerFragLoadedAndFragBuffered(hls, fragment);
      });
      expect(
        fragmentTracker.getBufferedFrag(0.0, PlaylistLevelType.MAIN)
      ).to.equal(fragments[0]);
      expect(
        fragmentTracker.getBufferedFrag(0.1, PlaylistLevelType.MAIN)
      ).to.equal(fragments[0]);
      expect(
        fragmentTracker.getBufferedFrag(1.0, PlaylistLevelType.MAIN)
      ).to.equal(fragments[1]);
      expect(
        fragmentTracker.getBufferedFrag(1.1, PlaylistLevelType.MAIN)
      ).to.equal(fragments[1]);
      expect(
        fragmentTracker.getBufferedFrag(2.0, PlaylistLevelType.MAIN)
      ).to.equal(fragments[2]);
      expect(
        fragmentTracker.getBufferedFrag(2.1, PlaylistLevelType.MAIN)
      ).to.equal(fragments[2]);
      expect(
        fragmentTracker.getBufferedFrag(2.9, PlaylistLevelType.MAIN)
      ).to.equal(fragments[2]);
      expect(
        fragmentTracker.getBufferedFrag(3.0, PlaylistLevelType.MAIN)
      ).to.equal(fragments[2]);
    });
    it('should return null if found it, but it is not buffered', function () {
      const fragments = [
        // 0-1
        createMockFragment(
          {
            startPTS: 0,
            endPTS: 1,
            sn: 1,
            level: 1,
            type: PlaylistLevelType.MAIN,
          },
          [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
        ),
        // 1-2
        createMockFragment(
          {
            startPTS: 1,
            endPTS: 2,
            sn: 2,
            level: 1,
            type: PlaylistLevelType.MAIN,
          },
          [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
        ),
        // 2-3
        createMockFragment(
          {
            startPTS: 2,
            endPTS: 3,
            sn: 3,
            level: 1,
            type: PlaylistLevelType.MAIN,
          },
          [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
        ),
      ];
      // load fragments, but it is not buffered
      fragments.forEach((fragment) => {
        triggerFragLoaded(hls, fragment);
      });
      expect(fragmentTracker.getBufferedFrag(0, PlaylistLevelType.MAIN)).to.not
        .exist;
      expect(fragmentTracker.getBufferedFrag(1, PlaylistLevelType.MAIN)).to.not
        .exist;
      expect(fragmentTracker.getBufferedFrag(2, PlaylistLevelType.MAIN)).to.not
        .exist;
      expect(fragmentTracker.getBufferedFrag(3, PlaylistLevelType.MAIN)).to.not
        .exist;
    });
    it('should return null if anyone does not match the position', function () {
      triggerFragLoadedAndFragBuffered(
        hls,
        createMockFragment(
          {
            startPTS: 0,
            endPTS: 1,
            sn: 1,
            level: 1,
            type: PlaylistLevelType.MAIN,
          },
          [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
        )
      );
      // not found
      expect(fragmentTracker.getBufferedFrag(1.1, PlaylistLevelType.MAIN)).to
        .not.exist;
    });
    it('should return null if fragmentTracker not have any fragments', function () {
      expect(fragmentTracker.getBufferedFrag(0, PlaylistLevelType.MAIN)).to.not
        .exist;
    });
    it('should return null if not found match levelType', function () {
      triggerFragLoadedAndFragBuffered(
        hls,
        createMockFragment(
          {
            startPTS: 0,
            endPTS: 1,
            sn: 1,
            level: 1,
            type: PlaylistLevelType.AUDIO, // <= level type is not "main"
          },
          [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
        )
      );

      expect(fragmentTracker.getBufferedFrag(0, PlaylistLevelType.MAIN)).to.not
        .exist;
    });
  });

  describe('onFragBuffered', function () {
    let fragment;

    const hls = new Hls({});
    const fragmentTracker = new FragmentTracker(hls);

    it('supports audio buffer', function () {
      fragment = createMockFragment(
        {
          startPTS: 0,
          endPTS: 1,
          sn: 1,
          level: 1,
          type: PlaylistLevelType.MAIN,
        },
        [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
      );

      triggerFragLoaded(hls, fragment);

      hls.trigger(
        Events.BUFFER_APPENDED,
        createBufferAppendedData(
          [
            {
              startPTS: 0,
              endPTS: 2,
            },
          ],
          [
            {
              startPTS: 0.5,
              endPTS: 2,
            },
          ]
        )
      );

      hls.trigger(Events.FRAG_BUFFERED, createFragBufferedData(fragment, true));

      expect(fragmentTracker.getState(fragment)).to.equal(
        FragmentState.PARTIAL
      );
    });

    it('supports video buffer', function () {
      fragment = createMockFragment(
        {
          startPTS: 0,
          endPTS: 1,
          sn: 1,
          level: 1,
          type: PlaylistLevelType.MAIN,
        },
        [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
      );

      triggerFragLoaded(hls, fragment);

      hls.trigger(
        Events.BUFFER_APPENDED,
        createBufferAppendedData(
          [
            {
              startPTS: 0.5,
              endPTS: 2,
            },
          ],
          [
            {
              startPTS: 0,
              endPTS: 2,
            },
          ]
        )
      );

      hls.trigger(Events.FRAG_BUFFERED, createFragBufferedData(fragment, true));

      expect(fragmentTracker.getState(fragment)).to.equal(
        FragmentState.PARTIAL
      );
    });

    it('supports audio only buffer', function () {
      fragment = createMockFragment(
        {
          startPTS: 0,
          endPTS: 1,
          sn: 1,
          level: 1,
          type: PlaylistLevelType.AUDIO,
        },
        [ElementaryStreamTypes.AUDIO]
      );

      triggerFragLoaded(hls, fragment);

      hls.trigger(
        Events.BUFFER_APPENDED,
        createBufferAppendedData(
          [
            {
              startPTS: 0.5,
              endPTS: 2,
            },
          ],
          [
            {
              startPTS: 0,
              endPTS: 2,
            },
          ]
        )
      );

      hls.trigger(Events.FRAG_BUFFERED, createFragBufferedData(fragment, true));

      expect(fragmentTracker.getState(fragment)).to.equal(FragmentState.OK);
    });
  });

  describe('removeFragment', function () {
    /** @type {Hls} */
    let hls;
    /** @type {FragmentTracker} */
    let fragmentTracker;
    beforeEach(function () {
      hls = new Hls({});
      fragmentTracker = new FragmentTracker(hls);
    });
    it('should remove fragment', function () {
      const fragment = createMockFragment(
        {
          startPTS: 0,
          endPTS: 1,
          sn: 1,
          level: 1,
          type: PlaylistLevelType.MAIN,
        },
        [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
      );
      // load fragments to buffered
      hls.trigger(
        Events.BUFFER_APPENDED,
        createBufferAppendedData([
          {
            startPTS: 0,
            endPTS: 1,
          },
        ])
      );
      triggerFragLoadedAndFragBuffered(hls, fragment);
      expect(fragmentTracker.hasFragment(fragment)).to.be.true;
      // Remove the fragment
      fragmentTracker.removeFragment(fragment);
      // Check
      expect(fragmentTracker.hasFragment(fragment)).to.be.false;
    });
  });
  describe('removeAllFragments', function () {
    /** @type {Hls} */
    let hls;
    /** @type {FragmentTracker} */
    let fragmentTracker;
    beforeEach(function () {
      hls = new Hls({});
      fragmentTracker = new FragmentTracker(hls);
    });
    it('should remove all fragments', function () {
      const fragments = [
        // 0-1
        createMockFragment(
          {
            startPTS: 0,
            endPTS: 1,
            sn: 1,
            level: 1,
            type: PlaylistLevelType.MAIN,
          },
          [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
        ),
        // 1-2
        createMockFragment(
          {
            startPTS: 1,
            endPTS: 2,
            sn: 2,
            level: 1,
            type: PlaylistLevelType.MAIN,
          },
          [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
        ),
        // 2-3
        createMockFragment(
          {
            startPTS: 2,
            endPTS: 3,
            sn: 3,
            level: 1,
            type: PlaylistLevelType.MAIN,
          },
          [ElementaryStreamTypes.AUDIO, ElementaryStreamTypes.VIDEO]
        ),
      ];
      // load fragments to buffered
      hls.trigger(
        Events.BUFFER_APPENDED,
        createBufferAppendedData([
          {
            startPTS: 0,
            endPTS: 3,
          },
        ])
      );
      fragments.forEach((fragment) => {
        triggerFragLoadedAndFragBuffered(hls, fragment);
      });
      // before
      fragments.forEach((fragment) => {
        expect(
          fragmentTracker.hasFragment(fragment),
          'has fragments before removing'
        ).to.be.true;
      });
      // Remove all fragments
      fragmentTracker.removeAllFragments();
      // after
      fragments.forEach((fragment) => {
        expect(
          fragmentTracker.hasFragment(fragment),
          'has not fragments after removing'
        ).to.be.false;
      });
    });
  });
});

function triggerFragLoaded(hls: Hls, fragment: Fragment) {
  hls.trigger(Events.FRAG_LOADED, createFragLoadedData(fragment));
}

function triggerFragLoadedAndFragBuffered(hls: Hls, fragment: Fragment) {
  triggerFragLoaded(hls, fragment);
  hls.trigger(Events.FRAG_BUFFERED, createFragBufferedData(fragment));
}

type PtsTimeRanges = Array<{ startPTS: number; endPTS: number }>;

function createMockBuffer(buffered: PtsTimeRanges): TimeRanges {
  return {
    start: (i) => buffered[i].startPTS,
    end: (i) => buffered[i].endPTS,
    length: buffered.length,
  };
}

function createBufferAppendedData(
  video: PtsTimeRanges,
  audio?: PtsTimeRanges
): BufferAppendedData {
  return {
    chunkMeta: new ChunkMetadata(0, 0, 0, 0),
    frag: new Fragment(PlaylistLevelType.MAIN, ''),
    part: null,
    parent: PlaylistLevelType.MAIN,
    type: audio && video ? 'audiovideo' : video ? 'video' : 'audio',
    timeRanges: {
      video: createMockBuffer(video),
      audio: createMockBuffer(audio || video),
    },
  };
}

function createFragBufferedData(
  frag: Fragment,
  aborted?: boolean
): FragBufferedData {
  const stats = new LoadStats();
  if (aborted) {
    stats.aborted = aborted;
  }
  return {
    stats,
    frag,
    part: null,
    id: frag.type,
  };
}

function createFragLoadedData(frag: Fragment): FragLoadedData {
  return {
    frag,
    part: null,
    payload: new ArrayBuffer(0),
    networkDetails: null,
  };
}

type MockFragmentParams = {
  startPTS: number;
  endPTS: number;
  sn: number;
  level: number;
  type: PlaylistLevelType;
};

function createMockFragment(
  data: MockFragmentParams,
  types: ElementaryStreamTypes[]
): Fragment {
  const frag = new Fragment(data.type, '');
  Object.assign(frag, data);
  frag.start = data.startPTS;
  frag.duration = data.endPTS - data.startPTS;
  types.forEach((t) => {
    frag.setElementaryStreamInfo(
      t,
      data.startPTS,
      data.endPTS,
      data.startPTS,
      data.endPTS
    );
  });
  return frag;
}
