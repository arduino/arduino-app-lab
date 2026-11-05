import errorSvgRaw from '../../../assets/attention-exclamation-icon.svg?raw';
import infoSvgRaw from '../../../assets/info-setup.svg?raw';
import warningSvgRaw from '../../../assets/triangle-sharp-outline.svg?raw';

const svgMaskUrl = (svg: string): string => {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

const ERROR_ICON_MASK = svgMaskUrl(errorSvgRaw);
const WARNING_ICON_MASK = svgMaskUrl(warningSvgRaw);
const INFO_ICON_MASK = svgMaskUrl(infoSvgRaw);

const TOOLTIP_PADDING_Y = '6px';
const TOOLTIP_PADDING_X = '8px';
const TOOLTIP_PADDING = `${TOOLTIP_PADDING_Y} ${TOOLTIP_PADDING_X}`;

const hoverStyles = {
  '.cm-tooltip.cm-tooltip-hover': {
    backgroundColor: 'var(--surface-bg-baseline, #232B2E)',
    borderRadius: '8px',
    border: '1px solid var(--border-default, #434F54)',
    fontSize: `12px`,
    maxWidth: '500px',
    maxHeight: '300px',
    overflowY: 'auto',
  },

  '.cm-tooltip.cm-tooltip-hover .cm-lsp-hover-tooltip': {
    color: 'var(--text-default, #FFF)',
    padding: TOOLTIP_PADDING,
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  },

  '.cm-tooltip.cm-tooltip-hover .cm-lsp-hover-tooltip pre': {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: '0',
  },

  // To modify the code element
  // '.cm-tooltip.cm-tooltip-hover .cm-lsp-hover-tooltip code': {},

  // The line
  '.cm-tooltip-section:not(:first-child)': {
    borderTop: '1px solid var(--border-default, #434F54)',
  },

  '.cm-diagnostic-action': {
    color: 'var(--text-accent, #25C2C7)',
    cursor: 'pointer',
  },

  '.cm-tooltip.cm-tooltip-hover .cm-tooltip-lint': {
    padding: `${TOOLTIP_PADDING_Y} 0`,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },

  '.cm-diagnostic': {
    padding: `0 ${TOOLTIP_PADDING_X}`,
    marginLeft: '0',
    borderLeft: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },

  '.cm-diagnostic::before': {
    content: '""',
    display: 'inline-block',
    width: '16px',
    height: '16px',
    flexShrink: '0',
    backgroundColor: 'currentColor',
    maskSize: 'contain',
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
  },

  '.cm-diagnostic-error': {
    color: 'var(--feedback-error-default, #FF8878)',
  },

  '.cm-diagnostic-error::before': {
    maskImage: ERROR_ICON_MASK,
  },

  '.cm-diagnostic-warning': {
    color: 'var(--feedback-warning-default, #C1AB15)',
  },

  '.cm-diagnostic-warning::before': {
    maskImage: WARNING_ICON_MASK,
  },

  '.cm-diagnostic-info': {
    color: 'var(--text-subtle, #c9d2d2)',
  },

  '.cm-diagnostic-info::before': {
    maskImage: INFO_ICON_MASK,
  },

  '.cm-diagnostic-hint': {
    color: 'var(--text-subtle, #c9d2d2)',
  },

  '.cm-diagnostic-hint::before': {
    maskImage: INFO_ICON_MASK,
  },
};

const documentationStyles = {
  '.cm-tooltip .cm-lsp-documentation a': {
    color: 'var(--text-accent, #25C2C7)',
    fontWeight: '600',
  },

  '.cm-tooltip .cm-lsp-documentation hr': {
    border: 'none',
    borderTop: '1px solid var(--border-default, #434F54)',
    margin: '6px -8px',
  },
};

const autoCompleteStyles = {
  // tooltip container
  '.cm-tooltip.cm-tooltip-autocomplete': {
    backgroundColor: 'var(--surface-bg-baseline, #232B2E)',
    borderRadius: '8px',
    border: '1px solid var(--border-default, #434F54)',
    fontSize: `12px`,
  },

  // autocomplete list items
  '.cm-tooltip.cm-tooltip-autocomplete ul li': {
    display: 'flex',
    alignItems: 'center',
    height: '20px',
    padding: '0 8px',
    color: 'var(--text-default, #FFF)',
  },

  // auto-import detail label (e.g., "(auto import from module)")
  '.cm-tooltip.cm-tooltip-autocomplete .cm-completionDetail': {
    color: 'var(--text-subtle, #c9d2d2)',
  },

  // selected item in the autocomplete dropdown
  '.cm-tooltip.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--tealscale-sapphire-20, rgba(37, 194, 199, 0.20))',
  },

  // hover state for autocomplete items
  '.cm-tooltip.cm-tooltip-autocomplete ul li:hover': {
    backgroundColor: 'var(--surface-bg-above, #374146)',
  },

  // Matched text in the autocomplete dropdown
  '.cm-tooltip.cm-tooltip-autocomplete .cm-completionMatchedText': {
    color: 'var(--text-accent, #25C2C7)',
    fontWeight: '600',
    textDecoration: 'none',
  },

  // info panel shown alongside the completion list (e.g., auto-import preview)
  '.cm-tooltip.cm-tooltip-autocomplete .cm-completionInfo': {
    backgroundColor: 'var(--surface-bg-baseline, #232B2E)',
    border: '1px solid var(--border-default, #434F54)',
    borderRadius: '8px',
    color: 'var(--text-default, #FFF)',
    fontSize: '12px',
  },

  // scrollbar
  '.cm-tooltip.cm-tooltip-autocomplete ul::-webkit-scrollbar': {
    width: '8px',
  },
  '.cm-tooltip.cm-tooltip-autocomplete ul::-webkit-scrollbar-thumb': {
    border: '4px solid #171e21',
  },
  '.cm-tooltip.cm-tooltip-autocomplete ul::-webkit-scrollbar-track': {
    backgroundColor: 'transparent',
  },
};

