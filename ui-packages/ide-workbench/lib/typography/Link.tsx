import clsx from 'clsx';
import { AnchorHTMLAttributes, forwardRef, Ref } from 'react';

import styles from './typography.module.scss';
import { TextProps } from './typography.type';

export type LinksProps = TextProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { flavour?: string };

/**
 * A styled anchor — deliberately not router-aware.
 *
 * A routed link is the host's business: the router is chosen by the
 * application, and this package is published and expected to lead on React 19,
 * while `@tanstack/react-location` is abandoned and caps React at 18. The two
 * call sites that need routed navigation (the Cloud Editor sidenav) use their
 * router's own Link instead — they already overrode this component's styling
 * with their own class, so they were never getting the typography treatment.
 */
export const Link = forwardRef(
  (
    { flavour = '', children, ...props }: LinksProps,
    ref: Ref<HTMLAnchorElement>,
  ) => (
    <a
      ref={ref}
      target="_blank"
      className={clsx(styles.link, flavour)}
      {...props}
    >
      {children}
    </a>
  ),
);
Link.displayName = 'Link';
