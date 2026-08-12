import errorSvgRaw from '../../../../../images/assets/error.svg?raw';
import infoSvgRaw from '../../../../../images/assets/info-icon-outline.svg?raw';
import warningSvgRaw from '../../../../../images/assets/warning.svg?raw';

const svgMaskUrl = (svg: string): string => {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

const ERROR_ICON_MASK = svgMaskUrl(errorSvgRaw);
const WARNING_ICON_MASK = svgMaskUrl(warningSvgRaw);
const INFO_ICON_MASK = svgMaskUrl(infoSvgRaw);

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
    padding: '4px 8px',
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

  '.cm-diagnostic': {
    padding: '4px 8px',
    marginLeft: '0',
    borderLeft: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },

  '.cm-diagnostic::before': {
    content: '""',
    display: 'inline-block',
    width: '14px',
    height: '14px',
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

  '.cm-tooltip.cm-tooltip-hover .cm-lsp-hover-tooltip a': {
    color: 'var(--text-accent, #25C2C7)',
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

const renameStyles = {
  '.cm-panel.cm-lsp-rename-panel': {
    position: 'fixed',
    zIndex: 99999,
    backgroundColor: 'var(--surface-bg-baseline, #232B2E)',
    borderRadius: '8px',
    border: '1px solid var(--border-default, #434F54)',
    padding: '8px 24px 8px 16px',
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
    padding: '4px 12px',
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
    fontSize: '11px',
    color: 'var(--text-subtle, #c9d2d2)',
    marginTop: '6px',
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
    color: 'var(--text-subtle, #c9d2d2)',
    cursor: 'pointer',
    position: 'absolute',
    right: '8px',
  },
};

const referenceStyles = {
  // The library renders the panel via CodeMirror's showPanel, which adds a
  // .cm-panels-bottom container (sticky, dark background, top border) to the
  // editor's DOM. The reference panel itself is positioned fixed so it floats
  // to the top-right, but the container strip remains visible at the bottom.
  // This rule collapses the container so no dark strip appears.
  '.cm-panels': {
    borderTop: 'none',
  },

  '.cm-lsp-reference-panel': {
    position: 'fixed',
    top: '120px',
    right: '24px',
    width: '25%',
    height: '60%',
    maxHeight: 'unset',

    zIndex: 99999,
    backgroundColor: 'var(--surface-bg-below-2, #090F11)',
    borderLeft: '1px solid var(--border-inverted, #232B2E)',
    borderTop: '1px solid var(--border-inverted, #232B2E)',
    padding: '8px',
    whiteSpace: 'pre-wrap',
    overflowY: 'auto',
    fontSize: '12px',
  },

  '.cm-lsp-reference-panel .cm-lsp-reference-file': {
    color: 'var(--text-default, #FFF)',
    fontWeight: '600',
    marginTop: '8px',
    marginBottom: '4px',
  },

  '.cm-lsp-reference-panel .cm-lsp-reference': {
    cursor: 'pointer',
    borderRadius: '4px',
    padding: '4px 6px',
    color: 'var(--text-default, #FFF)',
  },

  '.cm-lsp-reference-panel .cm-lsp-reference strong': {
    color: 'var(--text-accent, #25C2C7)',
  },

  '.cm-lsp-reference-panel .cm-lsp-reference[aria-selected]': {
    backgroundColor: 'var(--tealscale-sapphire-20, rgba(37, 194, 199, 0.20))',
  },

  '.cm-lsp-reference-panel .cm-lsp-reference:hover': {
    backgroundColor: 'var(--surface-bg-baseline, #232B2E)',
  },

  '.cm-lsp-reference-panel .cm-lsp-reference-line': {
    color: 'var(--text-inverted-subtle, #5D6A6B)',
  },

  // The close button is position:absolute relative to .cm-panels-bottom (sticky,
  // at the bottom of the editor), so it ends up invisible. Reposition it fixed
  // so it sits in the top-right corner of the floating reference panel.
  '.cm-panel:has(.cm-lsp-reference-panel) .cm-dialog-close': {
    position: 'fixed',
    top: '124px',
    right: '28px',
    zIndex: 100000,
    cursor: 'pointer',
    color: 'var(--text-subtle, #c9d2d2)',
    fontSize: '16px',
    padding: '4px',
    lineHeight: '1',
    backgroundColor: 'transparent',
    border: 'none',
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
    padding: '4px 8px',
    maxWidth: '500px',
    maxHeight: '300px',
    overflowY: 'auto', // override the library default "scroll" which always forces a visible scrollbar
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    zIndex: 99999,
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
    padding: '4px 8px',
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
  ...autoCompleteStyles,
  ...renameStyles,
  ...referenceStyles,
  ...codeActionStyles,
  ...documentHighlightStyles,
  ...navigationFeaturesStyles,
  ...tooltipSignatureStyles,
  ...tooltipFeedbackStyles,
  ...completionIconStyles,
};
