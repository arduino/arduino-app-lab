import { useEffect, useRef, useState } from 'react';

import { AgentMode, AgentModel } from '../../../services';

// ACP advertises only aliases; the resolved version is in the option description ("Version · tagline").
// Show "name — version" — cut at the first " · "-style separator (glyph-agnostic: any " <punct> ").
// OpenCode names a model after its provider too ("GitHub Copilot/GPT-5"); the menu groups by provider instead.
export const modelLabel = (model: AgentModel): string => {
  const name = model.id.includes('/')
    ? model.name.slice(model.name.indexOf('/') + 1)
    : model.name;
  const version = model.description?.split(/\s[^\w\s]+\s/)[0]?.trim();
  return version ? `${name} — ${version}` : name;
};

// OpenCode names its modes in lower case ("build", "plan"); Claude's are already capitalised.
export const modeLabel = (mode: AgentMode): string =>
  mode.name.charAt(0).toUpperCase() + mode.name.slice(1);

export type OpenPicker = 'mode' | 'model' | null;

export interface ModelGroup {
  providerId: string;
  // The provider's name from the credentials, else the one in front of its model names, else its id.
  label: string;
  models: AgentModel[];
}

export interface ModelMenu {
  // One per connected provider, in the order the engine lists their models.
  groups: ModelGroup[];
  // Free models on the first level: all of them, when no provider is connected.
  freeModels: AgentModel[];
  // Free models behind "Other models": all of them, when a provider is connected.
  otherModels: AgentModel[];
}

// The engine's model ids are "provider/model".
const providerOf = (model: AgentModel): string => model.id.split('/')[0];

// The provider as the engine names it in front of the model ("Google/Nano Banana 2"), until the credentials name it.
const providerInName = (model: AgentModel): string | undefined => {
  const slash = model.name.indexOf('/');
  return slash > 0 ? model.name.slice(0, slash) : undefined;
};

export const modelMenu = (
  models: AgentModel[],
  providerNames: Record<string, string>,
): ModelMenu => {
  const groups: ModelGroup[] = [];
  const free: AgentModel[] = [];
  for (const model of models) {
    if (model.free) {
      free.push(model);
      continue;
    }
    const providerId = providerOf(model);
    const group = groups.find((g) => g.providerId === providerId);
    if (group) {
      group.models.push(model);
    } else {
      groups.push({
        providerId,
        label: providerNames[providerId] ?? providerInName(model) ?? providerId,
        models: [model],
      });
    }
  }

  return groups.length > 0
    ? { groups, freeModels: [], otherModels: free }
    : { groups, freeModels: free, otherModels: [] };
};

interface ChatInputLogicParams {
  // False until the chat can take a prompt; sending would be a no-op, so Enter must keep the draft.
  canCompose: boolean;
  // A prompt that came back because its session did not open.
  restoredDraft?: { text: string };
  // Hands the draft to the queue, which decides whether it goes now or waits its turn.
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
  // The model menu's second level, "Other models".
  otherModelsOpen: boolean;
  toggleOtherModels: VoidFunction;
  closeOtherModels: VoidFunction;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onComposerKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  submit: VoidFunction;
  canSend: boolean;
  selectedMode?: AgentMode;
  selectedModel?: AgentModel;
}

export const useChatInputLogic = ({
  canCompose,
  restoredDraft,
  onSend,
  models,
  currentModelId,
  modes,
  currentModeId,
}: ChatInputLogicParams): ChatInputLogic => {
  const [draft, setDraft] = useState('');
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);
  const [otherModelsOpen, setOtherModelsOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Unless something new was typed meanwhile, which must not be overwritten.
  useEffect(() => {
    if (restoredDraft) {
      setDraft((current) =>
        current.trim() === '' ? restoredDraft.text : current,
      );
    }
  }, [restoredDraft]);

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

  // No turn gate: every draft goes to the queue, which sends it now or holds it. Shared by Enter and
  // the send button.
  const canSend = canCompose && draft.trim() !== '';
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

  const togglePicker = (picker: 'mode' | 'model'): void => {
    setOpenPicker((prev) => (prev === picker ? null : picker));
    setOtherModelsOpen(false);
  };
  const closePicker = (): void => {
    setOpenPicker(null);
    setOtherModelsOpen(false);
  };
  const toggleOtherModels = (): void => setOtherModelsOpen((open) => !open);
  const closeOtherModels = (): void => setOtherModelsOpen(false);

  const selectedMode =
    modes.find((mode) => mode.id === currentModeId) ?? modes[0];
  // Shown only once the session says which model it is on: the first of the list could be a paid one it is not using.
  const selectedModel =
    currentModelId === undefined
      ? undefined
      : models.find((model) => model.id === currentModelId) ?? {
          id: currentModelId,
          name: currentModelId,
        };

  return {
    draft,
    setDraft,
    openPicker,
    togglePicker,
    closePicker,
    otherModelsOpen,
    toggleOtherModels,
    closeOtherModels,
    inputRef,
    onComposerKeyDown,
    submit,
    canSend,
    selectedMode,
    selectedModel,
  };
};
