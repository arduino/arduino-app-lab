import { useEffect, useState } from 'react';

import { clearRenamedInPlace, isRenamedInPlace } from '../openAppFile';

// The app screen's React key: a counter bumped by every id change but an in-place rename, since a later app can get the old id back.
export const useAppScreenKey = (appId: string): string => {
  const [screen, setScreen] = useState({ appId, generation: 0 });
  let { generation } = screen;
  if (screen.appId !== appId) {
    generation = isRenamedInPlace(screen.appId, appId)
      ? generation
      : generation + 1;
    setScreen({ appId, generation });
  }
  useEffect(clearRenamedInPlace, [appId]);
  return String(generation);
};
