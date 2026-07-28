import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AnalyticalDatasetPage from "@/pages/analyticdataset";
import CreateDatasetStepper from "@/pages/DataSetPage/CreateDatasetStepper";
import ConnectionSelectionPanel from "./ConnectionSelectionPanel";
import type { AnalyticsStudioConnection } from "./ConnectionSelectionTable";
import AnalyticsStudioSourceSidebar, {
  type AnalyticsStudioSourceView,
} from "./AnalyticsStudioSourceSidebar";
import {
  buildCreateChartStateFromDataset,
  getCreateChartNodeIdFromDataset,
} from "./buildCreateChartStateFromDataset";
import type { AnalyticsStudioCreateChartState } from "./types";
import type { Dataset } from "@/types/dataset";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";

export function resolveInitialSourceView(
  routeState?: AnalyticsStudioCreateChartState | null,
): AnalyticsStudioSourceView {
  if (!routeState) return "connections";
  if (routeState.datasetId || routeState.sourceType === "virtual_db") {
    return "analytical-dataset";
  }
  return "connections";
}

interface AnalyticsStudioSourceHubProps {
  onBackToLists: () => void;
  selectedChartTypeId?: string;
  wizardMode?: boolean;
  isViewOnly?: boolean;
  initialActiveView?: AnalyticsStudioSourceView;
  preSelectedConnectionId?: string;
  selectedDatasetId?: number;
  onWizardConnectionContinue?: (payload: {
    nodeId: string;
    initialState: Record<string, unknown>;
  }) => void;
  onWizardConnectionContinueExisting?: () => void;
  onWizardDatasetContinue?: (payload: {
    nodeId: string;
    chartState: AnalyticsStudioCreateChartState;
  }) => void;
  onWizardDatasetContinueExisting?: () => void;
  onWizardConnectionSelectionChange?: (connection: AnalyticsStudioConnection | null) => void;
  onActiveViewChange?: (view: AnalyticsStudioSourceView) => void;
}

function ApiSourcePlaceholder() {
  return (
    <div className="flex h-full min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 p-8 text-center">
      <p className="text-sm font-semibold text-foreground">API data sources</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        Connect charts to API endpoints. This option will be available soon.
      </p>
    </div>
  );
}

export default function AnalyticsStudioSourceHub({
  onBackToLists,
  selectedChartTypeId,
  wizardMode = false,
  isViewOnly = false,
  initialActiveView,
  preSelectedConnectionId,
  selectedDatasetId,
  onWizardConnectionContinue,
  onWizardConnectionContinueExisting,
  onWizardDatasetContinue,
  onWizardDatasetContinueExisting,
  onWizardConnectionSelectionChange,
  onActiveViewChange,
}: AnalyticsStudioSourceHubProps) {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<AnalyticsStudioSourceView>(
    initialActiveView ?? "connections",
  );
  const [isCreatingDataset, setIsCreatingDataset] = useState(false);
  const [datasetListKey, setDatasetListKey] = useState(0);

  useEffect(() => {
    if (initialActiveView) setActiveView(initialActiveView);
  }, [initialActiveView]);

  const handleViewChange = useCallback((view: AnalyticsStudioSourceView) => {
    setActiveView(view);
    setIsCreatingDataset(false);
    onActiveViewChange?.(view);
  }, [onActiveViewChange]);

  const handleCreateDataset = useCallback(() => {
    if (isViewOnly) return;
    setIsCreatingDataset(true);
  }, [isViewOnly]);

  const handleCloseCreateDataset = useCallback(() => {
    setIsCreatingDataset(false);
    setDatasetListKey((key) => key + 1);
  }, []);

  const handleDatasetSelect = useCallback(
    (dataset: Dataset) => {
      if (isViewOnly) return;

      if (
        wizardMode &&
        selectedDatasetId &&
        dataset.id === selectedDatasetId &&
        onWizardDatasetContinueExisting
      ) {
        onWizardDatasetContinueExisting();
        return;
      }

      const chartState = buildCreateChartStateFromDataset(dataset);
      if (!chartState) {
        toast.error("This dataset is missing connection or table details required to create a chart.");
        return;
      }

      const nodeId = getCreateChartNodeIdFromDataset(dataset);
      const nextState = {
        ...chartState,
        ...(selectedChartTypeId ? { selectedChartTypeId } : {}),
      };

      if (wizardMode && onWizardDatasetContinue) {
        onWizardDatasetContinue({ nodeId, chartState: nextState });
        return;
      }

      try {
        navigate(`/analytic-studio/${nodeId}/create-chart`, { state: nextState });
      } catch (error) {
        toast.error(getDisplayErrorMessage(error, "Failed to open chart wizard."));
      }
    },
    [isViewOnly, navigate, onWizardDatasetContinue, onWizardDatasetContinueExisting, selectedChartTypeId, selectedDatasetId, wizardMode],
  );

  const renderContent = () => {
    if (activeView === "connections") {
      return (
        <ConnectionSelectionPanel
          onBack={onBackToLists}
          embedded
          isViewOnly={isViewOnly}
          selectedChartTypeId={selectedChartTypeId}
          preSelectedConnectionId={preSelectedConnectionId}
          onWizardContinue={wizardMode && !isViewOnly ? onWizardConnectionContinue : undefined}
          onWizardContinueExisting={wizardMode && !isViewOnly ? onWizardConnectionContinueExisting : undefined}
          onWizardSelectionChange={wizardMode ? onWizardConnectionSelectionChange : undefined}
          compact
        />
      );
    }

    if (activeView === "analytical-dataset") {
      if (isCreatingDataset) {
        return (
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <CreateDatasetStepper onClose={handleCloseCreateDataset} />
          </div>
        );
      }

      return (
        <AnalyticalDatasetPage
          key={datasetListKey}
          embedded
          compact
          isViewOnly={isViewOnly}
          selectedDatasetId={selectedDatasetId}
          onCreateDataset={isViewOnly ? undefined : handleCreateDataset}
          onDatasetSelect={isViewOnly ? undefined : handleDatasetSelect}
        />
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <ApiSourcePlaceholder />
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden mt-1">
      <AnalyticsStudioSourceSidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        onBackToLists={onBackToLists}
        hideBackButton={wizardMode}
        isViewOnly={isViewOnly}
        variant="vertical"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/40">
        {renderContent()}
      </div>
    </div>
  );
}
