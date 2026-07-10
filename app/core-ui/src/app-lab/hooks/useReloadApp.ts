import { AppInfo } from '@cloud-editor-mono/infrastructure';
import { AppsSection } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import { UseBoards } from './useBoards';

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
      saveAppId(currentAppId, currentSection).catch(console.error);
    } else if (!isInitialLoad) {
      resetAppId().catch(console.error);
    }
  }, [
    currentAppId,
    currentSection,
    selectedBoardSerial,
    boardJustChanged,
    selectedBoard,
    isInitialLoad,
    saveAppId,
    resetAppId,
  ]);

  useEffect(() => {
    const navigateToSavedApp = async (): Promise<void> => {
      if (!showRoutes || hasNavigatedToSavedAppRef.current) return;

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
          const hasUserApps = appsLength && appsLength > 0;
          const fallbackRoute = hasUserApps ? '/my-apps' : '/examples';
          await navigateRef.current({ to: fallbackRoute });
          return;
        }

        // Reset boardJustChanged if currentAppId is undefined (already navigated away)
        if (boardJustChanged && !currentAppId) {
          setBoardJustChanged(false);
          // Don't set hasNavigatedToSavedApp or return here, let the effect continue to evaluate fallback logic
        }

        if (lastAppId && lastAppId !== currentAppId) {
          hasNavigatedToSavedAppRef.current = true;
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
            const hasUserApps = appsLength && appsLength > 0;
            const fallbackRoute = hasUserApps ? '/my-apps' : '/examples';
            await navigateRef.current({ to: fallbackRoute });
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
    lastAppId,
    lastAppSection,
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
