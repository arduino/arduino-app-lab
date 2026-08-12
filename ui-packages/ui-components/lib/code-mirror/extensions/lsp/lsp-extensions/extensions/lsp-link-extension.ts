import { Extension } from '@codemirror/state';
import { EditorView, hasHoverTooltips, ViewPlugin } from '@codemirror/view';

/**
 * Extension for handling LSP link clicks
 */
export const getLspLinkExtension = ({
  onHoverLinkClick,
}: GetLspLinkExtensionParams): Extension => {
  const domEventHandlers = EditorView.domEventHandlers({
    click: (event, _) => {
      const target = event.target as HTMLElement;
      const href = extractHrefFromClickTarget(target);

      if (href) {
        event.preventDefault();
        onHoverLinkClick?.(href);
        return true;
      }
      return false;
    },
  });

  // The hover tooltip is rendered outside the normal editor text flow, so a regular editor click
  // handler is not always enough. This capture listener catches the link before the browser follows it.
  const tooltipLinkCapturePlugin = ViewPlugin.fromClass(
    class {
      private readonly onDocumentClickCapture = (event: MouseEvent): void => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        const href = extractHrefFromClickTarget(target);
        if (!href) {
          return;
        }

        // The tooltip DOM is rendered in document.body (see lsp-extensions.ts), so we can no
        // longer use `view.dom.contains(inTooltip)` to identify ownership. Instead, only handle
        // the click when this view actually has an active hover tooltip.
        if (!hasHoverTooltips(this.view.state)) {
          return;
        }

        // Stop the native navigation path first, then hand the URL to the external browser opener.
        event.preventDefault();
        event.stopImmediatePropagation();
        onHoverLinkClick?.(href);
      };

      constructor(private readonly view: EditorView) {
        this.view.dom.ownerDocument.addEventListener(
          'click',
          this.onDocumentClickCapture,
          true,
        );
      }

      destroy(): void {
        this.view.dom.ownerDocument.removeEventListener(
          'click',
          this.onDocumentClickCapture,
          true,
        );
      }
    },
  );

  return [domEventHandlers, tooltipLinkCapturePlugin];
};

// Helper to detect if an element is a link within a hover tooltip
const isLinkInHoverTooltip = (element: Element): boolean => {
  const link = element.closest('a');
  if (!link) return false;
  return !!link.closest('.cm-tooltip-hover');
};

// Helper to extract href from a clicked element if it's a hover tooltip link
const extractHrefFromClickTarget = (target: Element): string | null => {
  if (!isLinkInHoverTooltip(target)) return null;
  const link = target.closest('a');
  return link?.getAttribute('href') ?? null;
};

interface GetLspLinkExtensionParams {
  onHoverLinkClick?: (url: string) => void;
}
