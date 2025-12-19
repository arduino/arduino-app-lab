import { FetchEventSourceInit } from '@microsoft/fetch-event-source';

export interface EventSourceHandlers {
  onopen: FetchEventSourceInit['onopen'];
  onmessage: FetchEventSourceInit['onmessage'];
  onclose: FetchEventSourceInit['onclose'];
  onerror: FetchEventSourceInit['onerror'];
}
