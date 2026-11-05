import type { MessageDescriptor } from 'react-intl';

import { messages } from '../../../../messages';
import {
  PermissionOption,
  PermissionOptionKind,
  PermissionRequest,
} from '../../../../services';
import {
  type PromptActionRole,
  formatToolTitle,
  mcpToolName,
  webToolLabel,
} from '../../../../ui';

// Advanced permission-mode options the ExitPlanMode approval over-exposes; Claude Code surfaces a single "Yes, and …", so we hide these for a clean plan-approval.
const PLAN_ADVANCED_OPTION_IDS = new Set([
  'exit-plan-bypass',
  'exit-plan-clear-bypass',
  'exit-plan-auto',
  'exit-plan-clear-auto',
]);

// One button of the permission prompt. `label` is the agent's own text, set only when ours would
// collide; the caller renders it in preference to formatting `labelMessage`.
export interface PermissionAction {
  id: string;
  label?: string;
  labelMessage: MessageDescriptor;
  role: PromptActionRole;
}

// Everything the permission prompt displays, resolved from the request in one place.
export interface PermissionView {
  // Plan-mode approval: the card is reframed and the plan itself renders in the thread, so no command.
  planApproval: boolean;
  command?: string;
  reason?: string;
  // The call writes into another app: the host resolved it, so the badge and the refusal to auto-approve agree.
  outsideWorkspace: boolean;
  outsideApp?: string; // which app, when the host could name it
  actions: PermissionAction[];
}

const asString = (v: unknown): string =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : '';

// What a tool acts on (app name, brick, library…), pulled from its arguments, so the dialog reads
// "Start app: Blink Demo" instead of a bare "Start app". `_targetName` is the app's display name resolved
// by the backend (falls back to the raw id when unavailable). Empty for tools with no such target.
const permissionTarget = (input: unknown, tool: string | null): string => {
  if (!input || typeof input !== 'object') {
    return '';
  }
  const o = input as Record<string, unknown>;
  const primary =
    asString(o._targetName) ||
    asString(o.id) ||
    asString(o.appID) ||
    asString(o.name);
  // apps_edit renames through `name`: the user approves the name the app gets, not only the one it has.
  const renamedTo = tool === 'apps_edit' ? asString(o.name) : '';
  if (primary && renamedTo && renamedTo !== primary) {
    return `${primary} → ${renamedTo}`;
  }
  const from = asString(o.from);
  const to = asString(o.to);
  // Only with an app named: Grep and Glob carry a `path` of their own.
  const file = from && to ? `${from} → ${to}` : primary ? asString(o.path) : '';
  const detail = asString(o.brickID) || asString(o.library) || file;
  return primary && detail ? `${primary} · ${detail}` : primary || detail;
};

// What the permission is about: Bash/exec tools carry the command in rawInput.command; otherwise show the
// tool label plus its target (the app/example it acts on), so "Start app" is never shown without context.
const permissionCommand = (toolCall: {
  title: string;
  kind?: string;
  input?: unknown;
}): string => {
  const input = toolCall.input;
  // Web search/fetch read as an action, not a shell command (e.g. "Search the web: nano r4").
  const web = webToolLabel(toolCall.kind, input);
  if (web) {
    return web;
  }

  if (
    input &&
    typeof input === 'object' &&
    'command' in input &&
    typeof (input as { command: unknown }).command === 'string'
  ) {
    return (input as { command: string }).command;
  }

  const label = formatToolTitle(toolCall.title);
  const target = permissionTarget(input, mcpToolName(toolCall.title));
  return target ? `${label}: ${target}` : label;
};

// The board_exec `reason` arg, shown beneath the command so the user sees why it's being run.
const permissionReason = (toolCall: { input?: unknown }): string => {
  const input = toolCall.input;
  if (
    input &&
    typeof input === 'object' &&
    'reason' in input &&
    typeof (input as { reason: unknown }).reason === 'string'
  ) {
    return (input as { reason: string }).reason;
  }

  return '';
};

// The plan-mode approval (ExitPlanMode, ACP kind "switch_mode"): reframed as a plan-approval, not a raw permission prompt (the plan renders as a persistent block in the thread).
const isPlanApproval = (request?: PermissionRequest): boolean =>
  request?.toolCall?.kind === 'switch_mode';

// The options to show for a permission request; board_exec's "always" options are already dropped in Go (toPermissionRequest), so only the plan approval filters here: it hides the advanced permission-mode options to read as a clean plan-approval.
const visiblePermissionOptions = (
  request?: PermissionRequest,
): PermissionOption[] => {
  if (!request) {
    return [];
  }

  if (isPlanApproval(request)) {
    return request.options.filter((o) => !PLAN_ADVANCED_OPTION_IDS.has(o.id));
  }

  return request.options;
};

// Several options sharing a kind (plan mode) would collide under our concise by-kind labels, so the caller falls back to the agent's own labels when kinds repeat.
const hasDuplicatePermissionKinds = (options: PermissionOption[]): boolean =>
  new Set(options.map((o) => o.kind)).size !== options.length;

// Our own concise label per option kind — the agent's option.label repeats the whole command.
const permissionActionLabel = (
  kind: PermissionOptionKind,
): MessageDescriptor => {
  if (kind === 'allow_always') {
    return messages.permAllowAlways;
  }

  if (kind.startsWith('reject')) {
    return messages.permReject;
  }

  return messages.permAllowOnce;
};

const permissionActionRole = (kind: PermissionOptionKind): PromptActionRole => {
  if (kind.startsWith('reject')) {
    return 'cancel';
  }

  if (kind === 'allow_once') {
    return 'primary';
  }

  return 'secondary';
};

export const permissionView = (request: PermissionRequest): PermissionView => {
  const planApproval = isPlanApproval(request);
  const options = visiblePermissionOptions(request);
  // Concise by-kind labels normally; when several options share a kind (plan mode) they would collide,
  // so those actions carry the agent's own label instead.
  const agentLabels = planApproval || hasDuplicatePermissionKinds(options);
  const toolCall = planApproval ? undefined : request.toolCall;

  return {
    planApproval,
    outsideWorkspace: !!toolCall?.outsideWorkspace,
    outsideApp: toolCall?.outsideApp,
    command: toolCall && permissionCommand(toolCall),
    reason: (toolCall && permissionReason(toolCall)) || undefined,
    actions: options.map((option) => ({
      id: option.id,
      label: agentLabels ? option.label : undefined,
      labelMessage: permissionActionLabel(option.kind),
      role: permissionActionRole(option.kind),
    })),
  };
};
