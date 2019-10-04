export type SourceBufferName = 'video' | 'audio' | 'audiovideo';

export type ExtendedSourceBuffer = SourceBuffer & {
  ended?: boolean
};

export type SourceBuffers = Partial<Record<SourceBufferName, ExtendedSourceBuffer>>;

export interface SourceBufferFlushRange {
  start: number;
  end: number;
  type: SourceBufferName
}

export interface BufferOperationQueues {
  video: Array<BufferOperation>;
  audio: Array<BufferOperation>;
  audiovideo: Array<BufferOperation>;
}

export interface BufferOperation {
  execute: Function
  onComplete: Function
  onError: Function,
  start?: number
  end?: number
}

export interface SourceBufferListeners {
  video: Array<SourceBufferListener>;
  audio: Array<SourceBufferListener>;
  audiovideo: Array<SourceBufferListener>;
}

export interface SourceBufferListener {
  event: string,
  listener: EventListener
}

export type BufferedUtilArray = Array<{ start: number, end: number }>;

export interface BufferUtilInfo {
  len: number,
  start: number,
  end: number,
  nextStart: number | undefined
}
