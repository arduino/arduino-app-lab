import { TextLink } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import styles from '../settings-section.module.scss';

export interface ExternalLinkProps {
  href: string;
  onOpenExternal: (url: string) => void;
  label?: string;
  className?: string;
  target?: string;
}

export const ExternalLink = ({
  href,
  label,
  className,
  target = '_blank',
  onOpenExternal,
}: ExternalLinkProps): JSX.Element => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault();
    onOpenExternal(href);
  };
  return (
    <a
      href={href}
      target={target}
      aria-label={label}
      onClick={handleClick}
      rel="noreferrer"
      className={clsx(styles['settings-section-external-link'], className)}
    >
      {label}
      <TextLink />
    </a>
  );
};
