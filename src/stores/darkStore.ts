import { DarkStoreType } from "@/types/zustand/dark";
import { create } from "zustand";


export const useDarkStore = create<DarkStoreType>((set, get) => ({
  dark: window.localStorage.getItem("vite-ui-theme") === "dark",
  setDark: (dark: boolean) => {
    set({ dark });
    window.localStorage.setItem("vite-ui-theme", dark ? "dark" : "light");
  },
}));