import { setCSSVariable } from '@cloud-editor-mono/common';
import { SelectArrow } from '@cloud-editor-mono/images/assets/icons';
import { Key, ReactNode, useRef } from 'react';

import DropdownMenuButton from '../../../essential/dropdown-menu/DropdownMenuButton';
import FocusedPopover from '../../../essential/focused-popover/FocusedPopover';
import { useI18n } from '../../../i18n/useI18n';
import { Small, XSmall } from '../../../typography';
import { flavourConfigDialogMessages as messages } from '../messages';
import styles from './flavour-config-dialog.module.scss';
import { FlavourConfigDialogLogic } from './flavourConfigDialog.type';

export interface FlavourConfigDialogProps {
  themeClass?: string;
  flavourConfigDialogLogic: FlavourConfigDialogLogic;
}

const FlavourConfigDialog: React.FC<FlavourConfigDialogProps> = (
  props: FlavourConfigDialogProps,
) => {
  const { flavourConfigDialogLogic, themeClass } = props;
  const {
    reactModalProps,
    setFlavourOptions,
    handleClose,
    flavourOptions,
    top,
    left,
  } = flavourConfigDialogLogic();

  const dialogRef = useRef<HTMLDivElement>(null);

  const renderDropdownMenus = (): ReactNode => {
    return (
      flavourOptions?.map((flavourOption) => {
        const eleId = `${flavourOption.id}_dd_element`;
        const selection = flavourOption.variants.find(
          (variant) => variant.selected,
        );

        const selectionName = selection?.name || '';
        const selectionValue = selection?.id || '';
        return (
          <div
            key={`${flavourOption.id}_container`}
            className={styles['dropdown-container']}
          >
            <XSmall>{flavourOption.name}</XSmall>
            <DropdownMenuButton
              id={eleId}
              title={selectionName}
              classes={{
                dropdownMenuButtonWrapper:
                  styles['dropdown-menu-button-wrapper'],
                dropdownMenuButton: styles['dropdown-menu-button'],
                dropdownMenuList: styles['dropdown-menu-list'],
                dropdownMenuItem: styles['dropdown-menu-item'],
                dropdownMenuPopover: styles['dropdown-menu-popover'],
                dropdownMenu: styles['dropdown-menu'],
              }}
              buttonChildren={
                <div className={styles['dropdown-button-children']}>
                  <XSmall className={styles['dropdown-button-text']}>
                    {selectionName}
                  </XSmall>
                  <div className={styles['dropdown-button-arrow-container']}>
                    <SelectArrow />
                  </div>
                </div>
              }
              sections={[
                {
                  name: '*',
                  items: flavourOption.variants.map((variant) => {
                    return {
                      id: variant.id,
                      value: variant.id,
                      label: variant.name,
                      itemClassName:
                        selectionValue === variant.id
                          ? styles['dropdown-menu-item-selected']
                          : undefined,
                    };
                  }),
                },
              ]}
              onAction={(key: Key): void => {
                setFlavourOptions(flavourOption.id, key as string);
              }}
              onOpen={(): void => {
                const { left, top } = document
                  .getElementById(eleId)
                  ?.getBoundingClientRect() ?? {
                  left: 0,
                  top: 0,
                };

                setCSSVariable(styles.dropdownTop, `${top}px`);
                setCSSVariable(styles.dropdownLeft, `${left}px`);
              }}
              useStaticPosition={false}
            />
          </div>
        );
      }) || null
    );
  };

  const { formatMessage } = useI18n();

  return (
    <FocusedPopover
      dialogRef={dialogRef}
      reactModalProps={reactModalProps}
      setIsOpen={handleClose}
      themeClass={themeClass}
      top={top}
      left={left}
    >
      <Small bold>{formatMessage(messages.header)}</Small>
      <div className={styles.body}>{renderDropdownMenus()}</div>
    </FocusedPopover>
  );
};

export default FlavourConfigDialog;
