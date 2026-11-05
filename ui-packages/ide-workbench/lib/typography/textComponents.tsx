import { forwardRef, Ref } from 'react';

import {
  TextProps,
  TextSize,
  TextSizeComponentDictionary,
} from './typography.type';
import { classNameFrom } from './utils';

export const Text = forwardRef(
  (
    { style, title, children, ...props }: TextProps,
    ref: Ref<HTMLSpanElement>,
  ) => {
    return (
      <span
        ref={ref}
        className={classNameFrom(props)}
        title={title}
        style={style}
      >
        {children}
      </span>
    );
  },
);
Text.displayName = 'Text';

export const textComponents = Object.values(
  TextSize,
).reduce<TextSizeComponentDictionary>((acc, size) => {
  const Component = forwardRef(
    ({ className, ...props }: TextProps, ref: Ref<HTMLSpanElement>) => {
      return <Text ref={ref} size={size} className={className} {...props} />;
    },
  );

  Component.displayName = size;

  acc[size as TextSize] = Component;

  return acc;
}, {} as TextSizeComponentDictionary);
