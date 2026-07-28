import { create } from 'zustand';
import { Source, Connection, AggregationRule, AggregationType } from '@/types';

// Define the mutually exclusive connection type
type ConnectionType = 'key' | 'validation' | 'aggregation';

/** Merge persisted order with current upstream sources: keep saved order, append new source ids. */
export function mergeSourceOrderWithSources(
  savedOrder: string[] | undefined | null,
  sources: { id: string }[],
): string[] {
  const defaultOrder = sources.map(s => s.id);
  if (!savedOrder?.length) return defaultOrder;
  const valid = new Set(defaultOrder);
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const id of savedOrder) {
    if (valid.has(id) && !seen.has(id)) {
      merged.push(id);
      seen.add(id);
    }
  }
  for (const id of defaultOrder) {
    if (!seen.has(id)) merged.push(id);
  }
  return merged;
}

interface DataValidationState {
  connections: Connection[];
  aggregationRules: AggregationRule[];
  // This map will store the type for each connection. This is the single source of truth.
  connectionTypes: Map<string, ConnectionType>;
  selectedSourceIds: string[];
  sourceOrder: string[]; // Track the order of sources

  // Actions
  initializeState: (payload: any, sources: Source[]) => void;
  reset: () => void;
  toggleSource: (sourceId: string) => void;
  addConnection: (connection: Connection) => void;
  removeConnection: (connectionId: string) => void;
  // This action will replace toggleKeyColumn and toggleValidationColumn
  setConnectionType: (connectionId: string, type: ConnectionType) => void;
  updateAggregationRule: (rule: Partial<AggregationRule> & { connectionId: string }) => void;
  reorderSources: (newOrder: string[]) => void;
}

