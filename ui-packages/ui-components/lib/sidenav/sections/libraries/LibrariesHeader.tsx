import { UploadLight } from '@cloud-editor-mono/images/assets/icons';

import { IconButton } from '../../../essential/icon-button';
import { Loader } from '../../../essential/loader';
import styles from './libraries.module.scss';

type LibrariesHeaderProps = {
  isUploadingLibrary: boolean;
  onLibraryUpload: () => void;
};

export const LibrariesHeader: React.FC<LibrariesHeaderProps> = ({
  isUploadingLibrary,
  onLibraryUpload,
}: LibrariesHeaderProps) => {
  return (
    <div className={styles['libraries-header-cta']}>
      {isUploadingLibrary ? (
        <Loader tiny />
      ) : (
        <IconButton
          label="Upload library"
          Icon={UploadLight}
          onPress={onLibraryUpload}
        />
      )}
    </div>
  );
};
