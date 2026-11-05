import { ChatMessage, MessagePart, useChatStore } from '../../../store';
import { useElapsedSeconds, useTypewriter } from '../../../utils';
import { visibleParts } from '../utils/visibleParts';
import {
  type MessageSegment,
  messageSegments,
  withoutTransportError,
} from './utils/messageSegments';

interface MessageLogicParams {
  message: ChatMessage;
  // The session this panel displays, not the shared pointer: leaving Agent Mode nulls that one and an
  // answered choice would count as pending again.
  sessionId: string | null;
  // The active turn: show live activity; once settled it's curated.
  streaming: boolean;
  // Epoch ms the turn started, for the elapsed-time counter.
  turnStartedAt?: number;
}

export interface MessageLogic {
  // The parts the turn actually shows, and the ordered render blocks built from them.
  parts: MessagePart[];
  segments: MessageSegment[];
  // The trailing text run is the live one: render `revealedTail` for it instead of its own text.
  revealTail: boolean;
  revealedTail: string;
  showLoader: boolean;
  // The turn is parked on a permission prompt, so the loader must say so instead of naming a tool's phase.
  awaitingApproval: boolean;
  elapsedSeconds: number;
  // A user turn is either echoed choice answers or plain text; both are empty on an assistant turn.
  choiceAnswers: Extract<MessagePart, { type: 'choice-answer' }>[];
  userText: string;
}

export const useMessageLogic = ({
  message,
  sessionId,
  streaming,
  turnStartedAt,
}: MessageLogicParams): MessageLogic => {
  // A pending (unresolved) choice suppresses the live loader — the turn is waiting on
  // the user. The choice UI itself renders in the composer via PendingChoices, not here.
  const resolvedChoiceIds = useChatStore((s) =>
    sessionId ? s.threads[sessionId]?.resolvedChoiceIds : undefined,
  );

  const awaitingApproval = useChatStore((s) =>
    Boolean(sessionId && s.threads[sessionId]?.pendingPermission),
  );

  // Ordered render blocks — narration, activity, plans and choices in the order the agent
  // produced them, so nothing written before/between tools is dropped or flashes away.
  const parts = visibleParts(
    message.errorKind === 'network'
      ? withoutTransportError(message.parts)
      : message.parts,
  );
  const segments = messageSegments(parts);
  const lastSegment = segments[segments.length - 1];
  const tailKind = lastSegment?.kind;

  const pendingChoices = segments
    .filter(
      (s): s is Extract<MessageSegment, { kind: 'choices' }> =>
        s.kind === 'choices',
    )
    .flatMap((s) => s.choices)
    .filter((q) => !(resolvedChoiceIds ?? []).includes(q.id));

  // The live loader shows while the agent is working with nothing live at the tail (the tail is not
  // answer text). A pending choice suppresses it — the turn is waiting on the user.
  const showLoader =
    streaming && tailKind !== 'text' && pendingChoices.length === 0;
  // Only the trailing text run is "live": stream it with the typewriter; earlier runs are settled.
  const revealTail = streaming && tailKind === 'text';
  const tailText = revealTail
    ? (lastSegment as Extract<MessageSegment, { kind: 'text' }>).text
    : '';
  const revealedTail = useTypewriter(tailText, streaming, revealTail);
  const elapsedSeconds = useElapsedSeconds(
    showLoader,
    streaming ? turnStartedAt : undefined,
  );

  // Choice answers are echoed as their own user turn, so a user message carries either those
  // or plain text.
  const choiceAnswers = message.parts.filter(
    (part): part is Extract<MessagePart, { type: 'choice-answer' }> =>
      part.type === 'choice-answer',
  );
  const userText = message.parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');

  return {
    parts,
    segments,
    revealTail,
    revealedTail,
    showLoader,
    awaitingApproval,
    elapsedSeconds,
    choiceAnswers,
    userText,
  };
};
