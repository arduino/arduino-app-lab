import {
  AgentMode,
  AgentModel,
  AgentRestart,
  AgentUpdate,
  Checklist,
  ChecklistItem,
  ChecklistItemStatus,
  ChoiceOption,
  ChoiceRequest,
  PermissionOption,
  PermissionRequest,
  SessionState,
  SessionSummary,
  ToolCall,
  ToolCallStatus,
} from '@cloud-editor-mono/ai-assistant';

// JSON shapes the Go agent emits over Wails events; mapping to the reconciled contract is a typed pass-through.
export interface WireToolCall {
  id: string;
  title: string;
  kind?: string;
  status?: string;
  input?: unknown;
  output?: string;
}

export interface WireUpdate {
  type: string;
  delta?: string;
  toolCall?: WireToolCall;
  id?: string;
  status?: string;
  input?: unknown;
  output?: string;
  checklist?: WireChecklist;
  choices?: WireChoiceRequest;
  modelId?: string;
  models?: WireAgentModel[];
  modeId?: string;
  usedTokens?: number;
  contextSize?: number;
}

export interface WireChecklistItem {
  label: string;
  status: string;
}

export interface WireChecklist {
  id: string;
  title: string;
  items: WireChecklistItem[];
}

export interface WireChoiceOption {
  id: string;
  label: string;
  description?: string;
}

export interface WireChoiceRequest {
  id: string;
  title: string;
  options?: WireChoiceOption[];
  multiple?: boolean;
  allowOther?: boolean;
  batchId?: string;
  total?: number;
}

export interface WirePermissionOption {
  id: string;
  label: string;
  kind: string;
}

export interface WirePermissionRequest {
  id: string;
  sessionId: string;
  toolCall?: WireToolCall;
  options?: WirePermissionOption[];
  timeoutMs?: number;
}

export interface WireAgentModel {
  id: string;
  name: string;
  description?: string;
}

export interface WireAgentMode {
  id: string;
  name: string;
  description?: string;
}

export interface WireSessionSummary {
  id: string;
  title?: string;
  updatedAt?: string;
  status?: string;
  pinned?: boolean;
}

// agent.RestartInfo, whose json tags pin these names. Its crash cause stays host-side (an error
// interface carries nothing useful over the wire), so there is no reason to report here.
export interface WireRestart {
  attempt?: number;
  max?: number;
  gaveUp?: boolean;
  reason?: string;
}

export interface WireSessionState {
  sessionId: string;
  status?: string;
  modelId?: string;
  models?: WireAgentModel[];
  modeId?: string;
  modes?: WireAgentMode[];
  pendingPermission?: WirePermissionRequest;
}

const TOOL_STATUSES: ToolCallStatus[] = [
  'pending',
  'in_progress',
  'completed',
  'failed',
];

// The contract requires a status, so default an absent/unknown one to 'pending'.
const toToolStatus = (s?: string): ToolCallStatus =>
  TOOL_STATUSES.includes(s as ToolCallStatus)
    ? (s as ToolCallStatus)
    : 'pending';

const toToolCall = (tc: WireToolCall): ToolCall => ({
  id: tc.id,
  title: tc.title,
  kind: tc.kind ?? '',
  status: toToolStatus(tc.status),
  ...(tc.input !== undefined ? { input: tc.input } : {}),
  ...(tc.output !== undefined ? { output: tc.output } : {}),
});

// Returns null for update kinds the FE contract doesn't model (skipped upstream).
export const mapUpdate = (u: WireUpdate): AgentUpdate | null => {
  switch (u.type) {
    case 'message_chunk':
      return { type: 'message_chunk', delta: u.delta ?? '' };
    case 'thinking':
      return { type: 'thinking', delta: u.delta ?? '' };
    case 'tool_call':
      return u.toolCall
        ? { type: 'tool_call', toolCall: toToolCall(u.toolCall) }
        : null;
    case 'tool_call_update':
      return {
        type: 'tool_call_update',
        id: u.id ?? '',
        status: toToolStatus(u.status),
        ...(u.input !== undefined ? { input: u.input } : {}),
        ...(u.output !== undefined ? { output: u.output } : {}),
      };
    case 'checklist':
      return u.checklist
        ? { type: 'checklist', checklist: mapChecklist(u.checklist) }
        : null;
    case 'choices':
      return u.choices
        ? { type: 'choices', choices: mapChoiceRequest(u.choices) }
        : null;
    case 'model_change':
      return {
        type: 'model_change',
        ...(u.modelId !== undefined ? { modelId: u.modelId } : {}),
        models: (u.models ?? []).map(mapModel),
      };
    case 'mode_change':
      return {
        type: 'mode_change',
        ...(u.modeId !== undefined ? { modeId: u.modeId } : {}),
      };
    case 'usage':
      return {
        type: 'usage',
        usedTokens: u.usedTokens ?? 0,
        contextSize: u.contextSize ?? 0,
      };
    case 'user_message':
      return { type: 'user_message', delta: u.delta ?? '' };
    default:
      return null;
  }
};

