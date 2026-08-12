import { CodingAgentService } from './codingAgentService.type';

const notImplemented = (name: string) => (): never => {
  throw new Error(`${name} service not implemented`);
};

export let start: CodingAgentService['start'] = async () =>
  notImplemented('start')();
export let stop: CodingAgentService['stop'] = async () =>
  notImplemented('stop')();
export let listAgents: CodingAgentService['listAgents'] =
  notImplemented('listAgents');
export let getAuthStatus: CodingAgentService['getAuthStatus'] = async () =>
  notImplemented('getAuthStatus')();
export let validateAuth: CodingAgentService['validateAuth'] = async () =>
  notImplemented('validateAuth')();
export let authenticate: CodingAgentService['authenticate'] = async () =>
  notImplemented('authenticate')();
export let authenticateApiKey: CodingAgentService['authenticateApiKey'] =
  async () => notImplemented('authenticateApiKey')();
export let submitLoginToken: CodingAgentService['submitLoginToken'] =
  async () => notImplemented('submitLoginToken')();
export let cancelLogin: CodingAgentService['cancelLogin'] = async () =>
  notImplemented('cancelLogin')();
export let disconnect: CodingAgentService['disconnect'] = async () =>
  notImplemented('disconnect')();
export let setDefaultAgent: CodingAgentService['setDefaultAgent'] = async () =>
  notImplemented('setDefaultAgent')();
export let newSession: CodingAgentService['newSession'] = async () =>
  notImplemented('newSession')();
export let listSessions: CodingAgentService['listSessions'] = async () =>
  notImplemented('listSessions')();
export let loadSession: CodingAgentService['loadSession'] = async () =>
  notImplemented('loadSession')();
export let renameSession: CodingAgentService['renameSession'] = async () =>
  notImplemented('renameSession')();
export let pinSession: CodingAgentService['pinSession'] = async () =>
  notImplemented('pinSession')();
export let deleteSession: CodingAgentService['deleteSession'] = async () =>
  notImplemented('deleteSession')();
export let getSessionState: CodingAgentService['getSessionState'] = async () =>
  notImplemented('getSessionState')();
export let prompt: CodingAgentService['prompt'] = async () =>
  notImplemented('prompt')();
export let cancel: CodingAgentService['cancel'] = async () =>
  notImplemented('cancel')();
export let closeSession: CodingAgentService['closeSession'] = async () =>
  notImplemented('closeSession')();
export let listModels: CodingAgentService['listModels'] = async () =>
  notImplemented('listModels')();
export let setSessionModel: CodingAgentService['setSessionModel'] = async () =>
  notImplemented('setSessionModel')();
export let setSessionMode: CodingAgentService['setSessionMode'] = async () =>
  notImplemented('setSessionMode')();
export let permissionReply: CodingAgentService['permissionReply'] =
  notImplemented('permissionReply');
export let choicesReply: CodingAgentService['choicesReply'] =
  notImplemented('choicesReply');
export let onUpdate: CodingAgentService['onUpdate'] =
  notImplemented('onUpdate');
export let onPermission: CodingAgentService['onPermission'] =
  notImplemented('onPermission');
export let onRestart: CodingAgentService['onRestart'] =
  notImplemented('onRestart');
export let onLoginUrl: CodingAgentService['onLoginUrl'] =
  notImplemented('onLoginUrl');
export let applyToEditor: CodingAgentService['applyToEditor'] = async () =>
  notImplemented('applyToEditor')();
export let openAgentFile: CodingAgentService['openAgentFile'] = async () =>
  notImplemented('openAgentFile')();

export const setCodingAgentService = (service: CodingAgentService): void => {
  start = service.start;
  stop = service.stop;
  listAgents = service.listAgents;
  getAuthStatus = service.getAuthStatus;
  validateAuth = service.validateAuth;
  authenticate = service.authenticate;
  authenticateApiKey = service.authenticateApiKey;
  submitLoginToken = service.submitLoginToken;
  cancelLogin = service.cancelLogin;
  disconnect = service.disconnect;
  setDefaultAgent = service.setDefaultAgent;
  newSession = service.newSession;
  listSessions = service.listSessions;
  loadSession = service.loadSession;
  renameSession = service.renameSession;
  pinSession = service.pinSession;
  deleteSession = service.deleteSession;
  getSessionState = service.getSessionState;
  prompt = service.prompt;
  cancel = service.cancel;
  closeSession = service.closeSession;
  listModels = service.listModels;
  setSessionModel = service.setSessionModel;
  setSessionMode = service.setSessionMode;
  permissionReply = service.permissionReply;
  choicesReply = service.choicesReply;
  onUpdate = service.onUpdate;
  onPermission = service.onPermission;
  onRestart = service.onRestart;
  onLoginUrl = service.onLoginUrl;
  applyToEditor = service.applyToEditor;
  openAgentFile = service.openAgentFile;
};
