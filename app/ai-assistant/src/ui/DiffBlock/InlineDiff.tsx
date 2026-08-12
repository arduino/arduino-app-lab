import { ReactNode } from 'react';

import styles from './inline-diff.module.scss';

interface InlineDiffProps {
  children: ReactNode;
}

export const InlineDiff: React.FC<InlineDiffProps> = ({ children }) => {
  const text = typeof children === 'string' ? children : String(children);
  const lines = text.split('\n');

  return (
    <pre className={styles['diff-block']}>
      {lines.map((line, index) => {
        if (line.startsWith('+')) {
          return (
            <div key={index} className={styles['diff-block-added']}>
              {line}
            </div>
          );
        }
        if (line.startsWith('-')) {
          return (
            <div key={index} className={styles['diff-block-removed']}>
              {line}
            </div>
          );
        }
        return <div key={index}>{line}</div>;
      })}
    </pre>
  );
};

export default InlineDiff;
