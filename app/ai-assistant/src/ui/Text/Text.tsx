import {
  Text as BaseText,
  TextSize,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { ReactNode } from 'react';

import styles from './text.module.scss';

interface TextProps {
  children: ReactNode;
  className?: string;
  size?: TextSize;
  bold?: boolean;
}

export const Text: React.FC<TextProps> = ({
  children,
  className,
  size = TextSize.XSmall,
  bold,
}) => {
  return (
    <BaseText
      size={size}
      bold={bold}
      className={clsx(styles['text'], className)}
    >
      {children}
    </BaseText>
  );
};

export default Text;
