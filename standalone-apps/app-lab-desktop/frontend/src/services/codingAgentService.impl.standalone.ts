import {
  AgentDescriptor,
  AgentId,
  AgentModel,
  AuthMethod,
  AuthStatus,
  CodingAgentService,
  ProviderSignInPrompt,
} from '@cloud-editor-mono/ai-assistant';

import {
  AgentAuthStatus,
  AgentAwaitTurn,
  AgentCancel,
  AgentCancelLogin,
  AgentCancelProviderSignIn,
  AgentChoicesReply,
  AgentCloseSession,
  AgentConnectWithoutCredential,
  AgentCurrent,
  AgentDeleteProviderKey,
  AgentDeleteSession,
  AgentDisconnect,
  AgentGetSessionState,
  AgentListSessions,
  AgentLoadSession,
  AgentMarkSessionRead,
  AgentNewSession,
  AgentNewSessionState,
  AgentPermissionReply,
  AgentPinSession,
  AgentPrompt,
  AgentProviderCredentials,
  AgentProviders,
  AgentProviderSignIn,
  AgentRenameSession,
  AgentResolveFile,
  AgentSetDefault,
  AgentSetProviderKey,
  AgentSetSessionMode,
  AgentSetSessionModel,
  AgentSignIn,
  AgentSignInApiKey,
  AgentStart,
  AgentStop,
  AgentSubmitLoginToken,
  AgentSwitch,
  AgentValidateAuth,
} from '../../wailsjs/go/app/App';
import { agent } from '../../wailsjs/go/models';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import {
  mapForgottenChats,
  mapPermissionRequest,
  mapRestart,
  mapSessionState,
  mapSessionSummary,
  mapUpdate,
  WirePermissionRequest,
  WireRestart,
  WireUpdate,
} from './codingAgentService.mapper';

// Claude and OpenCode are live; Codex is a disabled "coming soon" card until its auth flow lands.
const AGENTS: AgentDescriptor[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    description: 'Use your Claude Pro/Max account or an Anthropic API key',
    provider: 'Anthropic',
    authMethods: ['subscription', 'api_key'],
    apiKeyPrefix: 'sk-ant-',
    apiKeyUrl: 'https://platform.claude.com/login?returnTo=%2Fsettings%2Fkeys',
    preview: true,
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Open-source coding Agent · use it with OpenCode or Gemini',
    provider: 'OpenCode',
    // As many providers as you like: the engine offers the models of every one whose key is set.
    perProviderKeys: true,
    usableWithoutKey: true,
    persistsNewSession: true,
    // No browser sign-in: session/authenticate returns success without doing anything.
    authMethods: ['api_key'],
    // Bring-your-own-provider: the provider comes from what the user configures, not the key's shape.
    apiKeyPrefix: '',
    preview: true,
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'Use your ChatGPT Plus/Pro account or an OpenAI API key',
    provider: 'OpenAI',
    authMethods: ['subscription', 'api_key'],
    apiKeyPrefix: 'sk-',
    comingSoon: true,
  },
];

export const start: CodingAgentService['start'] = async (agentId) => {
  await AgentStart(agentId);
};

export const validateAuth: CodingAgentService['validateAuth'] = async () =>
  mapSessionState(await AgentValidateAuth());

export const newSessionState: CodingAgentService['newSessionState'] =
  async () => mapSessionState(await AgentNewSessionState());

export const stop: CodingAgentService['stop'] = async () => {
  await AgentStop();
};

// Rejects when the mirror still holds edits the board does not have: Go refuses rather than delete them.
export const switchAgent: CodingAgentService['switchAgent'] = async (
  agentId,
) => {
  await AgentSwitch(agentId);
};

export const listAgents: CodingAgentService['listAgents'] = () =>
  AGENTS.map((a) => ({ ...a }));

export const newSession: CodingAgentService['newSession'] = async (
  appId,
  appName,
) => AgentNewSession(appId ?? '', appName ?? '');

export const listSessions: CodingAgentService['listSessions'] = async () =>
  (await AgentListSessions()).map(mapSessionSummary);

// Reopen a session; its history replays through the acp:update event stream (onUpdate).
export const loadSession: CodingAgentService['loadSession'] = async (
  sessionId,
) => {
  await AgentLoadSession(sessionId);
};

export const pinSession: CodingAgentService['pinSession'] = async (
  sessionId,
  pinned,
) => {
  await AgentPinSession(sessionId, pinned);
};

