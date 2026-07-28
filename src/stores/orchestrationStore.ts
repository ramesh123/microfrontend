import { create } from 'zustand';

interface OrchestrationState {
  // Current organization data (used for business unit and process creation)
  currentOrganization: {
    id: string | null;
    name: string | null;
  } | null;
  
  // Set current organization data
  setCurrentOrganization: (orgData: { id: string; name: string } | null) => void;
  
  // Clear current organization
  clearCurrentOrganization: () => void;
}

export const useOrchestrationStore = create<OrchestrationState>((set) => ({
  currentOrganization: null,
  
  setCurrentOrganization: (orgData) => set({ currentOrganization: orgData }),
  
  clearCurrentOrganization: () => set({ currentOrganization: null }),
}));