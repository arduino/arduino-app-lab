import { OpenInNewTab } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { ReactElement, ReactNode } from 'react';

import { openInSystemBrowser } from '../openInSystemBrowser';
import { useFileOpen } from './FileOpenContext';
import styles from './link.module.scss';
import { linkTarget } from './linkTarget';

interface LinkProps {
  href?: string;
  title?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * A link in agent output: external ones open in the system browser, a path or file:// URL opens in
 * App Lab's editor, anything else is plain text — see linkTarget for why no branch may navigate.
 * Props are optional to match react-markdown's node props, so this drops into a `components` map.
 */
export const Link = ({
  href,
  title,
  children,
  className,
}: LinkProps): ReactElement => {
  const target = linkTarget(href);
  const openFile = useFileOpen();

  if (target.kind === 'external') {
    return (
      <a
        className={clsx(styles['link'], className)}
        href={target.url}
        title={title}
        target="_blank"
        rel="noreferrer"
        onClick={(e): void => {
          // In the Wails host, hand the URL to the runtime so it opens in the
          // system browser; `target="_blank"` is the fallback for plain browsers.
          if (openInSystemBrowser(target.url)) {
            e.preventDefault();
          }
        }}
      >
        {children}
        <OpenInNewTab className={styles['link-icon']} />
      </a>
    );
  }

  if (target.kind === 'file' && openFile) {
    const open = (): void => openFile(target.path);

    return (
      <span
        role="link"
        tabIndex={0}
        className={clsx(styles['link'], styles['link-text'], className)}
        title={title ?? target.path}
        onClick={(e): void => {
          e.stopPropagation();
          open();
        }}
        onKeyDown={(e): void => {
          if (e.key === 'Enter') {
            e.stopPropagation();
            open();
          }
        }}
      >
        {children}
      </span>
    );
  }

  return <span title={title ?? href}>{children}</span>;
};

export default Link;
