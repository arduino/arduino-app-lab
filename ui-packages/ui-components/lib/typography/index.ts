import { textComponents } from './textComponents';
import { TextSize } from './typography.type';

export const {
  [TextSize.XXXSmall]: XXXSmall,
  [TextSize.XXSmall]: XXSmall,
  [TextSize.XSmall]: XSmall,
  [TextSize.Small]: Small,
  [TextSize.Medium]: Medium,
  [TextSize.Large]: Large,
  [TextSize.XLarge]: XLarge,
  [TextSize.XXLarge]: XXLarge,
} = textComponents;

export { Link } from './Link';
export { Text } from './textComponents';
export { TextSize };
export { type TextProps } from './typography.type';
