import axios from 'axios';

export type ApiRequestOptions = {
  signal?: AbortSignal;
};

/** True when the request was cancelled via AbortController / axios cancel. */
export function isRequestAborted(error: unknown): boolean {
  return (
    axios.isCancel(error) ||
    (error as { code?: string })?.code === 'ERR_CANCELED' ||
    (error as { name?: string })?.name === 'AbortError'
  );
}
