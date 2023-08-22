// ensure the worker ends up in the bundle
// If the worker should not be included this gets aliased to empty.js
import './transmuxer-worker';

export function hasUMDWorker(): boolean {
  return typeof __HLS_WORKER_BUNDLE__ === 'function';
}

export type WorkerContext = {
  worker: Worker;
  objectURL?: string;
  scriptURL?: string;
};

export function injectWorker(): WorkerContext {
  const blob = new self.Blob(
    [
      `var exports={};var module={exports:exports};function define(f){f()};define.amd=true;(${__HLS_WORKER_BUNDLE__.toString()})(true);`,
    ],
    {
      type: 'text/javascript',
    },
  );
  const objectURL = self.URL.createObjectURL(blob);
  const worker = new self.Worker(objectURL);

  return {
    worker,
    objectURL,
  };
}

export function loadWorker(path: string): WorkerContext {
  const scriptURL = new self.URL(path, self.location.href).href;
  const worker = new self.Worker(scriptURL);

  return {
    worker,
    scriptURL,
  };
}