const RENAME_ROW_GUTTER = '8px';

const renameStyles = {
  '.cm-panel.cm-lsp-rename-panel': {
    position: 'absolute',
    boxSizing: 'border-box',
    maxWidth: 'calc(100% - 16px)',
    zIndex: 99999,
    backgroundColor: 'var(--surface-bg-baseline, #232B2E)',
    borderRadius: '8px',
    border: '1px solid var(--border-default, #434F54)',
    padding: '6px 0 4px',
  },

  // Input above the hint/validation message (see lsp-rename-panel.ts).
  '.cm-panel.cm-lsp-rename-panel .cm-lsp-rename-content': {
    display: 'flex',
    flexDirection: 'column',
  },

  '.cm-panel.cm-lsp-rename-panel .cm-lsp-rename-input': {
    color: 'var(--text-default, #FFF)',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: '4px',
    boxSizing: 'border-box',
    height: '18px',
    margin: `2px ${RENAME_ROW_GUTTER}`,
    padding: '0 4px',
    fontSize: '12px',
  },

  // Focus accent for the input
  '.cm-panel.cm-lsp-rename-panel .cm-lsp-rename-input:focus, .cm-panel.cm-lsp-rename-panel .cm-lsp-rename-input:focus-visible':
    {
      outline: 'none',
      border: '1px solid var(--text-accent, #25C2C7)',
      borderRadius: '4px',
    },

  '.cm-panel.cm-lsp-rename-panel .cm-lsp-rename-message': {
    fontSize: '10px',
    lineHeight: '1.6',
    color: 'var(--text-subtle, #c9d2d2)',
    marginTop: '2px',
    padding: `0 ${RENAME_ROW_GUTTER}`,
    maxWidth: '280px',
  },

  // The message turns into a validation error when the typed name is rejected.
  '.cm-panel.cm-lsp-rename-panel .cm-lsp-rename-message-error': {
    color: 'var(--feedback-error-default, #FF8878)',
  },

  '.cm-panel.cm-lsp-rename-panel .cm-lsp-rename-input[aria-invalid=true]': {
    border: '1px solid var(--feedback-error-default, #FF8878)',
  },

  '.cm-panel.cm-lsp-rename-panel .cm-dialog-close': {
    display: 'none',
  },
};

const codeActionStyles = {
  '.cm-lsp-lightbulb': {
    position: 'absolute',
    transform: 'translateX(-100%)',
    marginLeft: '-4px',
    cursor: 'pointer',
    opacity: '0.7',
    fontSize: '12px',
    lineHeight: '1',
    userSelect: 'none',
    '&:hover': {
      opacity: '1',
    },
  },

  '.cm-lsp-code-action-menu': {
    position: 'fixed',
    zIndex: '99999',
    minWidth: '200px',
    maxWidth: '400px',
    backgroundColor: 'var(--surface-bg-baseline, #232B2E)',
    border: '1px solid var(--border-default, #434F54)',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    padding: '4px 0',
    fontSize: '12px',
  },

  '.cm-lsp-code-action-item': {
    padding: '6px 12px',
    cursor: 'pointer',
    color: 'var(--text-default, #FFF)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    '&:hover': {
      backgroundColor: 'var(--surface-bg-above, #374146)',
    },
  },
};

