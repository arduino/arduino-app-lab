import { Link as RouterLink, LinkProps } from '@tanstack/react-location';
import clsx from 'clsx';
import { forwardRef, Ref } from 'react';

import styles from './typography.module.scss';
import { TextProps } from './typography.type';
import { isAnchor } from './utils';

export type LinksProps = TextProps &
  (LinkProps | { href: string }) & { flavour?: string };

export const Link = forwardRef(
  ({ flavour = '', children, ...props }: LinksProps, ref: Ref<any>) => {
    let LinkComponent: typeof RouterLink | 'a' = RouterLink;
    let target = undefined;
    if (isAnchor(props)) {
      LinkComponent = 'a';
      target = '_blank';
    }

    return (
      <LinkComponent
        ref={ref}
        target={target}
        className={clsx(styles.link, flavour)}
        {...(props as LinkProps | { href: string })}
      >
        {children}
      </LinkComponent>
    );
  },
);
Link.displayName = 'Link';
