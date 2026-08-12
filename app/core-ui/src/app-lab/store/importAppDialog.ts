import { create } from 'zustand';

// Open-state + last-imported id for the single app-wide import-app dialog, owned
// by main and triggered from both the side panel's "+" and the app list. The id
// lets the my-apps list highlight the freshly imported app after a successful import.
interface ImportAppDialogStore {
  open: boolean;
  setOpen: (open: boolean) => void;
  importedAppId?: string;
  setImportedAppId: (id: string | undefined) => void;
}

export const useImportAppDialogStore = create<ImportAppDialogStore>((set) => ({
  open: false,
  setOpen: (open: boolean): void => set({ open }),
  importedAppId: undefined,
  setImportedAppId: (importedAppId: string | undefined): void =>
    set({ importedAppId }),
}));
