import { Events } from '../events';
import { Logger } from '../utils/logger';
import { parseMediaFragment } from '../utils/media-fragment-parser';
import type Hls from '../hls';
import type { ComponentAPI } from '../types/component-api';
import type {
  ManifestLoadingData,
  MediaAttachingData,
  MediaDetachingData,
} from '../types/events';

/**
 * MediaFragmentController
 *
 * Handles W3C Media Fragments URI temporal dimension (#t=start,end).
 * - Parses fragment from URL
 * - Sets start position
 * - Pauses at end time (one-time)
 * - Removes listeners after pause
 */
export default class MediaFragmentController
  extends Logger
  implements ComponentAPI
{
  private hls: Hls;
  private media: HTMLMediaElement | null = null;
  private fragmentEnd: number | null = null;
  private endReached: boolean = false;
  private _boundOnTimeUpdate: () => void;
  private _boundOnSeeked: () => void;

  constructor(hls: Hls) {
    super('media-fragment', hls.logger);
    this.hls = hls;
    this._boundOnTimeUpdate = this.onTimeUpdate.bind(this);
    this._boundOnSeeked = this.onSeeked.bind(this);
    this.registerListeners();
  }

  private registerListeners() {
    const { hls } = this;
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.MEDIA_ATTACHING, this.onMediaAttaching, this);
    hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
  }

  private unregisterListeners() {
    const { hls } = this;
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MEDIA_ATTACHING, this.onMediaAttaching, this);
    hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
  }

  private onManifestLoading(
    event: Events.MANIFEST_LOADING,
    data: ManifestLoadingData,
  ) {
    if (!data.url.includes('#')) {
      return;
    }
    const { temporalFragment } = parseMediaFragment(data.url);
    this.fragmentEnd = null;
    this.endReached = false;
    this.detachMediaListeners();
    if (temporalFragment) {
      if (temporalFragment.start !== undefined) {
        this.hls.config.startPosition = temporalFragment.start;
      }
      this.fragmentEnd = temporalFragment.end ?? null;
      this.hls.trigger(Events.MEDIA_FRAGMENT_PARSED, {
        start: temporalFragment.start,
        end: temporalFragment.end,
      });
      if (this.media && this.fragmentEnd !== null) {
        this.attachMediaListeners();
      }
    }
  }

  private onMediaAttaching(
    event: Events.MEDIA_ATTACHING,
    data: MediaAttachingData,
  ) {
    this.media = data.media;
    if (this.fragmentEnd !== null && !this.endReached) {
      this.attachMediaListeners();
    }
  }

  private onMediaDetaching(
    event: Events.MEDIA_DETACHING,
    data: MediaDetachingData,
  ) {
    this.detachMediaListeners();
    this.media = null;
  }

  private attachMediaListeners() {
    if (!this.media) {
      return;
    }
    this.media.addEventListener('timeupdate', this._boundOnTimeUpdate);
    this.media.addEventListener('seeked', this._boundOnSeeked);
  }

  private detachMediaListeners() {
    if (this.media) {
      this.media.removeEventListener('timeupdate', this._boundOnTimeUpdate);
      this.media.removeEventListener('seeked', this._boundOnSeeked);
    }
  }

  private onTimeUpdate() {
    this.checkFragmentEnd();
  }

  private onSeeked() {
    const { media } = this;
    if (media) {
      this.checkFragmentEnd(media.currentTime);
    }
  }

  private checkFragmentEnd(seekTime?: number) {
    const { media, fragmentEnd, endReached } = this;
    if (!media || fragmentEnd === null || endReached) {
      return;
    }
    const time = seekTime ?? media.currentTime;
    if (time >= fragmentEnd && (!media.paused || seekTime !== undefined)) {
      this.log(
        `Reached media fragment end at ${time.toFixed(3)} (end: ${fragmentEnd.toFixed(3)})`,
      );
      this.endReached = true;
      media.pause();
      this.detachMediaListeners();
      this.hls.trigger(Events.MEDIA_FRAGMENT_END, {});
    }
  }

  destroy() {
    this.unregisterListeners();
    this.detachMediaListeners();
    this.media = null;
    // @ts-ignore
    this.hls = null;
  }
}
