import { LinkProps } from '@tanstack/react-location';
import clsx from 'clsx';

import styles from './typography.module.scss';
import { TextProps } from './typography.type';

export function classNameFrom({
  className,
  bold,
  italic,
  uppercase,
  truncate,
  monospace,
  size,
}: Partial<TextProps>): string {
  return clsx(
    styles['text'],
    {
      [styles.bold]: bold,
      [styles.italic]: italic,
      [styles.uppercase]: uppercase,
      [styles.truncate]: truncate,
      [styles.monospace]: monospace,
    },
    styles[size || 'small'],
    className,
  );
}

export function isAnchor(
  props: LinkProps | { href: string },
): props is { href: string } {
  return !(props as LinkProps).to;
}
