import { AppUIService } from './app-ui-service.type';

export let findPorts: AppUIService['findPorts'] = async function () {
  throw new Error('findPorts not implemented');
};

export let openUIWhenReady: AppUIService['openUIWhenReady'] =
  async function () {
    throw new Error('openUIWhenReady not implemented');
  };

export let forwardNonUIPort: AppUIService['forwardNonUIPort'] =
  async function () {
    throw new Error('forwardNonUIPort not implemented');
  };

export let onAgentStartedApp: AppUIService['onAgentStartedApp'] = () => {
  return () => undefined;
};

export let onAgentRenamedApp: AppUIService['onAgentRenamedApp'] = () => {
  return () => undefined;
};

export let onAgentRenamedAppFile: AppUIService['onAgentRenamedAppFile'] =
  () => {
    return () => undefined;
  };

export let onAgentWifiRequest: AppUIService['onAgentWifiRequest'] = () => {
  return () => undefined;
};

export let onAgentModelImport: AppUIService['onAgentModelImport'] = () => {
  return () => undefined;
};

export const setAppUIService = (service: AppUIService): void => {
  findPorts = service.findPorts;
  openUIWhenReady = service.openUIWhenReady;
  forwardNonUIPort = service.forwardNonUIPort;
  onAgentStartedApp = service.onAgentStartedApp;
  onAgentRenamedApp = service.onAgentRenamedApp;
  onAgentRenamedAppFile = service.onAgentRenamedAppFile;
  onAgentWifiRequest = service.onAgentWifiRequest;
  onAgentModelImport = service.onAgentModelImport;
};
