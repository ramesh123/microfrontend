import { create } from 'zustand'

interface NodeStore {
  selectedNode: any | null
  setSelectedNode: (node: any) => void
}

export const useNodeStore = create<NodeStore>((set) => ({
  selectedNode: null,
  setSelectedNode: (node) => set({ selectedNode: node }),
}))
