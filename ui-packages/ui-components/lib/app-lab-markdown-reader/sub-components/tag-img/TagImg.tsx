import { ReactElement } from 'react';
import { ReactMarkdownProps } from 'react-markdown/lib/complex-types';

import styles from '../../markdown-reader.module.scss';

export const MarkdownReaderTagImg = ({
  ...props
}: ReactMarkdownProps): ReactElement => {
  return (
    <div className={styles['image']}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img {...props} />
    </div>
  );
};
