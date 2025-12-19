import { useRef } from 'react';
import { useEvent } from 'react-use';

import { CopyToClipboard } from '../../../essential/copy-to-clipboard';
import { GenericDialog } from '../../../essential/generic-dialog';
import { Input } from '../../../essential/input';
import { Radio, RadioGroup } from '../../../essential/radio-group';
import { useI18n } from '../../../i18n/useI18n';
import { Medium, XSmall } from '../../../typography';
import { shareSketchDialogMessages as messages } from '../messages';
import styles from './share-sketch-dialog.module.scss';
import {
  ShareSketchDialogLogic,
  ShareSketchRadioValue,
} from './shareSketchDialog.type';

interface ShareSketchDialogProps {
  themeClass?: string;
  shareSketchDialogLogic: ShareSketchDialogLogic;
}

const ShareSketchDialog: React.FC<ShareSketchDialogProps> = (
  props: ShareSketchDialogProps,
) => {
  const { themeClass, shareSketchDialogLogic } = props;

  const {
    handleClose,
    reactModalProps,
    handleDismiss,
    onToggleVisibility,
    targetUrl,
    embedMarkup,
    ...rest
  } = shareSketchDialogLogic();

  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { formatMessage } = useI18n();

  function selectTextareaContent(e: KeyboardEvent): void {
    if (e.metaKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      textareaRef.current?.select();
    }
  }
  useEvent('keydown', selectTextareaContent);

  return (
    <GenericDialog
      themeClass={themeClass}
      dialogRef={dialogRef}
      reactModalProps={reactModalProps}
      setIsOpen={handleClose}
    >
      <>
        <GenericDialog.Header
          title={formatMessage(messages.title)}
          onClickClose={handleDismiss}
        />
        <GenericDialog.Body classes={{ container: styles['body-container'] }}>
          <>
            {rest.isOwned ? (
              <div>
                <Medium bold>{formatMessage(messages.bodyTitle)}</Medium>
                <RadioGroup
                  label={formatMessage(messages.bodyTitle)}
                  classes={{ container: styles['radio-group'] }}
                  defaultValue={ShareSketchRadioValue.Private}
                  value={String(rest.isPublic)}
                  onChange={(value): void => {
                    onToggleVisibility(value === ShareSketchRadioValue.Public);
                  }}
                >
                  <Radio
                    value={ShareSketchRadioValue.Private}
                    classes={{
                      container: styles['radio'],
                    }}
                  >
                    <XSmall>{formatMessage(messages.privateLabel)}</XSmall>
                  </Radio>
                  <Radio
                    value={ShareSketchRadioValue.Public}
                    classes={{
                      container: styles['radio'],
                    }}
                  >
                    <XSmall>{formatMessage(messages.publicLabel)}</XSmall>
                  </Radio>
                </RadioGroup>
              </div>
            ) : null}
            {!rest.isOwned || rest.isPublic ? (
              <>
                <div className={styles['url-item-container']}>
                  <XSmall>{`${formatMessage(messages.urlLabel)}:`}</XSmall>
                  <div className={styles['url-item']}>
                    <Input
                      disabled
                      value={targetUrl}
                      className={styles['url-input']}
                      onChange={(): void => {
                        return;
                      }}
                    />
                    <CopyToClipboard
                      classes={{
                        container: styles['copy-button-container'],
                      }}
                      text={targetUrl}
                    />
                  </div>
                </div>
                <div className={styles['url-item-container']}>
                  <XSmall>{`${formatMessage(messages.embedLabel)}:`}</XSmall>
                  <div className={styles['url-item']}>
                    <textarea
                      className={styles['textarea-embed']}
                      value={embedMarkup}
                      ref={textareaRef}
                      readOnly
                    />
                    <CopyToClipboard
                      classes={{
                        container: styles['copy-button-container'],
                      }}
                      text={embedMarkup}
                    />
                  </div>
                </div>
              </>
            ) : null}
          </>
        </GenericDialog.Body>
      </>
    </GenericDialog>
  );
};

export default ShareSketchDialog;
