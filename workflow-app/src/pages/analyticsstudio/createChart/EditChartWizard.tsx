import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import DatasetStepLoading from "@/components/common/datasets/DatasetStepLoading";
import AnalyticsStudioSourceHub, { resolveInitialSourceView } from "../AnalyticsStudioSourceHub";
import AnalyticsStudioSourceSelection from "../SourceSelection";
import { resolveAnalyticsStudioNodeIdFromConnectionType } from "../connectionType";
import type { AnalyticsStudioCreateChartState, AnalyticsStudioSourcePageState } from "../types";
import { buildConfigureSourceStateFromRouteState, usesConnectionConfigureStep } from "../types";
import ChartWizardFooter from "./ChartWizardFooter";
import ChartWizardStepper from "./ChartWizardStepper";
import ChartTypeStep from "./steps/ChartTypeStep";
import DataBindingStep from "./steps/DataBindingStep";
import InteractionsStep from "./steps/InteractionsStep";
import SaveStep from "./steps/SaveStep";
import VisualiseStep from "./steps/VisualiseStep";
import { ensurePivotApplyParam, getBindingSummary, validateChartFormBinding } from "./chartFormUtils";
import {
  loadEditChartWizardState,
  type EditChartWizardLoadedState,
} from "./loadEditChartWizardState";
import { updateWizardChart } from "./updateWizardChart";
import {
  buildEditChartWizardSteps,
  type ChartVisibility,
  type ChartWizardStepKey,
} from "./types";
import { useAvailableCharts } from "./useAvailableCharts";
import {
  getRouteStateFetchKey,
  useChartWizardColumns,
} from "./useChartWizardColumns";
import { getDashboardChartForm, type ChartFormParameter } from "@/pages/Visualization/API/chartsApi";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import type { ChartCustomizationOptions } from "@/pages/charts/components/charts/pie";
import { isChartTypeExcludedFromDrilldown } from "@/pages/charts/utils/chartActionVisibility";

const EMPTY_ROUTE_STATE = {} as AnalyticsStudioCreateChartState;

function resolveEditWizardNodeId(routeState: AnalyticsStudioCreateChartState): string {
  if (routeState.sourceType === "virtual_db") {
    return routeState.connectionType?.trim() || "virtual_db";
  }
  const connectionType = routeState.connectionType?.trim() || "database";
  return resolveAnalyticsStudioNodeIdFromConnectionType(connectionType);
}

const EDIT_STEP_HINTS: Record<ChartWizardStepKey, string> = {
  data_source: "Review or change the connection or analytical dataset.",
  chart_type: "Review or change the chart type.",
  configure_source: "Select database, tables, or query for the connection.",
  data_binding: "Update dimensions and metrics for your chart.",
  visualise: "Review your chart configuration and preview.",
  interactions: "Configure optional chart interactions.",
  save: "Update chart name, visibility, and save changes.",
};

const VIEW_STEP_HINTS: Record<ChartWizardStepKey, string> = {
  data_source: "Data source used for this chart.",
  chart_type: "Chart type used for this visualization.",
  configure_source: "Database, tables, or query for this chart.",
  data_binding: "Dimensions and metrics bound to this chart.",
  visualise: "Chart preview and customization settings.",
  interactions: "Configured chart interactions.",
  save: "Chart name and visibility settings.",
};

interface EditChartWizardProps {
  chartId: string;
  isViewOnly?: boolean;
}