const useDataValidationStore = create<DataValidationState>((set, get) => ({
  // Initial State
  connections: [],
  aggregationRules: [],
  connectionTypes: new Map(), // Use the new map
  selectedSourceIds: [],
  sourceOrder: [],

  // Actions
  initializeState: (payload, sources) => {
    if (!payload || !sources || sources.length === 0) {
      get().reset();
      return;
    }

    const findColumnDetails = (globalId: string) => {
      if (!globalId) return null;
      const sortedSources = [...sources].sort((a, b) => b.id.length - a.id.length);
      for (const s of sortedSources) {
        if (globalId.startsWith(s.id + '-')) {
          const columnId = globalId.substring(s.id.length + 1);
          const column = s.columns.find(c => c.id === columnId);
          if (column) return { source: s, column };
        }
      }
      return null;
    };

    const restoredConnections: Connection[] = (payload.column_mappings || [])
      .map((mapping: any) => {
        if (!mapping.sourceColumnId || !mapping.targetColumnId) return null;
        const sourceDetails = findColumnDetails(mapping.sourceColumnId);
        const targetDetails = findColumnDetails(mapping.targetColumnId);

        if (!sourceDetails || !targetDetails) return null;

        return {
          id: `${mapping.sourceColumnId}-${mapping.targetColumnId}`,
          sourceId: sourceDetails.source.id,
          targetId: targetDetails.source.id,
          sourceColumn: sourceDetails.column.id,
          targetColumn: targetDetails.column.id,
          sourceTag: sourceDetails.source.tag || '',
          targetTag: targetDetails.source.tag || '',
        };
      })
      .filter((c: Connection | null): c is Connection => c !== null);

    const newConnectionTypes = new Map<string, ConnectionType>();
    const newAggregationRules: AggregationRule[] = [];

    restoredConnections.forEach(conn => {
      const sourceDetails = findColumnDetails(`${conn.sourceId}-${conn.sourceColumn}`);
      const targetDetails = findColumnDetails(`${conn.targetId}-${conn.targetColumn}`);
      if (!sourceDetails || !targetDetails) return;

      const pairKey = `('${sourceDetails.source.name}', '${targetDetails.source.name}')`;
      const reversePairKey = `('${targetDetails.source.name}', '${sourceDetails.source.name}')`;
      let foundType = false;

      const agg_cols = payload.aggregation_cols?.[pairKey] || payload.aggregation_cols?.[reversePairKey];
      if (agg_cols) {
        const sourceAggRule = agg_cols[sourceDetails.source.name]?.[sourceDetails.column.name];
        const targetAggRule = agg_cols[targetDetails.source.name]?.[targetDetails.column.name];
        if (sourceAggRule || targetAggRule) {
          newConnectionTypes.set(conn.id, 'aggregation');
          newAggregationRules.push({ connectionId: conn.id, sourceColumnAggregation: sourceAggRule, targetColumnAggregation: targetAggRule, tolerance: '' });
          foundType = true;
        }
      }

      if (!foundType) {
        const val_cols = payload.validation_cols?.[pairKey] || payload.validation_cols?.[reversePairKey];
        if (val_cols?.some((p: string[]) =>
          (p[0] === sourceDetails.column.name && p[1] === targetDetails.column.name) ||
          (p[1] === sourceDetails.column.name && p[0] === targetDetails.column.name)
        )) {
          newConnectionTypes.set(conn.id, 'validation');
          foundType = true;
        }
      }

      if (!foundType) {
        const key_cols = payload.key_cols?.[pairKey] || payload.key_cols?.[reversePairKey];
        if (key_cols?.some((p: string[]) =>
          (p[0] === sourceDetails.column.name && p[1] === targetDetails.column.name) ||
          (p[1] === sourceDetails.column.name && p[0] === targetDetails.column.name)
        )) {
          newConnectionTypes.set(conn.id, 'key');
          foundType = true;
        }
      }

      // Ensure every connection has a placeholder rule
      if (!newAggregationRules.find(r => r.connectionId === conn.id)) {
        newAggregationRules.push({
          connectionId: conn.id,
          sourceColumnAggregation: undefined,
          targetColumnAggregation: undefined,
          tolerance: '' // or some other default value
        });
      }
    });

    const sourceNameToIdMap = new Map(sources.map(s => [s.name, s.id]));
    const restoredSourceIds = (payload.selected_sources || [])
      .map((name: string) => sourceNameToIdMap.get(name))
      .filter((id: string | undefined): id is string => !!id);

    console.log('📊 InitializeState - Restored Data:', {
      connections: restoredConnections.length,
      connectionTypes: Array.from(newConnectionTypes.entries()).map(([id, type]) => ({ id, type })),
      aggregationRules: newAggregationRules.length,
      selectedSources: restoredSourceIds.length
    });

    set({
      connections: restoredConnections,
      connectionTypes: newConnectionTypes,
      aggregationRules: newAggregationRules,
      selectedSourceIds: restoredSourceIds.length > 0 ? restoredSourceIds : sources.map(s => s.id),
      sourceOrder: mergeSourceOrderWithSources(payload.source_order, sources),
    });
  },

  toggleSource: (sourceId) => set(state => ({
    selectedSourceIds: state.selectedSourceIds.includes(sourceId)
      ? state.selectedSourceIds.filter(id => id !== sourceId)
      : [...state.selectedSourceIds, sourceId]
  })),

  addConnection: (connection) => set(state => ({
    connections: [...state.connections, connection],
    aggregationRules: [...state.aggregationRules, {
      connectionId: connection.id,
      sourceColumnAggregation: 'sum', // default value
      targetColumnAggregation: 'sum', // default value
      tolerance: '' // or some other default value
    }]
  })),

  removeConnection: (connectionId) => set(state => {
    const newTypes = new Map(state.connectionTypes);
    newTypes.delete(connectionId);
    return {
      connections: state.connections.filter(conn => conn.id !== connectionId),
      aggregationRules: state.aggregationRules.filter(rule => rule.connectionId !== connectionId),
      connectionTypes: newTypes,
    };
  }),

  setConnectionType: (connectionId, type) => {
    set(state => {
      const newTypes = new Map(state.connectionTypes);
      const currentType = newTypes.get(connectionId);

      // If the type is the same, deselect it. Otherwise, set the new type.
      if (currentType === type) {
        newTypes.delete(connectionId);
        console.log(`🔘 Deselected type for connection ${connectionId} - was ${type}`);
      } else {
        newTypes.set(connectionId, type);
        console.log(`✅ Set connection type: ${connectionId} → ${type}`);
      }
      
      console.log('📊 Current Connection Types:', Array.from(newTypes.entries()).map(([id, t]) => ({ id, type: t })));

      // If the connection is no longer an aggregation type, clear its rules.
      if (newTypes.get(connectionId) !== 'aggregation') {
        const newRules = state.aggregationRules.map(rule =>
          rule.connectionId === connectionId
            ? { ...rule, sourceColumnAggregation: undefined, targetColumnAggregation: undefined }
            : rule
        );
        return { connectionTypes: newTypes, aggregationRules: newRules };
      }

      return { connectionTypes: newTypes };
    });
  },

  updateAggregationRule: (updatedRule) => set(state => ({
    aggregationRules: state.aggregationRules.map(rule =>
      rule.connectionId === updatedRule.connectionId
        ? { ...rule, ...updatedRule }
        : rule
    )
  })),

  reorderSources: (newOrder) => set(state => ({
    sourceOrder: newOrder
  })),

  reset: () => set({
    connections: [],
    aggregationRules: [],
    connectionTypes: new Map(),
    selectedSourceIds: [],
    sourceOrder: [],
  }),
}));

export default useDataValidationStore;