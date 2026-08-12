import { AppInfo } from '@cloud-editor-mono/infrastructure';
import { AppsSection } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import { clearPeekedApp, isPeekedApp } from '../openAppFile';
import { UseBoards } from './useBoards';

const getFallbackRoute = (appsCount?: number): string =>
  appsCount && appsCount > 0 ? '/my-apps' : '/inspirations';

export type UseReloadApp = (props: {
  boardsProps: ReturnType<UseBoards>;
  showRoutes: boolean;
  currentAppId?: string;
  apps?: AppInfo[];
  currentSection?: AppsSection;
  lastAppInfoLoaded?: boolean;
}) => void;

export const useReloadApp: UseReloadApp = ({
  boardsProps,
  showRoutes,
  currentAppId,
  apps,
  currentSection,
  lastAppInfoLoaded,
}) => {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // Agent mode is a top-level sibling route with no $appId, so currentAppId/currentSection read as
  // undefined there even though the user never left their app. It has to be excluded from the
  // resume state machine below, or entering agent mode looks like "the user closed the app".
  const agentModeActive = useRouterState({
    select: (state) => state.location.pathname.startsWith('/ai-assistant'),
  });

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [boardJustChanged, setBoardJustChanged] = useState(false);
  const hasNavigatedToSavedAppRef = useRef(false);
  const previousBoardSerialRef = useRef<string | undefined>();

  const {
    lastAppInfo,
    saveAppId,
    resetAppId,
    selectedBoard,
    connToBoardCompleted,
    isAutoSelectingBoard,
    couldNotAutoSelectBoard,
  } = boardsProps;

  const selectedBoardSerial = selectedBoard?.serial;
  const appsLength = apps?.length;
  const lastAppId = lastAppInfo?.appId;
  const lastAppSection = lastAppInfo?.section;
  // The saved app id is no longer in the list — e.g. the agent renamed it, minting a new id. Decided only once the
  // list is loaded: while apps is undefined we don't know, so we don't treat it as missing.
  const savedAppMissing =
    lastAppId !== undefined &&
    lastAppSection !== 'examples' &&
    apps !== undefined &&
    !apps.some((a) => a.id === lastAppId);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const currentSerial = selectedBoard?.serial;

    if (!showRoutes && hasNavigatedToSavedAppRef.current) {
      hasNavigatedToSavedAppRef.current = false;
    }

    if (
      currentSerial &&
      currentSerial !== previousBoardSerialRef.current &&
      hasNavigatedToSavedAppRef.current
    ) {
      hasNavigatedToSavedAppRef.current = false;
      setBoardJustChanged(true);
    }

    if (
      lastAppInfo &&
      hasNavigatedToSavedAppRef.current &&
      previousBoardSerialRef.current === currentSerial
    ) {
      hasNavigatedToSavedAppRef.current = false;
    }

    if (currentSerial !== previousBoardSerialRef.current) {
      previousBoardSerialRef.current = currentSerial;
    }
  }, [
    selectedBoardSerial,
    showRoutes,
    lastAppId,
    selectedBoard?.serial,
    lastAppInfo,
  ]);

  useEffect(() => {
    if (!selectedBoard) {
      return;
    }

    if (boardJustChanged) {
      return;
    }

    if (currentAppId && currentSection) {
      if (isPeekedApp(currentAppId)) {
        return; // opened via a chip peek — don't record it as the board's resume app
      }
      clearPeekedApp();
      saveAppId(currentAppId, currentSection).catch(console.error);
    } else if (!isInitialLoad && !agentModeActive) {
      // In agent mode the app is still the board's current one — keep it as the resume app.
      clearPeekedApp();
      resetAppId().catch(console.error);
    }
  }, [
    currentAppId,
    currentSection,
    selectedBoardSerial,
    boardJustChanged,
    selectedBoard,
    isInitialLoad,
    agentModeActive,
    saveAppId,
    resetAppId,
  ]);

  useEffect(() => {
    const navigateToSavedApp = async (): Promise<void> => {
      if (!showRoutes || hasNavigatedToSavedAppRef.current) return;

      // In agent mode currentAppId is undefined while lastAppId is still set, so resuming from here
      // would navigate the user out of the agent panel and back into the editor.
      if (agentModeActive) return;

      if (!selectedBoard) {
        return;
      }
      if (
        !isAutoSelectingBoard &&
        connToBoardCompleted &&
        selectedBoard &&
        hasNavigatedToSavedAppRef.current &&
        !currentAppId
      ) {
        hasNavigatedToSavedAppRef.current = false;
        return;
      }

      if (
        isAutoSelectingBoard ||
        !connToBoardCompleted ||
        couldNotAutoSelectBoard
      ) {
        return;
      }

      try {
        // If board just changed and currentAppId is set, navigate away
        // This prevents staying on an app that doesn't exist on the new board
        if (boardJustChanged && currentAppId) {
          setBoardJustChanged(false);
          hasNavigatedToSavedAppRef.current = true;
          await navigateRef.current({ to: getFallbackRoute(appsLength) });
          return;
        }

        // Reset boardJustChanged if currentAppId is undefined (already navigated away)
        if (boardJustChanged && !currentAppId) {
          setBoardJustChanged(false);
          // Don't set hasNavigatedToSavedApp or return here, let the effect continue to evaluate fallback logic
        }

        if (lastAppId && lastAppId !== currentAppId) {
          hasNavigatedToSavedAppRef.current = true;
          // Renamed away (see savedAppMissing): opening the editor on the gone id breaks, so fall back to the list.
          if (savedAppMissing) {
            await navigateRef.current({ to: getFallbackRoute(appsLength) });
            return;
          }
          const route =
            lastAppSection === 'examples'
              ? '/examples/$appId'
              : '/my-apps/$appId';
          const navParams = { appId: lastAppId };

          await navigateRef.current({ to: route, params: navParams });
          return;
        }

        if (lastAppId && lastAppId === currentAppId) {
          hasNavigatedToSavedAppRef.current = true;
          return;
        }

        if (!lastAppId) {
          if (lastAppInfoLoaded) {
            hasNavigatedToSavedAppRef.current = true;
            await navigateRef.current({ to: getFallbackRoute(appsLength) });
            return;
          }
          hasNavigatedToSavedAppRef.current = false;
          return;
        }
      } catch (error) {
        console.error('Failed to navigate to saved app:', error);
      }
    };

    navigateToSavedApp();
  }, [
    showRoutes,
    agentModeActive,
    lastAppId,
    lastAppSection,
    savedAppMissing,
    lastAppInfoLoaded,
    currentAppId,
    appsLength,
    isAutoSelectingBoard,
    connToBoardCompleted,
    selectedBoardSerial,
    selectedBoard,
    couldNotAutoSelectBoard,
    boardJustChanged,
  ]);
};
