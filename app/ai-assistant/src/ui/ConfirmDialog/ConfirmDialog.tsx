import {
  AppLabDialog,
  ButtonAppearance,
  ButtonVariant,
  TextSize,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { Button } from '../Button/Button';
import { Text } from '../Text/Text';
import styles from './confirm-dialog.module.scss';

interface ConfirmDialogProps {
  title: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  heading: string;
  description: string;
  confirmLabel: string;
  // Destructive (red) confirm for irreversible actions vs the default accent.
  destructive?: boolean;
  loading?: boolean;
  onConfirm: VoidFunction;
  onClose: VoidFunction;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  Icon,
  heading,
  description,
  confirmLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}) => (
  <AppLabDialog
    open
    onOpenChange={(next: boolean): void => {
      if (!next) {
        onClose();
      }
    }}
    title={title}
    classes={{
      body: styles['dialog-body'],
    }}
    footer={
      <Button
        variant={destructive ? ButtonVariant.Secondary : ButtonVariant.Primary}
        appearance={
          destructive ? ButtonAppearance.Destructive : ButtonAppearance.Action
        }
        loading={loading}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    }
  >
    <div className={styles['body']}>
      <Icon
        className={
          destructive
            ? `${styles['icon']} ${styles['icon--destructive']}`
            : styles['icon']
        }
        aria-hidden="true"
      />
      <Text size={TextSize.Medium} bold className={styles['heading']}>
        {heading}
      </Text>
      <Text size={TextSize.Small} className={styles['description']}>
        {description}
      </Text>
    </div>
  </AppLabDialog>
);

export default ConfirmDialog;
