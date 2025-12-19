import { OrchestratorService } from './orchestrator-service.type';

export let getApps: OrchestratorService['getApps'] = async function () {
  throw new Error('getApps service not implemented');
};

export let getAppDetail: OrchestratorService['getAppDetail'] =
  async function () {
    throw new Error('getAppDetail service not implemented');
  };

export let updateAppDetail: OrchestratorService['updateAppDetail'] =
  async function () {
    throw new Error('updateAppDetail service not implemented');
  };

export let createApp: OrchestratorService['createApp'] = async function () {
  throw new Error('createApp service not implemented');
};

export let cloneApp: OrchestratorService['cloneApp'] = async function () {
  throw new Error('cloneApp service not implemented');
};

export let deleteApp: OrchestratorService['deleteApp'] = async function () {
  throw new Error('deleteApp service not implemented');
};

export let getFiles: OrchestratorService['getFiles'] = async function () {
  throw new Error('getFiles service not implemented');
};

export let getFileContent: OrchestratorService['getFileContent'] =
  async function () {
    throw new Error('getFileContent service not implemented');
  };

export let getAppBricks: OrchestratorService['getAppBricks'] =
  async function () {
    throw new Error('getAppBricks service not implemented');
  };

export let getAppBrickInstance: OrchestratorService['getAppBrickInstance'] =
  async function () {
    throw new Error('getAppBrickInstance service not implemented');
  };

export let addAppBrick: OrchestratorService['addAppBrick'] = async function () {
  throw new Error('addAppBrick service not implemented');
};

export let deleteAppBrick: OrchestratorService['deleteAppBrick'] =
  async function () {
    throw new Error('deleteAppBrick service not implemented');
  };

export let updateAppBrick: OrchestratorService['updateAppBrick'] =
  async function () {
    throw new Error('updateAppBrick service not implemented');
  };

export let getBricks: OrchestratorService['getBricks'] = async function () {
  throw new Error('getBricks service not implemented');
};

export let getBrickDetails: OrchestratorService['getBrickDetails'] =
  async function () {
    throw new Error('getBrickDetails service not implemented');
  };

export let getConfig: OrchestratorService['getConfig'] = async function () {
  throw new Error('disableSyncApp service not implemented');
};

export let startApp: OrchestratorService['startApp'] = async function () {
  throw new Error('startApp service not implemented');
};

export let stopApp: OrchestratorService['stopApp'] = async function () {
  throw new Error('stopApp service not implemented');
};

export let getAppPorts: OrchestratorService['getAppPorts'] = async function () {
  throw new Error('getAppPorts service not implemented');
};

export let getAppLogs: OrchestratorService['getAppLogs'] = async function () {
  throw new Error('getAppLogs service not implemented');
};

export let getAppStatus: OrchestratorService['getAppsStatus'] =
  async function () {
    throw new Error('getAppsStatus service not implemented');
  };

export let getSerialMonitorLogs: OrchestratorService['getSerialMonitorLogs'] =
  async function () {
    throw new Error('getSerialMonitorLogs service not implemented');
  };

export let getSystemResources: OrchestratorService['getSystemResources'] =
  async function () {
    throw new Error('getSystemResources service not implemented');
  };

export let checkBoardUpdate: OrchestratorService['checkBoardUpdate'] =
  async function () {
    throw new Error('checkBoardUpdate service not implemented');
  };

export let getBoardUpdateLogs: OrchestratorService['getBoardUpdateLogs'] =
  async function () {
    throw new Error('getBoardUpdateLogs service not implemented');
  };

export let applyBoardUpdate: OrchestratorService['applyBoardUpdate'] =
  async function () {
    throw new Error('applyBoardUpdate service not implemented');
  };

export let getVersion: OrchestratorService['getVersion'] = async function () {
  throw new Error('getVersion service not implemented');
};

export let getSystemPropertyKeys: OrchestratorService['getSystemPropertyKeys'] =
  async function () {
    throw new Error('getSystemPropertyKeys service not implemented');
  };

export let getSystemProperty: OrchestratorService['getSystemProperty'] =
  async function () {
    throw new Error('getSystemProperty service not implemented');
  };
export let upsertSystemProperty: OrchestratorService['upsertSystemProperty'] =
  async function () {
    throw new Error('upsertSystemProperty service not implemented');
  };

export let deleteSystemProperty: OrchestratorService['deleteSystemProperty'] =
  async function () {
    throw new Error('deleteSystemProperty service not implemented');
  };

export let getSketchLibraries: OrchestratorService['getSketchLibraries'] =
  async function () {
    throw new Error('getSketchLibraries service not implemented');
  };

export let getAppSketchLibraries: OrchestratorService['getAppSketchLibraries'] =
  async function () {
    throw new Error('getAppSketchLibraries service not implemented');
  };

export let addAppSketchLibrary: OrchestratorService['addAppSketchLibrary'] =
  async function () {
    throw new Error('addAppSketchLibrary service not implemented');
  };

export let deleteAppSketchLibrary: OrchestratorService['deleteAppSketchLibrary'] =
  async function () {
    throw new Error('deleteAppSketchLibrary service not implemented');
  };

export const setOrchestratorService = (service: OrchestratorService): void => {
  getApps = service.getApps;
  getAppStatus = service.getAppsStatus;
  getAppDetail = service.getAppDetail;
  updateAppDetail = service.updateAppDetail;
  createApp = service.createApp;
  cloneApp = service.cloneApp;
  deleteApp = service.deleteApp;
  getFiles = service.getFiles;
  getFileContent = service.getFileContent;
  getAppBricks = service.getAppBricks;
  getConfig = service.getConfig;
  startApp = service.startApp;
  getAppPorts = service.getAppPorts;
  stopApp = service.stopApp;
  getAppLogs = service.getAppLogs;
  getSerialMonitorLogs = service.getSerialMonitorLogs;
  getSystemResources = service.getSystemResources;
  checkBoardUpdate = service.checkBoardUpdate;
  getBoardUpdateLogs = service.getBoardUpdateLogs;
  applyBoardUpdate = service.applyBoardUpdate;
  getVersion = service.getVersion;
  getBricks = service.getBricks;
  getAppBrickInstance = service.getAppBrickInstance;
  getBrickDetails = service.getBrickDetails;
  addAppBrick = service.addAppBrick;
  deleteAppBrick = service.deleteAppBrick;
  updateAppBrick = service.updateAppBrick;
  getSystemPropertyKeys = service.getSystemPropertyKeys;
  getSystemProperty = service.getSystemProperty;
  upsertSystemProperty = service.upsertSystemProperty;
  deleteSystemProperty = service.deleteSystemProperty;
  getSketchLibraries = service.getSketchLibraries;
  getAppSketchLibraries = service.getAppSketchLibraries;
  addAppSketchLibrary = service.addAppSketchLibrary;
  deleteAppSketchLibrary = service.deleteAppSketchLibrary;
};
