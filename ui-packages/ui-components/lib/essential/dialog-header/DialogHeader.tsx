import { BackArrow, CloseX } from '@cloud-editor-mono/images/assets/icons';

import { messages } from '../../device-association-dialog/content/messages';
import { useI18n } from '../../i18n/useI18n';
import { Small } from '../../typography';
import { IconButton } from '../icon-button';
import styles from './dialog-header.module.scss';

interface BaseDialogHeaderProps<T extends boolean | undefined> {
  title: string;
  classes?: { header?: string; closeButton?: string; backButton?: string };
  onClickClose: (...args: any) => any;
  includeBack?: T;
}

export type DialogHeaderProps =
  | BaseDialogHeaderProps<false | undefined>
  | (BaseDialogHeaderProps<true> & { onClickBack: (...args: any) => any });

const DialogHeader: React.FC<DialogHeaderProps> = (
  props: DialogHeaderProps,
) => {
  const { classes, onClickClose, includeBack, title } = props;

  const { formatMessage } = useI18n();
  return (
    <header className={classes?.header}>
      {includeBack ? (
        <IconButton
          onPress={props.onClickBack}
          Icon={BackArrow}
          label={formatMessage(messages.backButton)}
          classes={{ button: classes?.backButton }}
        />
      ) : null}
      <Small className={styles.title}>{title}</Small>
      <IconButton
        onPress={onClickClose}
        Icon={CloseX}
        label={formatMessage(messages.closeButton)}
        classes={{ button: classes?.closeButton }}
      />
    </header>
  );
};

export default DialogHeader;
