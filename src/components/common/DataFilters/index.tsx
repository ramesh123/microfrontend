import { useRef, forwardRef, useImperativeHandle } from "react";
import DeriveColumn from "@/components/common/deriveColumn";
import { DATA_FILTER_OPERATIONS } from "@/types/deriveColumn";

export interface DataFiltersRef {
  getCurrentConfig: () => any;
}

const DataFilters = forwardRef<DataFiltersRef, { onClickSave: (json: Object) => void, previewData: any }>(
  ({ onClickSave, previewData }, ref) => {
    const currentConfigRef = useRef<any>(null);

    // Store the current config and call onClickSave to notify parent
    const handleConfigChange = (json: Object) => {
      console.log("🔍 DataFilters handleConfigChange called with:", json);
      currentConfigRef.current = json;
      // Call onClickSave to notify parent component of changes
      onClickSave(json);
    };

    // Expose method to get current config
    useImperativeHandle(ref, () => ({
      getCurrentConfig: () => currentConfigRef.current,
    }));

    return (
      <DeriveColumn
        onClickSave={handleConfigChange}
        previewDeriveData={previewData}
        operationsSet={DATA_FILTER_OPERATIONS}
        configurationName="Data Filter Configuration"
        hideOutputTarget={true}
        hideAddCustomColumn={true}
      />
    );
  }
);

export default DataFilters;