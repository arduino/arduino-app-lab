export interface ForwardPort {
  port: number;
  type: 'webview' | 'other';
}

export interface AppUIService {
  findPorts: (appId: string) => Promise<ForwardPort[]>;
  openUIWhenReady: (port: number, timeout: number) => Promise<void>;
  forwardNonUIPort: (port: number) => Promise<void>;
  // Subscribe to "the agent started an app": the caller auto-opens its web UI once running. Returns an unsubscribe.
  onAgentStartedApp: (cb: (appId: string) => void) => () => void;
}
