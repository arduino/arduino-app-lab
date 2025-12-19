import { Emoji } from 'emoji-picker-react';
import { useMemo } from 'react';

interface EmojiPreviewProps {
  size?: number;
  value: string;
}

export const EmojiPreview: React.FC<EmojiPreviewProps> = (
  props: EmojiPreviewProps,
) => {
  const { size = 16, value } = props;

  const unified = useMemo(() => {
    const codePoints = Array.from(value)
      .map((c) => c.codePointAt(0)!.toString(16))
      .map((cp) => cp.padStart(4, '0'));
    return codePoints.join('-');
  }, [value]);

  return (
    <Emoji
      unified={unified}
      size={size}
      getEmojiUrl={(unified): string => `/emoji-assets/${unified}`}
    />
  );
};
