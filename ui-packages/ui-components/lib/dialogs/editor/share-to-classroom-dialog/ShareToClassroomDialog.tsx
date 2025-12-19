import { GoogleClassroom } from '@cloud-editor-mono/images/assets/icons';

import { GenericDialog } from '../../../essential/generic-dialog';
import { IconButton } from '../../../essential/icon-button';
import { useI18n } from '../../../i18n/useI18n';
import { XSmall } from '../../../typography';
import { shareToClassroomDialogMessages as messages } from '../messages';
import styles from './share-to-classroom-dialog.module.scss';
import { ShareToClassroomDialogLogic } from './shareToClassroomDialog.type';

interface ShareToClassroomProps {
  themeClass?: string;
  shareToClassroomDialogLogic: ShareToClassroomDialogLogic;
}

const ShareToClassroom: React.FC<ShareToClassroomProps> = (
  props: ShareToClassroomProps,
) => {
  const { themeClass, shareToClassroomDialogLogic } = props;

  const { reactModalProps, handleClose, shareToClassroom } =
    shareToClassroomDialogLogic();

  const { formatMessage } = useI18n();

  return (
    <GenericDialog
      themeClass={themeClass}
      reactModalProps={reactModalProps}
      setIsOpen={handleClose}
    >
      <>
        <GenericDialog.Header
          title={formatMessage(messages.title)}
          onClickClose={handleClose}
        />
        <GenericDialog.Body classes={{ container: styles['body-container'] }}>
          <>
            <XSmall>{formatMessage(messages.body)}</XSmall>
            <IconButton
              onPress={shareToClassroom}
              Icon={GoogleClassroom}
              label={formatMessage(messages.shareToClassroomButton)}
              classes={{
                button: styles['share-to-classroom-button'],
              }}
            >
              {formatMessage(messages.shareToClassroomButton)}
            </IconButton>
          </>
        </GenericDialog.Body>
      </>
    </GenericDialog>
  );
};

export default ShareToClassroom;
