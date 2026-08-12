import { defineMessages } from 'react-intl';

export const messages = defineMessages({
  resuming: {
    id: 'aiAssistant.panel.resuming',
    defaultMessage: 'Loading the agent…',
    description: 'Shown while restoring an existing session on open',
  },
  agentBoardChangedTitle: {
    id: 'aiAssistant.panel.boardChanged.title',
    defaultMessage: 'The assistant was restarted',
    description:
      'Title shown when the agent was torn down because the user selected a different board',
  },
  agentBoardChangedBody: {
    id: 'aiAssistant.panel.boardChanged.body',
    defaultMessage:
      'It was working with the board you switched away from, so it stopped. Your chats are saved — reconnect to carry on with the new board.',
    description:
      'Explanation shown with the reconnect action after a board change',
  },
  agentStoppedTitle: {
    id: 'aiAssistant.panel.agentStopped.title',
    defaultMessage: 'The agent stopped unexpectedly',
    description:
      'Title shown when the agent process crashed and could not be restarted automatically',
  },
  agentStoppedBody: {
    id: 'aiAssistant.panel.agentStopped.body',
    defaultMessage:
      'It crashed too many times to restart on its own. Your chats are saved — reconnect to carry on.',
    description: 'Explanation shown with the reconnect action after a crash',
  },
  agentReconnect: {
    id: 'aiAssistant.panel.agentStopped.reconnect',
    defaultMessage: 'Reconnect',
    description: 'Button that restarts the agent after it crashed',
  },
  connectTitle: {
    id: 'aiAssistant.connect.title',
    defaultMessage: 'Connect an AI to start building',
    description: 'Heading of the AI assistant connect (empty) state',
  },
  connectSubtitle: {
    id: 'aiAssistant.connect.subtitle',
    defaultMessage:
      'First install an agent locally, then sign in with your account.',
    description: 'Supporting line under the connect (empty) state heading',
  },
  sessionExpired: {
    id: 'aiAssistant.connect.sessionExpired',
    defaultMessage: 'Your session expired — please sign in again.',
    description:
      'Notice on the connect screen after a turn failed authentication',
  },
  connect: {
    id: 'aiAssistant.connect.connect',
    defaultMessage: 'Connect',
    description: 'Label of the button that signs in to / connects an AI agent',
  },
  install: {
    id: 'aiAssistant.connect.install',
    defaultMessage: 'Install',
    description:
      "Label of the button that downloads the agent's runtime dependencies",
  },
  comingSoon: {
    id: 'aiAssistant.connect.comingSoon',
    defaultMessage: 'Coming soon',
    description:
      'Badge on a connect card for an agent that is not yet available',
  },
  preview: {
    id: 'aiAssistant.connect.preview',
    defaultMessage: 'Preview',
    description:
      'Badge on a connect card for an agent that is available as a preview',
  },
  installing: {
    id: 'aiAssistant.connect.installing',
    defaultMessage: 'Installing…',
    description: 'Install button label while the runtime is being installed',
  },
  cancel: {
    id: 'aiAssistant.connect.cancel',
    defaultMessage: 'Cancel',
    description: 'Button that collapses the expanded connect card',
  },
  tabSignIn: {
    id: 'aiAssistant.connect.tab.signIn',
    defaultMessage: 'Sign in',
    description: 'Connect card tab for browser-based sign-in',
  },
  tabApiKey: {
    id: 'aiAssistant.connect.tab.apiKey',
    defaultMessage: 'API Key',
    description: 'Connect card tab for API-key authentication',
  },
  signInWith: {
    id: 'aiAssistant.connect.signInWith',
    defaultMessage: 'Sign in with {provider}',
    description: 'Button that starts the browser sign-in for a provider',
  },
  signInHint: {
    id: 'aiAssistant.connect.signInHint',
    defaultMessage:
      'Opens your browser to sign in. Uses your existing Pro or Max subscription.',
    description: 'Hint shown under the sign-in button',
  },
  signInBrowserOpening: {
    id: 'aiAssistant.connect.signInBrowserOpening',
    defaultMessage: 'Your browser should open automatically.',
    description: 'Message shown while waiting for the browser sign-in to open',
  },
  signInOpenLinkHint: {
    id: 'aiAssistant.connect.signInOpenLinkHint',
    defaultMessage: 'If not, open the link below.',
    description: 'Secondary hint pointing to the copyable sign-in link',
  },
  signInWaiting: {
    id: 'aiAssistant.connect.signInWaiting',
    defaultMessage: 'Waiting for confirmation…',
    description: 'Status shown while waiting for the sign-in to be confirmed',
  },
  signInPreparingLink: {
    id: 'aiAssistant.connect.signInPreparingLink',
    defaultMessage: 'Preparing sign-in link…',
    description:
      'Placeholder in the link row while the agent CLI generates the auth URL',
  },
  signInPasteTokenHint: {
    id: 'aiAssistant.connect.signInPasteTokenHint',
    defaultMessage: "In case your browser doesn't open",
    description:
      'Lead-in next to the button that reveals the manual token field',
  },
  signInPasteToken: {
    id: 'aiAssistant.connect.signInPasteToken',
    defaultMessage: 'Paste token',
    description: 'Button that reveals the field for pasting the sign-in token',
  },
  signInTokenPlaceholder: {
    id: 'aiAssistant.connect.signInTokenPlaceholder',
    defaultMessage: 'Paste your token here',
    description: 'Placeholder of the manual sign-in token field',
  },
  signInTokenLabel: {
    id: 'aiAssistant.connect.signInTokenLabel',
    defaultMessage: 'Sign-in token',
    description: 'Accessible label of the manual sign-in token field',
  },
  signInVerifyingToken: {
    id: 'aiAssistant.connect.signInVerifyingToken',
    defaultMessage: 'Verifying token…',
    description: 'Status shown while the pasted sign-in token is being checked',
  },
  signInTokenError: {
    id: 'aiAssistant.connect.signInTokenError',
    defaultMessage: "That token didn't work. Check it and try again.",
    description: 'Inline error shown when the pasted sign-in token is rejected',
  },
  copyLink: {
    id: 'aiAssistant.connect.copyLink',
    defaultMessage: 'Copy link',
    description: 'Accessible label for the button that copies the sign-in link',
  },
  apiKeyLabel: {
    id: 'aiAssistant.connect.apiKeyLabel',
    defaultMessage: '{provider} API key',
    description: 'Label of the API-key input field',
  },
  verify: {
    id: 'aiAssistant.connect.verify',
    defaultMessage: 'Verify',
    description: 'Button that validates the entered API key',
  },
  verifying: {
    id: 'aiAssistant.connect.verifying',
    defaultMessage: 'Verifying…',
    description: 'Verify button label while the API key is being checked',
  },
  apiKeyFormatError: {
    id: 'aiAssistant.connect.apiKeyFormatError',
    defaultMessage: 'Expected a key starting with "{prefix}"',
    description: 'Inline error when the API key has the wrong format',
  },
  whereApiKey: {
    id: 'aiAssistant.connect.whereApiKey',
    defaultMessage: 'Where do I find my {provider} API key?',
    description: 'Link to the provider docs for locating the API key',
  },
  toastVerifyFailed: {
    id: 'aiAssistant.connect.toastVerifyFailed',
    defaultMessage: "That key didn't work. Check it and try again.",
    description: 'Error toast shown when API-key verification fails',
  },
  dismiss: {
    id: 'aiAssistant.connect.dismiss',
    defaultMessage: 'Dismiss',
    description: 'Accessible label for the error toast close button',
  },
  chatScrollToBottom: {
    id: 'aiAssistant.chat.scrollToBottom',
    defaultMessage: 'Scroll to bottom',
    description:
      'Accessible label for the button that scrolls the chat to the latest message',
  },
  chatChoiceSkipped: {
    id: 'aiAssistant.chat.choiceSkipped',
    defaultMessage: 'No preference',
    description:
      'Answer shown in the chat when the user skips a choice question (no option picked)',
  },
  chatEmptyTitle: {
    id: 'aiAssistant.chat.empty.title',
    defaultMessage: 'Hi, What do you want to build today?',
    description: 'Title of the empty chat state',
  },
  chatEmptySubtitle: {
    id: 'aiAssistant.chat.empty.subtitle',
    defaultMessage:
      'Describe an app and the assistant will help you create it on your UNO Q.',
    description: 'Subtitle of the empty chat state',
  },
  chatSuggestionBlink: {
    id: 'aiAssistant.chat.suggestion.blink',
    defaultMessage: 'Blink an LED',
    description: 'Suggested prompt shown as a pill in the empty chat state',
  },
  chatSuggestionSensor: {
    id: 'aiAssistant.chat.suggestion.sensor',
    defaultMessage: 'Read a sensor',
    description: 'Suggested prompt shown as a pill in the empty chat state',
  },
  chatSuggestionComments: {
    id: 'aiAssistant.chat.suggestion.comments',
    defaultMessage: 'Add comments',
    description: 'Suggested prompt shown as a pill in the empty chat state',
  },
  chatPlaceholder: {
    id: 'aiAssistant.chat.placeholder',
    defaultMessage: 'Ask anything…',
    description: 'Placeholder of the chat composer input',
  },
  chatLoadingSession: {
    id: 'aiAssistant.chat.loadingSession',
    defaultMessage: 'Loading session…',
    description:
      "Caption under the loader while a reopened session's history loads",
  },
  chatSessionFailedTitle: {
    id: 'aiAssistant.chat.sessionFailed.title',
    defaultMessage: "Couldn't open the chat",
    description:
      'Title of the error banner shown when a session could not be opened or replayed',
  },
  chatSessionFailedRetry: {
    id: 'aiAssistant.chat.sessionFailed.retry',
    defaultMessage: 'Retry',
    description: 'Action that reopens the session the panel failed to open',
  },
  chatSessionFailedNewChat: {
    id: 'aiAssistant.chat.sessionFailed.newChat',
    defaultMessage: 'Start a new chat',
    description:
      'Action that abandons a session that cannot be reopened and starts a fresh one',
  },
  connectedToast: {
    id: 'aiAssistant.connectedToast',
    defaultMessage: '{agent} connected.',
    description: 'Success toast shown right after sign-in (chat and Settings)',
  },
  agentModePicker: {
    id: 'aiAssistant.chat.modePicker',
    defaultMessage: 'Mode',
    description: 'Accessible label of the chat agent-mode selector',
  },
  chatSend: {
    id: 'aiAssistant.chat.send',
    defaultMessage: 'Send',
    description: 'Label of the chat send button',
  },
  chatStop: {
    id: 'aiAssistant.chat.stop',
    defaultMessage: 'Stop',
    description: 'Label of the chat stop button that aborts the current turn',
  },
  codeApply: {
    id: 'aiAssistant.code.apply',
    defaultMessage: 'Apply to editor',
    description: 'Apply a code block to the App Lab editor',
  },
  codeApplied: {
    id: 'aiAssistant.code.applied',
    defaultMessage: 'Applied',
    description: 'Confirmation after applying a code block',
  },
  toolStatusPending: {
    id: 'aiAssistant.tool.status.pending',
    defaultMessage: 'Pending',
    description: 'Tool call status: queued, not started yet',
  },
  toolStatusRunning: {
    id: 'aiAssistant.tool.status.running',
    defaultMessage: 'Running…',
    description: 'Tool call status: in progress',
  },
  toolStatusDone: {
    id: 'aiAssistant.tool.status.done',
    defaultMessage: 'Done',
    description: 'Tool call status: completed successfully',
  },
  toolStatusFailed: {
    id: 'aiAssistant.tool.status.failed',
    defaultMessage: 'Failed',
    description: 'Tool call status: failed',
  },
  toolOutput: {
    id: 'aiAssistant.tool.output',
    defaultMessage: 'Output',
    description: 'Label for the tool call output section',
  },
  permDescription: {
    id: 'aiAssistant.permission.description',
    defaultMessage: 'Allow the agent to do this?',
    description: 'Body of the tool permission dialog',
  },
  permAllowOnce: {
    id: 'aiAssistant.permission.allowOnce',
    defaultMessage: 'Allow once',
    description: 'Permission option: allow this single call',
  },
  permAllowAlways: {
    id: 'aiAssistant.permission.allowAlways',
    defaultMessage: 'Always allow',
    description: 'Permission option: allow this tool from now on',
  },
  permReject: {
    id: 'aiAssistant.permission.reject',
    defaultMessage: 'Reject',
    description: 'Permission option: deny the tool call',
  },
  planTitle: {
    id: 'aiAssistant.plan.title',
    defaultMessage: 'Plan ready',
    description: 'Title of the plan-mode approval card',
  },
  planDescription: {
    id: 'aiAssistant.plan.description',
    defaultMessage: 'Review the plan, then choose how to proceed.',
    description: 'Body of the plan-mode approval card',
  },
  headerTitle: {
    id: 'aiAssistant.header.title',
    defaultMessage: 'Agent Builder',
    description: 'Title shown on the left of the chat header',
  },
  sessionsTitle: {
    id: 'aiAssistant.sessions.title',
    defaultMessage: 'Sessions',
    description: 'Title of the sessions accordion in the agent side panel',
  },
  sessionsNewChat: {
    id: 'aiAssistant.sessions.newChat',
    defaultMessage: 'New session',
    description: 'Row in the agent side panel that starts a fresh session',
  },
  sessionsDelete: {
    id: 'aiAssistant.sessions.delete',
    defaultMessage: 'Delete',
    description: 'Confirm action to delete a saved session',
  },
  sessionsDeleteDialogTitle: {
    id: 'aiAssistant.sessions.deleteDialog.title',
    defaultMessage: 'Delete Session',
    description: 'Title of the delete-session confirmation dialog',
  },
  sessionsDeleteDialogHeading: {
    id: 'aiAssistant.sessions.deleteDialog.heading',
    defaultMessage: 'Delete “{title}”?',
    description: 'Confirmation question in the delete-session dialog',
  },
  sessionsDeleteDialogBody: {
    id: 'aiAssistant.sessions.deleteDialog.body',
    defaultMessage:
      'This permanently removes the chat and its history. You can’t undo this.',
    description: 'Explanation in the delete-session dialog',
  },
  sessionsRename: {
    id: 'aiAssistant.sessions.rename',
    defaultMessage: 'Rename',
    description: 'Session actions menu item to rename a session',
  },
  sessionsPin: {
    id: 'aiAssistant.sessions.pin',
    defaultMessage: 'Pin Session',
    description: 'Session actions menu item to pin a session',
  },
  sessionsUnpin: {
    id: 'aiAssistant.sessions.unpin',
    defaultMessage: 'Unpin Session',
    description: 'Session actions menu item to unpin an already-pinned session',
  },
  sessionActionsTooltip: {
    id: 'aiAssistant.sessions.actions',
    defaultMessage: 'Session actions',
    description: 'Tooltip for the session actions "..." trigger',
  },
  sessionsUntitled: {
    id: 'aiAssistant.sessions.untitled',
    defaultMessage: 'Untitled chat',
    description: 'Fallback title for a session with no agent-generated title',
  },
  sessionsRenameFailed: {
    id: 'aiAssistant.sessions.renameFailed',
    defaultMessage: "Couldn't rename this chat",
    description: 'Side panel error shown when renaming a session was rejected',
  },
  sessionsDeleteFailed: {
    id: 'aiAssistant.sessions.deleteFailed',
    defaultMessage: "Couldn't delete this chat",
    description: 'Side panel error shown when deleting a session was rejected',
  },
  sessionsPinFailed: {
    id: 'aiAssistant.sessions.pinFailed',
    defaultMessage: "Couldn't pin this chat",
    description:
      'Side panel error shown when pinning/unpinning a session was rejected',
  },
  sessionsPinnedHeading: {
    id: 'aiAssistant.sessions.pinnedHeading',
    defaultMessage: 'Pinned',
    description: 'Side panel section heading for pinned sessions',
  },
  modelPicker: {
    id: 'aiAssistant.chat.modelPicker',
    defaultMessage: 'Model',
    description: 'Accessible label of the chat model selector',
  },
  settingsAgentTitle: {
    id: 'aiAssistant.settings.agent.title',
    defaultMessage: 'Agent',
    description: 'Title of the Agent section in Settings',
  },
  settingsConnectedBadge: {
    id: 'aiAssistant.settings.agent.connectedBadge',
    defaultMessage: 'Connected',
    description: 'Badge on a connected agent card in Settings',
  },
  settingsManage: {
    id: 'aiAssistant.settings.agent.manage',
    defaultMessage: 'Manage',
    description: 'Button that expands a connected agent card in Settings',
  },
  settingsStatusLine: {
    id: 'aiAssistant.settings.agent.statusLine',
    defaultMessage: '{method} {account} · Connected {when}',
    description: 'Subtitle summarizing how and when an agent was connected',
  },
  settingsSignInMethod: {
    id: 'aiAssistant.settings.agent.signInMethod',
    defaultMessage: 'Sign In Method',
    description: 'Detail row label: how the agent was authenticated',
  },
  settingsMethodOAuth: {
    id: 'aiAssistant.settings.agent.method.oauth',
    defaultMessage: 'OAuth',
    description: 'Value for a subscription (browser OAuth) sign-in method',
  },
  settingsMethodApiKey: {
    id: 'aiAssistant.settings.agent.method.apiKey',
    defaultMessage: 'API Key',
    description: 'Value for an API-key sign-in method',
  },
  settingsConnectedRow: {
    id: 'aiAssistant.settings.agent.connectedRow',
    defaultMessage: 'Connected',
    description: 'Detail row label: when the agent was connected',
  },
  settingsAccountRow: {
    id: 'aiAssistant.settings.agent.accountRow',
    defaultMessage: 'Account / Key',
    description: 'Detail row label: the connected account or API key',
  },
  settingsSetAsDefault: {
    id: 'aiAssistant.settings.agent.setAsDefault',
    defaultMessage: 'Set as default',
    description: 'Action that makes an agent the default for new sessions',
  },
  settingsDisconnect: {
    id: 'aiAssistant.settings.agent.disconnect',
    defaultMessage: 'Disconnect',
    description: 'Action that signs out of a connected agent',
  },
  settingsDisconnectDialogTitle: {
    id: 'aiAssistant.settings.agent.disconnectDialog.title',
    defaultMessage: 'Disconnect Provider',
    description: 'Title of the disconnect confirmation dialog',
  },
  settingsDisconnectDialogHeading: {
    id: 'aiAssistant.settings.agent.disconnectDialog.heading',
    defaultMessage: 'Are you sure you want to disconnect from {agent}?',
    description: 'Confirmation question in the disconnect dialog',
  },
  settingsDisconnectDialogBody: {
    id: 'aiAssistant.settings.agent.disconnectDialog.body',
    defaultMessage: 'You can re-connect it back any time.',
    description: 'Reassurance text in the disconnect dialog',
  },
  settingsSwitchDialogTitle: {
    id: 'aiAssistant.settings.agent.switchDialog.title',
    defaultMessage: 'Switch Provider',
    description:
      'Title of the set-as-default (switch provider) confirmation dialog',
  },
  settingsSwitchDialogHeading: {
    id: 'aiAssistant.settings.agent.switchDialog.heading',
    defaultMessage: 'Switch to {agent}?',
    description: 'Confirmation question in the switch-provider dialog',
  },
  settingsSwitchDialogBody: {
    id: 'aiAssistant.settings.agent.switchDialog.body',
    defaultMessage:
      'Activating {agent} will disable {current}. Your {current} history is saved and restored if you switch back.',
    description: 'Explanation in the switch-provider dialog',
  },
  settingsSwitchDialogConfirm: {
    id: 'aiAssistant.settings.agent.switchDialog.confirm',
    defaultMessage: 'Yes, Switch',
    description: 'Confirm button in the switch-provider dialog',
  },
  settingsRuntimeTitle: {
    id: 'aiAssistant.settings.runtime.title',
    defaultMessage: 'Runtime & Packages',
    description: 'Header of the collapsible runtime section in agent settings',
  },
  settingsRuntimeStatus: {
    id: 'aiAssistant.settings.runtime.status',
    defaultMessage: 'Status',
    description: 'Column label for the runtime install status',
  },
  settingsRuntimeStatusInstalled: {
    id: 'aiAssistant.settings.runtime.status.installed',
    defaultMessage: 'Installed',
    description: 'Runtime status value when the runtime is present',
  },
  settingsRuntimeVersion: {
    id: 'aiAssistant.settings.runtime.version',
    defaultMessage: 'Version',
    description: 'Column label for the installed runtime version',
  },
  settingsRuntimeDiskUsage: {
    id: 'aiAssistant.settings.runtime.diskUsage',
    defaultMessage: 'Disk usage',
    description: 'Column label for the runtime on-disk size',
  },
  settingsRuntimeCheckUpdates: {
    id: 'aiAssistant.settings.runtime.checkUpdates',
    defaultMessage: 'Check for updates',
    description: 'Action that probes the channel for a newer runtime',
  },
  settingsRuntimeChecking: {
    id: 'aiAssistant.settings.runtime.checking',
    defaultMessage: 'Checking for updates',
    description: 'Status shown while probing for a runtime update',
  },
  settingsRuntimeUpToDate: {
    id: 'aiAssistant.settings.runtime.upToDate',
    defaultMessage: 'Already up to date',
    description: 'Note shown when no runtime update is available',
  },
  settingsRuntimeUninstall: {
    id: 'aiAssistant.settings.runtime.uninstall',
    defaultMessage: 'Uninstall',
    description: 'Action that removes the installed runtime',
  },
  settingsRuntimeUpdating: {
    id: 'aiAssistant.settings.runtime.updating',
    defaultMessage: 'Updating runtime…',
    description: 'Progress label while a runtime update is downloading',
  },
  settingsRuntimeInstalling: {
    id: 'aiAssistant.settings.runtime.installing',
    defaultMessage: 'Installing runtime…',
    description: 'Progress label while the runtime is being (re)installed',
  },
  settingsRuntimeUninstalling: {
    id: 'aiAssistant.settings.runtime.uninstalling',
    defaultMessage: 'Uninstalling runtime…',
    description: 'Progress label while the runtime is being removed',
  },
  settingsRuntimeUninstallDialogTitle: {
    id: 'aiAssistant.settings.runtime.uninstallDialog.title',
    defaultMessage: 'Uninstall Runtime',
    description: 'Title of the uninstall-runtime confirmation dialog',
  },
  settingsRuntimeUninstallDialogHeading: {
    id: 'aiAssistant.settings.runtime.uninstallDialog.heading',
    defaultMessage: 'Uninstall the {agent} runtime?',
    description: 'Confirmation question in the uninstall-runtime dialog',
  },
  settingsRuntimeUninstallDialogBody: {
    id: 'aiAssistant.settings.runtime.uninstallDialog.body',
    defaultMessage:
      'This uninstalls the runtime and packages ({size}) and resets the agent to its initial state. You can reconnect and reinstall any time. You’ll also lose all your session history.',
    description: 'Explanation in the uninstall-runtime dialog',
  },
});
