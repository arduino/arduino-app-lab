import { SidePanelLogic } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useLocation } from '@tanstack/react-router';
import { useCallback, useContext, useMemo } from 'react';

import { UseBoards } from '../../hooks/useBoards';
import { AuthContext } from '../../providers/auth/authContext';
import { useCreateAppDialogStore } from '../../store/createAppDialog';
import { useImportAppDialogStore } from '../../store/importAppDialog';

// Up to 2 initials from the user's full name, e.g. "Agustin Rujana" -> "AR"
const getInitials = (name?: string): string | undefined => {
  const parts = name?.trim().split(/\s+/).filter(Boolean) || [];
  if (parts.length === 0) {
    return undefined;
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
};

// Factory (not a hook) returns the inner hook, matching createUseSettingsLogic;
// lets useMainLogic inject it without tripping rules-of-hooks at the call site.
export const createUseSidePanelLogic = function (
  boardsProps: ReturnType<UseBoards>,
): SidePanelLogic {
  return function useSidePanelLogic(): ReturnType<SidePanelLogic> {
    const { pathname } = useLocation();
    const { user } = useContext(AuthContext);
    const openCreateAppDialog = useCreateAppDialogStore(
      (state) => state.setOpen,
    );
    const openImportAppDialog = useImportAppDialogStore(
      (state) => state.setOpen,
    );

    const isVisible = pathname.split('/').length <= 2;

    const activeItemId = pathname
      .split('/')
      .filter((it) => it.length > 0)
      .shift();

    const onCreateApp = useCallback((): void => {
      openCreateAppDialog(true);
    }, [openCreateAppDialog]);

    const onImportApp = useCallback((): void => {
      openImportAppDialog(true);
    }, [openImportAppDialog]);

    const initials = useMemo(() => getInitials(user?.name), [user?.name]);

    return {
      visible: isVisible,
      activeItemId,
      board: boardsProps.selectedBoard,
      boards: boardsProps.boards,
      onSelectBoard: boardsProps.selectBoard,
      onCreateApp,
      onImportApp,
      user: initials ? { initials } : undefined,
    };
  };
};
