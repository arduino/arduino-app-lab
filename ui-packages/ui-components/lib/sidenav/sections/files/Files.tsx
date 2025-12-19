import { ChevronDown } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useCallback, useContext } from 'react';
import { useFilter } from 'react-aria';

import { SelectableFileData } from '../../../editor-tabs-bar';
import DropdownMenuButton from '../../../essential/dropdown-menu/DropdownMenuButton';
import { SearchField } from '../../../essential/search-field';
import useDebouncedSearch from '../../../essential/search-field/useDebouncedSearch';
import { useI18n } from '../../../i18n/useI18n';
import { XSmall } from '../../../typography';
import { FileMenuItemIds } from '../../sidenav.type';
import { FilesContext } from './context/filesContext';
import styles from './files.module.scss';
import FilesList from './FilesList';
import { newFileMenuSections } from './filesSpec';
import { filesMessages } from './messages';

export function Files(): JSX.Element {
  const {
    files,
    isLoading,
    selectedFileId,
    renameFile,
    deleteFile,
    newFileAction,
    isReadOnly,
  } = useContext(FilesContext);

  const { formatMessage } = useI18n();

  const { contains } = useFilter({
    sensitivity: 'base',
  });

  const filterFiles = useCallback(
    (files: SelectableFileData[], query: string): SelectableFileData[] =>
      files.filter((file) => contains(file.fileFullName, query)),
    [contains],
  );

  const { query, setQuery, filteredItems } =
    useDebouncedSearch<SelectableFileData>(files, filterFiles);

  return (
    <div className={styles['files-container']}>
      <div className={styles['files-header']}>
        <SearchField
          placeholder={formatMessage(filesMessages.searchFiles)}
          label={formatMessage(filesMessages.searchFiles)}
          onChange={setQuery}
          value={query}
        />
      </div>

      <FilesList
        items={filteredItems}
        selectedFileId={selectedFileId}
        isLoading={isLoading}
        isReadOnly={isReadOnly}
        onFileAction={(item, action): void => {
          if (isReadOnly) {
            return;
          }

          if (action === FileMenuItemIds.Rename) {
            renameFile(item.fileId, item.fileName);
          }
          if (action === FileMenuItemIds.Delete) {
            deleteFile(item.fileId);
          }
        }}
      />

      {!isLoading && !isReadOnly && (
        <div className={styles['files-action']}>
          <DropdownMenuButton
            buttonChildren={
              <div className={styles['files-action-button-content']}>
                <XSmall bold uppercase>
                  {formatMessage(filesMessages.addFile)}
                </XSmall>
                <ChevronDown />
              </div>
            }
            sections={newFileMenuSections}
            onAction={(id): void => newFileAction(id)}
            classes={{
              dropdownMenuButtonWrapper: clsx(
                styles['files-action-button-wrapper'],
              ),
              dropdownMenuButton: styles['files-action-button'],
            }}
            useStaticPosition={false}
          />
        </div>
      )}
    </div>
  );
}
