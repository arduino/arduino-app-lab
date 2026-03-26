import { JSXElementConstructor, MouseEvent, ReactElement } from 'react';
import { ReactMarkdownProps } from 'react-markdown/lib/complex-types';

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
      } else {
        onOpenInternal?.(href);
      }
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
