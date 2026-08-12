import {
  AgentDescriptor,
  AgentId,
  AgentModel,
  AuthMethod,
  AuthStatus,
  CodingAgentService,
} from '@cloud-editor-mono/ai-assistant';

import {
  AgentAuthStatus,
  AgentCancel,
  AgentCancelLogin,
  AgentChoicesReply,
  AgentCloseSession,
  AgentDeleteSession,
  AgentDisconnect,
  AgentGetSessionState,
  AgentListSessions,
  AgentLoadSession,
  AgentNewSession,
  AgentPermissionReply,
  AgentPinSession,
  AgentPrompt,
  AgentRenameSession,
  AgentResolveFile,
  AgentSetDefault,
  AgentSetSessionMode,
  AgentSetSessionModel,
  AgentSignIn,
  AgentSignInApiKey,
  AgentStart,
  AgentStop,
  AgentSubmitLoginToken,
  AgentValidateAuth,
} from '../../wailsjs/go/app/App';
import { agent } from '../../wailsjs/go/models';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import {
  mapPermissionRequest,
  mapRestart,
  mapSessionState,
  mapSessionSummary,
  mapUpdate,
  WirePermissionRequest,
  WireRestart,
  WireUpdate,
} from './codingAgentService.mapper';

// Claude is the only live agent (backed by the Wails runtime + ACP). Codex and
// OpenCode are surfaced as disabled "coming soon" cards until their auth flows land.
const AGENTS: AgentDescriptor[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    description: 'Use your Claude Pro/Max account or an Anthropic API key',
    provider: 'Anthropic',
    apiKeyPrefix: 'sk-ant-',
    apiKeyUrl: 'https://platform.claude.com/login?returnTo=%2Fsettings%2Fkeys',
    preview: true,
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'Use your ChatGPT Plus/Pro account or an OpenAI API key',
    provider: 'OpenAI',
    apiKeyPrefix: 'sk-',
    comingSoon: true,
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Open-source coding agent · bring your own model & API key',
    provider: 'OpenCode',
    apiKeyPrefix: '',
    comingSoon: true,
  },
];

export const start: CodingAgentService['start'] = async (agentId) => {
  await AgentStart(agentId);
};

export const validateAuth: CodingAgentService['validateAuth'] = async () => {
  await AgentValidateAuth();
};

export const stop: CodingAgentService['stop'] = async () => {
  await AgentStop();
};

export const listAgents: CodingAgentService['listAgents'] = () =>
  AGENTS.map((a) => ({ ...a }));

export const newSession: CodingAgentService['newSession'] = async (appId) =>
  AgentNewSession(appId ?? '');

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

export const prompt: CodingAgentService['prompt'] = async (sessionId, text) => {
  await AgentPrompt(sessionId, text);
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

// Reports a persisted subscription login (or an API key set this session) so a returning user skips connect.
export const getAuthStatus: CodingAgentService['getAuthStatus'] =
  async (): Promise<AuthStatus> => {
    try {
      const status = await AgentAuthStatus('claude');
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
