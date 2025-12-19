import { GenericDialog } from '../../../essential/generic-dialog';
import { useI18n } from '../../../i18n/useI18n';
import { XSmall } from '../../../typography';
import { genAIPolicyTermsDialogMessages } from '../messages';
import styles from './gen-ai-policy-terms-dialog.module.scss';
import { GenAIPolicyTermsDialogLogic } from './genAIPolicyTermsDialog.type';

export interface GenAIPolicyTermsDialogProps {
  themeClass?: string;
  genAIPolicyTermsDialogLogic: GenAIPolicyTermsDialogLogic;
}

const GenAIPolicyTermsDialog: React.FC<GenAIPolicyTermsDialogProps> = (
  props: GenAIPolicyTermsDialogProps,
) => {
  const { themeClass, genAIPolicyTermsDialogLogic } = props;

  const { reactModalProps, setIsOpen, handleClose } =
    genAIPolicyTermsDialogLogic();

  const { formatMessage } = useI18n();

  return (
    <GenericDialog
      themeClass={themeClass}
      reactModalProps={reactModalProps}
      setIsOpen={setIsOpen}
      classes={{ overlay: styles['overlay'], container: styles['container'] }}
    >
      <>
        <GenericDialog.Header
          title={formatMessage(genAIPolicyTermsDialogMessages.title)}
          onClickClose={handleClose}
        />
        <GenericDialog.Body classes={{ container: styles['body-container'] }}>
          <div className={styles['body']}>
            <XSmall>
              {formatMessage(genAIPolicyTermsDialogMessages.firstPart)}
            </XSmall>
            <XSmall>
              {formatMessage(genAIPolicyTermsDialogMessages.secondPart)}
            </XSmall>
            <XSmall>
              {formatMessage(genAIPolicyTermsDialogMessages.thirdPart)}
            </XSmall>
            <XSmall>
              {formatMessage(genAIPolicyTermsDialogMessages.fourthPart)}
            </XSmall>
            <ul>
              <li>
                <XSmall>
                  {formatMessage(
                    genAIPolicyTermsDialogMessages.fourthPartListItem1,
                  )}
                </XSmall>
              </li>
              <li>
                <XSmall>
                  {formatMessage(
                    genAIPolicyTermsDialogMessages.fourthPartListItem2,
                  )}
                </XSmall>
              </li>
              <li>
                <XSmall>
                  {formatMessage(
                    genAIPolicyTermsDialogMessages.fourthPartListItem3,
                  )}
                </XSmall>
              </li>
            </ul>
            <XSmall>
              {formatMessage(genAIPolicyTermsDialogMessages.fifthPart)}
            </XSmall>
            <ul>
              <li>
                <XSmall>
                  {formatMessage(
                    genAIPolicyTermsDialogMessages.fifthPartListItem1,
                  )}
                </XSmall>
              </li>
              <li>
                <XSmall>
                  {formatMessage(
                    genAIPolicyTermsDialogMessages.fifthPartListItem2,
                  )}
                </XSmall>
              </li>
              <li>
                <XSmall>
                  {formatMessage(
                    genAIPolicyTermsDialogMessages.fifthPartListItem3,
                  )}
                </XSmall>
              </li>
              <li>
                <XSmall>
                  {formatMessage(
                    genAIPolicyTermsDialogMessages.fifthPartListItem4,
                  )}
                </XSmall>
              </li>
            </ul>
            <XSmall>
              {formatMessage(genAIPolicyTermsDialogMessages.sixthPart)}
            </XSmall>
          </div>
        </GenericDialog.Body>
      </>
    </GenericDialog>
  );
};
export default GenAIPolicyTermsDialog;
