import { Config } from '@cloud-editor-mono/common';
import { ga4Emitter, send } from '@cloud-editor-mono/domain';
import {
  ConfirmActionDialogLogic,
  DeleteLibraryDialogLogic,
  DeleteSketchDialogLogic,
  flavourButtonId,
  FlavourConfigDialogLogic,
  GenAIPolicyTermsDialogLogic,
  ShareSketchDialogLogic,
} from '@cloud-editor-mono/ui-components';
import { useCallback } from 'react';

import {
  useDeleteCustomLibrary,
  useDeleteSketch,
} from '../../../../common/hooks/queries/create';
import { refreshCustomLibraries } from '../../../../common/hooks/queries/createUtils';
import { useDialog } from '../../../../common/providers/dialog/dialogProvider.logic';
import { DialogId, DialogInfo } from '../../dialog-switch';
import { CustomLibraryBroadcastEvent } from './libraries';
import { SketchBroadcastEvent, useSketchParams } from './sketch';

export function assertDialogType<T extends DialogId>(
  id: T,
  dialogInfo?: DialogInfo,
): asserts dialogInfo is DialogInfo & { id: T } {
  if (dialogInfo?.id !== id) {
    throw new Error(
      `Expected dialog ID "${id}", but found "${dialogInfo?.id}"`,
    );
  }
}

export const useDeleteSketchDialogLogic =
  (): ReturnType<DeleteSketchDialogLogic> => {
    const { reactModalProps, setIsOpen, dialogInfo } = useDialog<DialogInfo>();
    assertDialogType(DialogId.DeleteSketch, dialogInfo);

    const { sketchId } = dialogInfo.data;
    const { deleteSketchMutate, isLoading } = useDeleteSketch();

    const deleteSketchHandler = useCallback(async (): Promise<void> => {
      await deleteSketchMutate(sketchId);
      ga4Emitter({
        type: 'SKETCH_MOD',
        payload: { action: 'sketch_delete', sketch_id: sketchId },
      });

      send(SketchBroadcastEvent.SKETCH_DELETE, sketchId);
      window.location.href = `${Config.CLOUD_HOME_URL}/sketches`;
      setIsOpen(false);
    }, [deleteSketchMutate, setIsOpen, sketchId]);

    return {
      reactModalProps,
      setIsOpen,
      confirmAction: deleteSketchHandler,
      cancelAction: useCallback(() => setIsOpen(false), [setIsOpen]),
      isLoading,
    };
  };

export const useDeleteLibraryDialogLogic =
  (): ReturnType<DeleteLibraryDialogLogic> => {
    const { reactModalProps, setIsOpen, dialogInfo } = useDialog<DialogInfo>();
    assertDialogType(DialogId.DeleteLibrary, dialogInfo);

    const { libraryId } = dialogInfo.data;
    const { libraryID: routeLibraryId } = useSketchParams();
    const { deleteCustomLibraryMutate, isLoading } = useDeleteCustomLibrary();

    const deleteCustomLibraryHandler = useCallback(async (): Promise<void> => {
      await deleteCustomLibraryMutate(libraryId);

      send(CustomLibraryBroadcastEvent.CUSTOM_LIBRARY_DELETE, libraryId);
      refreshCustomLibraries();
      if (routeLibraryId === libraryId) {
        window.location.href = `${Config.CLOUD_HOME_URL}/sketches`;
      }
      setIsOpen(false);
    }, [deleteCustomLibraryMutate, libraryId, routeLibraryId, setIsOpen]);

    return {
      reactModalProps,
      setIsOpen,
      confirmAction: deleteCustomLibraryHandler,
      cancelAction: useCallback(() => setIsOpen(false), [setIsOpen]),
      isLoading,
    };
  };

export const useDeleteSecretDialogLogic =
  (): ReturnType<ConfirmActionDialogLogic> => {
    const { reactModalProps, setIsOpen, dialogInfo } = useDialog<DialogInfo>();
    assertDialogType(DialogId.DeleteSecret, dialogInfo);

    const closeDialog = useCallback(() => setIsOpen(false), [setIsOpen]);
    const confirmAction = useCallback(() => {
      closeDialog();
      dialogInfo.data.onConfirm();
    }, [closeDialog, dialogInfo.data]);

    return {
      reactModalProps,
      setIsOpen,
      confirmAction,
      cancelAction: closeDialog,
    };
  };

export function useGenericFlavourConfigDialogLogic(): Omit<
  ReturnType<FlavourConfigDialogLogic>,
  'flavourOptions' | 'setFlavourOptions'
> {
  const { reactModalProps, setIsOpen } = useDialog<DialogInfo>();

  const closeDialog = useCallback(() => setIsOpen(false), [setIsOpen]);

  const { left, top } = document
    .getElementById(flavourButtonId)
    ?.getBoundingClientRect() ?? {
    left: 0,
    top: 0,
  };

  return {
    reactModalProps: {
      ...reactModalProps,
    },
    setIsOpen,
    handleDismiss: closeDialog,
    handleClose: closeDialog,
    top,
    left,
  };
}

export function useGenericShareSketchDialogLogic(): Omit<
  ReturnType<ShareSketchDialogLogic>,
  'onToggleVisibility' | 'isOwned' | 'isPublic' | 'targetUrl' | 'embedMarkup'
> {
  const { reactModalProps, setIsOpen } = useDialog<DialogInfo>();

  const closeDialog = useCallback(() => setIsOpen(false), [setIsOpen]);

  return {
    reactModalProps,
    setIsOpen,
    handleDismiss: closeDialog,
    handleClose: closeDialog,
  };
}

export const useGenAIPolicyTermsDialogLogic = (): Omit<
  ReturnType<GenAIPolicyTermsDialogLogic>,
  'confirmAction'
> => {
  const { reactModalProps, setIsOpen } = useDialog<DialogInfo>();

  const closeDialog = useCallback(() => setIsOpen(false), [setIsOpen]);

  return {
    reactModalProps,
    setIsOpen,
    handleClose: closeDialog,
  };
};
