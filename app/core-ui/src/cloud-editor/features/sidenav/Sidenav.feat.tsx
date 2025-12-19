import {
  DependentSidenavLogic,
  Sidenav,
} from '@cloud-editor-mono/ui-components';
import { memo, useCallback } from 'react';

import { createUseSidenavLogic } from './sidenav.logic';

const SidenavMemo = memo(Sidenav);

interface SidenavFeatProps {
  children?: React.ReactNode;
  dependentSidenavLogic: DependentSidenavLogic;
  hide: boolean; // distinct from `dependentSidenavLogic` as it's used in the key of `SidenavMemo` to "reset state"
}

const SidenavFeat: React.FC<SidenavFeatProps> = (props: SidenavFeatProps) => {
  const { dependentSidenavLogic, hide, children } = props;

  const sidenavLogic = useCallback(
    () => createUseSidenavLogic(hide, dependentSidenavLogic)(),
    [dependentSidenavLogic, hide],
  );

  return (
    <SidenavMemo key={`sidenav-key-hidden-${hide}`} sidenavLogic={sidenavLogic}>
      {children}
    </SidenavMemo>
  );
};

export default memo(SidenavFeat);
