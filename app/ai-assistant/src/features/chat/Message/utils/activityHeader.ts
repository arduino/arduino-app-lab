import { type FormatMessage } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { type IntlShape, type MessageDescriptor } from 'react-intl';

import { messages } from '../../../../messages';
import { MessagePart } from '../../../../store';
import { formatToolTitle } from '../../../../ui';
import { type ToolCallData, toolCalls } from './messageSegments';

// Per ACP tool kind: the counted action (alone, or first in the summary), the same after another phrase, and the verb a row puts before its one file.
export const KIND_PHRASE: Record<
  string,
  { count: MessageDescriptor; next: MessageDescriptor; verb: MessageDescriptor }
> = {
  read: {
    count: messages.chatActionRead,
    next: messages.chatActionReadNext,
    verb: messages.chatFileRead,
  },
  edit: {
    count: messages.chatActionEdited,
    next: messages.chatActionEditedNext,
    verb: messages.chatFileEdited,
  },
  delete: {
    count: messages.chatActionDeleted,
    next: messages.chatActionDeletedNext,
    verb: messages.chatFileDeleted,
  },
  move: {
    count: messages.chatActionMoved,
    next: messages.chatActionMovedNext,
    verb: messages.chatFileMoved,
  },
  execute: {
    count: messages.chatActionRanCommands,
    next: messages.chatActionRanCommandsNext,
    verb: messages.chatFileRan,
  },
  search: {
    count: messages.chatActionRanSearches,
    next: messages.chatActionRanSearchesNext,
    verb: messages.chatFileRan,
  },
  fetch: {
    count: messages.chatActionFetched,
    next: messages.chatActionFetchedNext,
    verb: messages.chatFileFetched,
  },
  think: {
    count: messages.chatActionRanTasks,
    next: messages.chatActionRanTasksNext,
    verb: messages.chatFileRan,
  },
};

// The narrow "and" list: commas alone in English ("Read 3 files, ran 2 commands"), the locale's own separators elsewhere.
const SUMMARY_LIST = { type: 'conjunction', style: 'narrow' } as const;

// Phase shown by the live loader while streaming, from the active tool (or thinking otherwise).
const PHASE_BY_KIND: Record<string, MessageDescriptor> = {
  read: messages.chatPhaseReading,
  edit: messages.chatPhaseEditing,
  delete: messages.chatPhaseEditing,
  move: messages.chatPhaseEditing,
  execute: messages.chatPhaseRunning,
  search: messages.chatPhaseSearching,
  fetch: messages.chatPhaseFetching,
  think: messages.chatThinking,
};

// Rotated every 20s while the agent is just reasoning, so a long wait feels alive.
const THINKING_PHRASES = [
  messages.chatThinking,
  messages.chatThinkingWorking,
  messages.chatThinkingReasoning,
  messages.chatThinkingConnecting,
  messages.chatThinkingAlmost,
];

/** Human summary of a block's tool calls, grouped by kind in first-seen order ("Read 3 files, ran 2 commands"). */
const summarizeActions = (
  tools: ToolCallData[],
  formatMessage: FormatMessage,
  formatList?: IntlShape['formatList'],
): string => {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const t of tools) {
    if (!counts.has(t.kind)) {
      order.push(t.kind);
    }
    counts.set(t.kind, (counts.get(t.kind) ?? 0) + 1);
  }
  const phrases = order.map((kind, i) => {
    const phrase = KIND_PHRASE[kind];
    return formatMessage(
      (i === 0 ? phrase?.count : phrase?.next) ?? messages.chatActionSteps,
      { count: counts.get(kind) ?? 0 },
    );
  });
  // Older WebKit has no Intl.ListFormat: react-intl's formatList then returns no text.
  if (!('ListFormat' in Intl)) {
    return phrases.join(', ');
  }
  return formatList
    ? formatList(phrases, SUMMARY_LIST)
    : new Intl.ListFormat('en', SUMMARY_LIST).format(phrases);
};

/**
 * Header summary for an activity block: the current action while streaming, else a human summary of what
 * it did ("Read 3 files, ran 2 commands") — or the caller's generic used-tools label when it was a single
 * tool (its name shows on expand).
 */
export const activityHeader = (
  parts: MessagePart[],
  // The caller's: this builder has no intl of its own.
  formatMessage: FormatMessage,
  // A turn that has ended runs nothing, whatever a call the engine never closed still says.
  live = true,
  // The provider's, for the locale's way of listing the phrases; without a provider, English.
  formatList?: IntlShape['formatList'],
): string => {
  const usedTools = (count: number): string =>
    formatMessage(messages.chatUsedTools, { count });
  const tools = toolCalls(parts);
  if (tools.length === 0) {
    return formatMessage(messages.chatThinking);
  }
  // Single tool: always the generic label (even while pending), so it doesn't flip from the bare name once settled.
  if (tools.length === 1) {
    return usedTools(1);
  }
  const active =
    live &&
    tools.find((t) => t.status === 'pending' || t.status === 'in_progress');
  if (active) {
    return `${formatToolTitle(active.title)}…`;
  }
  // Only what ran: a call left 'failed', which is where a denied permission lands, would read as work done.
  const completed = tools.filter((t) => t.status === 'completed');
  return completed.length > 0
    ? summarizeActions(completed, formatMessage, formatList)
    : usedTools(tools.length);
};

/** Label for the live loader: the active tool's phase, else a rotating "thinking" phrase by elapsed time. */
export const currentPhase = (
  parts: MessagePart[],
  elapsedSeconds: number,
  formatMessage: FormatMessage,
): string => {
  const active = toolCalls(parts).find(
    (t) => t.status === 'pending' || t.status === 'in_progress',
  );
  if (active) {
    return formatMessage(PHASE_BY_KIND[active.kind] ?? messages.chatThinking);
  }
  const idx = Math.min(
    THINKING_PHRASES.length - 1,
    Math.floor(elapsedSeconds / 20),
  );
  return formatMessage(THINKING_PHRASES[idx]);
};
