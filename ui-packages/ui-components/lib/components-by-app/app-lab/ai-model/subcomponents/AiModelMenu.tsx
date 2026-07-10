import {
  Bin,
  Checkmark,
  OpenInNewTab,
  ThreeDots,
} from '@cloud-editor-mono/images/assets/icons';
import {
  BrickDetailModelImpulse,
  ButtonAppearance,
  ButtonVariant,
  DropdownMenuButton,
  DropdownMenuItemType,
  IconButton,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import styles from '../ai-model.module.scss';
import { AiModelProps } from '../AiModel.type';
import { isInstalledDownloadableModel } from '../helpers';
import { messages } from '../messages';

export interface AiModelMenuProps {
  model: AiModelProps['model'];
  isEdgeImpulse: boolean;
  selectedImpulse?: BrickDetailModelImpulse;
  openModelPage?: AiModelProps['openModelPage'];
  removeModel?: AiModelProps['removeModel'];
  forceRemove?: boolean;
  openForceRemoveDialog: () => void;
}

type AiModelMenuItem = DropdownMenuItemType<string, string>;

const MENU_TITLE = 'Model options';

const uninstallItem: AiModelMenuItem = {
  id: 'remove-model',
  label: 'Uninstall',
  labelPrefix: <Bin />,
  itemClassName: styles['remove-model'],
};

const renderMenuTrigger = (
  buttonProps: React.ButtonHTMLAttributes<HTMLButtonElement>,
  ref: React.RefObject<HTMLButtonElement | null>,
  isOpen?: boolean,
): React.ReactNode => (
  <IconButton
    ref={ref}
    label={MENU_TITLE}
    Icon={ThreeDots}
    variant={ButtonVariant.Secondary}
    appearance={ButtonAppearance.LowContrast}
    hideTooltip={isOpen}
    {...buttonProps}
  />
);

export const AiModelMenu: React.FC<AiModelMenuProps> = ({
  model,
  isEdgeImpulse,
  selectedImpulse,
  openModelPage,
  removeModel,
  forceRemove,
  openForceRemoveDialog,
}: AiModelMenuProps) => {
  const { formatMessage } = useI18n();

  if (isEdgeImpulse) {
    const items: AiModelMenuItem[] = [
      {
        id: 'edit-model',
        label: formatMessage(messages.aiModelEdit),
        labelPrefix: <OpenInNewTab />,
      },
    ];
    if (selectedImpulse?.isInstalled) {
      items.push(uninstallItem);
    }

    return (
      <div className={styles['ai-model-actions']}>
        <DropdownMenuButton
          title={MENU_TITLE}
          sections={[{ name: 'Actions', items }]}
          buttonChildren={renderMenuTrigger}
          onAction={(key): void => {
            key === 'edit-model'
              ? openModelPage?.(model.id, selectedImpulse?.id)
              : forceRemove
              ? openForceRemoveDialog()
              : removeModel?.(selectedImpulse?.installedModelId ?? '');
          }}
          classes={{
            dropdownMenuButtonWrapper: styles['dropdown-menu-button-wrapper'],
            dropdownMenuButton: styles['dropdown-menu-button'],
            dropdownMenu: styles['dropdown-menu'],
            dropdownMenuItem: styles['dropdown-menu-item'],
          }}
        />
      </div>
    );
  }

  if (isInstalledDownloadableModel(model)) {
    return (
      <div className={styles['ai-model-actions']}>
        <DropdownMenuButton
          title={MENU_TITLE}
          sections={[{ name: 'Actions', items: [uninstallItem] }]}
          buttonChildren={renderMenuTrigger}
          onAction={(): void => {
            forceRemove ? openForceRemoveDialog() : removeModel?.(model.id);
          }}
          classes={{
            dropdownMenuButtonWrapper: styles['dropdown-menu-button-wrapper'],
            dropdownMenuButton: styles['dropdown-menu-button'],
            dropdownMenu: styles['dropdown-menu'],
            dropdownMenuItem: styles['dropdown-menu-item'],
          }}
        />
        <span className={styles['ai-model-installed']}>
          <Checkmark /> {formatMessage(messages.aiModelInstalled)}
        </span>
      </div>
    );
  }

  return null;
};
