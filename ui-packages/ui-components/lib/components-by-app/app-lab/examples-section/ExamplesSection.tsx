import clsx from 'clsx';
import React from 'react';

import styles from './examples-section.module.scss';

export interface ExamplesSectionProps {
  children: React.ReactNode;
  className?: string;
}

export const ExamplesSection = ({
  children,
  className,
}: ExamplesSectionProps): JSX.Element => {
  return (
    <section className={clsx(styles['examples-section'], className)}>
      {children}
    </section>
  );
};
