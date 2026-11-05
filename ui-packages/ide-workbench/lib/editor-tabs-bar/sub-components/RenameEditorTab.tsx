import clsx from 'clsx';
import React, { forwardRef, useEffect, useState } from 'react';

import { XSmall, XXSmall } from '../../typography';
import {
  FileNameValidation,
  FileNameValidationItem,
  ValidateFileName,
} from '../EditorTabsBar.type';
import styles from './editor-tab.module.scss';

export enum RenameTabRole {
  Rename = 'Rename',
  Create = 'Create',
}

type TabActionRename = (fileId: string, newFileName: string) => void;
type TabActionCreate = (fileName: string, fileExtension: string) => void;

export type TabAction =
  | {
      role: RenameTabRole.Rename;
      handler: TabActionRename;
    }
  | {
      role: RenameTabRole.Create;
      handler: TabActionCreate;
    };

interface RenameEditorTabProps {
  fileId?: string;
  fileName: string;
  fileExtension: string;
  isSelected: boolean;
  validateFileName: ValidateFileName;
  replaceFileNameInvalidCharacters: (name: string) => string;
  tabAction: TabAction;
  Icon?: React.FC;
}

const RenameEditorTab = forwardRef(
  (
    props: RenameEditorTabProps,
    renameTabRef: React.ForwardedRef<HTMLLIElement>,
  ) => {
    const {
      fileId,
      fileName,
      fileExtension,
      isSelected,
      validateFileName,
      replaceFileNameInvalidCharacters,
      tabAction,
      Icon,
    } = props;

    const [newFileName, setNewFileName] = useState(fileName);
    const [fileNameValidationItem, setFileNameValidationItem] = useState<
      FileNameValidationItem | undefined
    >(undefined);

    useEffect(() => {
      let timeout: number;
      if (fileNameValidationItem?.type === 'warning') {
        timeout = window.setTimeout(
          () => setFileNameValidationItem(undefined),
          5000,
        );
      }
      return (): void => clearTimeout(timeout);
    }, [fileNameValidationItem]);

    const handleSubmitFileName = (
      event: React.FormEvent<HTMLFormElement | HTMLInputElement>,
    ): void => {
      event.preventDefault();
      if (fileNameValidationItem?.type === 'error') {
        return;
      }
      if (tabAction.role === RenameTabRole.Create) {
        return tabAction.handler(newFileName, fileExtension);
      }
      if (tabAction.role === RenameTabRole.Rename && fileId) {
        return tabAction.handler(fileId, newFileName);
      }
    };

    const handleNameChange = (
      event: React.ChangeEvent<HTMLInputElement>,
    ): void => {
      const validationResult = validateFileName(
        fileName,
        event.target.value,
        fileExtension,
      );
      const validationItem = validationResult.length
        ? validationResult[0]
        : undefined;

      const renamedFile = replaceFileNameInvalidCharacters(event.target.value);

      setFileNameValidationItem(validationItem);

      if (validationItem?.id === FileNameValidation.exceedsLimit) {
        return;
      }

      setNewFileName(renamedFile);
    };

    return (
      <li
        ref={renameTabRef}
        className={clsx(
          styles.tab,
          isSelected && styles['tab-selected'],
          styles['rename-tab'],
        )}
      >
        <div className={styles['tab-button']}>
          <div
            className={clsx({
              [styles['tab-icon']]: Icon,
            })}
          >
            {Icon ? <Icon /> : null}
          </div>
          <form
            onSubmit={handleSubmitFileName}
            className={styles['rename-tab-form']}
          >
            <label className={styles['tab-label']}>
              <input
                className={clsx(styles['rename-tab-input'], {
                  [styles['error']]: fileNameValidationItem?.type === 'error',
                })}
                value={newFileName}
                onChange={handleNameChange}
                onBlur={handleSubmitFileName}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus={true} // check if it's possible to remove this
                onFocus={(e): void => e.currentTarget.select()}
              />
            </label>
            <XSmall
              className={styles['tab-label']}
            >{`.${fileExtension}`}</XSmall>
          </form>
        </div>
        {fileNameValidationItem && (
          <XXSmall
            bold
            className={clsx(styles['tab-label-invalid'], {
              [styles['error']]: fileNameValidationItem.type === 'error',
            })}
          >
            {fileNameValidationItem.message}
          </XXSmall>
        )}
      </li>
    );
  },
);

RenameEditorTab.displayName = 'RenameEditorTab';
export default RenameEditorTab;
