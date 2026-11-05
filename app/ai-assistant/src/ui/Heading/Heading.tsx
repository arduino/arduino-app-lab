import {
  type TextProps,
  Small,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { ReactNode } from 'react';

interface HeadingProps extends Omit<TextProps, 'size'> {
  children: ReactNode;
}

export const Heading: React.FC<HeadingProps> = ({ children, ...props }) => {
  return (
    <Small bold {...props}>
      {children}
    </Small>
  );
};

export default Heading;
