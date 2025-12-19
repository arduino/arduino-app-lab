import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

import { Button, ButtonType } from '../../../essential/button';
import { GenericDialog } from '../../../essential/generic-dialog';
import { Input } from '../../../essential/input';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XXSmall } from '../../../typography';
import {
  renameSketchDialogMessages as messages,
  renameSketchDialogValidationMessages as validationMessages,
} from '../messages';
import styles from './rename-sketch-dialog.module.scss';
import {
  RenameDialogData,
  RenameDialogLogic,
  SketchNameValidationDictionary,
} from './renameSketchDialog.type';

export interface RenameDialogProps {
  themeClass?: string;
  renameDialogLogic: RenameDialogLogic;
  data: RenameDialogData;
}

const RenameDialog: React.FC<RenameDialogProps> = (
  props: RenameDialogProps,
) => {
  const { renameDialogLogic, themeClass } = props;
  const {
    reactModalProps,
    setIsOpen,
    renameAction,
    renameActionLoading,
    initialValue,
    sketchNameValidation,
    replaceSketchNameInvalidCharacters,
  } = renameDialogLogic();

  const { formatMessage } = useI18n();

  const dialogRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | undefined>(undefined);

  const [name, setName] = useState(initialValue);
  const [nameValidation, setNameValidation] =
    useState<SketchNameValidationDictionary>({
      exceedsLimit: false,
      alreadyExists: false,
      hasInvalidCharacters: false,
    });

  useEffect(() => {
    let timeout: number;
    if (timeoutRef.current) {
      timeout = timeoutRef.current;
    }

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  const handleChange = (value: string): void => {
    setName(replaceSketchNameInvalidCharacters(value));

    const { hasInvalidCharacters, ...rest } = sketchNameValidation(value);
    if (hasInvalidCharacters) {
      setNameValidation((prev) => ({ ...prev, ...rest, hasInvalidCharacters }));
      clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setNameValidation((prev) => ({ ...prev, hasInvalidCharacters: false }));
      }, 4000);
    } else {
      setNameValidation((prev) => ({ ...prev, ...rest }));
    }
  };

  const handleRename = async (): Promise<void> => {
    await renameAction(name);
  };

  return (
    <GenericDialog
      themeClass={themeClass}
      dialogRef={dialogRef}
      reactModalProps={reactModalProps}
      setIsOpen={setIsOpen}
    >
      <>
        <GenericDialog.Header
          title={formatMessage(messages.dialogTitle)}
          onClickClose={(): void => setIsOpen(false)}
        ></GenericDialog.Header>
        <GenericDialog.Body>
          <>
            <Medium bold className={styles.title}>
              {formatMessage(messages.actionTitle)}
            </Medium>
            <div className={styles.relative}>
              <Input
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                value={name}
                onChange={handleChange}
                onEnter={handleRename}
                type="text"
                label={formatMessage(messages.inputLabel)}
                error={
                  nameValidation.exceedsLimit
                    ? new Error(formatMessage(validationMessages.exceedsLimit))
                    : undefined
                }
              />
              {nameValidation.hasInvalidCharacters && (
                <XXSmall
                  bold
                  className={clsx(styles['invalid-format'], {
                    [styles.overlap]:
                      nameValidation.alreadyExists ||
                      nameValidation.exceedsLimit,
                  })}
                >
                  {formatMessage(validationMessages.hasInvalidCharacters)}
                </XXSmall>
              )}
            </div>
          </>
        </GenericDialog.Body>
        <GenericDialog.Actions>
          <>
            <Button
              type={ButtonType.Tertiary}
              onClick={(): void => setIsOpen(false)}
            >
              {formatMessage(messages.cancelButtonLabel)}
            </Button>
            <Button
              type={ButtonType.Primary}
              disabled={name === initialValue || nameValidation.exceedsLimit}
              onClick={handleRename}
              loading={renameActionLoading}
            >
              {formatMessage(messages.renameButtonLabel)}
            </Button>
          </>
        </GenericDialog.Actions>
      </>
    </GenericDialog>
  );
};

export default RenameDialog;
