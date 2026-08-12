import {
  AiRuntimeService,
  RuntimeProgress,
} from '@cloud-editor-mono/ai-assistant';

import {
  RuntimeCancelInstall,
  RuntimeCheckUpdate,
  RuntimeInstall,
  RuntimeStatus,
  RuntimeUninstall,
} from '../../wailsjs/go/app/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';

export const status: AiRuntimeService['status'] = async (agentId) => {
  const s = await RuntimeStatus(agentId);
  return {
    installed: s.installed,
    version: s.version,
    diskUsageBytes: s.diskUsageBytes,
  };
};

// Compares the installed runtime against the versions this app build pins (Node + dependency lockfile), in Go. No network: an update surfaces after the app itself updates; re-installing applies it.
export const checkForUpdate: AiRuntimeService['checkForUpdate'] = async (
  agentId,
) => {
  const c = await RuntimeCheckUpdate(agentId);
  return { updateAvailable: c.updateAvailable, latestVersion: c.latestVersion };
};

export const install: AiRuntimeService['install'] = async (agentId) => {
  await RuntimeInstall(agentId);
};

export const uninstall: AiRuntimeService['uninstall'] = async (agentId) => {
  await RuntimeUninstall(agentId);
};

export const cancel: AiRuntimeService['cancel'] = async (agentId) => {
  await RuntimeCancelInstall(agentId);
};

// airuntime.Progress shares RuntimeProgress's JSON shape, so the event maps 1:1.
export const onProgress: AiRuntimeService['onProgress'] = (handler) =>
  EventsOn('airuntime:progress', (p: RuntimeProgress) => handler(p));
