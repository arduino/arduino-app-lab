import { Key } from 'react';

import { SelectableFileData } from '../../../editor-tabs-bar';
import NoResults from '../common/NoResults';
import styles from './files.module.scss';
import FilesListItem from './FilesListItem';
import FilesListItemSkeleton from './FilesListItemSkeleton';

const skeletonChildren = Number(styles.skeletonChildren);

interface FilesListProps {
  items: SelectableFileData[];
  isReadOnly?: boolean;
  isLoading?: boolean;
  selectedFileId?: string;
  onFileAction: (item: SelectableFileData, action: Key) => void;
}

const FilesList: React.FC<FilesListProps> = (props: FilesListProps) => {
  const { items, isLoading, selectedFileId, isReadOnly, onFileAction } = props;

  return (
    <div className={styles['files-list-container']}>
      <ul className={styles['files-list']}>
        {!isLoading && items.length === 0 && (
          <NoResults
            resourceName="file"
            classes={{
              container: styles['files-no-result'],
            }}
          />
        )}
        {isLoading && items.length === 0 ? (
          <FilesListItemSkeleton count={skeletonChildren} />
        ) : (
          items.map((item) => (
            <FilesListItem
              key={`${item.fileId}`}
              item={item}
              isReadOnly={isReadOnly}
              selected={selectedFileId === item.fileId}
              onFileAction={onFileAction}
            />
          ))
        )}
      </ul>
    </div>
  );
};

export default FilesList;
