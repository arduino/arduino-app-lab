import React from 'react';

import styles from './page-layout.module.scss';

interface PageLayoutProps {
  header: React.ReactNode;
  children: React.ReactNode;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ header, children }) => {
  return (
    <section className={styles['main']}>
      <div className={styles['header']}>
        <div className={styles['header-content']}>{header}</div>
      </div>
      <div className={styles['content']}>{children}</div>
    </section>
  );
};

export default PageLayout;
