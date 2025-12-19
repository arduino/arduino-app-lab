export interface WebSocketHandlers {
  onopen: ((ev: Event) => unknown) | null;
  onmessage: ((ev: MessageEvent) => unknown) | null;
  onclose: (() => unknown) | null;
  onerror: ((ev: Event) => unknown) | null;
}
