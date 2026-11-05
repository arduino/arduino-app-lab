import {
  AppUIService,
  ForwardPort,
  getAppPorts,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';

import { ForwardNonUIPort, OpenUIWhenReady } from '../../wailsjs/go/app/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';

interface CompletePort {
  port: string;
  serviceName: string;
  source?: string | undefined;
}

export const findPorts: AppUIService['findPorts'] = async function (
  appId: string,
): Promise<ForwardPort[]> {
  const res = await getAppPorts(appId);
  return res
    .filter((p): p is CompletePort => !!p.port)
    .map((p) => ({
      port: parseInt(p.port, 10),
      type: p.serviceName === 'webview' ? 'webview' : 'other',
    }));
};

export const openUIWhenReady: AppUIService['openUIWhenReady'] = async function (
  port: number,
  timeout: number,
): Promise<void> {
  return OpenUIWhenReady(port, timeout);
};

export const forwardNonUIPort: AppUIService['forwardNonUIPort'] =
  async function (port: number): Promise<void> {
    return ForwardNonUIPort(port);
  };

// Wails event from the board MCP when the agent proposes a Wi-Fi network; the caller opens the dialog on that SSID.
export const onAgentWifiRequest: AppUIService['onAgentWifiRequest'] = (cb) =>
  EventsOn('wifi:agent-connect', (ssid) => {
    if (typeof ssid === 'string') {
      cb(ssid);
    }
  });

// Wails event from the board MCP when the agent asks for a custom model; the caller opens the brick's model picker.
export const onAgentModelImport: AppUIService['onAgentModelImport'] = (cb) =>
  EventsOn('models:agent-import', (appId, brickId) => {
    if (typeof appId === 'string' && typeof brickId === 'string') {
      cb(appId, brickId);
    }
  });

// Wails event from the board MCP when the agent renames an app; the caller moves off the old id.
export const onAgentRenamedApp: AppUIService['onAgentRenamedApp'] = (cb) =>
  EventsOn('app:agent-renamed', (oldId, newId, newName) => {
    if (typeof oldId === 'string' && typeof newId === 'string') {
      cb(oldId, newId, typeof newName === 'string' ? newName : '');
    }
  });

// Wails event from the board MCP when the agent renames or moves an app's file or folder; the caller moves its open tabs.
export const onAgentRenamedAppFile: AppUIService['onAgentRenamedAppFile'] = (
  cb,
) =>
  EventsOn('app:agent-renamed-file', (appId, appPath, from, to, isFolder) => {
    if (
      typeof appId === 'string' &&
      typeof appPath === 'string' &&
      typeof from === 'string' &&
      typeof to === 'string'
    ) {
      cb(appId, appPath, from, to, isFolder === true);
    }
  });

// Wails event from the board MCP when the agent starts an app; the caller opens its web UI once running.
export const onAgentStartedApp: AppUIService['onAgentStartedApp'] = (cb) =>
  EventsOn('app:agent-started', (appId) => {
    if (typeof appId === 'string') {
      cb(appId);
    }
  });