const documentHighlightStyles = {
  // plain textual match (no semantics) + read access (e.g. variable usage)
  '.cm-lsp-highlight-text, .cm-lsp-highlight-read': {
    backgroundColor: '#575757b8',
  },

  // write access (e.g. assignment / declaration)
  '.cm-lsp-highlight-write': {
    backgroundColor: '#004972b8',
  },
};

// lsp clickable item (go-to-definition/find-all-refs)
const navigationFeaturesStyles = {
  '.cm-lsp-clickable-text': {
    cursor: 'pointer',
    textDecoration: 'underline',
    color: 'var(--text-accent, #25c2c7)',
    fontWeight: '600',
  },
};
const tooltipSignatureStyles = {
  '.cm-tooltip.cm-lsp-signature-tooltip': {
    backgroundColor: 'var(--surface-bg-baseline, #232B2E)',
    border: '1px solid var(--border-default, #434F54)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'var(--text-default, #FFF)',
    padding: TOOLTIP_PADDING,
    maxWidth: '500px',
    maxHeight: '300px',
    overflowY: 'auto', // override the library default "scroll" which always forces a visible scrollbar
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    zIndex: 99999,
  },

  // The library's own theme shrinks documentation inside a signature tooltip to 80%
  '.cm-tooltip.cm-lsp-signature-tooltip .cm-lsp-documentation': {
    fontSize: 'inherit',
  },

  '.cm-tooltip.cm-lsp-signature-tooltip .cm-lsp-active-parameter': {
    fontWeight: 'inherit',
    color: 'var(--editor-syntax-highlight-string, #00AB75)',
  },

  // Markdown documentation can render code blocks as <pre>, which default to
  // white-space: pre and refuse to wrap. Allow wrapping while keeping newlines.
  '.cm-tooltip.cm-lsp-signature-tooltip .cm-lsp-signature-documentation pre': {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: '0',
  },
};

const tooltipFeedbackStyles = {
  '.cm-tooltip.cm-lsp-feedback-tooltip': {
    backgroundColor: 'var(--surface-bg-baseline, #232B2E)',
    border: '1px solid var(--border-default, #434F54)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'var(--text-default, #FFF)',
    padding: TOOLTIP_PADDING,
    pointerEvents: 'none',
    zIndex: 99999,
  },
};

const completionIconStyles = {
  // Overrides @codemirror/autocomplete icons
  '.cm-completionIcon-function, .cm-completionIcon-method': {
    '&:after': { content: "'🔧'" },
  },
  '.cm-completionIcon-class': {
    '&:after': { content: "'📦'" },
  },
  '.cm-completionIcon-interface': {
    '&:after': { content: "'🔌'" },
  },
  '.cm-completionIcon-variable': {
    '&:after': { content: "'📝'" },
  },
  '.cm-completionIcon-constant': {
    '&:after': { content: "'🔒'" },
  },
  '.cm-completionIcon-type': {
    '&:after': { content: "'🏷️'" },
  },
  '.cm-completionIcon-enum': {
    '&:after': { content: "'🔢'" },
  },
  '.cm-completionIcon-property': {
    '&:after': { content: "'📎'" },
  },
  '.cm-completionIcon-keyword': {
    '&:after': { content: "'🔑'" },
  },
  '.cm-completionIcon-namespace': {
    '&:after': { content: "'📁'" },
  },
  '.cm-completionIcon-text': {
    '&:after': { content: "'💬'" },
  },

  // Icons for .ino-specific autocomplete keyword categories
  '.cm-completionIcon-methods': {
    '&:after': { content: "'🔧'" },
  },
  '.cm-completionIcon-builtIn': {
    '&:after': { content: "'⚙️'" },
  },
  '.cm-completionIcon-hints': {
    '&:after': { content: "'💡'" },
  },
  '.cm-completionIcon-literal': {
    '&:after': { content: "'🔠'" },
  },
};

export const lspStyles = {
  ...hoverStyles,
  ...documentationStyles,
  ...autoCompleteStyles,
  ...renameStyles,
  ...codeActionStyles,
  ...documentHighlightStyles,
  ...navigationFeaturesStyles,
  ...tooltipSignatureStyles,
  ...tooltipFeedbackStyles,
  ...completionIconStyles,
};
