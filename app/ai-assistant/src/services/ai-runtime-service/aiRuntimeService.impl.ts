import { AiRuntimeService } from './aiRuntimeService.type';

const notImplemented = (name: string) => (): never => {
  throw new Error(`${name} service not implemented`);
};

export let status: AiRuntimeService['status'] = async () =>
  notImplemented('status')();
export let checkForUpdate: AiRuntimeService['checkForUpdate'] = async () =>
  notImplemented('checkForUpdate')();
export let install: AiRuntimeService['install'] = async () =>
  notImplemented('install')();
export let uninstall: AiRuntimeService['uninstall'] = async () =>
  notImplemented('uninstall')();
// `cancelInstall` (not `cancel`): avoids colliding with the agent's `cancel` in the barrel.
export let cancelInstall: AiRuntimeService['cancel'] = async () =>
  notImplemented('cancel')();
export let onProgress: AiRuntimeService['onProgress'] =
  notImplemented('onProgress');

export const setAiRuntimeService = (service: AiRuntimeService): void => {
  status = service.status;
  checkForUpdate = service.checkForUpdate;
  install = service.install;
  uninstall = service.uninstall;
  cancelInstall = service.cancel;
  onProgress = service.onProgress;
};
