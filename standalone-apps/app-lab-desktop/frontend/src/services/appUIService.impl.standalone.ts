import {
  AppUIService,
  getAppPorts,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';

import { OpenUIWhenReady } from '../../wailsjs/go/app/App';

export const findUIPort: AppUIService['findUIPort'] = async function (
  appId: string,
): Promise<number> {
  const ports = await getAppPorts(appId);
  const webview = ports.find((p) => p.serviceName === 'webview');
  const port = webview?.port;
  if (!port) throw new Error(`Webview port not found for app ${appId}`);
  return parseInt(port, 10);
};

export const openUIWhenReady: AppUIService['openUIWhenReady'] = async function (
  port: number,
): Promise<void> {
  return OpenUIWhenReady(port);
};
