import { FC, lazy, LazyExoticComponent } from 'react';

import { MainPageProps } from '../pages/MainPage';
import { PageProps } from '../pages/page.type';
import { SerialMonitorPageProps } from '../pages/SerialMonitorPage';

interface MainPageLazyPreload extends LazyExoticComponent<FC<MainPageProps>> {
  preload: () => Promise<void>;
}

interface SerialMonitorLazyPreload
  extends LazyExoticComponent<FC<SerialMonitorPageProps>> {
  preload: () => Promise<void>;
}

export function getLazyComponents(): {
  MainPage: LazyExoticComponent<FC<MainPageProps>>;
  SerialMonitorPage: LazyExoticComponent<FC<PageProps>>;
} {
  const MainPage: MainPageLazyPreload = Object.assign(
    lazy(() => import('../pages/MainPage')),
    {
      preload: async (): Promise<void> => {
        await import('../pages/MainPage');
      },
    },
  );

  const SerialMonitorPage: SerialMonitorLazyPreload = Object.assign(
    lazy(() => import('../pages/SerialMonitorPage')),
    {
      preload: async (): Promise<void> => {
        await import('../pages/SerialMonitorPage');
      },
    },
  );

  return { MainPage, SerialMonitorPage };
}
