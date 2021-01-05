export type SourceBufferName = 'video' | 'audio' | 'audiovideo';

// eslint-disable-next-line no-restricted-globals
export type ExtendedSourceBuffer = SourceBuffer & {
  ended?: boolean;
  changeType?: (type: string) => void;
};

export type SourceBuffers = Partial<
  Record<SourceBufferName, ExtendedSourceBuffer>
>;

export interface BufferOperationQueues {
  video: Array<BufferOperation>;
  audio: Array<BufferOperation>;
  audiovideo: Array<BufferOperation>;
}

export interface BufferOperation {
  execute: Function;
  onStart: Function;
  onComplete: Function;
  onError: Function;
  start?: number;
  end?: number;
}

export interface SourceBufferListeners {
  video: Array<SourceBufferListener>;
  audio: Array<SourceBufferListener>;
  audiovideo: Array<SourceBufferListener>;
}

export interface SourceBufferListener {
  event: string;
  listener: EventListener;
}
