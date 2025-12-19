import { ForwardRefExoticComponent, RefAttributes } from 'react';

export enum TextSize {
  XXXSmall = 'xxx-small',
  XXSmall = 'xx-small',
  XSmall = 'x-small',
  Small = 'small',
  Medium = 'medium',
  Large = 'large',
  XLarge = 'x-large',
  XXLarge = 'xx-large',
}

export interface TextProps {
  size?: TextSize;
  className?: string;
  bold?: boolean;
  italic?: boolean;
  uppercase?: boolean;
  truncate?: boolean;
  monospace?: boolean;
  children: React.ReactNode;
  title?: string;
  style?: React.CSSProperties;
}

export type TextSizeComponentDictionary = {
  [S in TextSize]: ForwardRefExoticComponent<
    TextProps & RefAttributes<HTMLSpanElement>
  >;
};
