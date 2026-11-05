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
  agentBoardFlashedTitle: {
    id: 'aiAssistant.panel.boardFlashed.title',
    defaultMessage: 'The assistant was restarted',
    description:
      'Title shown when the agent was torn down because the board was reflashed',
  },
  agentBoardFlashedBody: {
    id: 'aiAssistant.panel.boardFlashed.body',
    defaultMessage:
      'The board was reflashed, so the apps it was working on are gone. Your chats are saved. Reconnect once the board has finished restarting.',
    description:
      'Explanation shown with the reconnect action after the board was reflashed',
  },
  switchBoardReviving: {
    id: 'aiAssistant.switchBoard.reviving',
    defaultMessage: 'Restarting the assistant on the new board…',
    description:
      'Shown while the agent restarts itself after a board switch the user confirmed',
  },
  switchBoardDialogTitle: {
    id: 'aiAssistant.switchBoard.title',
    defaultMessage: 'Switch board',
    description: 'Title of the dialog asking to confirm a board switch',
  },
  switchBoardDialogHeading: {
    id: 'aiAssistant.switchBoard.heading',
    defaultMessage: 'Switch board while the agent is working?',
    description:
      'Confirmation question shown before a board switch stops the agent',
  },
  switchBoardDialogBody: {
    id: 'aiAssistant.switchBoard.body',
    defaultMessage:
      'The agent is working on {boardName}. If you switch board now, the current work is interrupted.',
    description:
      'Explanation of what a board switch costs while a turn is running',
  },
  switchBoardDialogBoardFallback: {
    id: 'aiAssistant.switchBoard.boardFallback',
    defaultMessage: 'the current board',
    description: 'Stands in for the board name when it is unknown',
  },
  switchBoardDialogConfirm: {
    id: 'aiAssistant.switchBoard.confirm',
    defaultMessage: 'Switch anyway',
    description: 'Button that switches board and stops the agent',
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
  agentStartFailedTitle: {
    id: 'aiAssistant.panel.agentStartFailed.title',
    defaultMessage: 'The agent did not start',
    description:
      'Title shown when the agent could not be started after a sign-in, a key change or a switch',
  },
  agentStartFailedBody: {
    id: 'aiAssistant.panel.agentStartFailed.body',
    defaultMessage:
      'App Lab could not start it. Your chats are saved — reconnect to try again.',
    description:
      'Explanation shown with the reconnect action after the agent failed to start',
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
      'First install an Agent locally, then sign in with your account.',
    description: 'Supporting line under the connect (empty) state heading',
  },
  sessionExpired: {
    id: 'aiAssistant.connect.sessionExpired',
    defaultMessage: 'Your session expired — please sign in again.',
    description:
      'Notice on the connect screen after a turn failed authentication',
  },
  install: {
    id: 'aiAssistant.connect.install',
    defaultMessage: 'Install',
    description:
      "Label of the button that downloads the agent's runtime dependencies",
  },
  installChecking: {
    id: 'aiAssistant.connect.installChecking',
    defaultMessage: 'Checking…',
    description:
      "Label of an agent card's disabled button while App Lab checks whether the agent is installed",
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
    description:
      'Button that makes an agent the one in use: a sign-in, a free start, or a switch',
  },
  signInHint: {
    id: 'aiAssistant.connect.signInHint',
    defaultMessage:
      'Opens your browser to sign in with your existing {provider} subscription.',
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
  providersTitle: {
    id: 'aiAssistant.connect.providersTitle',
    defaultMessage: 'AI model providers',
    description: 'Heading of the provider section, shown in capitals',
  },
  providersConnectedCount: {
    id: 'aiAssistant.connect.providersConnectedCount',
    defaultMessage: '{count} connected',
    description:
      'Right of the provider heading: how many providers have a key or a sign-in',
  },
  providersSubtitle: {
    id: 'aiAssistant.connect.providersSubtitle',
    defaultMessage: 'Choose the additional models the Agent will use.',
    description: 'Under the provider heading, and above the provider dropdown',
  },
  providerFreeModels: {
    id: 'aiAssistant.connect.providerFreeModels',
    defaultMessage: '{agent} free models',
    description:
      "The agent's own free models, offered and listed as a provider of their own",
  },
  providerFreeModelsNoKey: {
    id: 'aiAssistant.connect.providerFreeModelsNoKey',
    defaultMessage: 'No API key needed',
    description: 'Right of the free-models row, where a key row shows the key',
  },
  providerAddProvider: {
    id: 'aiAssistant.connect.providerAddProvider',
    defaultMessage: 'Add provider',
    description: 'Button that opens the provider list to connect one more',
  },
  providerMethodKey: {
    id: 'aiAssistant.connect.providerMethodKey',
    defaultMessage: 'API key',
    description:
      'In the provider list, next to a provider connected with an API key',
  },
  providerMethodFreeKey: {
    id: 'aiAssistant.connect.providerMethodFreeKey',
    defaultMessage: 'API key · free models available',
    description:
      'In the provider list, next to a provider that gives a free key',
  },
  providerMethodSignIn: {
    id: 'aiAssistant.connect.providerMethodSignIn',
    defaultMessage: 'Sign in with {provider}',
    description:
      'In the provider list, next to a provider connected by signing in',
  },
  providerVerify: {
    id: 'aiAssistant.connect.providerVerify',
    defaultMessage: 'Verify',
    description: 'Button that checks the API key with the provider and adds it',
  },
  providerChecking: {
    id: 'aiAssistant.connect.providerChecking',
    defaultMessage: 'Checking the key with {provider}',
    description:
      'Above the key field while the provider checks the key, in bold',
  },
  providerCheckingNote: {
    id: 'aiAssistant.connect.providerCheckingNote',
    defaultMessage: '— this takes a few seconds.',
    description: 'Follows "Checking the key with {provider}"',
  },
  providerSignInBrowser: {
    id: 'aiAssistant.connect.providerSignInBrowser',
    defaultMessage: 'Your browser should open automatically.',
    description:
      'Above the provider sign-in link and its one-time code, in bold',
  },
  providerSignInBrowserNote: {
    id: 'aiAssistant.connect.providerSignInBrowserNote',
    defaultMessage: 'If not, open the link below and enter this code.',
    description: 'Follows "Your browser should open automatically."',
  },
  providerSignInDeviceCode: {
    id: 'aiAssistant.connect.providerSignInDeviceCode',
    defaultMessage: 'Device code',
    description: 'Label of the one-time code field of a provider sign-in',
  },
  providerCopySignInPage: {
    id: 'aiAssistant.connect.providerCopySignInPage',
    defaultMessage: 'Copy sign-in page',
    description:
      'Accessible label of the button that copies the address of the provider sign-in page',
  },
  providerCopyDeviceCode: {
    id: 'aiAssistant.connect.providerCopyDeviceCode',
    defaultMessage: 'Copy device code',
    description:
      'Accessible label of the button that copies the one-time code of a provider sign-in',
  },
  providerSignInWaitingOn: {
    id: 'aiAssistant.connect.providerSignInWaitingOn',
    defaultMessage: 'Waiting for confirmation on {host}…',
    description:
      'While the provider sign-in waits; host is the site of the sign-in page',
  },
  providerSignInConfirmed: {
    id: 'aiAssistant.connect.providerSignInConfirmed',
    defaultMessage: 'Confirmed on {provider}. Connecting…',
    description:
      'After the provider confirmed the sign-in, while App Lab stores it',
  },
  startBuilding: {
    id: 'aiAssistant.connect.startBuilding',
    defaultMessage: 'Start building',
    description:
      'Button at the bottom of the agent card that starts the agent and opens the chat',
  },
  modelPickerAddProvider: {
    id: 'aiAssistant.chat.modelPickerAddProvider',
    defaultMessage: 'Add provider',
    description: 'Last row of the model menu: opens the provider settings',
  },
  modelPickerOtherModels: {
    id: 'aiAssistant.chat.modelPickerOtherModels',
    defaultMessage: 'Other models',
    description: 'Row of the model menu that opens the list of free models',
  },
  modelPickerAddProviderHint: {
    id: 'aiAssistant.chat.modelPickerAddProviderHint',
    defaultMessage: 'Opens Settings',
    description: 'Next to the Add provider row of the model menu',
  },
  connectedToastProviders: {
    id: 'aiAssistant.connectedToastProviders',
    defaultMessage:
      '{agent} connected. You can add more providers and API keys any time from Settings.',
    description:
      'Success toast after connecting an agent that takes provider keys',
  },
  providerSearchLabel: {
    id: 'aiAssistant.connect.providerSearchLabel',
    defaultMessage: 'Provider',
    description: 'Label of the field that filters the list of model providers',
  },
  textAnswerPlaceholder: {
    id: 'aiAssistant.chat.textAnswerPlaceholder',
    defaultMessage: 'Type your answer',
    description:
      'Placeholder of the field for a free-text question from the agent',
  },
  textAnswerSend: {
    id: 'aiAssistant.chat.textAnswerSend',
    defaultMessage: 'Send',
    description: 'Button that sends the typed answer back to the agent',
  },
  textAnswerSkip: {
    id: 'aiAssistant.chat.textAnswerSkip',
    defaultMessage: 'Skip this question',
    description: 'Link that declines a free-text question from the agent',
  },
  textAnswerStep: {
    id: 'aiAssistant.chat.textAnswerStep',
    defaultMessage: 'Step {counter} — {question}',
    description:
      'Heading of a free-text question that is one step of several the agent asked at once; {counter} reads like "2/3"',
  },
  textAnswerNext: {
    id: 'aiAssistant.chat.textAnswerNext',
    defaultMessage: 'Next',
    description:
      'Button of a free-text question that moves on to the next question of the same batch',
  },
  settingsAccountFree: {
    id: 'aiAssistant.settings.agent.accountFree',
    defaultMessage: 'Free',
    description: 'Account value for an agent connected without any credential',
  },
  settingsMethodFree: {
    id: 'aiAssistant.settings.agent.method.free',
    defaultMessage: 'Free models',
    description: 'Sign-in method for an agent running without any credential',
  },
  providerChoosePlaceholder: {
    id: 'aiAssistant.connect.providerChoosePlaceholder',
    defaultMessage: 'Choose a provider',
    description: 'Placeholder of the provider dropdown before one is chosen',
  },
  providerKeyLabel: {
    id: 'aiAssistant.connect.providerKeyLabel',
    defaultMessage: 'API key',
    description: 'Label of the key field for the selected provider',
  },
  providerKeyAdded: {
    id: 'aiAssistant.connect.providerKeyAdded',
    defaultMessage: '{provider} key checked and added.',
    description:
      'Success toast after a provider API key is verified and stored',
  },
  providerKeyUnchecked: {
    id: 'aiAssistant.connect.providerKeyUnchecked',
    defaultMessage:
      '{provider} key added. It could not be checked, so a wrong one will only show on the first message.',
    description:
      'Toast when a provider key was stored but the provider could not be asked',
  },
  providerKeysRemovedAll: {
    id: 'aiAssistant.connect.providerKeysRemovedAll',
    defaultMessage: 'All provider keys removed.',
    description:
      'Success toast after every provider API key is deleted at once',
  },
  providerDeleteAll: {
    id: 'aiAssistant.connect.providerDeleteAll',
    defaultMessage: 'Remove all',
    description: 'Button above the provider key list that deletes every key',
  },
  providerDeleteAllDialogTitle: {
    id: 'aiAssistant.connect.providerDeleteAllDialogTitle',
    defaultMessage: 'Delete All Providers',
    description:
      'Title of the dialog that confirms deleting every provider key',
  },
  providerDeleteAllDialogHeading: {
    id: 'aiAssistant.connect.providerDeleteAllDialogHeading',
    defaultMessage: 'Delete every key and sign-in?',
    description:
      'Question in the dialog that confirms deleting every provider key',
  },
  providerDeleteAllDialogBody: {
    id: 'aiAssistant.connect.providerDeleteAllDialogBody',
    defaultMessage:
      'The agent keeps only its free models. To use a provider again, add its key or sign in again. You can’t undo this.',
    description:
      'Explanation in the dialog that confirms deleting every provider key',
  },
  providerSignIn: {
    id: 'aiAssistant.connect.providerSignIn',
    defaultMessage: 'Sign in with {provider}',
    description:
      'Button that starts the sign-in for a provider connected by an account, not a key',
  },
  providerSignInHint: {
    id: 'aiAssistant.connect.providerSignInHint',
    defaultMessage: '{provider} needs an active plan on your account.',
    description:
      'Next to the sign-in button: signing in works only with an active plan',
  },
  providerSignInWaiting: {
    id: 'aiAssistant.connect.providerSignInWaiting',
    defaultMessage: 'Waiting for you to authorize…',
    description: 'Shown while the provider sign-in waits for the user',
  },
  providerSignedIn: {
    id: 'aiAssistant.connect.providerSignedIn',
    defaultMessage: 'Signed in',
    description:
      'In the provider list, in place of the masked key for a provider connected by an account',
  },
  providerSignedInToast: {
    id: 'aiAssistant.connect.providerSignedInToast',
    defaultMessage: 'Signed in to {provider}.',
    description: 'Success toast after a provider sign-in completes',
  },
  providerKeyRemoved: {
    id: 'aiAssistant.connect.providerKeyRemoved',
    defaultMessage: '{provider} key removed.',
    description: 'Success toast after a provider API key is deleted',
  },
  providerSignedOut: {
    id: 'aiAssistant.connect.providerSignedOut',
    defaultMessage: 'Signed out of {provider}.',
    description:
      'Success toast after removing a provider connected by signing in, not with a key',
  },
  providerSignInBusy: {
    id: 'aiAssistant.connect.providerSignInBusy',
    defaultMessage:
      'A sign-in to {provider} is already waiting for confirmation in {place}. Finish it or cancel it there first.',
    description:
      'Error when a provider sign-in is started while another one still waits; place is "Agent mode" or "Settings"',
  },
  agentSignInBusy: {
    id: 'aiAssistant.connect.agentSignInBusy',
    defaultMessage:
      'A sign-in to {agent} is already waiting for confirmation in {place}. Finish it or cancel it there first.',
    description:
      'Error when an agent sign-in is started while another one still waits; agent is the one whose sign-in waits, place is "Agent mode" or "Settings"',
  },
  agentSignInRestarting: {
    id: 'aiAssistant.connect.agentSignInRestarting',
    defaultMessage:
      '{agent} is restarting with the sign-in completed in {place}. Wait until it is back.',
    description:
      'Error when an agent sign-in is started while the agent restarts after a sign-in confirmed in the other place; place is "Agent mode" or "Settings"',
  },
  providerSignInBusyElsewhere: {
    id: 'aiAssistant.connect.providerSignInBusyElsewhere',
    defaultMessage:
      'A sign-in to {provider} is already waiting for confirmation. Finish it or cancel it first.',
    description:
      'Error when a provider sign-in is started while another one still waits, in a place App Lab cannot name',
  },
  placeAgentMode: {
    id: 'aiAssistant.connect.placeAgentMode',
    defaultMessage: 'Agent mode',
    description:
      'Names the Agent mode screen inside other messages, as in "waiting for confirmation in Agent mode"',
  },
  placeSettings: {
    id: 'aiAssistant.connect.placeSettings',
    defaultMessage: 'Settings',
    description:
      'Names the Settings screen inside other messages, as in "waiting for confirmation in Settings"',
  },
  providerCancel: {
    id: 'aiAssistant.connect.providerCancel',
    defaultMessage: 'Cancel',
    description:
      'Button beside Verify, or under the provider list, that goes back to the providers without adding one',
  },
  providerListLoading: {
    id: 'aiAssistant.connect.providerListLoading',
    defaultMessage: 'Loading providers…',
    description: 'In the provider dropdown while the list of providers loads',
  },
  providerRemove: {
    id: 'aiAssistant.connect.providerRemove',
    defaultMessage: 'Remove {provider}',
    description: 'Accessible label of the button that deletes one provider key',
  },
  providerCatalogueEmpty: {
    id: 'aiAssistant.connect.providerCatalogueEmpty',
    defaultMessage:
      'The provider list is not ready yet. Start the agent once, then reopen this screen.',
    description:
      'Shown when the engine has not fetched its provider catalogue yet',
  },
  providerFreeKeyLink: {
    id: 'aiAssistant.connect.providerFreeKeyLink',
    defaultMessage: 'Get a free key from {site}',
    description:
      'Link under the key field of a provider that gives a free key, to the site that hands it out',
  },
  providerWhereKey: {
    id: 'aiAssistant.connect.providerWhereKey',
    defaultMessage: 'Where do I find my {provider} API key?',
    description: 'Link to the selected provider docs',
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
    defaultMessage: 'Hi, what do you want to build today?',
    description: 'Title of the empty chat state',
  },
  chatEmptyTitleCompact: {
    id: 'aiAssistant.chat.empty.titleCompact',
    defaultMessage:
      'Ask about this app — the agent already sees the file you have open.',
    description: 'Title of the empty chat state in the docked agent side panel',
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
  offlineToast: {
    id: 'aiAssistant.chat.offlineToast',
    defaultMessage:
      "You're offline. The assistant needs a connection to reply.",
    description:
      'Toast shown for as long as the computer has no network connection; it clears itself once the connection is back',
  },
  offlineRequestError: {
    id: 'aiAssistant.chat.offlineRequestError',
    defaultMessage:
      "The request couldn't reach the assistant. Check your connection and try again.",
    description:
      'Reason shown in the failed-turn banner when the request never reached the provider',
  },
  internalRequestError: {
    id: 'aiAssistant.chat.internalRequestError',
    defaultMessage:
      'The agent reported an internal error and gave no reason. Try again; if it happens again, start a new chat.',
    description:
      'Reason shown in the failed-turn banner when the agent failed without saying why',
  },
  providerAuthRequestError: {
    id: 'aiAssistant.chat.providerAuthRequestError',
    defaultMessage:
      'The model provider refused the request: {error}. Check its key in Settings, or pick another model.',
    description:
      "Reason shown in the failed-turn banner when one model provider rejected its key; {error} is the provider's own words",
  },
  chatOpenSettings: {
    id: 'aiAssistant.chat.openSettings',
    defaultMessage: 'Open Settings',
    description:
      'Action of the failed-turn banner that opens the agent section of Settings',
  },
  modelPickFailed: {
    id: 'aiAssistant.chat.modelPickFailed',
    defaultMessage:
      "The agent didn't switch to that model. The chat keeps the model shown.",
    description:
      'Toast shown when the agent refused a model the user picked from the model menu',
  },
  replayedRequestError: {
    id: 'aiAssistant.chat.replayedRequestError',
    defaultMessage:
      'The last reply in this chat failed. Try again, or start a new chat.',
    description:
      'Reason shown in the failed-turn banner of a reopened chat whose last turn failed while it was closed or before a restart',
  },
  sessionGoneRequestError: {
    id: 'aiAssistant.chat.sessionGoneRequestError',
    defaultMessage:
      'The agent no longer has this chat, so it cannot reopen it. Start a new chat.',
    description:
      'Reason shown in the failed-turn banner when the agent cannot reopen the chat the prompt was sent to, and never will',
  },
  sessionLoadFailedRequestError: {
    id: 'aiAssistant.chat.sessionLoadFailedRequestError',
    defaultMessage: 'The agent could not reopen this chat. Try again.',
    description:
      'Reason shown in the failed-turn banner when the agent failed to reopen the chat the prompt was sent to, and trying again can help',
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
  chatQueuedCount: {
    id: 'aiAssistant.chat.queuedCount',
    defaultMessage: '{count, plural, other {# queued}}',
    description:
      'Header of the queue accordion, shown once three or more prompts are waiting; the rows open below it',
  },
  chatQueuedClearAll: {
    id: 'aiAssistant.chat.queuedClearAll',
    defaultMessage: 'Clear all',
    description:
      'Button in the queue accordion header that drops every queued prompt before it is sent',
  },
  chatQueuedRemove: {
    id: 'aiAssistant.chat.queuedRemove',
    defaultMessage: 'Remove from queue',
    description:
      'Label of the button that drops a queued prompt before it is sent',
  },
  chatStop: {
    id: 'aiAssistant.chat.stop',
    defaultMessage: 'Stop',
    description: 'Label of the chat stop button that aborts the current turn',
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
  workspacePickerPrefix: {
    id: 'aiAssistant.workspace.prefix',
    defaultMessage: 'New session in',
    description: 'Label before the workspace picker, shown on an empty chat',
  },
  workspacePicker: {
    id: 'aiAssistant.workspace.picker',
    defaultMessage: 'Workspace',
    description: 'Accessible name of the workspace picker',
  },
  permDescription: {
    id: 'aiAssistant.permission.description',
    defaultMessage: 'Allow the agent to do this?',
    description: 'Body of the tool permission dialog',
  },
  permOutsideWorkspace: {
    id: 'aiAssistant.permission.outsideWorkspace',
    defaultMessage: 'Outside this app',
    description:
      'Badge on a permission prompt whose action writes into an app other than the session workspace',
  },
  permOutsideApp: {
    id: 'aiAssistant.permission.outsideApp',
    defaultMessage: 'Outside this app: {app}',
    description:
      'Badge on a permission prompt or a tool row whose action lands in another app; {app} is that app’s name',
  },
  chatUsedTools: {
    id: 'aiAssistant.chat.usedTools',
    defaultMessage: '{count, plural, one {Used # tool} other {Used # tools}}',
    description:
      'Activity block header naming how many tools a turn used, when their kinds have no wording of their own',
  },
  chatActionRead: {
    id: 'aiAssistant.chat.action.read',
    defaultMessage: '{count, plural, one {Read # file} other {Read # files}}',
    description:
      'What a turn did: the first phrase of its activity summary ("Read 3 files, ran 2 commands"), and a row for several files',
  },
  chatActionReadNext: {
    id: 'aiAssistant.chat.action.readNext',
    defaultMessage: '{count, plural, one {read # file} other {read # files}}',
    description:
      'The same as aiAssistant.chat.action.read, after another phrase of the activity summary: "read 3 files" in "Ran 2 commands, read 3 files"',
  },
  chatActionEdited: {
    id: 'aiAssistant.chat.action.edited',
    defaultMessage:
      '{count, plural, one {Edited # file} other {Edited # files}}',
    description:
      'What a turn did: the first phrase of its activity summary, and a row for several files',
  },
  chatActionEditedNext: {
    id: 'aiAssistant.chat.action.editedNext',
    defaultMessage:
      '{count, plural, one {edited # file} other {edited # files}}',
    description:
      'The same as aiAssistant.chat.action.edited, after another phrase of the activity summary: "edited 3 files" in "Ran 2 commands, edited 3 files"',
  },
  chatActionDeleted: {
    id: 'aiAssistant.chat.action.deleted',
    defaultMessage:
      '{count, plural, one {Deleted # file} other {Deleted # files}}',
    description:
      'What a turn did: the first phrase of its activity summary, and a row for several files',
  },
  chatActionDeletedNext: {
    id: 'aiAssistant.chat.action.deletedNext',
    defaultMessage:
      '{count, plural, one {deleted # file} other {deleted # files}}',
    description:
      'The same as aiAssistant.chat.action.deleted, after another phrase of the activity summary: "deleted 3 files" in "Ran 2 commands, deleted 3 files"',
  },
  chatActionMoved: {
    id: 'aiAssistant.chat.action.moved',
    defaultMessage: '{count, plural, one {Moved # file} other {Moved # files}}',
    description:
      'What a turn did: the first phrase of its activity summary, and a row for several files',
  },
  chatActionMovedNext: {
    id: 'aiAssistant.chat.action.movedNext',
    defaultMessage: '{count, plural, one {moved # file} other {moved # files}}',
    description:
      'The same as aiAssistant.chat.action.moved, after another phrase of the activity summary: "moved 3 files" in "Ran 2 commands, moved 3 files"',
  },
  chatActionRanCommands: {
    id: 'aiAssistant.chat.action.ranCommands',
    defaultMessage:
      '{count, plural, one {Ran # command} other {Ran # commands}}',
    description: 'What a turn did: the first phrase of its activity summary',
  },
  chatActionRanCommandsNext: {
    id: 'aiAssistant.chat.action.ranCommandsNext',
    defaultMessage:
      '{count, plural, one {ran # command} other {ran # commands}}',
    description:
      'The same as aiAssistant.chat.action.ranCommands, after another phrase of the activity summary: "ran 2 commands" in "Read 3 files, ran 2 commands"',
  },
  chatActionRanSearches: {
    id: 'aiAssistant.chat.action.ranSearches',
    defaultMessage:
      '{count, plural, one {Ran # search} other {Ran # searches}}',
    description: 'What a turn did: the first phrase of its activity summary',
  },
  chatActionRanSearchesNext: {
    id: 'aiAssistant.chat.action.ranSearchesNext',
    defaultMessage:
      '{count, plural, one {ran # search} other {ran # searches}}',
    description:
      'The same as aiAssistant.chat.action.ranSearches, after another phrase of the activity summary: "ran 2 searches" in "Read 3 files, ran 2 searches"',
  },
  chatActionFetched: {
    id: 'aiAssistant.chat.action.fetched',
    defaultMessage:
      '{count, plural, one {Fetched # page} other {Fetched # pages}}',
    description: 'What a turn did: the first phrase of its activity summary',
  },
  chatActionFetchedNext: {
    id: 'aiAssistant.chat.action.fetchedNext',
    defaultMessage:
      '{count, plural, one {fetched # page} other {fetched # pages}}',
    description:
      'The same as aiAssistant.chat.action.fetched, after another phrase of the activity summary: "fetched 2 pages" in "Read 3 files, fetched 2 pages"',
  },
  chatActionRanTasks: {
    id: 'aiAssistant.chat.action.ranTasks',
    defaultMessage: '{count, plural, one {Ran # task} other {Ran # tasks}}',
    description: 'What a turn did: the first phrase of its activity summary',
  },
  chatActionRanTasksNext: {
    id: 'aiAssistant.chat.action.ranTasksNext',
    defaultMessage: '{count, plural, one {ran # task} other {ran # tasks}}',
    description:
      'The same as aiAssistant.chat.action.ranTasks, after another phrase of the activity summary: "ran 2 tasks" in "Read 3 files, ran 2 tasks"',
  },
  chatActionSteps: {
    id: 'aiAssistant.chat.action.steps',
    defaultMessage: '{count, plural, one {# step} other {# steps}}',
    description:
      'What a turn did, at any place in its activity summary, for tools whose kind has no wording of its own',
  },
  chatFileRead: {
    id: 'aiAssistant.chat.file.read',
    defaultMessage: 'Read',
    description:
      'Activity row title, followed by the name of the one file the tool read',
  },
  chatFileEdited: {
    id: 'aiAssistant.chat.file.edited',
    defaultMessage: 'Edited',
    description:
      'Activity row title, followed by the name of the one file the tool edited',
  },
  chatFileDeleted: {
    id: 'aiAssistant.chat.file.deleted',
    defaultMessage: 'Deleted',
    description:
      'Activity row title, followed by the name of the one file the tool deleted',
  },
  chatFileMoved: {
    id: 'aiAssistant.chat.file.moved',
    defaultMessage: 'Moved',
    description:
      'Activity row title, followed by the name of the one file the tool moved',
  },
  chatFileRan: {
    id: 'aiAssistant.chat.file.ran',
    defaultMessage: 'Ran',
    description:
      'Activity row title, followed by the name of the one file the tool ran on',
  },
  chatFileFetched: {
    id: 'aiAssistant.chat.file.fetched',
    defaultMessage: 'Fetched',
    description:
      'Activity row title, followed by the name of the one file the tool fetched',
  },
  chatPhaseReading: {
    id: 'aiAssistant.chat.phase.reading',
    defaultMessage: 'Reading files',
    description: 'Live label while the agent runs a tool that reads files',
  },
  chatPhaseEditing: {
    id: 'aiAssistant.chat.phase.editing',
    defaultMessage: 'Editing files',
    description:
      'Live label while the agent runs a tool that edits, deletes or moves files',
  },
  chatPhaseRunning: {
    id: 'aiAssistant.chat.phase.running',
    defaultMessage: 'Running commands',
    description: 'Live label while the agent runs a command',
  },
  chatPhaseSearching: {
    id: 'aiAssistant.chat.phase.searching',
    defaultMessage: 'Searching',
    description: 'Live label while the agent searches',
  },
  chatPhaseFetching: {
    id: 'aiAssistant.chat.phase.fetching',
    defaultMessage: 'Fetching',
    description: 'Live label while the agent fetches a page',
  },
  chatThinking: {
    id: 'aiAssistant.chat.thinking',
    defaultMessage: 'Thinking',
    description: 'Live label while the agent reasons',
  },
  chatThinkingWorking: {
    id: 'aiAssistant.chat.thinking.working',
    defaultMessage: 'Working through it',
    description:
      'Live label after 20 seconds of reasoning: the phrases rotate so a long wait shows progress',
  },
  chatThinkingReasoning: {
    id: 'aiAssistant.chat.thinking.reasoning',
    defaultMessage: 'Reasoning it out',
    description: 'Live label after 40 seconds of reasoning',
  },
  chatThinkingConnecting: {
    id: 'aiAssistant.chat.thinking.connecting',
    defaultMessage: 'Connecting the dots',
    description: 'Live label after 60 seconds of reasoning',
  },
  chatThinkingAlmost: {
    id: 'aiAssistant.chat.thinking.almost',
    defaultMessage: 'Almost there',
    description: 'Live label after 80 seconds of reasoning',
  },
  chatThought: {
    id: 'aiAssistant.chat.thought',
    defaultMessage: 'Thought',
    description:
      'Label of a finished reasoning block whose duration is unknown, as in replayed history',
  },
  chatThoughtFor: {
    id: 'aiAssistant.chat.thoughtFor',
    defaultMessage: 'Thought for {seconds}s',
    description:
      'Label of a finished reasoning block, with its duration in seconds',
  },
  chatActivityDone: {
    id: 'aiAssistant.chat.activityDone',
    defaultMessage: 'Done',
    description: 'Last row of the activity timeline of a turn that has ended',
  },
  chatStoppedByUser: {
    id: 'aiAssistant.chat.stoppedByUser',
    defaultMessage: 'You stopped the agent',
    description:
      'Shown under a reply whose turn the user stopped, or alone when the turn stopped before any reply',
  },
  chatRequestFailed: {
    id: 'aiAssistant.chat.requestFailed',
    defaultMessage: 'Request failed',
    description: 'Title of the error shown when a prompt did not get an answer',
  },
  chatRequestRetry: {
    id: 'aiAssistant.chat.requestRetry',
    defaultMessage: 'Retry',
    description: 'Action that sends the failed prompt again',
  },
  permWaiting: {
    id: 'aiAssistant.permission.waiting',
    defaultMessage: 'Waiting for your approval',
    description:
      'Live loader label while the turn is parked on a permission prompt',
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
  settingsBusyTurn: {
    id: 'aiAssistant.settings.busyTurn',
    defaultMessage:
      'The agent is answering. Changing this now would stop it, so wait for the turn to finish.',
    description:
      'Tooltip on the Settings actions that restart the agent, while a turn is running',
  },
  settingsBusyRestart: {
    id: 'aiAssistant.settings.busyRestart',
    defaultMessage:
      'The agent is restarting. Wait until it is back, then change its keys.',
    description:
      'Tooltip on the provider key actions in Settings while the agent restarts',
  },
  credentialRestartWaiting: {
    id: 'aiAssistant.credentialRestart.waiting',
    defaultMessage:
      '{agent} is answering. It will restart with your change when the turn ends.',
    description:
      'Shown in the chat and in Settings while a key change waits for the running turn to end before the agent restarts',
  },
  credentialRestarting: {
    id: 'aiAssistant.credentialRestart.restarting',
    defaultMessage:
      '{agent} is restarting with your change. Send your message once it is back.',
    description:
      'Shown in the chat while the agent restarts to pick up a new key or a new agent; sending waits meanwhile',
  },
  errorSwitchUnsavedEdits: {
    id: 'aiAssistant.error.switchUnsavedEdits',
    defaultMessage:
      "Can't switch the agent yet: the edits in {apps} are not saved to the board, and switching would delete them. Try again.",
    description:
      'Error when changing agent is refused because edits in some apps could not be saved to the board; apps is a list of app names',
  },
  errorSwitchConflictingEdits: {
    id: 'aiAssistant.error.switchConflictingEdits',
    defaultMessage:
      "Can't switch the agent yet: the agent's edits to {apps} conflict with changes made on the board since its checkout, so they are not on the board. Ask the agent to check out {apps} again, then apply its edits again or drop them. Then switch.",
    description:
      'Error when changing agent is refused because the agent edits in some apps conflict with changes made on the board; apps is a list of app names',
  },
  errorSwitchConflictingEditsAmong: {
    id: 'aiAssistant.error.switchConflictingEditsAmong',
    defaultMessage:
      "Can't switch the agent yet: the agent's edits to {apps} are not on the board. Where they conflict with changes made on the board since its checkout, ask the agent to check out the app again, then apply its edits again or drop them. Where they could not be saved, check the board connection. Then switch.",
    description:
      'Error when changing agent is refused because of agent edits that conflict with board changes in some of the apps, when App Lab cannot tell which; apps is a list of app names',
  },
  errorSwitchEditsNotSavedEither: {
    id: 'aiAssistant.error.switchEditsNotSavedEither',
    defaultMessage:
      'The edits to {apps} could not be saved to the board either: check the board connection.',
    description:
      'Follows the conflicting-edits error, for the apps whose edits failed to save for another reason; apps is a list of app names',
  },
  errorSwitchStrandedEdits: {
    id: 'aiAssistant.error.switchStrandedEdits',
    defaultMessage:
      "Can't switch the agent yet: {count, plural, one {the folder {folders} holds} other {the folders {folders} hold}} edits that belong to no app on the board, so they cannot be saved. Move or delete them first.",
    description:
      'Error when changing agent is refused because some workspace folders match no app on the board; folders is a list of folder names, count how many',
  },
  errorSwitchAgentStopped: {
    id: 'aiAssistant.error.switchAgentStopped',
    defaultMessage:
      'The agent you were using could not start again and is stopped. Reconnect it to carry on.',
    description:
      'Follows a refused agent change, when App Lab had stopped the agent in use and could not start it again',
  },
  errorDiskSpace: {
    id: 'aiAssistant.error.diskSpace',
    defaultMessage:
      'Not enough disk space to install the agent: it needs about {needed} free, and this disk has {free}.',
    description:
      'Error when the agent runtime cannot be installed for lack of disk space; needed and free are sizes like "1.5 GB"',
  },
  errorDiskSpaceUnknown: {
    id: 'aiAssistant.error.diskSpaceUnknown',
    defaultMessage:
      'Not enough disk space to install the agent. Free some space, then try again.',
    description:
      'Error when the agent runtime cannot be installed for lack of disk space, and the sizes are unknown',
  },
  errorProviderKeyRejected: {
    id: 'aiAssistant.error.providerKeyRejected',
    defaultMessage:
      '{provider} did not accept this API key. Check that you copied the whole key from your {provider} account.',
    description:
      'Error when the provider answered that the API key the user added is not valid; provider is a name like "Google Gemini"',
  },
  errorProviderKeyRejectedSaying: {
    id: 'aiAssistant.error.providerKeyRejectedSaying',
    defaultMessage:
      '{provider} did not accept this API key and answered: "{reason}". Check that you copied the whole key from your {provider} account.',
    description:
      'Error when the provider refused the API key the user added; reason is what the provider answered, in English, like "invalid x-api-key"',
  },
  errorProviderKeyHasSpaces: {
    id: 'aiAssistant.error.providerKeyHasSpaces',
    defaultMessage:
      'The key has a space or a line break inside. Copy it again as one line, with nothing around it.',
    description:
      'Error when the pasted API key holds a space or a line break; nothing was sent or kept',
  },
  errorProviderKeyTextBefore: {
    id: 'aiAssistant.error.providerKeyTextBefore',
    defaultMessage:
      'The text you pasted has something before the key. Paste only the key: it starts with "{prefix}".',
    description:
      'Error when the pasted text holds the API key after some other text, like "NAME=" or a quote; prefix is how the keys start, like "sk-ant-"',
  },
  errorProviderKeyRepeated: {
    id: 'aiAssistant.error.providerKeyRepeated',
    defaultMessage:
      'The text you pasted holds the key more than once. Paste it only once.',
    description:
      'Error when the pasted text holds the same API key twice; nothing was sent or kept',
  },
  errorProviderKeyForAnotherProvider: {
    id: 'aiAssistant.error.providerKeyForAnotherProvider',
    defaultMessage:
      'This key is for {keyProvider}, not {provider}. Paste your {provider} API key here, or add this one under {keyProvider}.',
    description:
      'Error when the user pasted the API key of another provider, recognized by how it starts; nothing was sent or kept. Both are provider names like "Anthropic"',
  },
  chatUnnamedSession: {
    id: 'aiAssistant.chat.unnamedSession',
    defaultMessage: 'New session',
    description:
      'Chat header title before the engine names the session, matching the side panel header',
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
  sessionsGeneralFolder: {
    id: 'aiAssistant.sessions.generalFolder',
    defaultMessage: 'Arduino Apps',
    description:
      'Side panel folder holding the sessions started outside an app',
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
    description:
      'Action that switches the chat to this agent and makes it the default',
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
  settingsRuntimeNode: {
    id: 'aiAssistant.settings.runtime.node',
    defaultMessage: 'Node',
    description: 'Column label for the bundled Node version',
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

// Keyed by agent id; the descriptor's own text stands in for an agent with no entry.
export const agentDescriptions = defineMessages({
  claude: {
    id: 'aiAssistant.agent.claude.description',
    defaultMessage: 'Use your Claude Pro/Max account or an Anthropic API key',
    description:
      'Subtitle of the Claude Code card in the connect panel and Settings',
  },
  opencode: {
    id: 'aiAssistant.agent.opencode.description',
    defaultMessage: 'Open-source coding Agent · use it with OpenCode or Gemini',
    description:
      'Subtitle of the OpenCode card in the connect panel and Settings',
  },
  codex: {
    id: 'aiAssistant.agent.codex.description',
    defaultMessage: 'Use your ChatGPT Plus/Pro account or an OpenAI API key',
    description: 'Subtitle of the Codex card in the connect panel and Settings',
  },
});

// Keyed by provider id: the account a sign-in provider is signed in with, named in "Sign in with …" and "Confirmed on …".
export const providerSignInBrands = defineMessages({
  'github-copilot': {
    id: 'aiAssistant.connect.providerBrand.githubCopilot',
    defaultMessage: 'GitHub',
    description:
      'The account a GitHub Copilot sign-in uses, as in "Sign in with GitHub" and "Confirmed on GitHub"',
  },
});
