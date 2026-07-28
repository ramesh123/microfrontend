import type { Dispatch, SetStateAction } from "react";
import {
  ChartConfigurator,
  type ChartType,
  type Config,
  type Field,
} from "@/pages/charts/components/ChartConfigurator";
import type { ChartFormParameter } from "@/pages/Visualization/API/chartsApi";
import { WizardDynamicChartForm } from "./WizardDynamicChartForm";

export interface WizardChartConfiguratorProps {
  chart: ChartType;
  threadName: string;
  fields: Field[];
  fieldsByParamKey?: Record<string, Field[]>;
  config: Config;
  setConfig: Dispatch<SetStateAction<Config | null>>;
  onClear: () => void;
  onSave: () => void;
  chartFormData?: { parameters?: ChartFormParameter[]; name?: string; unique_id?: string };
  isLoadingForm?: boolean;
  initialFormValues?: Record<string, unknown>;
  flowId: string;
  selectedSource?: string | null;
  sources?: Array<{ name: string; columns: string[] }>;
  onFormValuesChange?: (values: Record<string, unknown>) => void;
  isViewOnly?: boolean;
}

export default function WizardChartConfigurator({
  onClear,
  onSave,
  ...props
}: WizardChartConfiguratorProps) {
  return (
    <ChartConfigurator
      {...props}
      onClear={onClear}
      onSave={onSave}
      hideFooter
      hideCustomizeTab
      layoutVariant="wizard"
      chartFormComponent={WizardDynamicChartForm}
      onFormValuesChange={props.onFormValuesChange as (values: Record<string, any>) => void}
    />
  );
}
