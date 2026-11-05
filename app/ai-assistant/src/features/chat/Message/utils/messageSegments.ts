import { type FormatMessage } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { messages } from '../../../../messages';
import { isNetworkError } from '../../../../services';
import { MessagePart } from '../../../../store';

export type ToolCallData = Extract<
  MessagePart,
  { type: 'tool_call' }
>['toolCall'];

/**
 * Drops the transport error the agent narrates when its own request dies ("API Error: Connection
 * closed mid-response…"): the composer banner already reports that failure, localized, so the
 * turn keeps only what it managed to answer. Applied on a network failure alone — with no banner
 * to speak for it, the agent's line is the only account the user gets.
 */
export const withoutTransportError = (parts: MessagePart[]): MessagePart[] => {
  const last = parts[parts.length - 1];
  if (last?.type !== 'text') {
    return parts;
  }
  const blocks = last.text.split(/\n{2,}/);
  if (!isNetworkError(blocks[blocks.length - 1])) {
    return parts;
  }
  const text = blocks.slice(0, -1).join('\n\n').trimEnd();
  return text ? [...parts.slice(0, -1), { ...last, text }] : parts.slice(0, -1);
};

export const toolCalls = (parts: MessagePart[]): ToolCallData[] =>
  parts
    .filter(
      (p): p is Extract<MessagePart, { type: 'tool_call' }> =>
        p.type === 'tool_call',
    )
    .map((p) => p.toolCall);

/** Merges a run's reasoning chunks into one string, so the block shows a single accordion, not a stack. */
export const mergeThinking = (parts: MessagePart[]): string =>
  parts
    .filter(
      (p): p is Extract<MessagePart, { type: 'thinking' }> =>
        p.type === 'thinking',
    )
    .map((p) => p.text)
    .join('\n\n');

// "Thought for Xs" from a thinking block's span; "Thought" when timing is unavailable (e.g. replayed history).
export const thoughtLabel = (
  formatMessage: FormatMessage,
  start?: number,
  end?: number,
): string => {
  if (start === undefined || end === undefined) {
    return formatMessage(messages.chatThought);
  }
  return formatMessage(messages.chatThoughtFor, {
    seconds: Math.max(1, Math.round((end - start) / 1000)),
  });
};

// Min-start / max-end timestamps across a block's thinking parts, for the duration.
export const thinkingSpan = (
  parts: MessagePart[],
): { start?: number; end?: number } => {
  let start: number | undefined;
  let end: number | undefined;
  for (const p of parts) {
    if (p.type !== 'thinking') {
      continue;
    }
    if (p.startedAt !== undefined) {
      start = start === undefined ? p.startedAt : Math.min(start, p.startedAt);
    }
    if (p.endedAt !== undefined) {
      end = end === undefined ? p.endedAt : Math.max(end, p.endedAt);
    }
  }
  return { start, end };
};

/**
 * One render block of a turn, in the order the agent produced it. `activity` is a maximal run of
 * thinking+tool parts (rendered as one Timeline/Thinking block); `text` is a prose run; `checklist`
 * and `choices` are their own cards.
 */
export type MessageSegment =
  | { kind: 'activity'; parts: MessagePart[] }
  | { kind: 'text'; text: string }
  | {
      kind: 'checklist';
      checklist: Extract<MessagePart, { type: 'checklist' }>['checklist'];
    }
  | {
      // One block per elicitation batch: the questions of a single AskUserQuestion, paged as a wizard.
      kind: 'choices';
      choices: Extract<MessagePart, { type: 'choices' }>['choices'][];
    }
  // ExitPlanMode's plan, rendered as a persistent block so it stays in the thread after the approval resolves.
  | { kind: 'plan'; plan: string };

// The plan markdown carried by an ExitPlanMode tool call (ACP kind "switch_mode"), or '' if absent.
const planFromToolCall = (toolCall: ToolCallData): string => {
  if (toolCall.kind !== 'switch_mode') {
    return '';
  }
  const input = toolCall.input;
  if (
    input &&
    typeof input === 'object' &&
    'plan' in input &&
    typeof (input as { plan: unknown }).plan === 'string'
  ) {
    return (input as { plan: string }).plan;
  }
  return '';
};

