import { create } from 'zustand';

interface RuleConfigurationState {
  savedPayload: any | null;
  nodeId: string | null; // Track which node this payload belongs to
  setSavedPayload: (payload: any, nodeId: string) => void;
  getSavedPayload: (nodeId?: string) => any | null;
  reset: () => void;
  clearPayloadForNode: (nodeId: string) => void;
}

const initialState = {
  savedPayload: null,
  nodeId: null,
};

export const useRuleConfigurationStore = create<RuleConfigurationState>((set, get) => ({
  ...initialState,
  setSavedPayload: (payload, nodeId) => {
    console.log('💾 Storing payload in rule configuration store:', {
      nodeId,
      hasRules: !!(payload?.rules && Object.keys(payload.rules || {}).length > 0),
      hasFieldRules: !!(Array.isArray(payload?.field_rules) && payload.field_rules.length > 0),
      rulesKeys: payload?.rules ? Object.keys(payload.rules || {}) : [],
    });
    set({ savedPayload: payload, nodeId });
  },
  getSavedPayload: (nodeId?: string) => {
    const state = get();
    // If nodeId is provided, only return payload if it matches
    if (nodeId && state.nodeId !== nodeId) {
      console.log('⚠️ Payload in store belongs to different node:', {
        requestedNodeId: nodeId,
        storedNodeId: state.nodeId,
      });
      return null;
    }
    const payload = state.savedPayload;
    console.log('📦 Retrieved payload from rule configuration store:', {
      nodeId: state.nodeId,
      hasPayload: !!payload,
      hasRules: !!(payload?.rules && Object.keys(payload.rules || {}).length > 0),
      hasFieldRules: !!(Array.isArray(payload?.field_rules) && payload.field_rules.length > 0),
    });
    return payload;
  },
  reset: () => {
    console.log('🔄 Resetting rule configuration store');
    set({ ...initialState });
  },
  clearPayloadForNode: (nodeId) => {
    const state = get();
    if (state.nodeId === nodeId) {
      console.log('🗑️ Clearing payload for node:', nodeId);
      set({ savedPayload: null, nodeId: null });
    }
  },
}));

