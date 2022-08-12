import { LoaderContext, RequestSetup } from '../types/loader';

export function requestSetup(
  requestSetup: RequestSetup,
  context: LoaderContext
) {
  if (!requestSetup) {
    return Promise.resolve();
  }

  const request = {
    url: context.url,
    headers: context.headers || {},
    credentials: context.credentials,
  };

  return Promise.resolve(requestSetup(request)).then(() =>
    Object.assign(context, request)
  );
}
