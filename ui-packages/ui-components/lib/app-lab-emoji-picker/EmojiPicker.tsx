import clsx from 'clsx';
import { useRef, useState } from 'react';

import styles from './emoji-picker.module.scss';
import {
  EmojiPickerDialog,
  EmojiPickerDialogProps,
} from './sub-components/EmojiPickerDialog';
import { EmojiPreview } from './sub-components/EmojiPreview';

interface EmojiPickerProps {
  value?: string;
  onChange: (emoji: string) => void;
  onOpen?: (isOpen: boolean) => void;
  classes?: EmojiPickerDialogProps['classes'] & {
    emojiPickerButton?: string;
    emojiPickerButtonOpen?: string;
  };
}

const EmojiPicker: React.FC<EmojiPickerProps> = (props: EmojiPickerProps) => {
  const { value, onChange, classes } = props;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const handleOpenChange = (isOpen: boolean): void => {
    setEmojiPickerOpen(isOpen);
    props.onOpen?.(isOpen);
  };

  return (
    <div className={styles['emoji-picker-container']}>
      <button
        ref={buttonRef}
        className={clsx(
          styles['emoji-picker-button'],
          classes?.emojiPickerButton,
          {
            [styles['open']]: emojiPickerOpen,
            [classes?.emojiPickerButtonOpen ?? '']: emojiPickerOpen,
          },
        )}
        onClick={(e): void => {
          e.stopPropagation();
          handleOpenChange(!emojiPickerOpen);
        }}
      >
        {value && <EmojiPreview value={value} />}
      </button>
      {emojiPickerOpen && (
        <EmojiPickerDialog
          buttonRef={buttonRef}
          onChange={onChange}
          setEmojiPickerOpen={handleOpenChange}
          classes={classes}
        />
      )}
    </div>
  );
};

export default EmojiPicker;
