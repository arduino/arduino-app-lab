import { Config } from '@cloud-editor-mono/common';
import { isPlayStoreApp } from '@cloud-editor-mono/domain';
import clsx from 'clsx';
import { memo, useCallback, useContext } from 'react';

import { AuthContext } from '../../../common/providers/auth/authContext';
import { ComponentContext } from '../../../common/providers/component/componentContext';
import ErrorNullBoundary from '../../../ErrorNullBoundary';
import { HeaderItemId, HeaderLogic } from '../header';
import Header from '../header/Header';
import HelmetWrapper from '../helmet/HelmetWrapper';
import { useSketchParams } from '../main/hooks/sketch';
import styles from './error.module.scss';
import ErrorContent from './ErrorContent';

interface ErrorProps {
  onClickCopyError?: () => void;
}

const Error: React.FC<ErrorProps> = (props: ErrorProps) => {
  const { onClickCopyError } = props;

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
      {/*
        nested `ErrorNullBoundary` in case source of error was `HelmetWrapper` or `Header`
      */}
      <ErrorNullBoundary>
        {!isHeaderless ? <HelmetWrapper /> : null}
        {!isHeaderless ? <Header headerLogic={headerLogic} /> : null}
      </ErrorNullBoundary>
      <div className={styles.content}>
        <ErrorContent onClickCopyError={onClickCopyError} />
      </div>
    </div>
  );
};

export default memo(Error);
