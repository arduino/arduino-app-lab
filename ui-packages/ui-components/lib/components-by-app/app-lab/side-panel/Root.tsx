import clsx from 'clsx';
import { ReactNode } from 'react';

import styles from './side-panel.module.scss';

export interface RootProps {
  children: ReactNode;
  className?: string;
}

// The sidebar shell: fixed-width <nav> that hosts a composition of primitives
export const Root = ({ children, className }: RootProps): JSX.Element => (
  <nav className={clsx(styles['side-panel'], className)}>{children}</nav>
);
