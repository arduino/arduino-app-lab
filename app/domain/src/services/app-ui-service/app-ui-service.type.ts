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
  // Subscribe to "the agent renamed an app": the rename gave it a new id, so a page on the old one follows it. Returns an unsubscribe.
  onAgentRenamedApp: (
    cb: (oldId: string, newId: string, newName: string) => void,
  ) => () => void;
  // Subscribe to "the agent renamed or moved a file or folder of an app": from and to are relative to appPath, so the app's open tabs follow it. Returns an unsubscribe.
  onAgentRenamedAppFile: (
    cb: (
      appId: string,
      appPath: string,
      from: string,
      to: string,
      isFolder: boolean,
    ) => void,
  ) => () => void;
  // Subscribe to "the agent proposed a Wi-Fi network": the caller opens the dialog on that SSID so the user types the password, which must never reach the agent. Returns an unsubscribe.
  onAgentWifiRequest: (cb: (ssid: string) => void) => () => void;
  // The agent asked for one of the user's own Edge Impulse models: the picker opens on this app's brick, because importing needs a key the agent never sees.
  onAgentModelImport: (
    cb: (appId: string, brickId: string) => void,
  ) => () => void;
}
