import clsx from 'clsx';
import { ReactNode } from 'react';

import styles from './content.module.scss';

export interface ContentProps {
  children: ReactNode;
  className?: string;
}

// Scrollable region between the board header and the bottom bar
export const Content = ({ children, className }: ContentProps): JSX.Element => (
  <div className={clsx(styles['content'], className)}>{children}</div>
);
