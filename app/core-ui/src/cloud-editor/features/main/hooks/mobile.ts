import { isMobileDevice } from '@cloud-editor-mono/common';
import { get, set } from 'idb-keyval';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMedia } from 'react-use';

import { useDialog } from '../../../../common/providers/dialog/dialogProvider.logic';
import { DialogId, DialogInfo } from '../../dialog-switch';

const DISMISSED_STORAGE_KEY = 'mobileDialogDismissed';

export const useMobileWarning = (enabled: boolean): void => {
  const {
    reactModalProps: { isOpen },
    dialogInfo,
    setIsOpen,
    setDialogInfo,
  } = useDialog<DialogInfo>();

  /**
   * MobileWarningDialog opens and closes programmatically, so we need to track
   * whether user has closed it (current session) or dismissed it (permanently).
   * Both states overrides isOpen value of reactModalProps
   */
  const [userClosed, setUserClosed] = useState<boolean>(false);
  const [userDismissed, setUserDismissed] = useState<boolean | null>(null);

  const isSmall = useMedia('(max-width: 768px)');
  const _isMobileDevice = useMemo(() => isMobileDevice(), []);
  const isMobile = _isMobileDevice || isSmall;

  const isMobileDialogOpen =
    isOpen && dialogInfo?.id === DialogId.MobileWarning;

  const handleClose = useCallback(() => {
    setUserClosed(true);
    setIsOpen(false);
    setDialogInfo(undefined);
  }, [setDialogInfo, setIsOpen]);

  const handleDismiss = useCallback((): void => {
    handleClose();
    setUserDismissed(true);
    set(DISMISSED_STORAGE_KEY, true);
  }, [handleClose]);

  useEffect(() => {
    const initState = async (): Promise<void> => {
      const value = await get(DISMISSED_STORAGE_KEY);
      setUserDismissed(Boolean(value));
    };

    initState();
  }, []);

  useEffect(() => {
    if (!enabled || userClosed || userDismissed || userDismissed === null) {
      return;
    }

    if (!isMobile && isMobileDialogOpen) {
      // close dialog on resize
      setDialogInfo(undefined);
      setIsOpen(false);
    }

    if (isMobile && !isMobileDialogOpen) {
      setDialogInfo({
        id: DialogId.MobileWarning,
        data: { handleDismiss, handleClose },
      });
      setIsOpen(true);
    }
  }, [
    enabled,
    handleClose,
    handleDismiss,
    isMobile,
    isMobileDialogOpen,
    setDialogInfo,
    setIsOpen,
    userClosed,
    userDismissed,
  ]);
};
