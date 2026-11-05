import { MessagePart } from '../../../store';

// Claude Code's internal plumbing tools, not user-facing actions: ToolSearch (deferred-tool loader)
// and ScheduleWakeup (the agent's self-pacing wait between polls, e.g. while a slow app start boots).
const INTERNAL_TOOL_TITLES = new Set(['ToolSearch', 'ScheduleWakeup']);

// OpenCode's todo list call, which the host also sends as the checklist the thread shows; replayed, it is titled "N todos".
const OPENCODE_TODO_TITLE = /^(?:todowrite|\d+ todos?)$/;

/** Message parts minus internal plumbing tool calls (deferred-tool loading), before rendering. */
export const visibleParts = (parts: MessagePart[]): MessagePart[] =>
  parts.filter(
    (part) =>
      !(
        part.type === 'tool_call' &&
        (INTERNAL_TOOL_TITLES.has(part.toolCall.title) ||
          OPENCODE_TODO_TITLE.test(part.toolCall.title))
      ),
  );
