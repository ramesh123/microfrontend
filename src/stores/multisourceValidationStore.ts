import { create } from 'zustand';
import { Source, Connection, AggregationRule } from '@/types';

type ConnectionType = 'key' | 'validation' | 'aggregation';

interface MultiSourceValidationState {
  sources: Source[];
  connections: Connection[];
  connectionTypes: Map<string, ConnectionType>;
  aggregationRules: AggregationRule[];
  selectedSources: string[];
  sourceFilters: Record<string, any>;
  
  // Actions
  setSources: (sources: Source[]) => void;
  addConnection: (connection: Connection) => void;
  removeConnection: (connectionId: string) => void;
  setConnectionType: (connectionId: string, type: ConnectionType) => void;
  updateAggregationRule: (rule: Partial<AggregationRule> & { connectionId: string }) => void;
  toggleSource: (sourceId: string) => void;
  updateSourceFilter: (sourceId: string, filter: any) => void;
  initializeState: (payload: any, sources: Source[]) => void;
  reset: () => void;
}

export const useMultiSourceValidationStore = create<MultiSourceValidationState>((set, get) => ({
  sources: [],
  connections: [],
  connectionTypes: new Map(),
  aggregationRules: [],
  selectedSources: [],
  sourceFilters: {},

  setSources: (sources) => set({ sources }),

  addConnection: (connection) => {
    set((state) => ({
      connections: [...state.connections, connection],
    }));
  },

  removeConnection: (connectionId) => {
    set((state) => ({
      connections: state.connections.filter((conn) => conn.id !== connectionId),
      connectionTypes: new Map([...state.connectionTypes].filter(([id]) => id !== connectionId)),
      aggregationRules: state.aggregationRules.filter((rule) => rule.connectionId !== connectionId),
    }));
  },

  setConnectionType: (connectionId, type) => {
    set((state) => {
      const newConnectionTypes = new Map(state.connectionTypes);
      newConnectionTypes.set(connectionId, type);
      return { connectionTypes: newConnectionTypes };
    });
  },

  updateAggregationRule: (rule) => {
    set((state) => {
      const existingRuleIndex = state.aggregationRules.findIndex(
        (r) => r.connectionId === rule.connectionId
      );

      if (existingRuleIndex >= 0) {
        const updatedRules = [...state.aggregationRules];
        updatedRules[existingRuleIndex] = { ...updatedRules[existingRuleIndex], ...rule };
        return { aggregationRules: updatedRules };
      } else {
        return {
          aggregationRules: [
            ...state.aggregationRules,
            {
              id: `rule_${Date.now()}`,
              connectionId: rule.connectionId,
              sourceColumnAggregation: rule.sourceColumnAggregation,
              targetColumnAggregation: rule.targetColumnAggregation,
            },
          ],
        };
      }
    });
  },

  toggleSource: (sourceId) => {
    set((state) => ({
      selectedSources: state.selectedSources.includes(sourceId)
        ? state.selectedSources.filter((id) => id !== sourceId)
        : [...state.selectedSources, sourceId],
    }));
  },

  updateSourceFilter: (sourceId, filter) => {
    set((state) => ({
      sourceFilters: {
        ...state.sourceFilters,
        [sourceId]: filter,
      },
    }));
  },

  initializeState: (payload, sources) => {
    set({
      sources,
      connections: payload?.connections || [],
      connectionTypes: new Map(payload?.connectionTypes || []),
      aggregationRules: payload?.aggregationRules || [],
      selectedSources: payload?.selectedSources || sources.map((s) => s.id),
      sourceFilters: payload?.sourceFilters || {},
    });
  },

  reset: () => {
    set({
      sources: [],
      connections: [],
      connectionTypes: new Map(),
      aggregationRules: [],
      selectedSources: [],
      sourceFilters: {},
    });
  },
}));

export default useMultiSourceValidationStore;
