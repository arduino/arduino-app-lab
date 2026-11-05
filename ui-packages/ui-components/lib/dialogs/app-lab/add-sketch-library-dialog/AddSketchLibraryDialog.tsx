import {
  ListLibrariesParams,
  SketchLibrary,
} from '@cloud-editor-mono/infrastructure';
import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import {
  Board,
  Button,
  ButtonSize,
  ButtonVariant,
  SketchLibraryCard,
} from '../../../components-by-app/app-lab';
import { InputStyle } from '../../../essential/input';
import { SearchField } from '../../../essential/search-field';
import { useI18n } from '../../../i18n/useI18n';
import { Skeleton } from '../../../skeleton';
import { XSmall } from '../../../typography';
import { AppLabDialog } from '../app-lab-dialog/AppLabDialog';
import { addSketchLibraryDialogMessages as messages } from '../messages';
import styles from './add-sketch-library-dialog.module.scss';

const LIBRARY_ARCHITECTURE = 'zephyr';

export type AddSketchLibraryDialogLogic = () => {
  board?: Board;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraries?: SketchLibrary[];
  librarySearchIsLoading: boolean;
  librarySearchError: boolean;
  retryLibrarySearch: () => void;
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
    board,
    open,
    onOpenChange,
    libraries = [],
    librarySearchIsLoading,
    librarySearchError,
    retryLibrarySearch,
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

  const showError = !librarySearchIsLoading && librarySearchError;

  // The query is cleared on close: clearing it on open would show the old
  // query for the first render after reopening.
  useEffect(() => {
    if (open) {
      searchSketchLibraries({
        search: '',
        architecture: LIBRARY_ARCHITECTURE,
      });
    } else {
      setSearchQuery('');
    }
  }, [open, searchSketchLibraries]);

  useDebounce(
    () => {
      if (open) {
        searchSketchLibraries({
          search: searchQuery,
          architecture: LIBRARY_ARCHITECTURE,
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
        inputStyle={InputStyle.AppLab}
        classes={{ container: styles['search-container'] }}
      />
      {!librarySearchIsLoading && !showError && libraries.length > 0 && (
        <div className={styles['library-list']}>
          {libraries.map((library) => (
            <SketchLibraryCard
              key={library.id}
              board={board}
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
      {showError && (
        <div className={styles['library-error']} role="alert">
          <XSmall>{formatMessage(messages.searchError)}</XSmall>
          <Button
            variant={ButtonVariant.Secondary}
            size={ButtonSize.XSmall}
            onClick={retryLibrarySearch}
          >
            {formatMessage(messages.retryButton)}
          </Button>
        </div>
      )}
      {!librarySearchIsLoading && !showError && libraries.length === 0 && (
        <div className={styles['library-empty']}>
          {formatMessage(messages.noLibrariesFound)}
        </div>
      )}
    </AppLabDialog>
  );
};
