import startWorker from './transmuxer-worker';

if (typeof __IN_WORKER__ !== 'undefined' && __IN_WORKER__) {
  startWorker(self);
}

export function hasUMDWorker(): boolean {
  return typeof __HLS_WORKER_BUNDLE__ === 'function';
}

export type WorkerContext = {
  worker: Worker;
  objectURL: string;
};

export function injectWorker(): WorkerContext {
  const blob = new self.Blob(
    [
      `var exports={};var module={exports:exports};function define(f){f()};define.amd=true;(${__HLS_WORKER_BUNDLE__.toString()})(true);`,
    ],
    {
      type: 'text/javascript',
    }
  );
  // @ts-ignore
  const URL = self.URL || self.webkitURL || self.mozURL || self.msURL;
  const objectURL = URL.createObjectURL(blob);
  const worker = new self.Worker(objectURL);

  return {
    worker,
    objectURL,
  };
}
