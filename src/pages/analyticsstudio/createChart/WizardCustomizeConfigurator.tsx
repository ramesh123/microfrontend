import type { Dispatch, SetStateAction } from "react";
import {
  ChartConfigurator,
  type ChartType,
  type Config,
  type Field,
} from "@/pages/charts/components/ChartConfigurator";
import type { ChartCustomizationOptions } from "@/pages/charts/components/charts/pie";
import type { AnalyticsStudioChartInit } from "@/pages/charts/ChartFormulator/types";
import type { ChartFormParameter } from "@/pages/Visualization/API/chartsApi";

export interface WizardCustomizeConfiguratorProps {
  chart: ChartType;
  threadName: string;
  fields: Field[];
  config: Config;
  setConfig: Dispatch<SetStateAction<Config | null>>;
  onClear: () => void;
  onSave: () => void;
  chartFormData?: { parameters?: ChartFormParameter[]; name?: string; unique_id?: string };
  initialFormValues?: Record<string, unknown>;
  flowId: string;
  analyticsStudioInit?: AnalyticsStudioChartInit;
  selectedSource?: string | null;
  sources?: Array<{ name: string; columns: string[] }>;
  customizationOptions?: ChartCustomizationOptions;
  onCustomizationChange?: (options: ChartCustomizationOptions) => void;
  isViewOnly?: boolean;
}

export default function WizardCustomizeConfigurator({
  onClear,
  onSave,
  ...props
}: WizardCustomizeConfiguratorProps) {
  return (
    <ChartConfigurator
      {...props}
      onClear={onClear}
      onSave={onSave}
      hideFooter
      hideDataTab
      defaultTab="customize"
      layoutVariant="wizard"
      hidePanelHeader
      hideCustomizeSectionLabel
    />
  );
}
