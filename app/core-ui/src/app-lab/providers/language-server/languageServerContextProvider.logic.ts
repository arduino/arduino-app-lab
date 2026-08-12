import {
  LSP_LANGS,
  LspId,
  LspState,
  SelectableFileData,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback, useMemo, useState } from 'react';

export type UseLanguageServer = () => {
  activeSelectedFile: SelectableFileData | undefined;
  setActiveSelectedFile: React.Dispatch<
    React.SetStateAction<SelectableFileData | undefined>
  >;
  lspId: LspId | undefined;
  lspState: LspState;
  setLspStates: React.Dispatch<React.SetStateAction<Record<LspId, LspState>>>;
  resetLspState: () => void;
};

const idleLspStates: Record<LspId, LspState> = Array.from(
  new Set(Object.values(LSP_LANGS)),
).reduce((acc, lang) => {
  const lspId = lang as LspId;
  acc[lspId] = { type: 'idle' };
  return acc;
}, {} as Record<LspId, LspState>);

export const useLanguageServer: UseLanguageServer =
  (): ReturnType<UseLanguageServer> => {
    const [activeSelectedFile, setActiveSelectedFile] =
      useState<SelectableFileData>();
    const [lspStates, setLspStates] =
      useState<Record<LspId, LspState>>(idleLspStates);

    const lspId = useMemo(() => {
      if (!activeSelectedFile) return undefined;
      const ext = activeSelectedFile.fileExtension;
      return LSP_LANGS[ext as keyof typeof LSP_LANGS];
    }, [activeSelectedFile]);
    const lspState = useMemo((): LspState => {
      if (!lspId) return { type: 'idle' };
      return lspStates[lspId];
    }, [lspId, lspStates]);

    const resetLspState = useCallback((): void => {
      setActiveSelectedFile(undefined);
      setLspStates(idleLspStates);
    }, []);

    return {
      activeSelectedFile,
      setActiveSelectedFile,
      lspId,
      lspState,
      setLspStates,
      resetLspState,
    };
  };
