import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { FormattedMessage } from 'react-intl';

import {
  Button,
  ButtonSize,
  ButtonVariant,
} from '../../../components-by-app/app-lab';
import { Input, InputStyle } from '../../../essential/input';
import { ArcSpinner } from '../../../essential/loader';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall, XXXSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { addHuggingFaceModelDialogMessages as messages } from '../messages';
import styles from './add-hugging-face-model-dialog.module.scss';
import { ModelIdHelp } from './sub-components/model-id-help/ModelIdHelp';
import { renderMonospace } from './sub-components/render-monospace/renderMonospace';

export type AddHuggingFaceModelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  downloadModel: (source: string) => Promise<void>;
  isSourceDownloading?: (source: string) => boolean;
  isSourceInstalled?: (source: string) => boolean;
  onOpenExternal: (url: string) => void;
};

export const AddHuggingFaceModelDialog: React.FC<
  AddHuggingFaceModelDialogProps
> = ({
  open,
  onOpenChange,
  downloadModel,
  isSourceDownloading,
  isSourceInstalled,
  onOpenExternal,
}: AddHuggingFaceModelDialogProps) => {
  const { formatMessage } = useI18n();
  const [source, setSource] = useState('');
  const [error, setError] = useState<string>();
  const [isDownloading, setIsDownloading] = useState(false);

  const sessionRef = useRef(0);

  const trimmedSource = source.trim();

  useEffect(() => {
    if (!open) {
      sessionRef.current++;
      setSource('');
      setError(undefined);
      setIsDownloading(false);
    }
  }, [open]);

  const onSourceChange = (value: string): void => {
    setSource(value);
    setError(undefined);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!trimmedSource || isDownloading) {
      return;
    }

    if (isSourceDownloading?.(trimmedSource)) {
      setError(formatMessage(messages.alreadyDownloading));
      return;
    }

    if (isSourceInstalled?.(trimmedSource)) {
      setError(formatMessage(messages.alreadyInstalled));
      return;
    }

    const session = ++sessionRef.current;
    const isStaleSession = (): boolean => sessionRef.current !== session;

    setIsDownloading(true);
    try {
      await downloadModel(trimmedSource);
      if (isStaleSession()) {
        return;
      }
      onOpenChange(false);
    } catch (linkError) {
      if (isStaleSession()) {
        return;
      }
      setError(
        linkError instanceof Error && linkError.message
          ? linkError.message
          : formatMessage(messages.errorGeneric),
      );
    } finally {
      if (!isStaleSession()) {
        setIsDownloading(false);
      }
    }
  };

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.dialogTitle)}
      onSubmit={handleSubmit}
      classes={{
        body: styles['body'],
      }}
    >
      <div className={styles['body-header']}>
        <Medium bold>{formatMessage(messages.dialogBodyTitle)}</Medium>
        <XSmall>{formatMessage(messages.dialogBodyDescription)}</XSmall>
      </div>

      <div className={styles['model-source']}>
        <div className={styles['source-field']}>
          <div className={styles['input-group']}>
            <div className={styles['field']}>
              <Input
                inputStyle={InputStyle.AppLab}
                type="text"
                value={source}
                onChange={onSourceChange}
                onEnter={handleSubmit}
                placeholder={formatMessage(messages.sourcePlaceholder)}
                disabled={isDownloading}
                autoFocus
                error={error ? new Error(error) : undefined}
                errorBelow
              />
            </div>

            <div className={styles['action']}>
              <Button
                variant={ButtonVariant.Primary}
                size={ButtonSize.Small}
                disabled={!trimmedSource || isDownloading}
                type="submit"
                classes={{
                  button: clsx({ [styles['hidden']]: isDownloading }),
                }}
              >
                {formatMessage(messages.confirmButton)}
              </Button>
              <div
                className={clsx(styles['verifying'], {
                  [styles['hidden']]: !isDownloading,
                })}
              >
                <ArcSpinner />
                <XSmall className={styles['verifying-text']}>
                  {formatMessage(messages.verifyingButton)}
                </XSmall>
              </div>
            </div>
          </div>

          <XXXSmall semibold className={styles['hint']}>
            <FormattedMessage
              {...messages.sourceHint}
              values={{ mono: renderMonospace }}
            />
          </XXXSmall>
        </div>

        <ModelIdHelp onOpenExternal={onOpenExternal} />
      </div>
    </AppLabDialog>
  );
};
