import { JSXElementConstructor, MouseEvent, ReactElement } from 'react';
import { ReactMarkdownProps } from 'react-markdown/lib/complex-types';

// Scroll to the element a fragment names, as the browser would have. Ids are
// whatever the document authored, so the fragment is decoded before the lookup
// and matched by id rather than as a selector. `scrollIntoView` is called
// optionally because jsdom does not implement it.
const scrollToFragment = (href: string): void => {
  const id = decodeURIComponent(href.slice(1));
  if (!id) return;

  document.getElementById(id)?.scrollIntoView?.({ block: 'start' });
};

export const MarkdownReaderTagA = (
  onOpenExternal?: (url: string) => void,
  onOpenInternal?: (url: string) => void,
): JSXElementConstructor<ReactMarkdownProps> => {
  const Component = ({
    node,
    children,
    ...props
  }: ReactMarkdownProps): ReactElement => {
    const href = node.properties?.href as string | undefined;
    const isExternal = href?.startsWith('http');

    const handleClick = (e: MouseEvent): void => {
      e.preventDefault();
      if (!href) return;

      if (isExternal) {
        onOpenExternal?.(href);
        return;
      }

      // A link into this same document: a footnote, a heading, an anchor the
      // author placed. `preventDefault` above has already stopped the browser
      // making the jump, and the internal-link handlers deal in routes rather
      // than fragments, so do it here.
      if (href.startsWith('#')) {
        scrollToFragment(href);
        return;
      }

      onOpenInternal?.(href);
    };

    const handleKeyUp = (): void => {};

    return (
      <a
        {...props}
        href={href}
        onClick={handleClick}
        onKeyUp={handleKeyUp}
        {...(isExternal
          ? {
              target: '_blank',
            }
          : {})}
      >
        {children}
      </a>
    );
  };

  return Component;
};
