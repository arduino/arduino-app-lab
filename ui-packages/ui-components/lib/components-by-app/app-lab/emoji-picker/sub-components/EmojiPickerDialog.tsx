import { ArrowRoundedUp } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import EmojiPicker, {
  EmojiClickData,
  SkinTones,
  SuggestionMode,
  Theme,
} from 'emoji-picker-react';
import { RefObject, useLayoutEffect, useRef, useState } from 'react';

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
  const { onChange, setEmojiPickerOpen, classes, buttonRef } = props;
  const pickerRef = useRef<HTMLDivElement>(null);
  const [buttonLeft, setButtonLeft] = useState(0);

  useLayoutEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setEmojiPickerOpen(false);
      }
    };

    const handleResize = (): void => {
      if (buttonRef.current) {
        setButtonLeft(buttonRef.current.getBoundingClientRect().left);
      }
    };
    handleResize();

    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = ({ emoji }: EmojiClickData): void => {
    onChange(emoji);
    setEmojiPickerOpen(false);
  };

  console.log('buttonLeft', buttonLeft);

  return (
    <div
      ref={pickerRef}
      className={clsx(
        styles['emoji-picker-container'],
        classes?.emojiPickerContainer,
      )}
      style={
        {
          '--emoji-picker-translate-x': `${
            buttonLeft < 140 ? 140 - buttonLeft : 0
          }px`,
        } as React.CSSProperties
      }
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
