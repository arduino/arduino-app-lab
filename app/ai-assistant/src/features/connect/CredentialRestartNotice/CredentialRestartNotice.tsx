import { useI18n } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { messages } from '../../../messages';
import { getAgent } from '../../../services';
import { useAiAssistantStore } from '../../../store';
import { Toast } from '../../../ui';

type CredentialRestartNoticeProps = {
  // Settings has no composer: the restart itself says nothing there that its spinner does not.
  waitingOnly?: boolean;
};

// Why a new key is not in use yet, and why sending waits while the agent restarts with it.
export const CredentialRestartNotice: React.FC<
  CredentialRestartNoticeProps
> = ({ waitingOnly }) => {
  const { formatMessage } = useI18n();
  const restart = useAiAssistantStore((s) => s.credentialRestart);
  const agent = getAgent(restart?.agentId);
  if (!restart || !agent || (waitingOnly && restart.phase !== 'waiting')) {
    return null;
  }
  return (
    <Toast variant="success">
      {formatMessage(
        restart.phase === 'waiting'
          ? messages.credentialRestartWaiting
          : messages.credentialRestarting,
        { agent: agent.name },
      )}
    </Toast>
  );
};

export default CredentialRestartNotice;