export const markSessionRead: CodingAgentService['markSessionRead'] = async (
  sessionId,
) => AgentMarkSessionRead(sessionId);

export const renameSession: CodingAgentService['renameSession'] = async (
  sessionId,
  title,
) => {
  await AgentRenameSession(sessionId, title);
};

export const deleteSession: CodingAgentService['deleteSession'] = async (
  sessionId,
) => {
  await AgentDeleteSession(sessionId);
};

export const prompt: CodingAgentService['prompt'] = async (
  sessionId,
  text,
  editorContext,
) => {
  // No editor (Agent Mode) reaches Go as a nil context, which sends the agent nothing.
  const editor = editorContext && agent.EditorContext.createFrom(editorContext);
  await AgentPrompt(sessionId, text, editor as agent.EditorContext);
};

export const awaitTurn: CodingAgentService['awaitTurn'] = async (sessionId) => {
  await AgentAwaitTurn(sessionId);
};

export const cancel: CodingAgentService['cancel'] = async (sessionId) => {
  await AgentCancel(sessionId);
};

export const closeSession: CodingAgentService['closeSession'] = async (
  sessionId,
) => {
  await AgentCloseSession(sessionId);
};

export const setSessionModel: CodingAgentService['setSessionModel'] = async (
  sessionId,
  modelId,
) => {
  await AgentSetSessionModel(sessionId, modelId);
};

export const setSessionMode: CodingAgentService['setSessionMode'] = async (
  sessionId,
  modeId,
) => {
  await AgentSetSessionMode(sessionId, modeId);
};

// Rehydration after a webview reload: status + in-flight turn + pending permission.
export const getSessionState: CodingAgentService['getSessionState'] = async (
  sessionId,
) => mapSessionState(await AgentGetSessionState(sessionId));

// PermissionOutcome ({optionId?, cancelled?}) is the ACP shape Go expects, so the reply is a pass-through.
export const permissionReply: CodingAgentService['permissionReply'] = (
  requestId,
  outcome,
) => {
  AgentPermissionReply(requestId, new agent.PermissionOutcome(outcome)).catch(
    (e) => console.error('permissionReply failed', e),
  );
};

export const onUpdate: CodingAgentService['onUpdate'] = (handler) =>
  EventsOn('acp:update', (sessionId: string, u: WireUpdate) => {
    const update = mapUpdate(u);
    if (update) {
      handler(sessionId, update);
    }
  });

export const onPermission: CodingAgentService['onPermission'] = (handler) =>
  EventsOn('acp:permission', (req: WirePermissionRequest) => {
    handler(mapPermissionRequest(req));
  });

// The agent process crashed and Go is auto-restarting it; the last event carries gaveUp once the
// budget is spent, which is when the UI has to offer a manual reconnect.
export const onRestart: CodingAgentService['onRestart'] = (handler) =>
  EventsOn('acp:restart', (info: WireRestart) => {
    handler(mapRestart(info));
  });

// The subscription login CLI prints its OAuth URL; Go forwards the first one here.
export const onLoginUrl: CodingAgentService['onLoginUrl'] = (handler) =>
  EventsOn('agent:login-url', (url: string) => handler(url));

// Go dropped a deleted app's grants and chats — from the delete dialog, or from the agent's own apps_delete.
export const onWorkspaceAppForgotten: CodingAgentService['onWorkspaceAppForgotten'] =
  (handler) =>
    EventsOn(
      'agent:workspace-app-forgotten',
      (appId: string, chatIds?: unknown) =>
        handler(appId, mapForgottenChats(chatIds)),
    );

// The agent's apps_edit renamed an app; Go moves its chats to the new id right after sending this.
export const onWorkspaceAppRenamed: CodingAgentService['onWorkspaceAppRenamed'] =
  (handler) =>
    EventsOn(
      'app:agent-renamed',
      (oldId: string, newId: string, newName: string) =>
        handler(oldId, newId, newName),
    );

// Reports a persisted subscription login (or an API key set this session) so a returning user skips connect.
export const getAuthStatus: CodingAgentService['getAuthStatus'] = async (
  agentId,
): Promise<AuthStatus> => {
  try {
    const status = await AgentAuthStatus(agentId);
    return status.authenticated
      ? {
          authenticated: true,
          agentId: status.agentId as AgentId,
          isDefault: status.isDefault,
          method: status.method ? (status.method as AuthMethod) : undefined,
          account: status.account || undefined,
          connectedAt: status.connectedAt || undefined,
        }
      : { authenticated: false };
  } catch {
    return { authenticated: false };
  }
};

