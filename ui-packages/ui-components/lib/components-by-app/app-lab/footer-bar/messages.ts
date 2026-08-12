import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  networkPanelTitle: {
    id: 'appLabFooterBar.networkPanelTitle',
    defaultMessage: 'Network Info',
    description: 'Title for the network info panel',
  },
  networkPanelChangeButton: {
    id: 'appLabFooterBar.networkPanelChangeButton',
    defaultMessage: 'Change',
    description: 'Label for the change network button',
  },
  networkPanelSSIDLabel: {
    id: 'appLabFooterBar.networkPanelSSIDLabel',
    defaultMessage: 'SSID: {ssid}',
    description: 'Label for the SSID field in the network info panel',
  },
  networkPanelIPLabel: {
    id: 'appLabFooterBar.networkPanelIPLabel',
    defaultMessage: 'IP: {ipAddress}',
    description: 'Label for the IP address field in the network info panel',
  },
  networkPanelConnectedStatus: {
    id: 'appLabFooterBar.networkPanelConnectedStatus',
    defaultMessage: 'Connected',
    description: 'Status label indicating that the network is connected',
  },
  networkPanelNotConnectedStatus: {
    id: 'appLabFooterBar.networkPanelNotConnectedStatus',
    defaultMessage: 'Not Connected',
    description: 'Status label indicating that the network is not connected',
  },
  notificationPanelTitle: {
    id: 'appLabFooterBar.notificationPanelTitle',
    defaultMessage: 'Notifications',
    description: 'Title for the notification panel',
  },
  notificationPanelNoNotifications: {
    id: 'appLabFooterBar.notificationPanelNoNotifications',
    defaultMessage: 'No new notifications',
    description: 'Message displayed when there are no notifications',
  },
  systemStats: {
    id: 'appLabFooterBar.systemStats',
    defaultMessage: 'System stats',
    description: 'Label for the system stats button and title',
  },
  stopButton: {
    id: 'appLabFooterBar.stopButton',
    defaultMessage: 'Stop',
    description: 'Label for the stop button in the footer bar',
  },
  version: {
    id: 'appLabFooterBar.version',
    defaultMessage: 'v. {version}',
    description: 'Version display label',
  },
  lspLoadingTooltip: {
    id: 'appLabFooterBar.lspLoadingTooltip',
    defaultMessage: 'Loading language support... {progress}%',
    description: 'Tooltip shown when LSP is loading for the active file',
  },
  lspErrorTooltip: {
    id: 'appLabFooterBar.lspErrorTooltip',
    defaultMessage: 'Language support unavailable: {reason}',
    description:
      'Tooltip shown when the language server failed to start, with the reason reported by the backend',
  },
  lspErrorTooltipNoReason: {
    id: 'appLabFooterBar.lspErrorTooltipNoReason',
    defaultMessage:
      'Language support unavailable. Code completion and diagnostics are off for this file.',
    description:
      'Tooltip shown when the language server failed to start and reported no specific reason',
  },
  aiAssistant: {
    id: 'appLabFooterBar.aiAssistant',
    defaultMessage: 'AI Assistant',
    description:
      'Tooltip/label for the AI Assistant footer entry point when closed',
  },
  aiAssistantEntryAgent: {
    id: 'appLabFooterBar.aiAssistantEntryAgent',
    defaultMessage: 'Agent Mode',
    description: 'Label for the AI Assistant footer entry point in editor mode',
  },
  aiAssistantEntryEditor: {
    id: 'appLabFooterBar.aiAssistantEntryEditor',
    defaultMessage: 'Editor Mode',
    description:
      'Label for the AI Assistant footer entry point in AI Assistant mode',
  },
  backToIdeTooltipTitle: {
    id: 'appLabFooterBar.backToIdeTooltipTitle',
    defaultMessage: 'Back to App Lab IDE',
    description:
      'Title of the one-time tooltip shown on the first entry into agent mode',
  },
  backToIdeTooltipDescription: {
    id: 'appLabFooterBar.backToIdeTooltipDescription',
    defaultMessage:
      'From here you can always go to App Lab IDE to keep building.',
    description:
      'Description of the one-time tooltip shown on the first entry into agent mode',
  },
  agentIsHereTooltipTitle: {
    id: 'appLabFooterBar.agentIsHereTooltipTitle',
    defaultMessage: 'AppLab Agent is here',
    description:
      'Title of the one-time tooltip shown on the first return to editor mode',
  },
  agentIsHereTooltipDescription: {
    id: 'appLabFooterBar.agentIsHereTooltipDescription',
    defaultMessage:
      'The AppLab Agent lives here. Give it a prompt and watch it build.',
    description:
      'Description of the one-time tooltip shown on the first return to editor mode',
  },
  dismissTooltip: {
    id: 'appLabFooterBar.dismissTooltip',
    defaultMessage: 'Dismiss',
    description: 'Label of the close button of the agent-mode tooltips',
  },
});
