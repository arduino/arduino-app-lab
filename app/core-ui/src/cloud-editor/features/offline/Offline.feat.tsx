import { Config } from '@cloud-editor-mono/common';
import { isPlayStoreApp } from '@cloud-editor-mono/domain';
import clsx from 'clsx';
import { useCallback, useContext } from 'react';

import { AuthContext } from '../../../common/providers/auth/authContext';
import { ComponentContext } from '../../../common/providers/component/componentContext';
import { HeaderItemId, HeaderLogic } from '../header';
import Header from '../header/Header';
import HelmetWrapper from '../helmet/HelmetWrapper';
import { useSketchParams } from '../main/hooks/sketch';
import styles from './offline.module.scss';
import OfflineContent from './OfflineContent';

const Offline: React.FC = () => {
  const useHeaderLogic = (): ReturnType<HeaderLogic> => {
    const { user } = useContext(AuthContext);

    const { viewMode } = useSketchParams();

    const headerItemId = HeaderItemId.None;

    return {
      isReadOnly: !!viewMode,
      readOnlyAvatarLink: !isPlayStoreApp() ? Config.ID_URL : '',
      user,
      headerItemId,
    };
  };

  const headerLogic = useCallback(useHeaderLogic, []);

  let isHeaderless = false;
  const componentContext = useContext(ComponentContext);
  if (componentContext) {
    isHeaderless = Boolean(componentContext.headerless);
  }

  return (
    <div
      className={clsx(styles.container, {
        [styles['container-with-header']]: !isHeaderless,
      })}
    >
      {!isHeaderless ? <HelmetWrapper /> : null}
      {!isHeaderless ? <Header headerLogic={headerLogic} /> : null}
      <div className={styles.content}>
        <OfflineContent />
      </div>
    </div>
  );
};

export default Offline;
