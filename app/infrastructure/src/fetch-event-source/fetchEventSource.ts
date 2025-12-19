import {
  fetchEventSource,
  FetchEventSourceInit,
} from '@microsoft/fetch-event-source';

import { EventSourceHandlers } from './fetchEventSource.type';

const maxRetries = 5;
const baseDelay = 1000; // 1 second

class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FatalError';
  }
}

class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
  }
}

async function commonOnOpen(res: Response): Promise<void> {
  if (!res.ok) {
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      throw new FatalError(`HTTP ${res.status}`);
    } else {
      throw new RetryableError(`Unexpected response status: ${res.status}`);
    }
  }
}

function getCommonOnError(): (err: Error) => number {
  let tries = 0;
  return (err: Error): number => {
    if (err instanceof FatalError) {
      throw err;
    }

    tries += 1;
    if (tries > maxRetries) {
      throw new Error('Max retries exceeded');
    }

    return baseDelay * 2 ** (tries - 1);
  };
}

function addCommonHandlers(handlers: EventSourceHandlers): EventSourceHandlers {
  const commonOnError = getCommonOnError();
  return {
    ...handlers,
    async onopen(res: Response): Promise<void> {
      await handlers.onopen?.(res);
      await commonOnOpen(res);
    },
    onerror: (err: Error): void => {
      handlers.onerror?.(err);
      commonOnError(err);
    },
  };
}

export async function getEventSource(
  url: string,
  handlers: EventSourceHandlers,
  token?: string,
  abortController?: AbortController,
  headers?: FetchEventSourceInit['headers'],
): Promise<void> {
  const options: FetchEventSourceInit = {
    method: 'GET',
    ...addCommonHandlers(handlers),
  };

  if (token) {
    options.headers = {
      Authorization: `Bearer ${token}`,
    };
  }

  if (abortController) {
    options.signal = abortController.signal;
  }

  if (headers) {
    options.headers = {
      ...options.headers,
      ...headers,
    };
  }

  return fetchEventSource(url, { ...options, openWhenHidden: true });
}

export async function postEventSource(
  url: string,
  handlers: EventSourceHandlers,
  body = {},
  token?: string,
  abortController?: AbortController,
  headers?: FetchEventSourceInit['headers'],
): Promise<void> {
  const options: FetchEventSourceInit = {
    method: 'POST',
    body: JSON.stringify(body),
    ...addCommonHandlers(handlers),
  };

  if (token) {
    options.headers = {
      Authorization: `Bearer ${token}`,
    };
  }

  if (abortController) {
    options.signal = abortController.signal;
  }

  if (headers) {
    options.headers = {
      ...options.headers,
      ...headers,
    };
  }

  return fetchEventSource(url, { ...options, openWhenHidden: true });
}
