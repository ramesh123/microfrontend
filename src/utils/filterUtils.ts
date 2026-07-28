import useFlowStore from '@/stores/flowStore';
import { useValidationStore } from '@/stores/validationStore';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

type FilterType = "filter" | "custom_column" | "derive_column" | "conditional_column" | "column_filter";

interface DataItem {
  filters: any[];
  [key: string]: any;
}

/**
 * After `filter_generator` returns new `filter_conditions`, merge with the previous payload so
 * manual / AI Polars blocks are kept when the API response only contains newly generated rows.
 */
export function mergeFilterConditionsAfterGeneratorResponse(
  previousConditions: unknown,
  incomingConditions: unknown
): any[] {
  const prev = Array.isArray(previousConditions) ? previousConditions : [];
  const incoming = Array.isArray(incomingConditions) ? incomingConditions : [];
  const incomingIds = new Set(
    incoming.map((x: any) => x?.id).filter((id: unknown) => id != null && id !== "")
  );

  const preserved = prev.filter((x: any) => {
    const ft = x?.filter_type;
    if (ft !== "manual" && ft !== "ai_generated") return false;
    if (x?.id != null && x?.id !== "" && incomingIds.has(x.id)) return false;
    return true;
  });

  return [...preserved, ...incoming];
}

export function mapFilterDataToPayload(dataArray: DataItem[], filterType?: FilterType) {
  return dataArray.flatMap((item) => {
    const { filters }: any = item;
    if (filterType === "custom_column") {
      return {
        id: filters?.[0]?.id || uuidv4(),
        value: "",
        column: "",
        condition: "",
        new_column: "",
        filter_type: filterType,
        set_custom_column: filters?.[0]?.set_custom_column || [],
        custom_derived_columns: {},
      };
    }

    return filters.map((filter: any) => {
      const base = {
        id: filter.id || uuidv4(),
        value: "",
        column: "",
        condition: "",
        new_column: "",
        filter_type: filterType,
        set_custom_column: [],
        custom_derived_columns: {},
      };

      switch (filterType) {
        case "filter":
          return {
            ...base,
            value: filter.value ?? "",
            column: filter.column || "",
            condition: filter.condition || "",
            filter: filter.filter || "",  // Preserve generated filter code
            custom_derived_columns: filter.custom_derived_columns || {},  // Preserve for editing
          };

        case "derive_column":
          return {
            ...base,
            value: filter.charRange || "",
            column: filter.column || "",
            condition: filter.condition || "",
            new_column: filter.new_column || "",
            custom_derived_columns: filter.custom_derived_columns || {},
          };

        case "column_filter":
          return {
            ...base,
            column_filters: filter.column_filters || {},
          };

        case "conditional_column":
          return {
            ...base,
            conditional_filter_columns: filter.conditional_filter_columns || [],
          };

        default:
          return base;
      }
    });
  });
}

/** Delete only the filter whose id matches (and sourceId when provided). Never match by code content — duplicates can share the same code. */
function shouldRemoveFilterOnDelete(
  filter: { id?: string; sourceId?: string },
  deleteId: string,
  sourceId?: string
): boolean {
  if (sourceId) {
    return filter.id === deleteId && filter.sourceId === sourceId;
  }
  return filter.id === deleteId;
}

