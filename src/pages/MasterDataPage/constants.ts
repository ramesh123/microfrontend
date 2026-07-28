import { create } from 'zustand';

interface MasterDataState {
  isUploadDialogOpen: boolean;
  openUploadDialog: () => void;
  closeUploadDialog: () => void;
}

export const useMasterDataStore = create<MasterDataState>((set) => ({
  isUploadDialogOpen: false,
  openUploadDialog: () => set({ isUploadDialogOpen: true }),
  closeUploadDialog: () => set({ isUploadDialogOpen: false }),
}));

export const useMasterDataStores = create<MasterDataState>((set) => ({
    isUploadDialogOpen: false,
    openUploadDialog: () => set({ isUploadDialogOpen: true }),
    closeUploadDialog: () => set({ isUploadDialogOpen: false }),
  }));