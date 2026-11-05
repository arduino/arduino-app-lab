import {
  ChatEnter,
  ChatStopFilled,
} from '@cloud-editor-mono/images/assets/icons';
import { useI18n } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { messages } from '../../../messages';
import { AgentMode, AgentModel } from '../../../services';
import { type PickerOptionContent, PickerSubmenu } from '../../../ui';
import styles from './chat-input.module.scss';
import {
  modeLabel,
  modelLabel,
  modelMenu,
  useChatInputLogic,
} from './ChatInput.logic';
import { ChatInputPicker } from './ChatInputPicker';

// Not model ids: the engine's ids are "provider/model".
const ADD_PROVIDER_ID = 'add-provider';
const OTHER_MODELS_ID = 'other-models';

type ModelMenuItem = AgentModel & {
  hint?: string;
  dividerAfter?: boolean;
  groupLabel?: string;
  submenu?: boolean;
  expanded?: boolean;
};

interface ChatInputProps {
  isStreaming: boolean;
  canCompose: boolean;
  restoredDraft?: { text: string };
  onSend: (text: string) => void;
  onStop: VoidFunction;
  models: AgentModel[];
  currentModelId?: string;
  // The session could not say which model it is on: the menu opens anyway, with none shown as current.
  modelUnreadable?: boolean;
  setModel: (modelId: string) => Promise<void>;
  modes: AgentMode[];
  currentModeId?: string;
  setMode: (modeId: string) => Promise<void>;
  // Given, the model menu ends with a row that opens the provider settings.
  onAddProvider?: VoidFunction;
  // Given, the model menu groups the models by connected provider (names by provider id), with the
  // engine's free models behind "Other models".
  providerNames?: Record<string, string>;
  // Labels the free models, at the top of "Other models".
  freeModelsLabel?: string;
  // Rows waiting above the input box, inside the composer's padding and gap.
  queue?: React.ReactNode;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  isStreaming,
  canCompose,
  restoredDraft,
  onSend,
  onStop,
  models,
  currentModelId,
  modelUnreadable = false,
  setModel,
  modes,
  currentModeId,
  setMode,
  onAddProvider,
  providerNames,
  freeModelsLabel,
  queue,
}) => {
  const { formatMessage } = useI18n();
  const {
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
  } = useChatInputLogic({
    canCompose,
    restoredDraft,
    onSend,
    models,
    currentModelId,
    modes,
    currentModeId,
  });

  const menu = providerNames && modelMenu(models, providerNames);
  const otherModels = menu?.otherModels ?? [];
  const otherModelsLabel = formatMessage(messages.modelPickerOtherModels);
  const firstLevel: ModelMenuItem[] = menu
    ? [
        ...menu.groups.flatMap((group) =>
          group.models.map((model, i) =>
            i === 0 ? { ...model, groupLabel: group.label } : model,
          ),
        ),
        ...menu.freeModels,
        ...(otherModels.length > 0
          ? [
              {
                id: OTHER_MODELS_ID,
                name: otherModelsLabel,
                submenu: true,
                expanded: otherModelsOpen,
              },
            ]
          : []),
      ]
    : models;
  const modelItems: ModelMenuItem[] =
    onAddProvider && firstLevel.length > 0
      ? [
          ...firstLevel.slice(0, -1),
          { ...firstLevel[firstLevel.length - 1], dividerAfter: true },
          {
            id: ADD_PROVIDER_ID,
            name: formatMessage(messages.modelPickerAddProvider),
            hint: formatMessage(messages.modelPickerAddProviderHint),
          },
        ]
      : firstLevel;

  return (
    <div className={styles['chat-input']}>
      {queue}
      <div className={styles['chat-input-box']}>
        <textarea
          ref={inputRef}
          className={styles['chat-input-field']}
          value={draft}
          rows={1}
          placeholder={formatMessage(messages.chatPlaceholder)}
          onChange={(e): void => setDraft(e.target.value)}
          onKeyDown={onComposerKeyDown}
        />
        {isStreaming ? (
          <button
            type="button"
            className={styles['chat-input-action']}
            aria-label={formatMessage(messages.chatStop)}
            onClick={onStop}
          >
            <ChatStopFilled
              className={styles['chat-input-action-icon']}
              aria-hidden="true"
            />
          </button>
        ) : (
          // Send button appears only once there's something to send.
          canSend && (
            <button
              type="button"
              className={styles['chat-input-action']}
              aria-label={formatMessage(messages.chatSend)}
              onClick={submit}
            >
              <ChatEnter
                className={styles['chat-input-action-icon']}
                aria-hidden="true"
              />
            </button>
          )
        )}
      </div>

      <div className={styles['chat-input-toolbar']}>
        <div className={styles['chat-input-toolbar-right']}>
          {modes.length > 0 && selectedMode && (
            <ChatInputPicker
              items={modes}
              selected={selectedMode}
              label={formatMessage(messages.agentModePicker)}
              getLabel={modeLabel}
              isOpen={openPicker === 'mode'}
              onToggle={(): void => togglePicker('mode')}
              onClose={closePicker}
              onSelect={(modeId): void => {
                void setMode(modeId);
                closePicker();
                inputRef.current?.focus(); // the menu that held focus is gone: typing goes on in the composer
              }}
            />
          )}

          {/* Kept in place while the session has not said which model it is on, and named by nothing it does not use. */}
          {models.length > 0 && (
            <ChatInputPicker
              items={modelItems}
              selected={
                selectedModel ?? {
                  id: '',
                  name: formatMessage(messages.modelPicker),
                }
              }
              disabled={!selectedModel && !modelUnreadable}
              label={formatMessage(messages.modelPicker)}
              isOpen={openPicker === 'model'}
              getLabel={(item): string =>
                item.id === ADD_PROVIDER_ID || item.id === OTHER_MODELS_ID
                  ? item.name
                  : modelLabel(item)
              }
              isSelected={(item): boolean =>
                item.id === selectedModel?.id ||
                (item.id === OTHER_MODELS_ID &&
                  otherModels.some((model) => model.id === selectedModel?.id))
              }
              onToggle={(): void => togglePicker('model')}
              onClose={closePicker}
              onSelect={(modelId): void => {
                if (modelId === OTHER_MODELS_ID) {
                  toggleOtherModels();
                  return;
                }
                closePicker();
                if (modelId === ADD_PROVIDER_ID) {
                  onAddProvider?.();
                  return;
                }
                void setModel(modelId);
                inputRef.current?.focus();
              }}
              classes={
                menu ? { menu: styles['chat-input-model-menu'] } : undefined
              }
              renderSubmenu={
                otherModels.length > 0
                  ? (anchor): React.ReactNode => (
                      <PickerSubmenu
                        anchor={anchor}
                        items={otherModels}
                        isSelected={(model): boolean =>
                          model.id === selectedModel?.id
                        }
                        getOption={(model): PickerOptionContent => ({
                          label: modelLabel(model),
                          description: model.description,
                          groupLabel:
                            model === otherModels[0]
                              ? freeModelsLabel
                              : undefined,
                        })}
                        onSelect={(modelId): void => {
                          closePicker();
                          void setModel(modelId);
                          inputRef.current?.focus();
                        }}
                        onClose={closeOtherModels}
                        label={otherModelsLabel}
                        className={styles['chat-input-model-menu']}
                      />
                    )
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};
