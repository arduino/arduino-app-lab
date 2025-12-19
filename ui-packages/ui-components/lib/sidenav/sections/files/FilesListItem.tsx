import {
  ThreeDots,
  UnsavedBadge,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import {
  Key,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FileNameValidation,
  FileNameValidationItem,
  SelectableFileData,
} from '../../../editor-tabs-bar';
import DropdownMenuButton from '../../../essential/dropdown-menu/DropdownMenuButton';
import { XSmall, XXSmall } from '../../../typography';
import { FileMenuItemIds } from '../../sidenav.type';
import { FilesContext } from './context/filesContext';
import styles from './files.module.scss';
import { fileMenuSections } from './filesSpec';

interface FilesListItemProps {
  item: SelectableFileData;
  selected: boolean;
  isReadOnly?: boolean;
  isRenaming?: boolean;
  onFileAction: (item: SelectableFileData, action: Key) => void;
}

const FilesListItem: React.FC<FilesListItemProps> = ({
  item,
  selected,
  isReadOnly,
  onFileAction,
}: FilesListItemProps) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [inputValue, setInputValue] = useState(item.fileName);
  const [validationError, setValidationError] = useState<
    FileNameValidationItem | undefined
  >(undefined);
  const [isHovered, setIsHovered] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const {
    unsavedFileIds,
    selectedFileChange,
    validateFileName,
    replaceFileNameInvalidCharacters,
  } = useContext(FilesContext);

  const isUnsaved = useMemo(
    () => unsavedFileIds?.has(item.fileId) ?? false,
    [item.fileId, unsavedFileIds],
  );

  const isItemReadonly = item.isMetadataReadOnly || isReadOnly;

  const startRename = (): void => {
    // selectedFileChange(item.fileId);
    setInputValue(item.fileName);
    setIsRenaming(true);
  };

  const handleRename = (): void => {
    if (validationError?.type !== 'error' && inputValue !== item.fileName) {
      onFileAction(
        {
          ...item,
          fileName: inputValue,
        },
        FileMenuItemIds.Rename,
      );
    }

    setIsRenaming(false);
    setValidationError(undefined);
  };

  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, [isRenaming]);

  useEffect(() => {
    let timeout: number;
    if (validationError?.type === 'warning') {
      timeout = window.setTimeout(() => setValidationError(undefined), 5000);
    }
    return (): void => clearTimeout(timeout);
  }, [validationError?.type]);

  return (
    <li
      className={clsx(styles['files-list-item'], {
        [styles['file-selected']]: selected,
      })}
      onMouseEnter={(): void => setIsHovered(true)}
      onMouseLeave={(): void => setIsHovered(false)}
    >
      <button
        className={clsx(styles['file-button'], {
          [styles['file-button-with-input']]: isRenaming,
        })}
        onClick={(e): void => {
          if (e.detail === 2 && !item.isMetadataReadOnly && !isReadOnly) {
            startRename();
            return;
          }
          selectedFileChange(item.fileId);
        }}
      >
        <div className={styles['file-icon']}>
          {item.Icon ? <item.Icon /> : null}
        </div>
        {isRenaming ? (
          <div className={styles['file-input-wrapper']}>
            <input
              ref={inputRef}
              type="text"
              className={clsx(styles['file-input'], {
                [styles['error']]: validationError?.type === 'error',
              })}
              value={inputValue}
              onChange={(e): void => {
                const validation = validateFileName(
                  item.fileName,
                  e.target.value,
                  item.fileExtension,
                );
                setValidationError(validation[0] ?? undefined);

                if (validation[0]?.id === FileNameValidation.exceedsLimit) {
                  return;
                }

                setInputValue(replaceFileNameInvalidCharacters(e.target.value));
              }}
              onBlur={handleRename}
              onKeyUp={(e): void => {
                if (e.key === 'Enter') {
                  handleRename();
                }
              }}
            />
            <XSmall className={styles['file-extension']}>
              .{item.fileExtension}
            </XSmall>
          </div>
        ) : (
          <XSmall className={styles['file-label']}>{item.fileFullName}</XSmall>
        )}
        {item.tags.length > 0 &&
          item.tags.map((tag) => (
            <div className={styles['file-tag']} key={tag}>
              <XXSmall className={styles['file-tag-text']}>{tag}</XXSmall>
            </div>
          ))}

        {isRenaming && validationError && (
          <div className={styles['file-validation']}>
            <XXSmall
              bold
              className={clsx(styles['file-validation-label'], {
                [styles['error']]: validationError.type === 'error',
              })}
            >
              {validationError.message}
            </XXSmall>
          </div>
        )}
      </button>
      {isUnsaved && !isReadOnly && (!isHovered || item.isMetadataReadOnly) && (
        <div className={styles['unsaved-badge']}>
          <UnsavedBadge />
        </div>
      )}
      {!isItemReadonly && isHovered && !isRenaming && (
        <DropdownMenuButton
          useStaticPosition={false}
          buttonChildren={<ThreeDots />}
          sections={fileMenuSections}
          onAction={(key: Key): void => {
            if (key === FileMenuItemIds.Rename) {
              startRename();
              return;
            }
            onFileAction(item, key);
          }}
          classes={{
            dropdownMenuPopover: clsx(styles['item-dropdown-menu-popover']),
          }}
        />
      )}
    </li>
  );
};

export default FilesListItem;
