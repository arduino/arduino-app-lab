import { InfoIconOutline } from '@cloud-editor-mono/images/assets/icons';
import { ReactElement } from 'react';
import { ReactMarkdownProps } from 'react-markdown/lib/complex-types';

import styles from '../../markdown-reader.module.scss';

export const MarkdownReaderTagBlockquote = ({
  children,
  ...props
}: ReactMarkdownProps): ReactElement => {
  return (
    <div className={styles['note']}>
      <InfoIconOutline />
      <blockquote {...props}>{children}</blockquote>
    </div>
  );
};
