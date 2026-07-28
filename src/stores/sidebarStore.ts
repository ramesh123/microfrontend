import { set } from "react-hook-form"
import { create } from "zustand"

interface SidebarState {
  isCollapsed: boolean
  toggleSidebar: () => void
  setCollapsed: (collapsed: boolean) => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed: false, // default: expanded
  toggleSidebar: () =>
    setTimeout(() => set((state) => ({ isCollapsed: !state.isCollapsed })), 100),
  setCollapsed: (collapsed: boolean) => setTimeout(() => set({ isCollapsed: collapsed }), 100),
}))