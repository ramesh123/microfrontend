import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import DatasetStepLoading from "@/components/common/datasets/DatasetStepLoading";
import type { AnalyticsStudioCreateChartState } from "../types";
import ChartWizardFooter from "./ChartWizardFooter";
import ChartWizardStepper from "./ChartWizardStepper";
import ChartTypeStep from "./steps/ChartTypeStep";
import DataBindingStep from "./steps/DataBindingStep";
import InteractionsStep from "./steps/InteractionsStep";
import SaveStep from "./steps/SaveStep";
import VisualiseStep from "./steps/VisualiseStep";
import { ensurePivotApplyParam, getBindingSummary, validateChartFormBinding } from "./chartFormUtils";
import { buildFormValuesFromSemanticMappings } from "./buildFormValuesFromSemanticMappings";
import { saveWizardChart } from "./saveWizardChart";
import { CHART_WIZARD_STEPS, type ChartVisibility, type ChartWizardStepKey } from "./types";
import { useAvailableCharts } from "./useAvailableCharts";
import { useChartWizardColumns } from "./useChartWizardColumns";
import { getDashboardChartForm, type ChartFormParameter } from "@/pages/Visualization/API/chartsApi";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import type { ChartCustomizationOptions } from "@/pages/charts/components/charts/pie";
import { isChartTypeExcludedFromDrilldown } from "@/pages/charts/utils/chartActionVisibility";

const STEP_HINTS: Record<ChartWizardStepKey, string> = {
  data_source: "Confirm your selected data source.",
  chart_type: "Select the chart type that best fits your data.",
  configure_source: "Select database, tables, or query for the connection.",
  data_binding: "Choose dimensions and metrics for your chart.",
  visualise: "Review your chart configuration and preview.",
  interactions: "Configure optional chart interactions.",
  save: "Name your chart, set visibility, and save it to Analytics Studio.",
};

