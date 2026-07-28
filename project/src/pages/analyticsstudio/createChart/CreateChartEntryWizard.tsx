import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import DatasetStepLoading from "@/components/common/datasets/DatasetStepLoading";
import AnalyticsStudioSourceHub from "../AnalyticsStudioSourceHub";
import type { AnalyticsStudioSourceView } from "../AnalyticsStudioSourceSidebar";
import {
  buildWizardConnectionContinuePayload,
} from "../ConnectionSelectionPanel";
import type { AnalyticsStudioConnection } from "../ConnectionSelectionTable";
import AnalyticsStudioSourceSelection from "../SourceSelection";
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
import {
  buildEntryChartWizardSteps,
  type ChartVisibility,
  type ChartWizardStepKey,
} from "./types";
import { useAvailableCharts } from "./useAvailableCharts";
import { useChartWizardColumns } from "./useChartWizardColumns";
import { getDashboardChartForm, type ChartFormParameter } from "@/pages/Visualization/API/chartsApi";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import type { ChartCustomizationOptions } from "@/pages/charts/components/charts/pie";
import { isChartTypeExcludedFromDrilldown } from "@/pages/charts/utils/chartActionVisibility";

const EMPTY_ROUTE_STATE = {} as AnalyticsStudioCreateChartState;

const STEP_HINTS: Record<ChartWizardStepKey, string> = {
  chart_type: "Select the chart type that best fits your data.",
  data_source: "Choose a connection or analytical dataset.",
  configure_source: "Select database, tables, or query for the connection.",
  data_binding: "Choose dimensions and metrics for your chart.",
  visualise: "Review your chart configuration and preview.",
  interactions: "Configure optional chart interactions.",
  save: "Name your chart, set visibility, and save it to Analytics Studio.",
};

