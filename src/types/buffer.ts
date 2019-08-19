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

export interface BufferOperation {
  execute: Function
  onComplete: Function
  onError: Function,
  start?: number
  end?: number
}

export interface SourceBufferListener {
  event: string,
  listener: EventListener
}
