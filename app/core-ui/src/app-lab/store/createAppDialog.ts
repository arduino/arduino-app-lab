import { create } from 'zustand';

// Open-state for the single app-wide create-app dialog, owned by main and
// triggered from both the side panel's "+" and the app list's create button
interface CreateAppDialogStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useCreateAppDialogStore = create<CreateAppDialogStore>((set) => ({
  open: false,
  setOpen: (open: boolean): void => set({ open }),
}));