export default function CreateChartEntryWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const restoredChartTypeId = (location.state as { selectedChartTypeId?: string } | null)?.selectedChartTypeId;

  const [currentStep, setCurrentStep] = useState<ChartWizardStepKey>("chart_type");
  const [selectedChartTypeId, setSelectedChartTypeId] = useState<string | undefined>(restoredChartTypeId);
  const [wizardRouteState, setWizardRouteState] = useState<AnalyticsStudioCreateChartState | null>(null);
  const [nodeId, setNodeId] = useState("");
  const [requireConfigureSource, setRequireConfigureSource] = useState(false);
  const [configureSourceState, setConfigureSourceState] = useState<Record<string, unknown> | null>(null);

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
  const [bindingRestoreKey, setBindingRestoreKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSourceView, setActiveSourceView] = useState<AnalyticsStudioSourceView>("connections");
  const [selectedConnection, setSelectedConnection] = useState<AnalyticsStudioConnection | null>(null);

  const previousChartTypeRef = useRef<string | undefined>(undefined);
  const bindingSnapshotsRef = useRef<Record<string, Record<string, unknown>>>({});
  const semanticApplyKeyRef = useRef("");

  const wizardSteps = useMemo(
    () => buildEntryChartWizardSteps(requireConfigureSource),
    [requireConfigureSource],
  );

  const routeState = wizardRouteState ?? EMPTY_ROUTE_STATE;

  const {
    sections: chartSections,
    allCharts,
    isLoading: chartsLoading,
    error: chartsError,
  } = useAvailableCharts();

  const { sources, isLoading, error, isValid, defaultSourceName } =
    useChartWizardColumns(nodeId, routeState);

  const selectedChart = useMemo(
    () => allCharts.find((chart) => chart.unique_id === selectedChartTypeId),
    [allCharts, selectedChartTypeId],
  );

  const currentStepIndex = useMemo(
    () => wizardSteps.findIndex((step) => step.key === currentStep),
    [currentStep, wizardSteps],
  );

  useEffect(() => {
    if (restoredChartTypeId) setSelectedChartTypeId(restoredChartTypeId);
  }, [restoredChartTypeId]);

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
        if (JSON.stringify(prev) === JSON.stringify(values)) return prev;
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
        if (JSON.stringify(prev) === JSON.stringify(latestFormValues)) return prev;
        return latestFormValues;
      });
      persistBindingSnapshot(latestFormValues);
    }
    return latestFormValues;
  }, [formValues, persistBindingSnapshot]);

  useEffect(() => {
    if (currentStep === "data_binding") setBindingRestoreKey((key) => key + 1);
  }, [currentStep]);

  const bindingSeedValues = useMemo(() => {
    if (!selectedChartTypeId) return {};
    const snapshot = bindingSnapshotsRef.current[selectedChartTypeId];
    return snapshot ? { ...snapshot } : {};
  }, [selectedChartTypeId, bindingSessionKey, bindingRestoreKey]);

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

  useEffect(() => {
    if (!defaultSourceName || selectedSourceName) return;
    setSelectedSourceName(defaultSourceName);
  }, [defaultSourceName, selectedSourceName]);

  useEffect(() => {
    if (!chartName && selectedSourceName) setChartName(selectedSourceName);
  }, [chartName, selectedSourceName]);

  const bindingSummary = useMemo(() => getBindingSummary(formValues), [formValues]);

  const drilldownSupported = useMemo(() => {
    const chartKey = selectedChartTypeId || selectedChart?.name || "";
    return !!chartKey && !isChartTypeExcludedFromDrilldown(chartKey);
  }, [selectedChart?.name, selectedChartTypeId]);

  const usedColumnNames = useMemo(
    () => [...bindingSummary.dimensions, ...bindingSummary.metrics],
    [bindingSummary.dimensions, bindingSummary.metrics],
  );

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case "chart_type":
        return !!selectedChartTypeId;
      case "data_source":
        if (wizardRouteState && isValid) return true;
        if (activeSourceView === "connections") return !!selectedConnection;
        return false;
      case "data_binding":
        return validateChartFormBinding(formValues, chartFormData, selectedChartTypeId);
      case "interactions":
        return !enableDrilldown || drilldownColumns.length > 0 || !drilldownSupported;
      case "save":
        return chartName.trim().length > 0;
      default:
        return true;
    }
  }, [
    chartFormData,
    chartName,
    currentStep,
    drilldownColumns.length,
    drilldownSupported,
    enableDrilldown,
    formValues,
    activeSourceView,
    isValid,
    selectedChartTypeId,
    selectedConnection,
    wizardRouteState,
  ]);

  const handleStepperClick = useCallback(
    (stepKey: ChartWizardStepKey) => {
      if (isSaving) return;
      const targetIndex = wizardSteps.findIndex((step) => step.key === stepKey);
      if (targetIndex < 0 || targetIndex >= currentStepIndex) return;
      if (currentStep === "data_binding" || currentStep === "visualise") {
        syncFormValuesFromConfigurator();
      }
      setCurrentStep(stepKey);
    },
    [currentStep, currentStepIndex, isSaving, syncFormValuesFromConfigurator, wizardSteps],
  );

  const handleWizardConnectionContinue = useCallback(
    (payload: { nodeId: string; initialState: Record<string, unknown> }) => {
      setNodeId(payload.nodeId);
      setRequireConfigureSource(true);
      setConfigureSourceState(payload.initialState);
      setCurrentStep("configure_source");
    },
    [],
  );

  const handleWizardDatasetContinue = useCallback(
    (payload: { nodeId: string; chartState: AnalyticsStudioCreateChartState }) => {
      setNodeId(payload.nodeId);
      setWizardRouteState(payload.chartState);
      setRequireConfigureSource(false);
      setConfigureSourceState(null);
      if (payload.chartState.displayName) setChartName(payload.chartState.displayName);
      setCurrentStep("data_binding");
    },
    [],
  );

  const handleConfigureSourceComplete = useCallback(
    (state: AnalyticsStudioCreateChartState) => {
      setWizardRouteState({ ...state, selectedChartTypeId });
      if (state.displayName) setChartName(state.displayName);
      setCurrentStep("data_binding");
    },
    [selectedChartTypeId],
  );

  const handleBack = () => {
    if (isSaving) return;
    if (currentStep === "data_binding" || currentStep === "visualise") {
      syncFormValuesFromConfigurator();
    }

    if (currentStepIndex <= 0) {
      navigate("/analytic-studio", { state: { tab: "charts" } });
      return;
    }

    const previousStep = wizardSteps[currentStepIndex - 1]?.key;
    if (currentStep === "data_binding" && !requireConfigureSource) {
      setWizardRouteState(null);
      setNodeId("");
    }
    if (currentStep === "configure_source") {
      setRequireConfigureSource(false);
      setConfigureSourceState(null);
    }
    if (previousStep) setCurrentStep(previousStep);
  };

  const handleNext = () => {
    if (!canProceed || isSaving) return;

    if (currentStep === "chart_type") {
      const snapshot = bindingSnapshotsRef.current[selectedChartTypeId!];
      if (snapshot && Object.keys(snapshot).length > 0) setFormValues({ ...snapshot });
      setCurrentStep("data_source");
      return;
    }

    if (currentStep === "data_source") {
      if (wizardRouteState && isValid) {
        setCurrentStep("data_binding");
        return;
      }
      if (selectedConnection) {
        handleWizardConnectionContinue(
          buildWizardConnectionContinuePayload(selectedConnection, selectedChartTypeId),
        );
        return;
      }
      toast.error("Please select a connection or analytical dataset to continue");
      return;
    }

    if (currentStep === "data_binding") syncFormValuesFromConfigurator();
    if (currentStep === "save") {
      void handleSaveChart();
      return;
    }

    setCurrentStep(wizardSteps[currentStepIndex + 1].key);
  };

  const handleSaveChart = async () => {
    if (!selectedChartTypeId || !chartFormData || !selectedChart?.name || !wizardRouteState) {
      toast.error("Chart configuration is incomplete.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await saveWizardChart({
        routeState: wizardRouteState,
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

      if (!response.status) throw new Error(response.message || "Failed to save chart");

      toast.success(response.message || `Chart "${chartName.trim()}" saved successfully`);
      navigate("/analytic-studio", { state: { tab: "charts" } });
    } catch (err) {
      toast.error(getDisplayErrorMessage(err, "Failed to save chart"));
    } finally {
      setIsSaving(false);
    }
  };

  const showColumnsLoading =
    !!wizardRouteState &&
    isLoading &&
    ["data_binding", "visualise", "interactions", "save"].includes(currentStep);

  const showColumnsError =
    !!wizardRouteState &&
    !isLoading &&
    (error || sources.length === 0) &&
    ["data_binding", "visualise", "interactions", "save"].includes(currentStep);

  const showFooter = currentStep !== "configure_source" && currentStep !== "data_source";

  return (
    <div className="flex h-[95vh] flex-col bg-background">
      <ChartWizardStepper
        currentStep={currentStep}
        steps={wizardSteps}
        onStepClick={handleStepperClick}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {currentStep === "chart_type" ? (
          <ChartTypeStep
            sections={chartSections}
            isLoading={chartsLoading}
            error={chartsError}
            selectedChartTypeId={selectedChartTypeId}
            onSelectChartType={setSelectedChartTypeId}
          />
        ) : null}

        {currentStep === "data_source" ? (
          <AnalyticsStudioSourceHub
            wizardMode
            selectedChartTypeId={selectedChartTypeId}
            onBackToLists={handleBack}
            onWizardConnectionContinue={handleWizardConnectionContinue}
            onWizardDatasetContinue={handleWizardDatasetContinue}
            onWizardConnectionSelectionChange={setSelectedConnection}
            onActiveViewChange={setActiveSourceView}
          />
        ) : null}

        {currentStep === "configure_source" && nodeId && configureSourceState ? (
          <AnalyticsStudioSourceSelection
            embeddedNodeId={nodeId}
            embeddedInitialState={configureSourceState}
            onEmbeddedBack={() => {
              setRequireConfigureSource(false);
              setConfigureSourceState(null);
              setCurrentStep("data_source");
            }}
            onEmbeddedContinue={handleConfigureSourceComplete}
          />
        ) : null}

        {showColumnsLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <DatasetStepLoading message="Loading data fields..." size="lg" />
          </div>
        ) : null}

        {showColumnsError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">{error ?? "Unable to load chart data"}</p>
            <Button size="sm" onClick={handleBack}>
              Back
            </Button>
          </div>
        ) : null}

        {!showColumnsLoading && !showColumnsError && currentStep === "data_binding" && isValid ? (
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

        {!showColumnsLoading && !showColumnsError && currentStep === "visualise" && isValid ? (
          <VisualiseStep
            routeState={routeState}
            sources={sources}
            selectedSourceName={selectedSourceName}
            selectedChartTypeId={selectedChartTypeId}
            selectedChartName={selectedChart?.name}
            chartFormData={chartFormData}
            formValues={formValues}
            customizationOptions={customizationOptions}
            onCustomizationChange={setCustomizationOptions}
          />
        ) : null}

        {!showColumnsLoading && !showColumnsError && currentStep === "interactions" && isValid ? (
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

        {!showColumnsLoading && !showColumnsError && currentStep === "save" && isValid ? (
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

      {showFooter ? (
        <ChartWizardFooter
          hint={STEP_HINTS[currentStep]}
          onBack={handleBack}
          onNext={handleNext}
          nextDisabled={!canProceed}
          nextLoading={isSaving}
          nextLabel={currentStep === "save" ? "Save Chart" : "Next"}
        />
      ) : currentStep === "data_source" ? (
        <ChartWizardFooter
          hint={STEP_HINTS.data_source}
          onBack={handleBack}
          onNext={handleNext}
          nextDisabled={!canProceed}
        />
      ) : null}
    </div>
  );
}
