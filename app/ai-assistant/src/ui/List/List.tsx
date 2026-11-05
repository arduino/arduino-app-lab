import clsx from 'clsx';
import { ReactNode } from 'react';

import styles from './list.module.scss';

interface ListProps {
  as?: 'ul' | 'ol';
  children: ReactNode;
  className?: string;
  start?: number;
}

export const List: React.FC<ListProps> = ({
  as = 'ul',
  children,
  className,
  start,
}) => {
  const Component = as;

  return (
    <Component
      className={clsx(styles['list'], styles[`list--${as}`], className)}
      start={start}
    >
      {children}
    </Component>
  );
};

export default List;
