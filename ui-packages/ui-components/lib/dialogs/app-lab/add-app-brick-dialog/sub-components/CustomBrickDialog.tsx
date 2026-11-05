import { InfoIconOutline } from '@cloud-editor-mono/images/assets/icons';
import { AppBrickListItem } from '@cloud-editor-mono/infrastructure';
import { useEffect, useMemo, useState } from 'react';

import {
  Button,
  ButtonVariant,
  Input,
  InputStyle,
} from '../../../../components-by-app/app-lab';
import { useI18n } from '../../../../i18n/useI18n';
import { Medium, XSmall, XXXSmall } from '../../../../typography';
import { AppLabDialog } from '../../app-lab-dialog/AppLabDialog';
import { addAppBrickDialogMessages as messages } from '../../messages';
import styles from './custom-brick-dialog.module.scss';

const MAX_LENGTH = 80;

export type CustomBrickDialogLogic = () => {
  brick?: AppBrickListItem | null;
  open: boolean;
  confirmAction: (name: string, brickId?: string) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
  isRename?: boolean;
};

type CustomBrickDialogProps = { logic: CustomBrickDialogLogic };

export const CustomBrickDialog: React.FC<CustomBrickDialogProps> = ({
  logic,
}: CustomBrickDialogProps) => {
  const { brick, open, confirmAction, onOpenChange, isRename } = logic();

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [mountInput, setMountInput] = useState(false);
  const trimmedName = name.trim();

  useEffect(() => {
    if (open) {
      if (isRename && brick?.name) {
        setName(brick.name);
      } else {
        setName('');
      }

      setMountInput(true);
    } else {
      setMountInput(false);
    }
  }, [open, isRename, brick]);

  const { formatMessage } = useI18n();

  const onBrickNameChange = (value: string): void => {
    if (value.length > MAX_LENGTH) return;
    setName(value);
  };

  const dialogMessages = useMemo(() => {
    if (isRename) {
      return {
        dialogTitle: messages.renameBrickDialogTitle,
        bodyTitle: messages.renameBrickBodyTitle,
        bodyDescription: messages.renameBrickBodyDescription,
        buttonText: messages.renameButton,
      };
    }

    return {
      dialogTitle: messages.createBrickDialogTitle,
      bodyTitle: messages.createBrickBodyTitle,
      bodyDescription: messages.createBrickBodyDescription,
      buttonText: messages.createButton,
    };
  }, [isRename]);

  const handleConfirm = async (): Promise<void> => {
    if (!trimmedName) {
      return;
    }
    setLoading(true);
    try {
      const result = await confirmAction(trimmedName, brick?.id);
      if (result) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(dialogMessages.dialogTitle)}
      onSubmit={handleConfirm}
      footer={
        <>
          <Button
            variant={ButtonVariant.Primary}
            loading={loading}
            iconPosition="right"
            onClick={handleConfirm}
            disabled={!trimmedName}
          >
            {formatMessage(dialogMessages.buttonText)}
          </Button>
        </>
      }
      classes={{
        root: styles['root'],
        content: styles['content'],
        body: styles['body'],
      }}
    >
      <Medium bold className={styles['body-title']}>
        {formatMessage(dialogMessages.bodyTitle, {
          brickName: brick?.name,
        })}
      </Medium>
      <XSmall className={styles['body-description']}>
        {formatMessage(dialogMessages.bodyDescription, {
          brickFolder: (
            <XSmall bold>{formatMessage(messages.brickFolder)}</XSmall>
          ),
          mainPy: <XSmall bold>{formatMessage(messages.mainPy)}</XSmall>,
        })}
      </XSmall>
      {mountInput ? (
        <Input
          inputStyle={InputStyle.AppLab}
          type="text"
          value={name}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          onChange={onBrickNameChange}
          onEnter={handleConfirm}
          label={formatMessage(
            isRename
              ? messages.customBrickRenameInputLabel
              : messages.customBrickInputLabel,
          )}
          autoFocus
        />
      ) : null}
      {isRename && trimmedName ? (
        <div className={styles['custom-brick-id-info']}>
          <InfoIconOutline />
          <XXXSmall>
            {formatMessage(messages.customBrickId, {
              brickId: (
                <XXXSmall bold>
                  {trimmedName.toLowerCase().replace(/\s+/g, '_')}
                </XXXSmall>
              ),
            })}
          </XXXSmall>
        </div>
      ) : null}
    </AppLabDialog>
  );
};
