import { TextSize } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { ReactNode } from 'react';

import { Text } from '../Text/Text';
import styles from './header.module.scss';

interface HeaderProps {
  title: ReactNode;
  // Right-aligned actions (e.g. Sessions / Permissions). Omitted on the
  // connect screen, which has no session yet.
  children?: ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, children }) => {
  return (
    <div className={styles['header']}>
      {/* Panel chrome, not chat content: stays at 14 while the chat's Heading is 16. */}
      <Text size={TextSize.XSmall} bold className={styles['title']}>
        {title}
      </Text>
      {children}
    </div>
  );
};

export default Header;
