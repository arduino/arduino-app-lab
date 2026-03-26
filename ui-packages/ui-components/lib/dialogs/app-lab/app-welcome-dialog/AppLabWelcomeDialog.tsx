import {
  AppExamples,
  AppLab,
  Bricks,
  MyApps,
} from '@cloud-editor-mono/images/assets/icons';

import {
  Button,
  ButtonType,
  Small,
  useI18n,
} from '../../../components-by-app/app-lab';
import { Medium, XSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import styles from './app-lab-welcome-dialog.module.scss';
import { type AppLabWelcomeDialogLogic } from './app-welcome-dialog.type';
import { messages } from './messages';

type AppLabWelcomeDialogProps = {
  logic: AppLabWelcomeDialogLogic;
};

export const AppLabWelcomeDialog = ({
  logic,
}: AppLabWelcomeDialogProps): JSX.Element => {
  const { formatMessage } = useI18n();
  const { open, onOpenChange, onConfirm } = logic();

  const features = [
    {
      icon: <MyApps />,
      title: formatMessage(messages.appsTitle),
      description: formatMessage(messages.appsDescription),
    },
    {
      icon: <Bricks />,
      title: formatMessage(messages.bricksTitle),
      description: formatMessage(messages.bricksDescription),
    },
    {
      icon: <AppExamples />,
      title: formatMessage(messages.examplesTitle),
      description: formatMessage(messages.examplesDescription),
    },
  ];

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.title)}
      classes={{
        root: styles['welcome-dialog'],
        body: styles['welcome-body-override'],
      }}
      footer={
        <Button type={ButtonType.Primary} onClick={onConfirm} bold={false}>
          {formatMessage(messages.confirmButton)}
        </Button>
      }
    >
      <div className={styles['welcome-body']}>
        <div className={styles['illustration-panel']}>
          <AppLab />
        </div>

        <div className={styles['content-panel']}>
          <Medium bold className={styles['content-title']}>
            {formatMessage(messages.contentTitle)}
          </Medium>

          <ul className={styles['feature-list']}>
            {features.map((feature) => (
              <li key={feature.title} className={styles['feature-item']}>
                <div className={styles['feature-icon']}>{feature.icon}</div>
                <div className={styles['feature-text']}>
                  <Small bold>{feature.title}</Small>
                  <XSmall>{feature.description}</XSmall>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppLabDialog>
  );
};