export async function deleteFilterById({
  id,
  selectedNode,
  items,
  setItems,
  sourceNodes,
  setResult,
  sourceId,
  activeRuleId, // Add activeRuleId parameter for validation store deletion
}: {
  id: string;
  selectedNode: any;
  items: any[];
  setItems: (val: any[]) => void;
  sourceNodes?: any[];
  setResult?: any;
  sourceId?: string; // Source ID for per-source filter isolation
  activeRuleId?: string; // Active rule ID for validation store deletion
}) {
  console.log('🗑️ deleteFilterById: Deleting filter with id:', id);
  console.log('🗑️ deleteFilterById: Current items:', items.map(i => i.id));
  console.log('🗑️ deleteFilterById: sourceId:', sourceId, 'activeRuleId:', activeRuleId);

  const itemToDelete = items.find((item) => item.id === id);
  if (!itemToDelete) return toast.error("Item not found");

  // Optimistically update UI immediately for better UX
  // The useEffect will sync from payload after API completes
  const updatedItems = items.filter((item) => item.id !== id);
  console.log('🗑️ deleteFilterById: Updated items after filter:', updatedItems.map(i => i.id));
  setItems(updatedItems);

  const nodes = useFlowStore.getState().currentWorkflow?.data?.nodes;
  // const selectedNode = useFlowStore.getState().getSelectedNode();
  const currentNode: any = nodes.find((n: any) => n.id === selectedNode?.id);
  if (!currentNode) return toast.error("Selected node not found");

  const existingPayload = currentNode?.data?.node?.payload || {};

  // CRITICAL: Also delete from validation store (columnFiltersBySource and validationRulesMap) if this is a validation node with derive column filters
  if (sourceId && activeRuleId) {
    const { columnFiltersBySource, setColumnFiltersBySource, validationRulesMap, upsertValidationRule } = useValidationStore.getState();
    const ruleKey = `rule_${activeRuleId}`;
    
    // Delete from columnFiltersBySource
    if (columnFiltersBySource && typeof columnFiltersBySource === 'object') {
      const ruleFilters = columnFiltersBySource[ruleKey];
      
      if (ruleFilters && typeof ruleFilters === 'object' && ruleFilters[sourceId]) {
        const sourceFilters = Array.isArray(ruleFilters[sourceId]) ? ruleFilters[sourceId] : [];
        const updatedSourceFilters = sourceFilters.filter(
          (filter: any) => !shouldRemoveFilterOnDelete(filter, id, sourceId)
        );
        
        // Update validation store
        const updatedColumnFilters = {
          ...columnFiltersBySource,
          [ruleKey]: {
            ...ruleFilters,
            [sourceId]: updatedSourceFilters.length > 0 ? updatedSourceFilters : undefined
          }
        };
        
        // Clean up empty source arrays
        if (updatedSourceFilters.length === 0) {
          delete updatedColumnFilters[ruleKey][sourceId];
          // If rule has no more filters, remove the rule key
          if (Object.keys(updatedColumnFilters[ruleKey]).length === 0) {
            delete updatedColumnFilters[ruleKey];
          }
        }
        
        setColumnFiltersBySource(updatedColumnFilters);
        console.log('🗑️ deleteFilterById: Removed filter from validation store (columnFiltersBySource)');
      }
    }

    // Also delete from validationRulesMap if rule name can be found
    // Try to find rule name from payload or by iterating validationRulesMap
    if (validationRulesMap && typeof validationRulesMap === 'object') {
      // Try to find the rule that matches activeRuleId or has filters for this sourceId
      Object.keys(validationRulesMap).forEach((ruleName) => {
        const ruleData = validationRulesMap[ruleName];
        if (ruleData && typeof ruleData === 'object' && ruleData[sourceId]) {
          const sourceEntry = ruleData[sourceId];
          
          // Check filter_conditions in this source entry
          if (Array.isArray(sourceEntry.filter_conditions)) {
            const updatedFilterConditions = sourceEntry.filter_conditions.filter(
              (filter: any) => !shouldRemoveFilterOnDelete(filter, id, sourceId)
            );
            
            // Update validationRulesMap if filter was removed
            if (updatedFilterConditions.length !== sourceEntry.filter_conditions.length) {
              upsertValidationRule(ruleName, {
                [sourceId]: {
                  ...sourceEntry,
                  filter_conditions: updatedFilterConditions.length > 0 ? updatedFilterConditions : undefined
                }
              });
              console.log('🗑️ deleteFilterById: Removed filter from validationRulesMap for rule:', ruleName, 'source:', sourceId);
            }
          }
          
          // Also check filters array in this source entry
          if (Array.isArray(sourceEntry.filters)) {
            const updatedFilters = sourceEntry.filters.filter(
              (filter: any) => !shouldRemoveFilterOnDelete(filter, id, sourceId)
            );
            
            // Update validationRulesMap if filter was removed
            if (updatedFilters.length !== sourceEntry.filters.length) {
              upsertValidationRule(ruleName, {
                [sourceId]: {
                  ...sourceEntry,
                  filters: updatedFilters.length > 0 ? updatedFilters : undefined
                }
              });
              console.log('🗑️ deleteFilterById: Removed filter from validationRulesMap.filters for rule:', ruleName, 'source:', sourceId);
            }
          }
        }
      });
    }
  }

  // CRITICAL: Filter by id AND sourceId to ensure per-source isolation
  // Only delete filters that match both the id AND the sourceId (if sourceId is provided)
  const updatedFilters = (existingPayload.filters || []).filter(
    (filter: any) => !shouldRemoveFilterOnDelete(filter, id, sourceId)
  );

  const updatedFilterConditions = Array.isArray(existingPayload.filter_conditions)
    ? (existingPayload.filter_conditions || []).filter(
        (filterCondition: any) => !shouldRemoveFilterOnDelete(filterCondition, id, sourceId)
      )
    : [];

  console.log('🗑️ deleteFilterById: Updated filter_conditions:', updatedFilterConditions.map((f: any) => f.id));

  // Also update filter_conditions_by_source if it exists (for derive column filters)
  let updatedFilterConditionsBySource = existingPayload.filter_conditions_by_source || {};
  if (sourceId && typeof updatedFilterConditionsBySource === 'object') {
    const sourceFilterConditions = Array.isArray(updatedFilterConditionsBySource[sourceId]) 
      ? updatedFilterConditionsBySource[sourceId] 
      : [];
    
    const updatedSourceFilterConditions = sourceFilterConditions.filter(
      (filterCondition: any) => !shouldRemoveFilterOnDelete(filterCondition, id, sourceId)
    );
    
    if (updatedSourceFilterConditions.length > 0) {
      updatedFilterConditionsBySource = {
        ...updatedFilterConditionsBySource,
        [sourceId]: updatedSourceFilterConditions
      };
    } else {
      // Remove source key if no filters remain
      const { [sourceId]: _, ...rest } = updatedFilterConditionsBySource;
      updatedFilterConditionsBySource = rest;
    }
    
    console.log('🗑️ deleteFilterById: Updated filter_conditions_by_source for source:', sourceId);
  }

  const dataToStore = {
    ...currentNode.data,
    node: {
      ...currentNode.data.node,
      payload: {
        ...existingPayload,
        filters: updatedFilters,
        filter_conditions: updatedFilterConditions,
        ...(Object.keys(updatedFilterConditionsBySource).length > 0 && {
          filter_conditions_by_source: updatedFilterConditionsBySource,
        }),
      },
    },
  };

  try {
    useFlowStore.getState().updateNodeData(selectedNode?.id, dataToStore);
    toast.success("Filter deleted successfully. Click Save to persist the node.");

    if (updatedFilterConditions.length === 0 && sourceNodes && sourceNodes.length > 0 && setResult) {
      setResult({
        id: currentNode?.id,
        columns: sourceNodes[0]?.data?.node?.output?.columns || [],
        data: sourceNodes[0]?.data?.node?.output?.data || [],
        message: "All filters removed, showing source data",
        status: true,
      });
    }
  } catch (error) {
    console.error("Delete failed:", error);
    toast.error("Failed to delete filter");
  }
}