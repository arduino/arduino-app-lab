import {
  ChatEnter,
  ChatStopFilled,
} from '@cloud-editor-mono/images/assets/icons';
import { useI18n } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { messages } from '../../../messages';
import { AgentMode, AgentModel } from '../../../services';
import styles from './chat-input.module.scss';
import { modelLabel, useChatInputLogic } from './ChatInput.logic';
import { ChatInputPicker } from './ChatInputPicker';

interface ChatInputProps {
  isStreaming: boolean;
  hasSession: boolean;
  onSend: (text: string) => void;
  onStop: VoidFunction;
  models: AgentModel[];
  currentModelId?: string;
  setModel: (modelId: string) => Promise<void>;
  modes: AgentMode[];
  currentModeId?: string;
  setMode: (modeId: string) => Promise<void>;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  isStreaming,
  hasSession,
  onSend,
  onStop,
  models,
  currentModelId,
  setModel,
  modes,
  currentModeId,
  setMode,
}) => {
  const { formatMessage } = useI18n();
  const {
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
  } = useChatInputLogic({
    isStreaming,
    hasSession,
    onSend,
    models,
    currentModelId,
    modes,
    currentModeId,
  });

  return (
    <div className={styles['chat-input']}>
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
        <div
          className={styles['chat-input-toolbar-right']}
          ref={toolbarPickersRef}
        >
          {modes.length > 0 && selectedMode && (
            <ChatInputPicker
              items={modes}
              selected={selectedMode}
              label={formatMessage(messages.agentModePicker)}
              isOpen={openPicker === 'mode'}
              onToggle={(): void => togglePicker('mode')}
              onSelect={(modeId): void => {
                void setMode(modeId);
                closePicker();
              }}
            />
          )}

          {models.length > 0 && selectedModel && (
            <ChatInputPicker
              items={models}
              selected={selectedModel}
              label={formatMessage(messages.modelPicker)}
              isOpen={openPicker === 'model'}
              getLabel={modelLabel}
              onToggle={(): void => togglePicker('model')}
              onSelect={(modelId): void => {
                void setModel(modelId);
                closePicker();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
