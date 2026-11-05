import { CodingAgentService } from './codingAgentService.type';

const notImplemented = (name: string) => (): never => {
  throw new Error(`${name} service not implemented`);
};

export let start: CodingAgentService['start'] = async () =>
  notImplemented('start')();
export let stop: CodingAgentService['stop'] = async () =>
  notImplemented('stop')();

export let switchAgent: CodingAgentService['switchAgent'] = async () =>
  notImplemented('switchAgent')();
export let listAgents: CodingAgentService['listAgents'] =
  notImplemented('listAgents');
export let getAuthStatus: CodingAgentService['getAuthStatus'] = async () =>
  notImplemented('getAuthStatus')();
export let validateAuth: CodingAgentService['validateAuth'] = async () =>
  notImplemented('validateAuth')();
export let newSessionState: CodingAgentService['newSessionState'] = async () =>
  notImplemented('newSessionState')();
export let authenticate: CodingAgentService['authenticate'] = async () =>
  notImplemented('authenticate')();
export let authenticateApiKey: CodingAgentService['authenticateApiKey'] =
  async () => notImplemented('authenticateApiKey')();
export let listProviders: CodingAgentService['listProviders'] = async () =>
  notImplemented('listProviders')();
export let listProviderCredentials: CodingAgentService['listProviderCredentials'] =
  async () => notImplemented('listProviderCredentials')();
export let setProviderKey: CodingAgentService['setProviderKey'] = async () =>
  notImplemented('setProviderKey')();
export let deleteProviderKey: CodingAgentService['deleteProviderKey'] =
  async () => notImplemented('deleteProviderKey')();
export let signInProvider: CodingAgentService['signInProvider'] = async () =>
  notImplemented('signInProvider')();
export let cancelProviderSignIn: CodingAgentService['cancelProviderSignIn'] =
  async () => notImplemented('cancelProviderSignIn')();
export let onProviderSignIn: CodingAgentService['onProviderSignIn'] =
  notImplemented('onProviderSignIn');
export let currentAgent: CodingAgentService['currentAgent'] = async () =>
  notImplemented('currentAgent')();
export let connectWithoutKey: CodingAgentService['connectWithoutKey'] =
  async () => notImplemented('connectWithoutKey')();
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
export let markSessionRead: CodingAgentService['markSessionRead'] = async () =>
  notImplemented('markSessionRead')();
export let deleteSession: CodingAgentService['deleteSession'] = async () =>
  notImplemented('deleteSession')();
export let getSessionState: CodingAgentService['getSessionState'] = async () =>
  notImplemented('getSessionState')();
export let prompt: CodingAgentService['prompt'] = async () =>
  notImplemented('prompt')();
export let awaitTurn: CodingAgentService['awaitTurn'] = async () =>
  notImplemented('awaitTurn')();
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
export let onWorkspaceAppForgotten: CodingAgentService['onWorkspaceAppForgotten'] =
  notImplemented('onWorkspaceAppForgotten');
export let onWorkspaceAppRenamed: CodingAgentService['onWorkspaceAppRenamed'] =
  notImplemented('onWorkspaceAppRenamed');
export let applyToEditor: CodingAgentService['applyToEditor'] = async () =>
  notImplemented('applyToEditor')();
export let openAgentFile: CodingAgentService['openAgentFile'] = async () =>
  notImplemented('openAgentFile')();

export const setCodingAgentService = (service: CodingAgentService): void => {
  start = service.start;
  stop = service.stop;
  switchAgent = service.switchAgent;
  listAgents = service.listAgents;
  getAuthStatus = service.getAuthStatus;
  validateAuth = service.validateAuth;
  newSessionState = service.newSessionState;
  authenticate = service.authenticate;
  authenticateApiKey = service.authenticateApiKey;
  listProviders = service.listProviders;
  listProviderCredentials = service.listProviderCredentials;
  setProviderKey = service.setProviderKey;
  deleteProviderKey = service.deleteProviderKey;
  signInProvider = service.signInProvider;
  cancelProviderSignIn = service.cancelProviderSignIn;
  onProviderSignIn = service.onProviderSignIn;
  connectWithoutKey = service.connectWithoutKey;
  currentAgent = service.currentAgent;
  submitLoginToken = service.submitLoginToken;
  cancelLogin = service.cancelLogin;
  disconnect = service.disconnect;
  setDefaultAgent = service.setDefaultAgent;
  newSession = service.newSession;
  listSessions = service.listSessions;
  loadSession = service.loadSession;
  renameSession = service.renameSession;
  pinSession = service.pinSession;
  markSessionRead = service.markSessionRead;
  deleteSession = service.deleteSession;
  getSessionState = service.getSessionState;
  prompt = service.prompt;
  awaitTurn = service.awaitTurn;
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
  onWorkspaceAppForgotten = service.onWorkspaceAppForgotten;
  onWorkspaceAppRenamed = service.onWorkspaceAppRenamed;
  applyToEditor = service.applyToEditor;
  openAgentFile = service.openAgentFile;
};
