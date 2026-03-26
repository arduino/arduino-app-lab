import { ArrowRoundedUp } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import EmojiPicker, {
  EmojiClickData,
  SkinTones,
  SuggestionMode,
  Theme,
} from 'emoji-picker-react';
import { RefObject, useLayoutEffect, useRef } from 'react';

import styles from './emoji-picker-dialog.module.scss';

export interface EmojiPickerDialogProps {
  buttonRef: RefObject<HTMLButtonElement>;
  onChange: (emoji: string) => void;
  setEmojiPickerOpen: (open: boolean) => void;
  classes?: {
    emojiPicker?: string;
    emojiPickerArrow?: string;
    emojiPickerContainer?: string;
  };
}

export const EmojiPickerDialog: React.FC<EmojiPickerDialogProps> = (
  props: EmojiPickerDialogProps,
) => {
  const { onChange, setEmojiPickerOpen, classes } = props;
  const pickerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        props.buttonRef.current &&
        !props.buttonRef.current.contains(event.target as Node)
      ) {
        setEmojiPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = ({ emoji }: EmojiClickData): void => {
    onChange(emoji);
    setEmojiPickerOpen(false);
  };

  return (
    <div
      ref={pickerRef}
      className={clsx(
        styles['emoji-picker-container'],
        classes?.emojiPickerContainer,
      )}
    >
      <ArrowRoundedUp
        className={clsx(
          styles['emoji-picker-arrow'],
          classes?.emojiPickerArrow,
        )}
      />
      <EmojiPicker
        open
        height={200}
        width={280}
        className={clsx(styles['emoji-picker'], classes?.emojiPicker)}
        onEmojiClick={handleChange}
        previewConfig={{
          showPreview: false,
        }}
        lazyLoadEmojis
        suggestedEmojisMode={SuggestionMode.RECENT}
        skinTonesDisabled
        allowExpandReactions={false}
        defaultSkinTone={SkinTones.NEUTRAL}
        theme={Theme.DARK}
        searchDisabled
        getEmojiUrl={(unified): string => `/emoji-assets/${unified}`}
      />
    </div>
  );
};