// Subscription sign-in: runs the agent CLI's browser-OAuth login in Go; resolves when it completes.
export const authenticate: CodingAgentService['authenticate'] = async (
  agentId,
) => {
  try {
    await AgentSignIn(agentId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

// API-key sign-in: stores the key in Go, injected as ANTHROPIC_API_KEY at the next agent start.
export const listProviders: CodingAgentService['listProviders'] = async (
  agentId,
) => (await AgentProviders(agentId)) ?? [];

export const listProviderCredentials: CodingAgentService['listProviderCredentials'] =
  async (agentId) => (await AgentProviderCredentials(agentId)) ?? [];

export const setProviderKey: CodingAgentService['setProviderKey'] = async (
  agentId,
  providerId,
  apiKey,
) => {
  try {
    const verified = await AgentSetProviderKey(agentId, providerId, apiKey);
    return { ok: true, verified };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

export const deleteProviderKey: CodingAgentService['deleteProviderKey'] =
  async (agentId, providerId) => {
    await AgentDeleteProviderKey(agentId, providerId);
  };

// OpenCode's own login for a provider signed in to rather than keyed; its code arrives through onProviderSignIn.
export const signInProvider: CodingAgentService['signInProvider'] = async (
  agentId,
  providerId,
) => {
  try {
    await AgentProviderSignIn(agentId, providerId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

export const cancelProviderSignIn: CodingAgentService['cancelProviderSignIn'] =
  async (agentId) => {
    await AgentCancelProviderSignIn(agentId);
  };

export const onProviderSignIn: CodingAgentService['onProviderSignIn'] = (
  handler,
) =>
  EventsOn('agent:provider-sign-in', (prompt: ProviderSignInPrompt) =>
    handler(prompt),
  );

export const currentAgent: CodingAgentService['currentAgent'] = async () =>
  (await AgentCurrent()) as AgentId;

export const connectWithoutKey: CodingAgentService['connectWithoutKey'] =
  async (agentId) => {
    await AgentConnectWithoutCredential(agentId);
  };

export const authenticateApiKey: CodingAgentService['authenticateApiKey'] =
  async (agentId, apiKey) => {
    try {
      await AgentSignInApiKey(agentId, apiKey);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

// Feeds the pasted token to the login CLI still running from authenticate(); rejects if it wants another.
export const submitLoginToken: CodingAgentService['submitLoginToken'] = async (
  agentId,
  token,
) => {
  await AgentSubmitLoginToken(agentId, token);
};

// Aborts a sign-in the user walked away from, so the login CLI doesn't outlive the flow.
export const cancelLogin: CodingAgentService['cancelLogin'] = async (
  agentId,
) => {
  await AgentCancelLogin(agentId);
};

// Disconnect signs the agent out in Go (stops it, drops the API key, removes the persisted credential), so getAuthStatus then reports not-authenticated.
export const disconnect: CodingAgentService['disconnect'] = async (agentId) => {
  await AgentDisconnect(agentId);
};

// Records the default agent for new sessions; reflected back via getAuthStatus.isDefault.
export const setDefaultAgent: CodingAgentService['setDefaultAgent'] = async (
  agentId,
) => {
  await AgentSetDefault(agentId);
};

// Models are advertised per-session (ACP config options), so they're read from getSessionState.
export const listModels: CodingAgentService['listModels'] = async (): Promise<
  AgentModel[]
> => [];

// The reply echoes the request id + the user's picks; Go resolves the blocked ACP elicitation with it.
export const choicesReply: CodingAgentService['choicesReply'] = (
  requestId,
  submission,
) => {
  AgentChoicesReply(requestId, new agent.ChoiceSubmission(submission)).catch(
    (e) => console.error('choicesReply failed', e),
  );
};

// Editor integration lives outside the agent; not wired in this pass.
export const applyToEditor: CodingAgentService['applyToEditor'] = async () => {
  console.warn('applyToEditor is not wired yet');
};

export const openAgentFile: CodingAgentService['openAgentFile'] = async (
  path,
) => {
  // AgentResolveFile rejects if the path isn't a checked-out app file or the board changed — the caller shows it.
  const loc = await AgentResolveFile(path);
  // Lazy: app-lab instantiates the serial-monitor Worker at import, which breaks the Worker-less test env.
  const { openAppFileInEditor } = await import(
    '@cloud-editor-mono/core-ui/app-lab'
  );
  await openAppFileInEditor(loc.appId, loc.file);
};
