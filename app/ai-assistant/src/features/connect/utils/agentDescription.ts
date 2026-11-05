import { type FormatMessage } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { type MessageDescriptor } from 'react-intl';

import { agentDescriptions } from '../../../messages';
import { type AgentDescriptor, type AgentId } from '../../../services';

const descriptions: Partial<Record<AgentId, MessageDescriptor>> =
  agentDescriptions;

export const agentDescription = (
  agent: AgentDescriptor,
  formatMessage: FormatMessage,
): string => {
  const message = descriptions[agent.id];
  return message ? formatMessage(message) : agent.description;
};