export default function CreateChartWizard() {
  const navigate = useNavigate();
  const { nodeId = "" } = useParams<{ nodeId: string }>();
  const location = useLocation();
  const routeState = useMemo(
    () => (location.state ?? {}) as AnalyticsStudioCreateChartState,
    [location.state],
  );

  const [currentStep, setCurrentStep] = useState<ChartWizardStepKey>("chart_type");
  const [selectedChartTypeId, setSelectedChartTypeId] = useState<string | undefined>(
    () => routeState.selectedChartTypeId,
  );
  const [selectedSourceName, setSelectedSourceName] = useState<string>();
  const [chartFormData, setChartFormData] = useState<{
    parameters?: ChartFormParameter[];
    name?: string;
    unique_id?: string;
  } | null>(null);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [chartName, setChartName] = useState("");
  const [chartVisibility, setChartVisibility] = useState<ChartVisibility>("personal");
  const [enableDrilldown, setEnableDrilldown] = useState(false);
  const [drilldownColumns, setDrilldownColumns] = useState<string[]>([]);
  const [customizationOptions, setCustomizationOptions] = useState<ChartCustomizationOptions | null>(null);
  const [bindingSessionKey, setBindingSessionKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const previousChartTypeRef = useRef<string | undefined>(undefined);
  const previousStepRef = useRef<ChartWizardStepKey>("chart_type");
  const bindingSnapshotsRef = useRef<Record<string, Record<string, unknown>>>({});
  const semanticApplyKeyRef = useRef("");
  const [bindingRestoreKey, setBindingRestoreKey] = useState(0);

  const persistBindingSnapshot = useCallback(
    (values: Record<string, unknown>) => {
      if (selectedChartTypeId && Object.keys(values).length > 0) {
        bindingSnapshotsRef.current[selectedChartTypeId] = { ...values };
      }
      return values;
    },
    [selectedChartTypeId],
  );

  const handleFormValuesChange = useCallback(
    (values: Record<string, unknown>) => {
      setFormValues((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(values)) {
          return prev;
        }
        return values;
      });
      persistBindingSnapshot(values);
    },
    [persistBindingSnapshot],
  );

  const syncFormValuesFromConfigurator = useCallback(() => {
    const latestFormValues =
      typeof window !== "undefined"
        ? ((window as any).__chartFormValues as Record<string, unknown> | undefined) ?? formValues
        : formValues;
    if (Object.keys(latestFormValues).length > 0) {
      setFormValues((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(latestFormValues)) {
          return prev;
        }
        return latestFormValues;
      });
      persistBindingSnapshot(latestFormValues);
    }
    return latestFormValues;
  }, [formValues, persistBindingSnapshot]);

  useEffect(() => {
    previousStepRef.current = currentStep;
    if (currentStep === "data_binding") {
      setBindingRestoreKey((key) => key + 1);
    }
  }, [currentStep]);

  const bindingSeedValues = useMemo(() => {
    if (!selectedChartTypeId) return {};

    const snapshot = bindingSnapshotsRef.current[selectedChartTypeId];
    return snapshot ? { ...snapshot } : {};
  }, [selectedChartTypeId, bindingSessionKey, bindingRestoreKey]);

  const handleCustomizationChange = useCallback((options: ChartCustomizationOptions) => {
    setCustomizationOptions((prev) => {
      if (prev && JSON.stringify(prev) === JSON.stringify(options)) {
        return prev;
      }
      return options;
    });
  }, []);

  const { sources, isLoading, error, isValid, defaultSourceName, connectionLabel } =
    useChartWizardColumns(nodeId, routeState);
  const {
    sections: chartSections,
    allCharts,
    isLoading: chartsLoading,
    error: chartsError,
  } = useAvailableCharts();

  const selectedChart = useMemo(
    () => allCharts.find((chart) => chart.unique_id === selectedChartTypeId),
    [allCharts, selectedChartTypeId],
  );

  useEffect(() => {
    if (!isValid) {
      navigate(`/analytic-studio/${nodeId}`, { replace: true });
    }
  }, [isValid, navigate, nodeId]);

  useEffect(() => {
    if (defaultSourceName && !selectedSourceName) {
      setSelectedSourceName(defaultSourceName);
    }
  }, [defaultSourceName, selectedSourceName]);

  useEffect(() => {
    if (!chartName && selectedSourceName) {
      setChartName(selectedSourceName);
    }
  }, [chartName, selectedSourceName]);

  useEffect(() => {
    if (!selectedChartTypeId) {
      setChartFormData(null);
      setFormValues({});
      previousChartTypeRef.current = undefined;
      return;
    }

    const chartTypeChanged = previousChartTypeRef.current !== selectedChartTypeId;
    previousChartTypeRef.current = selectedChartTypeId;

    let cancelled = false;
    const loadChartForm = async () => {
      setIsLoadingForm(true);
      if (chartTypeChanged) {
        const snapshot = bindingSnapshotsRef.current[selectedChartTypeId];
        setFormValues(snapshot ? { ...snapshot } : {});
        setBindingSessionKey((key) => key + 1);
      }
      try {
        const response = await getDashboardChartForm(selectedChartTypeId);
        if (cancelled) return;
        if (!response.status || !response.data) {
          throw new Error(response.message || "Failed to load chart form");
        }
        setChartFormData(
          ensurePivotApplyParam(response.data, selectedChartTypeId) as {
            parameters?: ChartFormParameter[];
            name?: string;
            unique_id?: string;
          },
        );
      } catch (err) {
        if (!cancelled) {
          toast.error(getDisplayErrorMessage(err, "Failed to load chart form"));
          setChartFormData(null);
        }
      } finally {
        if (!cancelled) setIsLoadingForm(false);
      }
    };

    void loadChartForm();
    return () => {
      cancelled = true;
    };
  }, [selectedChartTypeId]);

  useEffect(() => {
    const semanticMappings = routeState.semanticMappings;
    if (!chartFormData || !semanticMappings?.columns?.length || !selectedChartTypeId) return;

    const applyKey = `${routeState.datasetId ?? ""}:${selectedChartTypeId}`;
    if (semanticApplyKeyRef.current === applyKey) return;

    const mappedValues = buildFormValuesFromSemanticMappings(semanticMappings, chartFormData);
    if (Object.keys(mappedValues).length === 0) return;

    semanticApplyKeyRef.current = applyKey;
    setFormValues(mappedValues);
    persistBindingSnapshot(mappedValues);
    setBindingSessionKey((key) => key + 1);
  }, [
    chartFormData,
    persistBindingSnapshot,
    routeState.datasetId,
    routeState.semanticMappings,
    selectedChartTypeId,
  ]);

  const bindingSummary = useMemo(() => getBindingSummary(formValues), [formValues]);

  const drilldownSupported = useMemo(() => {
    const chartKey = selectedChartTypeId || selectedChart?.name || "";
    return !!chartKey && !isChartTypeExcludedFromDrilldown(chartKey);
  }, [selectedChart?.name, selectedChartTypeId]);

  const usedColumnNames = useMemo(
    () => [...bindingSummary.dimensions, ...bindingSummary.metrics],
    [bindingSummary.dimensions, bindingSummary.metrics],
  );

  const currentStepIndex = useMemo(
    () => CHART_WIZARD_STEPS.findIndex((step) => step.key === currentStep),
    [currentStep],
  );

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case "chart_type":
        return !!selectedChartTypeId;
      case "data_binding":
        return validateChartFormBinding(formValues, chartFormData, selectedChartTypeId);
      case "interactions":
        return !enableDrilldown || drilldownColumns.length > 0 || !drilldownSupported;
      case "save":
        return chartName.trim().length > 0;
      default:
        return true;
    }
  }, [chartFormData, chartName, currentStep, drilldownColumns.length, drilldownSupported, enableDrilldown, formValues, selectedChartTypeId]);

  const handleStepperClick = useCallback(
    (stepKey: ChartWizardStepKey) => {
      if (isSaving) return;

      const targetIndex = CHART_WIZARD_STEPS.findIndex((step) => step.key === stepKey);
      if (targetIndex < 0 || targetIndex >= currentStepIndex) return;

      if (currentStep === "data_binding" || currentStep === "visualise") {
        syncFormValuesFromConfigurator();
      }

      setCurrentStep(stepKey);
    },
    [currentStep, currentStepIndex, isSaving, syncFormValuesFromConfigurator],
  );

  const handleBack = () => {
    if (isSaving) return;

    if (currentStep === "data_binding") {
      syncFormValuesFromConfigurator();
    }

    if (currentStep === "visualise") {
      syncFormValuesFromConfigurator();
    }

    if (currentStepIndex <= 1) {
      if (routeState.datasetId) {
        navigate("/analytic-studio", {
          state: { view: "sources", tab: "charts" },
        });
        return;
      }

      navigate(`/analytic-studio/${nodeId}`, {
        state: {
          ...routeState,
          displayName: routeState.displayName,
          icon: routeState.icon,
          name: routeState.nodeName ?? routeState.displayName,
          selectedChartTypeId,
        },
      });
      return;
    }

    setCurrentStep(CHART_WIZARD_STEPS[currentStepIndex - 1].key);
  };

  const handleNext = () => {
    if (!canProceed || isSaving) return;

    if (currentStep === "chart_type" && selectedChartTypeId) {
      const snapshot = bindingSnapshotsRef.current[selectedChartTypeId];
      if (snapshot && Object.keys(snapshot).length > 0) {
        setFormValues({ ...snapshot });
      }
    }

    if (currentStep === "data_binding") {
      syncFormValuesFromConfigurator();
    }

    if (currentStep === "save") {
      void handleSaveChart();
      return;
    }

    setCurrentStep(CHART_WIZARD_STEPS[currentStepIndex + 1].key);
  };

  const handleSaveChart = async () => {
    if (!selectedChartTypeId || !chartFormData || !selectedChart?.name) {
      toast.error("Chart configuration is incomplete.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await saveWizardChart({
        routeState,
        sources,
        selectedSourceName,
        selectedChartTypeId,
        selectedChartName: selectedChart.name,
        chartFormData,
        formValues,
        customizationOptions,
        chartName: chartName.trim(),
        chartVisibility,
        enableDrilldown: drilldownSupported && enableDrilldown,
        drilldownColumns,
      });

      if (!response.status) {
        throw new Error(response.message || "Failed to save chart");
      }

      toast.success(response.message || `Chart "${chartName.trim()}" saved successfully`);
      navigate("/analytic-studio", { state: { tab: "charts" } });
    } catch (err) {
      toast.error(getDisplayErrorMessage(err, "Failed to save chart"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isValid) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex h-[95vh] flex-col bg-background">
        <ChartWizardStepper currentStep="chart_type" />
        <div className="flex flex-1 items-center justify-center">
          <DatasetStepLoading message="Loading data fields..." size="lg" />
        </div>
      </div>
    );
  }

  if (error || sources.length === 0) {
    return (
      <div className="flex h-[95vh] flex-col bg-background">
        <ChartWizardStepper currentStep="chart_type" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Unable to load chart data"}</p>
          <Button size="sm" onClick={handleBack}>
            Back to source selection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[95vh] flex-col bg-background">
      <ChartWizardStepper currentStep={currentStep} onStepClick={handleStepperClick} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {currentStep === "chart_type" ? (
        <ChartTypeStep
          sections={chartSections}
          isLoading={chartsLoading}
          error={chartsError}
          selectedChartTypeId={selectedChartTypeId}
          onSelectChartType={setSelectedChartTypeId}
          filterCategory={routeState.chartCategory}
        />
      ) : null}

      {currentStep === "data_binding" ? (
        <DataBindingStep
          routeState={routeState}
          sources={sources}
          selectedSourceName={selectedSourceName}
          onSelectSource={setSelectedSourceName}
          selectedChartTypeId={selectedChartTypeId}
          selectedChartName={selectedChart?.name}
          chartFormData={chartFormData}
          isLoadingForm={isLoadingForm}
          formValues={formValues}
          bindingSeedValues={bindingSeedValues}
          bindingRestoreKey={bindingRestoreKey}
          bindingSessionKey={bindingSessionKey}
          onFormValuesChange={handleFormValuesChange}
        />
      ) : null}

      {currentStep === "visualise" ? (
        <VisualiseStep
          routeState={routeState}
          sources={sources}
          selectedSourceName={selectedSourceName}
          selectedChartTypeId={selectedChartTypeId}
          selectedChartName={selectedChart?.name}
          chartFormData={chartFormData}
          formValues={formValues}
          customizationOptions={customizationOptions}
          onCustomizationChange={handleCustomizationChange}
        />
      ) : null}

      {currentStep === "interactions" ? (
        <InteractionsStep
          sources={sources}
          selectedSourceName={selectedSourceName}
          usedColumnNames={usedColumnNames}
          drilldownSupported={drilldownSupported}
          enableDrilldown={enableDrilldown}
          drilldownColumns={drilldownColumns}
          onToggleDrilldown={(enabled) => {
            setEnableDrilldown(enabled);
            if (!enabled) setDrilldownColumns([]);
          }}
          onDrilldownColumnsChange={setDrilldownColumns}
        />
      ) : null}

      {currentStep === "save" ? (
        <SaveStep
          chartName={chartName}
          chartVisibility={chartVisibility}
          selectedChartName={selectedChart?.name}
          selectedSourceName={selectedSourceName}
          dimensions={bindingSummary.dimensions}
          metrics={bindingSummary.metrics}
          enableDrilldown={enableDrilldown}
          drilldownColumns={drilldownColumns}
          onChartNameChange={setChartName}
          onChartVisibilityChange={setChartVisibility}
        />
      ) : null}
      </div>

      <ChartWizardFooter
        hint={STEP_HINTS[currentStep]}
        onBack={handleBack}
        onNext={handleNext}
        nextDisabled={!canProceed}
        nextLoading={isSaving}
        nextLabel={currentStep === "save" ? "Save Chart" : "Next"}
      />
    </div>
  );
}