// Pass-through: options and the tool-call carry straight to the UI; the reply echoes the chosen id.
export const mapPermissionRequest = (
  req: WirePermissionRequest,
): PermissionRequest => ({
  id: req.id,
  sessionId: req.sessionId,
  ...(req.toolCall ? { toolCall: toToolCall(req.toolCall) } : {}),
  options: (req.options ?? []).map(
    (o): PermissionOption => ({
      id: o.id,
      label: o.label,
      kind: o.kind as PermissionOption['kind'],
    }),
  ),
  ...(req.timeoutMs !== undefined ? { timeoutMs: req.timeoutMs } : {}),
});

export const mapRestart = (r: WireRestart): AgentRestart => ({
  attempt: r.attempt ?? 0,
  max: r.max ?? 0,
  gaveUp: r.gaveUp ?? false,
  ...(r.reason ? { reason: r.reason } : {}),
});

const mapModel = (m: WireAgentModel): AgentModel => ({
  id: m.id,
  name: m.name,
  ...(m.description ? { description: m.description } : {}),
});

const mapMode = (m: WireAgentMode): AgentMode => ({
  id: m.id,
  name: m.name,
  ...(m.description ? { description: m.description } : {}),
});

export const mapSessionSummary = (s: WireSessionSummary): SessionSummary => ({
  id: s.id,
  ...(s.title ? { title: s.title } : {}),
  ...(s.updatedAt ? { updatedAt: s.updatedAt } : {}),
  ...(s.status === 'error' || s.status === 'running'
    ? { status: s.status }
    : {}),
  ...(s.pinned ? { pinned: true } : {}),
});

const CHECKLIST_STATUSES: ChecklistItemStatus[] = [
  'pending',
  'in_progress',
  'completed',
];

const toChecklistStatus = (s: string): ChecklistItemStatus =>
  CHECKLIST_STATUSES.includes(s as ChecklistItemStatus)
    ? (s as ChecklistItemStatus)
    : 'pending';

const mapChecklist = (c: WireChecklist): Checklist => ({
  id: c.id,
  title: c.title,
  items: c.items.map(
    (i): ChecklistItem => ({
      label: i.label,
      status: toChecklistStatus(i.status),
    }),
  ),
});

const mapChoiceRequest = (c: WireChoiceRequest): ChoiceRequest => ({
  id: c.id,
  title: c.title,
  options: (c.options ?? []).map(
    (o): ChoiceOption => ({
      id: o.id,
      label: o.label,
      ...(o.description ? { description: o.description } : {}),
    }),
  ),
  ...(c.multiple ? { multiple: true } : {}),
  ...(c.allowOther ? { allowOther: true } : {}),
  ...(c.batchId ? { batchId: c.batchId } : {}),
  ...(c.total ? { total: c.total } : {}),
});

export const mapSessionState = (s: WireSessionState): SessionState => ({
  sessionId: s.sessionId,
  status: s.status === 'streaming' ? 'streaming' : 'idle',
  ...(s.modelId !== undefined ? { modelId: s.modelId } : {}),
  ...(s.models ? { models: s.models.map(mapModel) } : {}),
  ...(s.modeId !== undefined ? { modeId: s.modeId } : {}),
  ...(s.modes ? { modes: s.modes.map(mapMode) } : {}),
  ...(s.pendingPermission
    ? { pendingPermission: mapPermissionRequest(s.pendingPermission) }
    : {}),
});
