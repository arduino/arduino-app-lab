import { autocompletion } from '@codemirror/autocomplete';

export const autocompletionConfig: Parameters<typeof autocompletion>[0] = {
  activateOnTyping: true,
  activateOnTypingDelay: 100,
  selectOnOpen: true,
  closeOnBlur: true,
  maxRenderedOptions: undefined,
  defaultKeymap: true,
  aboveCursor: true,
  icons: true,
};
