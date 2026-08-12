import { useEffect, useRef, useState } from 'react';

import { AgentMode, AgentModel } from '../../../services';

// ACP advertises only aliases; the resolved version is in the option description ("Version · tagline").
// Show "name — version" — cut at the first " · "-style separator (glyph-agnostic: any " <punct> ").
export const modelLabel = (model: AgentModel): string => {
  const version = model.description?.split(/\s[^\w\s]+\s/)[0]?.trim();
  return version ? `${model.name} — ${version}` : model.name;
};

export type OpenPicker = 'mode' | 'model' | null;

interface ChatInputLogicParams {
  isStreaming: boolean;
  // False until a session is open; sending would be a no-op, so Enter must keep the draft.
  hasSession: boolean;
  onSend: (text: string) => void;
  models: AgentModel[];
  currentModelId?: string;
  modes: AgentMode[];
  currentModeId?: string;
}

export interface ChatInputLogic {
  draft: string;
  setDraft: (value: string) => void;
  openPicker: OpenPicker;
  togglePicker: (picker: 'mode' | 'model') => void;
  closePicker: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  toolbarPickersRef: React.RefObject<HTMLDivElement>;
  onComposerKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  submit: VoidFunction;
  canSend: boolean;
  selectedMode?: AgentMode;
  selectedModel?: AgentModel;
}

export const useChatInputLogic = ({
  isStreaming,
  hasSession,
  onSend,
  models,
  currentModelId,
  modes,
  currentModeId,
}: ChatInputLogicParams): ChatInputLogic => {
  const [draft, setDraft] = useState('');
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const toolbarPickersRef = useRef<HTMLDivElement>(null);

  // Grow the input with its content up to the CSS max-height, then scroll.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) {
      return;
    }

    const resize = (): void => {
      if (el.scrollHeight === 0) {
        return;
      }

      el.style.height = 'auto';
      const height = el.scrollHeight;
      el.style.height = `${height}px`;

      const maxHeight = parseFloat(getComputedStyle(el).maxHeight);
      el.style.overflowY =
        Number.isFinite(maxHeight) && height > maxHeight ? 'auto' : 'hidden';
    };

    resize();

    // Re-measure when the field gains (or changes) layout: display:none → visible, panel resize.
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return (): void => observer.disconnect();
  }, [draft]);

  // Close an open picker on outside-click / Escape.
  useEffect(() => {
    if (!openPicker) {
      return;
    }

    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (!toolbarPickersRef.current?.contains(target)) {
        setOpenPicker(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpenPicker(null);
      }
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return (): void => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openPicker]);

  // Sending is gated on the turn being idle so a new prompt can't start
  // mid-turn (and the draft survives). Shared by Enter and the send button.
  const canSend = !isStreaming && hasSession && draft.trim() !== '';
  const submit = (): void => {
    if (!canSend) {
      return;
    }
    onSend(draft);
    setDraft('');
  };

  const onComposerKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ): void => {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const togglePicker = (picker: 'mode' | 'model'): void =>
    setOpenPicker((prev) => (prev === picker ? null : picker));
  const closePicker = (): void => setOpenPicker(null);

  const selectedMode =
    modes.find((mode) => mode.id === currentModeId) ?? modes[0];
  const selectedModel =
    models.find((model) => model.id === currentModelId) ?? models[0];

  return {
    draft,
    setDraft,
    openPicker,
    togglePicker,
    closePicker,
    inputRef,
    toolbarPickersRef,
    onComposerKeyDown,
    submit,
    canSend,
    selectedMode,
    selectedModel,
  };
};
