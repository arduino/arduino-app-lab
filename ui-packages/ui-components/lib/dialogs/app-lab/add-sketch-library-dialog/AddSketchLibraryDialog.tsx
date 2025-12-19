import {
  ListLibrariesParams,
  SketchLibrary,
} from '@cloud-editor-mono/infrastructure';
import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import { SketchLibraryCard } from '../../../components-by-app/app-lab';
import { SearchField } from '../../../essential/search-field';
import { useI18n } from '../../../i18n/useI18n';
import { Skeleton } from '../../../skeleton';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { addSketchLibraryDialogMessages as messages } from '../messages';
import styles from './add-sketch-library-dialog.module.scss';

export type AddSketchLibraryDialogLogic = () => {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraries?: SketchLibrary[];
  librarySearchIsLoading: boolean;
  searchSketchLibraries: (query: ListLibrariesParams['query']) => void;
  appLibrariesById: Record<string, string>;
  installingLibraryId?: string;
  addSketchLibrary: (libRef: string) => void;
  addSketchLibraryError?: boolean;
  deletingLibraryId?: string;
  deleteSketchLibrary: (libRef: string) => Promise<void>;
  openExternalLink: (url: string) => void;
};

type AddSketchDialogProps = { logic: AddSketchLibraryDialogLogic };

export const AddSketchLibraryDialog: React.FC<AddSketchDialogProps> = ({
  logic,
}: AddSketchDialogProps) => {
  const {
    open,
    onOpenChange,
    libraries = [],
    librarySearchIsLoading,
    searchSketchLibraries,
    appLibrariesById,
    installingLibraryId,
    addSketchLibrary,
    deletingLibraryId,
    deleteSketchLibrary,
    openExternalLink,
  } = logic();

  const { formatMessage } = useI18n();

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      searchSketchLibraries({});
    }
  }, [open, searchSketchLibraries]);

  useDebounce(
    () => {
      if (open) {
        searchSketchLibraries({
          search: searchQuery,
          architecture: 'zephyr',
        });
      }
    },
    300,
    [searchQuery],
  );

  return (
    <AppLabDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formatMessage(messages.dialogTitle)}
      classes={{
        root: styles['dialog-root'],
        content: styles['dialog-content'],
        body: styles['dialog-body'],
      }}
    >
      <SearchField
        placeholder={formatMessage(messages.searchPlaceholder)}
        label={formatMessage(messages.searchPlaceholder)}
        value={searchQuery}
        onChange={setSearchQuery}
        classes={{
          container: styles['search-container'],
          input: styles['search-input'],
        }}
      />
      {!librarySearchIsLoading && libraries.length > 0 && (
        <div className={styles['library-list']}>
          {libraries.map((library) => (
            <SketchLibraryCard
              key={library.id}
              library={library}
              onInstall={addSketchLibrary}
              onDelete={deleteSketchLibrary}
              isDeleting={deletingLibraryId === library.id}
              isInstalling={installingLibraryId === library.id}
              installedPackage={appLibrariesById[library.id || '']}
              openExternalLink={openExternalLink}
              isCoreLibrary={library.platform === 'arduino:zephyr'}
            />
          ))}
        </div>
      )}
      {librarySearchIsLoading && (
        <div className={styles['library-list-skeleton']}>
          <Skeleton variant="rect" count={5} />
        </div>
      )}
      {!librarySearchIsLoading && libraries.length === 0 && (
        <div className={styles['library-empty']}>No libraries found</div>
      )}
    </AppLabDialog>
  );
};