export default function EditChartWizard({ chartId, isViewOnly = false }: EditChartWizardProps) {
  const navigate = useNavigate();
  const [loadedState, setLoadedState] = useState<EditChartWizardLoadedState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<ChartWizardStepKey>("chart_type");
  const [selectedChartTypeId, setSelectedChartTypeId] = useState<string>();
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
  const [customizationOptions, setCustomizationOptions] = useState<ChartCustomizationOptions | null>(
    null,
  );
  const [bindingSessionKey, setBindingSessionKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [wizardRouteState, setWizardRouteState] = useState<AnalyticsStudioCreateChartState | null>(null);
  const [nodeId, setNodeId] = useState("");
  const [configureSourceState, setConfigureSourceState] = useState<AnalyticsStudioSourcePageState | null>(null);
  const previousChartTypeRef = useRef<string | undefined>(undefined);
  const bindingSnapshotsRef = useRef<Record<string, Record<string, unknown>>>({});
  const [bindingRestoreKey, setBindingRestoreKey] = useState(0);
  const initialRouteStateKeyRef = useRef<string | null>(null);

  const routeState = wizardRouteState ?? loadedState?.routeState ?? EMPTY_ROUTE_STATE;
  const usesConfigureStep = usesConnectionConfigureStep(routeState);
  const routeStateKey = useMemo(() => getRouteStateFetchKey(routeState), [routeState]);

  const wizardSteps = useMemo(
    () => buildEditChartWizardSteps(usesConfigureStep),
    [usesConfigureStep],
  );

  const configureSourceEmbeddedState = useMemo(() => {
    if (!usesConfigureStep) return null;
    return (
      configureSourceState ??
      buildConfigureSourceStateFromRouteState(routeState, selectedChartTypeId)
    );
  }, [configureSourceState, routeState, selectedChartTypeId, usesConfigureStep]);

  const sourceUnchanged =
    !!initialRouteStateKeyRef.current && routeStateKey === initialRouteStateKeyRef.current;

  const {
    sources: fetchedSources,
    isLoading: columnsLoading,
    error: columnsError,
    isValid,
    defaultSourceName,
  } = useChartWizardColumns(nodeId, routeState);

  const sources =
    sourceUnchanged && loadedState ? loadedState.sources : fetchedSources;

  const {
    sections: chartSections,
    allCharts,
    isLoading: chartsLoading,
    error: chartsError,
  } = useAvailableCharts();

  useEffect(() => {
    let cancelled = false;

    const loadChart = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const state = await loadEditChartWizardState(chartId);
        if (cancelled) return;

        setLoadedState(state);
        setWizardRouteState(state.routeState);
        setNodeId(resolveEditWizardNodeId(state.routeState));
        initialRouteStateKeyRef.current = getRouteStateFetchKey(state.routeState);
        if (usesConnectionConfigureStep(state.routeState)) {
          setConfigureSourceState(
            buildConfigureSourceStateFromRouteState(state.routeState, state.selectedChartTypeId),
          );
        }
        setSelectedChartTypeId(state.selectedChartTypeId);
        setSelectedSourceName(state.selectedSourceName);
        setChartFormData(state.chartFormData);
        setFormValues(state.formValues);
        setChartName(state.chartName);
        setChartVisibility(state.chartVisibility);
        setEnableDrilldown(state.enableDrilldown);
        setDrilldownColumns(state.drilldownColumns);
        setCustomizationOptions(state.customizationOptions);
        bindingSnapshotsRef.current[state.selectedChartTypeId] = { ...state.formValues };
        previousChartTypeRef.current = state.selectedChartTypeId;
        setBindingRestoreKey((key) => key + 1);
      } catch (err) {
        if (!cancelled) {
          const message = getDisplayErrorMessage(err, "Failed to load chart");
          setLoadError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadChart();
    return () => {
      cancelled = true;
    };
  }, [chartId]);

  useEffect(() => {
    if (!usesConfigureStep && currentStep === "configure_source") {
      setCurrentStep("data_binding");
    }
  }, [currentStep, usesConfigureStep]);

  useEffect(() => {
    if (!usesConfigureStep) {
      setConfigureSourceState(null);
      return;
    }
    if (currentStep === "configure_source") return;
    setConfigureSourceState(
      buildConfigureSourceStateFromRouteState(routeState, selectedChartTypeId),
    );
  }, [currentStep, routeStateKey, selectedChartTypeId, usesConfigureStep]);

  const persistBindingSnapshot = useCallback(
    (values: Record<string, unknown>) => {
      if (selectedChartTypeId && Object.keys(values).length > 0) {
        bindingSnapshotsRef.current[selectedChartTypeId] = { ...values };
      }
      return values;
    },
    [selectedChartTypeId],
  );

  const restoreBindingSeedForConfigurator = useCallback(() => {
    if (!selectedChartTypeId) return;
    const snapshot =
      bindingSnapshotsRef.current[selectedChartTypeId] ??
      (loadedState?.selectedChartTypeId === selectedChartTypeId
        ? loadedState.formValues
        : undefined);
    if (snapshot && Object.keys(snapshot).length > 0) {
      bindingSnapshotsRef.current[selectedChartTypeId] = { ...snapshot };
      setFormValues({ ...snapshot });
    }
    setBindingRestoreKey((key) => key + 1);
  }, [loadedState, selectedChartTypeId]);

  const handleFormValuesChange = useCallback(
    (values: Record<string, unknown>) => {
      if (isViewOnly) return;
      setFormValues((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(values)) {
          return prev;
        }
        return values;
      });
      persistBindingSnapshot(values);
    },
    [isViewOnly, persistBindingSnapshot],
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
    if (currentStep === "data_binding") {
      restoreBindingSeedForConfigurator();
    }
  }, [currentStep, restoreBindingSeedForConfigurator]);

  const bindingSeedValues = useMemo(() => {
    if (!selectedChartTypeId) return {};
    const snapshot = bindingSnapshotsRef.current[selectedChartTypeId];
    return snapshot ? { ...snapshot } : {};
  }, [selectedChartTypeId, bindingSessionKey, bindingRestoreKey]);

  const handleCustomizationChange = useCallback(
    (options: ChartCustomizationOptions) => {
      if (isViewOnly) return;
      setCustomizationOptions((prev) => {
        if (prev && JSON.stringify(prev) === JSON.stringify(options)) {
          return prev;
        }
        return options;
      });
    },
    [isViewOnly],
  );

  useEffect(() => {
    if (!selectedChartTypeId || isViewOnly) return;
    if (loadedState && selectedChartTypeId === loadedState.selectedChartTypeId) {
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
  }, [isViewOnly, loadedState, selectedChartTypeId]);

  const selectedChart = useMemo(
    () => allCharts.find((chart) => chart.unique_id === selectedChartTypeId),
    [allCharts, selectedChartTypeId],
  );

  const selectedChartName = selectedChart?.name ?? loadedState?.selectedChartName;

  const resetBindingsForSourceChange = useCallback(() => {
    setFormValues({});
    setSelectedSourceName(undefined);
    setEnableDrilldown(false);
    setDrilldownColumns([]);
    bindingSnapshotsRef.current = {};
    setBindingSessionKey((key) => key + 1);
  }, []);

  const handleWizardConnectionContinue = useCallback(
    (payload: { nodeId: string; initialState: Record<string, unknown> }) => {
      if (isViewOnly) return;
      setNodeId(payload.nodeId);
      setConfigureSourceState(payload.initialState as AnalyticsStudioSourcePageState);
      setCurrentStep("configure_source");
    },
    [isViewOnly],
  );

  const handleWizardConnectionContinueExisting = useCallback(() => {
    if (isViewOnly) return;
    setConfigureSourceState(
      buildConfigureSourceStateFromRouteState(routeState, selectedChartTypeId),
    );
    setCurrentStep("configure_source");
  }, [isViewOnly, routeState, selectedChartTypeId]);

  const handleWizardDatasetContinue = useCallback(
    (payload: { nodeId: string; chartState: AnalyticsStudioCreateChartState }) => {
      if (isViewOnly) return;
      setNodeId(payload.nodeId);
      setWizardRouteState(payload.chartState);
      setConfigureSourceState(null);
      resetBindingsForSourceChange();
      if (payload.chartState.displayName) setChartName(payload.chartState.displayName);
      setCurrentStep("data_binding");
    },
    [isViewOnly, resetBindingsForSourceChange],
  );

  const handleWizardDatasetContinueExisting = useCallback(() => {
    if (isViewOnly) return;
    setCurrentStep("data_binding");
  }, [isViewOnly]);

  const handleConfigureSourceComplete = useCallback(
    (state: AnalyticsStudioCreateChartState) => {
      if (isViewOnly) return;
      const previousKey = getRouteStateFetchKey(
        wizardRouteState ?? loadedState?.routeState ?? EMPTY_ROUTE_STATE,
      );
      const nextState = { ...state, selectedChartTypeId };
      setWizardRouteState(nextState);
      setConfigureSourceState(buildConfigureSourceStateFromRouteState(nextState, selectedChartTypeId));
      if (getRouteStateFetchKey(nextState) !== previousKey) {
        resetBindingsForSourceChange();
      }
      if (state.displayName) setChartName(state.displayName);
      setCurrentStep("data_binding");
    },
    [isViewOnly, loadedState?.routeState, resetBindingsForSourceChange, selectedChartTypeId, wizardRouteState],
  );

  useEffect(() => {
    if (!defaultSourceName || selectedSourceName) return;
    setSelectedSourceName(defaultSourceName);
  }, [defaultSourceName, selectedSourceName]);

  const bindingSummary = useMemo(() => {
    const summaryValues =
      Object.keys(formValues).length > 0 ? formValues : bindingSeedValues;
    return getBindingSummary(summaryValues);
  }, [bindingSeedValues, formValues]);

  const drilldownSupported = useMemo(() => {
    const chartKey = selectedChartTypeId || selectedChartName || "";
    return !!chartKey && !isChartTypeExcludedFromDrilldown(chartKey);
  }, [selectedChartName, selectedChartTypeId]);

  const usedColumnNames = useMemo(
    () => [...bindingSummary.dimensions, ...bindingSummary.metrics],
    [bindingSummary.dimensions, bindingSummary.metrics],
  );

  const currentStepIndex = useMemo(
    () => wizardSteps.findIndex((step) => step.key === currentStep),
    [currentStep, wizardSteps],
  );

  const canProceed = useMemo(() => {
    if (isViewOnly) return true;
    switch (currentStep) {
      case "chart_type":
        return !!selectedChartTypeId;
      case "data_source":
        if (usesConfigureStep) {
          return isViewOnly || !!routeState.connectionId || isValid;
        }
        return isViewOnly || isValid;
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
    isViewOnly,
    isValid,
    selectedChartTypeId,
    usesConfigureStep,
    routeState.connectionId,
  ]);

  const handleBackToStudio = () => {
    navigate("/analytic-studio", { state: { tab: "charts" } });
  };

  const handleStepperClick = useCallback(
    (stepKey: ChartWizardStepKey) => {
      if (isSaving) return;

      const targetIndex = wizardSteps.findIndex((step) => step.key === stepKey);
      if (targetIndex < 0 || targetIndex === currentStepIndex) return;

      if (currentStep === "data_binding" || currentStep === "visualise") {
        syncFormValuesFromConfigurator();
      }

      setCurrentStep(stepKey);
    },
    [currentStep, currentStepIndex, isSaving, syncFormValuesFromConfigurator, wizardSteps],
  );

  const wizardBackButton = (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0"
      onClick={handleBackToStudio}
      aria-label="Back to Analytics Studio"
    >
      <ArrowLeft className="size-4" />
    </Button>
  );

  const wizardStepperTrailing = isViewOnly ? (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      View only
    </span>
  ) : (
    <span className="size-7 shrink-0" aria-hidden />
  );

  const editWizardStepper = (step: ChartWizardStepKey) => (
    <ChartWizardStepper
      currentStep={step}
      steps={wizardSteps}
      onStepClick={handleStepperClick}
      allowAllStepNavigation={isViewOnly}
      leadingAction={wizardBackButton}
      trailingAction={wizardStepperTrailing}
    />
  );

  const handleBack = () => {
    if (isSaving) return;

    if (currentStep === "data_binding" || currentStep === "visualise") {
      syncFormValuesFromConfigurator();
    }

    if (currentStepIndex <= 0) {
      handleBackToStudio();
      return;
    }

    const previousStep = wizardSteps[currentStepIndex - 1]?.key;
    if (previousStep) setCurrentStep(previousStep);
  };

  const handleNext = () => {
    if (!canProceed || isSaving) return;

    if (isViewOnly && currentStep === "save") {
      handleBackToStudio();
      return;
    }

    if (currentStep === "chart_type" && selectedChartTypeId) {
      const snapshot = bindingSnapshotsRef.current[selectedChartTypeId];
      if (snapshot && Object.keys(snapshot).length > 0) {
        setFormValues({ ...snapshot });
      }
    }

    if (currentStep === "data_source") {
      if (usesConfigureStep) {
        setConfigureSourceState(
          buildConfigureSourceStateFromRouteState(routeState, selectedChartTypeId),
        );
        setCurrentStep("configure_source");
        return;
      }
      if (isViewOnly || isValid) {
        setCurrentStep("data_binding");
      }
      return;
    }

    if (currentStep === "data_binding") {
      syncFormValuesFromConfigurator();
    }

    if (currentStep === "save") {
      void handleUpdateChart();
      return;
    }

    setCurrentStep(wizardSteps[currentStepIndex + 1].key);
  };

  const handleUpdateChart = async () => {
    const activeRouteState = wizardRouteState ?? loadedState?.routeState;
    if (!loadedState || !activeRouteState || !selectedChartTypeId || !chartFormData || !selectedChartName) {
      toast.error("Chart configuration is incomplete.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await updateWizardChart({
        chartId: loadedState.chartId,
        chartRecord: loadedState.chartRecord,
        routeState: activeRouteState,
        sources,
        selectedSourceName,
        selectedChartTypeId,
        selectedChartName,
        chartFormData,
        formValues,
        customizationOptions,
        chartName: chartName.trim(),
        chartVisibility,
        enableDrilldown: drilldownSupported && enableDrilldown,
        drilldownColumns,
        analyticsStudioInit: sourceUnchanged ? loadedState.chartInit : undefined,
      });

      if (!response.status) {
        throw new Error(response.message || "Failed to update chart");
      }

      toast.success(response.message || `Chart "${chartName.trim()}" updated successfully`);
      navigate("/analytic-studio", { state: { tab: "charts" } });
    } catch (err) {
      toast.error(getDisplayErrorMessage(err, "Failed to update chart"));
    } finally {
      setIsSaving(false);
    }
  };

  const stepHints = isViewOnly ? VIEW_STEP_HINTS : EDIT_STEP_HINTS;

  const showColumnsLoading =
    !sourceUnchanged &&
    columnsLoading &&
    ["data_binding", "visualise", "interactions", "save"].includes(currentStep);

  const showColumnsError =
    !sourceUnchanged &&
    !columnsLoading &&
    (columnsError || !isValid || sources.length === 0) &&
    ["data_binding", "visualise", "interactions", "save"].includes(currentStep);

  const canShowDataSteps = sourceUnchanged || (isValid && !columnsLoading && sources.length > 0);

  const showFooter =
    (currentStep !== "configure_source" && currentStep !== "data_source") ||
    (isViewOnly && currentStep === "configure_source");

  if (isLoading) {
    return (
      <div className="flex h-[95vh] flex-col bg-background">
        {editWizardStepper("chart_type")}
        <div className="flex flex-1 items-center justify-center gap-2">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading chart...</span>
        </div>
      </div>
    );
  }

  if (loadError || !loadedState) {
    return (
      <div className="flex h-[95vh] flex-col bg-background">
        {editWizardStepper("chart_type")}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm text-muted-foreground">{loadError ?? "Unable to load chart data"}</p>
          <Button size="sm" onClick={handleBackToStudio}>
            Back to Analytics Studio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[95vh] flex-col bg-background">
      {editWizardStepper(currentStep)}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {currentStep === "chart_type" ? (
          <ChartTypeStep
            sections={chartSections}
            isLoading={chartsLoading}
            error={chartsError}
            selectedChartTypeId={selectedChartTypeId}
            onSelectChartType={setSelectedChartTypeId}
            isViewOnly={isViewOnly}
          />
        ) : null}

        {currentStep === "data_source" ? (
          <AnalyticsStudioSourceHub
            wizardMode
            isViewOnly={isViewOnly}
            selectedChartTypeId={selectedChartTypeId}
            initialActiveView={resolveInitialSourceView(routeState)}
            preSelectedConnectionId={routeState.connectionId}
            selectedDatasetId={routeState.datasetId}
            onBackToLists={handleBack}
            onWizardConnectionContinue={handleWizardConnectionContinue}
            onWizardConnectionContinueExisting={handleWizardConnectionContinueExisting}
            onWizardDatasetContinue={handleWizardDatasetContinue}
            onWizardDatasetContinueExisting={handleWizardDatasetContinueExisting}
          />
        ) : null}

        {currentStep === "configure_source" && nodeId && configureSourceEmbeddedState ? (
          <AnalyticsStudioSourceSelection
            embeddedNodeId={nodeId}
            embeddedInitialState={configureSourceEmbeddedState}
            isViewOnly={isViewOnly}
            onEmbeddedBack={() => setCurrentStep("data_source")}
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
            <p className="text-sm text-muted-foreground">
              {columnsError ?? "Unable to load chart data"}
            </p>
            <Button size="sm" onClick={handleBack}>
              Back
            </Button>
          </div>
        ) : null}

        {!showColumnsLoading && !showColumnsError && currentStep === "data_binding" && canShowDataSteps ? (
          <DataBindingStep
            routeState={routeState}
            sources={sources}
            selectedSourceName={selectedSourceName}
            onSelectSource={(sourceName) => {
              if (!isViewOnly) setSelectedSourceName(sourceName);
            }}
            selectedChartTypeId={selectedChartTypeId}
            selectedChartName={selectedChartName}
            chartFormData={chartFormData}
            isLoadingForm={isLoadingForm}
            formValues={formValues}
            bindingSeedValues={bindingSeedValues}
            bindingRestoreKey={bindingRestoreKey}
            bindingSessionKey={bindingSessionKey}
            onFormValuesChange={handleFormValuesChange}
            isViewOnly={isViewOnly}
            analyticsStudioInit={loadedState.chartInit}
            payloadSource={loadedState.payloadSource}
          />
        ) : null}

        {!showColumnsLoading && !showColumnsError && currentStep === "visualise" && canShowDataSteps ? (
          <VisualiseStep
            routeState={routeState}
            sources={sources}
            selectedSourceName={selectedSourceName}
            selectedChartTypeId={selectedChartTypeId}
            selectedChartName={selectedChartName}
            chartFormData={chartFormData}
            formValues={formValues}
            customizationOptions={customizationOptions}
            onCustomizationChange={handleCustomizationChange}
            isViewOnly={isViewOnly}
            analyticsStudioInit={loadedState.chartInit}
            payloadSource={loadedState.payloadSource}
          />
        ) : null}

        {!showColumnsLoading && !showColumnsError && currentStep === "interactions" && canShowDataSteps ? (
          <InteractionsStep
            sources={sources}
            selectedSourceName={selectedSourceName}
            usedColumnNames={usedColumnNames}
            drilldownSupported={drilldownSupported}
            enableDrilldown={enableDrilldown}
            drilldownColumns={drilldownColumns}
            onToggleDrilldown={(enabled) => {
              if (isViewOnly) return;
              setEnableDrilldown(enabled);
              if (!enabled) setDrilldownColumns([]);
            }}
            onDrilldownColumnsChange={setDrilldownColumns}
            isViewOnly={isViewOnly}
          />
        ) : null}

        {currentStep === "save" ? (
          <SaveStep
            chartName={chartName}
            chartVisibility={chartVisibility}
            selectedChartName={selectedChartName}
            selectedSourceName={selectedSourceName}
            dimensions={bindingSummary.dimensions}
            metrics={bindingSummary.metrics}
            enableDrilldown={enableDrilldown}
            drilldownColumns={drilldownColumns}
            onChartNameChange={setChartName}
            onChartVisibilityChange={setChartVisibility}
            isViewOnly={isViewOnly}
            mode={isViewOnly ? "view" : "edit"}
          />
        ) : null}
      </div>

      {showFooter ? (
        <ChartWizardFooter
          hint={stepHints[currentStep]}
          onBack={handleBack}
          onNext={handleNext}
          nextDisabled={!canProceed}
          nextLoading={isSaving}
          nextLabel={
            isViewOnly
              ? currentStep === "save"
                ? "Done"
                : "Next"
              : currentStep === "save"
                ? "Update Chart"
                : "Next"
          }
        />
      ) : currentStep === "data_source" ? (
        <ChartWizardFooter
          hint={stepHints.data_source}
          onBack={handleBack}
          onNext={handleNext}
          nextDisabled={!canProceed}
          showNext={
            isViewOnly ||
            (usesConfigureStep ? !!routeState.connectionId || isValid : isValid)
          }
        />
      ) : null}
    </div>
  );
}