// The Write that stages ExitPlanMode's plan file (Claude Code's plans dir) is plumbing — the plan renders as its own block, so this write stays out of the timeline.
const isPlanStagingWrite = (toolCall: ToolCallData): boolean => {
  const input = toolCall.input;
  if (!input || typeof input !== 'object') {
    return false;
  }
  const fp = (input as { file_path?: unknown }).file_path;
  return typeof fp === 'string' && fp.includes('/plans/') && fp.endsWith('.md');
};

/**
 * Groups a turn's parts into ordered segments so narration renders in place: consecutive thinking+tool
 * parts collapse into one activity block, each text run its own block, checklists/choices their own
 * cards — all in agent order. Nothing is dropped (this replaced answerText, which kept only the text
 * after the last tool and so lost any narration written before or between tools).
 */
export const messageSegments = (parts: MessagePart[]): MessageSegment[] => {
  const segments: MessageSegment[] = [];
  let activity: MessagePart[] = [];

  const flushActivity = (): void => {
    if (activity.length > 0) {
      segments.push({ kind: 'activity', parts: activity });
      activity = [];
    }
  };

  for (const part of parts) {
    if (part.type === 'tool_call' && part.toolCall.kind === 'switch_mode') {
      // ExitPlanMode: pull the plan out as its own persistent block, never an activity row.
      const plan = planFromToolCall(part.toolCall);
      if (plan) {
        flushActivity();
        segments.push({ kind: 'plan', plan });
      }
      continue;
    }
    if (part.type === 'tool_call' && isPlanStagingWrite(part.toolCall)) {
      continue;
    }
    if (part.type === 'thinking' || part.type === 'tool_call') {
      activity.push(part);
      continue;
    }
    if (part.type === 'text') {
      // Merge consecutive text chunks (no activity between) into a single block.
      const last = segments[segments.length - 1];
      if (activity.length === 0 && last?.kind === 'text') {
        last.text += `\n\n${part.text}`;
      } else {
        flushActivity();
        segments.push({ kind: 'text', text: part.text });
      }
      continue;
    }
    if (part.type === 'checklist') {
      flushActivity();
      segments.push({ kind: 'checklist', checklist: part.checklist });
      continue;
    }
    if (part.type === 'choices') {
      // Group the questions of one AskUserQuestion (shared batchId) into a single paged block.
      const last = segments[segments.length - 1];
      if (
        activity.length === 0 &&
        last?.kind === 'choices' &&
        part.choices.batchId !== undefined &&
        last.choices[last.choices.length - 1].batchId === part.choices.batchId
      ) {
        last.choices.push(part.choices);
      } else {
        flushActivity();
        segments.push({ kind: 'choices', choices: [part.choices] });
      }
    }
  }
  flushActivity();

  return segments;
};

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

// A streaming reply splits at blank lines, except inside a code fence or before an indented line (a list item's continuation).
export const markdownBlocks = (text: string): string[] => {
  const lines = text.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let fence: string | undefined;
  lines.forEach((line, i) => {
    const marker = line.match(FENCE)?.[1];
    if (fence) {
      const closes =
        marker?.[0] === fence[0] &&
        marker.length >= fence.length &&
        line.trim() === marker;
      if (closes) {
        fence = undefined;
      }
    } else if (marker) {
      fence = marker;
    }
    const next = lines[i + 1];
    const splits =
      !fence &&
      line.trim() === '' &&
      current.length > 0 &&
      next !== undefined &&
      next.trim() !== '' &&
      !/^\s/.test(next);
    if (splits) {
      blocks.push(current.join('\n'));
      current = [];
      return;
    }
    current.push(line);
  });
  if (current.length > 0) {
    blocks.push(current.join('\n'));
  }
  return blocks;
};
