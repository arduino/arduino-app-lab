import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  splitViewButton: {
    id: 'editor-panel.split-view-button',
    defaultMessage: 'Split view',
    description: 'Button tooltip to toggle split editor view',
  },
  agentPanelButton: {
    id: 'editor-panel.agent-panel-button',
    defaultMessage: 'Agent panel (⌘L)',
    description: 'Button tooltip to toggle the agent side panel',
  },
  concurrentEditingLabel: {
    id: 'editor-panel.concurrent-editing-label',
    defaultMessage: 'Another user just modified this sketch.',
    description:
      'Status bar warning shown while another user is editing the same sketch',
  },
  concurrentEditingTooltip: {
    id: 'editor-panel.concurrent-editing-tooltip',
    defaultMessage:
      'Beware, simultaneous changes may be overwritten. Please wait for them to finish before editing the code.',
    description:
      'Tooltip expanding on the concurrent-editing status bar warning',
  },
});
