import { create } from "zustand";
import { getMasterDataFiles } from "@/controllers/API/filesApi";

export interface FileRecord {
  value: string; // unique_id
  label: string; // display_name
  file_name: string;
  file_type?: string;
  encrypted_file_key: string;
  sheet_name?: string;
  [key: string]: any;
}

interface FilesStore {
  files: FileRecord[];
  isLoading: boolean;
  error: Error | null;
  fetchFiles: (customPayload?: any) => Promise<void>;
  getFileByUniqueId: (uniqueId: string) => FileRecord | undefined;
  getFilesByCategory: (category: string) => FileRecord[];
}

export const useFilesStore = create<FilesStore>((set, get) => ({
  files: [],
  isLoading: false,
  error: null,

  fetchFiles: async (customPayload?: any) => {
    // Only use cache if no custom payload
    if (!customPayload && get().files.length > 0) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const defaultPayload = {
        fields: JSON.stringify([
          "unique_id as value",
          "display_name as label",
          "file_name",
          "file_type",
          "icon_encrypted_file_key",
          "sheet_name",
        ]),
        file_category: "dataset_icon"
      };
      const response = await getMasterDataFiles(customPayload || defaultPayload);
      const normalizedFiles = (response.data || []).map((file: any) => ({
        value: file.value || file.unique_id,
        label: file.label || file.display_name,
        file_name: file.file_name,
        file_type: file.file_type,
        icon_encrypted_file_key: file.icon_encrypted_file_key,
        sheet_name: file.sheet_name,
        ...file,
      }));
      set({ files: normalizedFiles, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error : new Error("Failed to fetch files"),
        isLoading: false,
      });
    }
  },

  getFileByUniqueId: (uniqueId: string) => {
    return get().files.find((file) => file.value === uniqueId || file.unique_id === uniqueId);
  },

  getFilesByCategory: (category: string) => {
    return get().files.filter((file) => file.file_category === category);
  },
}));