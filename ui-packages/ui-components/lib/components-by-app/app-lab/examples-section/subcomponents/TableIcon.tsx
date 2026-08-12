import { BrickIcon } from '../../brick-icon';
import { EmojiPreview } from '../../emoji-picker/sub-components/EmojiPreview';
import { ExampleTableIcon } from '../../examples/examples.type';

export interface TableIconProps {
  icon?: ExampleTableIcon;
}

// Renders the VM icon descriptor: emoji for core categories, BrickIcon for
// bricks (BrickIcon maps the category to a glyph and falls back to misc).
export const TableIcon = ({ icon }: TableIconProps): JSX.Element | null => {
  if (!icon) {
    return null;
  }
  if (icon.kind === 'emoji') {
    return <EmojiPreview size={16} value={icon.value} />;
  }
  return <BrickIcon category={icon.category} size="xsmall" />;
};
