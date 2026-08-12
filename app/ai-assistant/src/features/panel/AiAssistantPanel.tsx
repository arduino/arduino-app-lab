import {
  ArduinoLoader,
  TextSize,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { messages } from '../../messages';
import { Button, Text } from '../../ui';
import { ChatPanel } from '../chat/ChatPanel/ChatPanel';
import { ConnectPanel } from '../connect/ConnectPanel';
import styles from './ai-assistant-panel.module.scss';
import { useAiAssistantPanelLogic } from './AiAssistantPanel.logic';

// Entry point: restore an existing login on open (skip connect), otherwise the connect state, then the chat.
export const AiAssistantPanel: React.FC = () => {
  const { formatMessage } = useI18n();
  const {
    loading,
    authenticated,
    agentDown,
    agentDownReason,
    reconnecting,
    reconnect,
  } = useAiAssistantPanelLogic();

  if (loading) {
    return (
      <div className={styles['loading']}>
        <ArduinoLoader className={styles['loader']} />
        <Text size={TextSize.XXSmall} className={styles['caption']}>
          {formatMessage(messages.resuming)}
        </Text>
      </div>
    );
  }

  if (agentDown) {
    // A deliberate teardown (board change) reads nothing like a crash, so the prompt says which one happened.
    const stopped =
      agentDownReason === 'board-changed'
        ? {
            title: messages.agentBoardChangedTitle,
            body: messages.agentBoardChangedBody,
          }
        : {
            title: messages.agentStoppedTitle,
            body: messages.agentStoppedBody,
          };
    return (
      <div className={styles['stopped']}>
        <Text className={styles['stopped-title']}>
          {formatMessage(stopped.title)}
        </Text>
        <Text size={TextSize.XXSmall} className={styles['stopped-body']}>
          {formatMessage(stopped.body)}
        </Text>
        <Button
          loading={reconnecting}
          disabled={reconnecting}
          onClick={reconnect}
        >
          {formatMessage(messages.agentReconnect)}
        </Button>
      </div>
    );
  }

  return authenticated ? <ChatPanel /> : <ConnectPanel />;
};

export default AiAssistantPanel;
