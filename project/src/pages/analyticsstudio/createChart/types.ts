import type { AnalyticsStudioCreateChartState } from "../types";

export type ChartWizardStepKey =
  | "data_source"
  | "chart_type"
  | "configure_source"
  | "data_binding"
  | "visualise"
  | "interactions"
  | "save";

export interface ChartWizardStep {
  id: number;
  key: ChartWizardStepKey;
  label: string;
}

export interface ChartWizardSource {
  name: string;
  columns: string[];
}

export type ChartVisibility = "personal" | "team" | "public";

export interface ChartWizardState {
  routeState: AnalyticsStudioCreateChartState;
  nodeId: string;
  sources: ChartWizardSource[];
  selectedSourceName?: string;
  selectedChartTypeId?: string;
  dimensions: string[];
  metrics: string[];
  chartName: string;
  chartVisibility: ChartVisibility;
  enableDrilldown: boolean;
  drilldownColumns: string[];
}

export const CHART_WIZARD_STEPS: ChartWizardStep[] = [
  { id: 1, key: "data_source", label: "Data source" },
  { id: 2, key: "chart_type", label: "Chart type" },
  { id: 3, key: "data_binding", label: "Data binding" },
  { id: 4, key: "visualise", label: "Visualise" },
  { id: 5, key: "interactions", label: "Interactions" },
  { id: 6, key: "save", label: "Save" },
];

export const buildEditChartWizardSteps = buildEntryChartWizardSteps;

export const EDIT_CHART_WIZARD_STEPS: ChartWizardStep[] = buildEditChartWizardSteps(false);

export function buildEntryChartWizardSteps(requireConfigureSource: boolean): ChartWizardStep[] {
  const tail: Array<{ key: ChartWizardStepKey; label: string }> = [
    { key: "data_binding", label: "Data binding" },
    { key: "visualise", label: "Visualise" },
    { key: "interactions", label: "Interactions" },
    { key: "save", label: "Save" },
  ];

  const steps: ChartWizardStep[] = [
    { id: 1, key: "chart_type", label: "Chart type" },
    { id: 2, key: "data_source", label: "Data source" },
  ];

  let nextId = 3;
  if (requireConfigureSource) {
    steps.push({ id: nextId++, key: "configure_source", label: "Select tables" });
  }

  for (const step of tail) {
    steps.push({ id: nextId++, key: step.key, label: step.label });
  }

  return steps;
}
