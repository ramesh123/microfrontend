import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Cable, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ANALYTICS_STUDIO_CONNECTION_SOURCES,
  fetchAllConnections,
} from "@/controllers/API/connectionVaultApi";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import ConnectionSelectionTable, {
  type AnalyticsStudioConnection,
} from "./ConnectionSelectionTable";
import { parseGroupedConnectionsResponse } from "./parseGroupedConnections.tsx";
import { resolveAnalyticsStudioNodeIdFromConnectionType } from "./connectionType";
import type { AnalyticsStudioSelectedConnection } from "./types";

export function buildWizardConnectionContinuePayload(
  connection: AnalyticsStudioConnection,
  selectedChartTypeId?: string,
): { nodeId: string; initialState: Record<string, unknown> } {
  const connectionId = String(connection.id);
  const connectionType = String(connection.connection_type ?? "").trim();
  const groupType = String(connection.group_type ?? "databases").trim();
  const nodeId = resolveAnalyticsStudioNodeIdFromConnectionType(connectionType || "database");

  const mappedConnection: AnalyticsStudioSelectedConnection = {
    id: connection.id,
    name: String(connection.name ?? "").trim(),
    connection_type: connectionType,
    group_type: groupType,
    database_name: String(connection.database_name ?? connection.database ?? "").trim() || undefined,
    schema_name: String(connection.schema_name ?? "").trim() || undefined,
  };

  return {
    nodeId,
    initialState: {
      displayName: mappedConnection.name || connectionType || "Connection",
      icon: connectionType || nodeId,
      name: connectionType || nodeId,
      preSelectedConnectionId: connectionId,
      selectedConnection: mappedConnection,
      ...(selectedChartTypeId ? { selectedChartTypeId } : {}),
    },
  };
}

interface ConnectionSelectionPanelProps {
  onBack: () => void;
  embedded?: boolean;
  compact?: boolean;
  isViewOnly?: boolean;
  selectedChartTypeId?: string;
  preSelectedConnectionId?: string;
  onWizardContinue?: (payload: {
    nodeId: string;
    initialState: Record<string, unknown>;
  }) => void;
  onWizardContinueExisting?: () => void;
  onWizardSelectionChange?: (connection: AnalyticsStudioConnection | null) => void;
}

const ConnectionSelectionPanel = ({
  onBack,
  embedded = false,
  compact = false,
  isViewOnly = false,
  selectedChartTypeId,
  preSelectedConnectionId,
  onWizardContinue,
  onWizardContinueExisting,
  onWizardSelectionChange,
}: ConnectionSelectionPanelProps) => {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<{
    databases: AnalyticsStudioConnection[];
    storage: AnalyticsStudioConnection[];
    notifications: AnalyticsStudioConnection[];
    ingestion: AnalyticsStudioConnection[];
  }>({
    databases: [],
    storage: [],
    notifications: [],
    ingestion: [],
  });
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<AnalyticsStudioConnection | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      setConnectionsLoading(true);

      const response = await fetchAllConnections([...ANALYTICS_STUDIO_CONNECTION_SOURCES]);

      if (response?.status && response.data) {
        setConnections(parseGroupedConnectionsResponse(response.data));
      } else {
        setConnections({
          databases: [],
          storage: [],
          notifications: [],
          ingestion: [],
        });
      }
    } catch (error) {
      console.error("Error fetching connections:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to load connections"));
    } finally {
      setConnectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    if (connectionsLoading) return;

    const allConnections = [
      ...connections.databases,
      ...connections.storage,
      ...connections.notifications,
      ...connections.ingestion,
    ];

    if (preSelectedConnectionId) {
      const match = allConnections.find(
        (connection) => String(connection.id) === String(preSelectedConnectionId),
      );
      if (match) {
        setSelectedConnectionId(String(match.id));
        setSelectedConnection(match);
        onWizardSelectionChange?.(match);
        return;
      }
    }

    setSelectedConnection((current) => {
      if (!current) {
        onWizardSelectionChange?.(null);
        return current;
      }
      const stillExists = allConnections.some(
        (connection) => String(connection.id) === String(current.id),
      );
      const next = stillExists ? current : null;
      onWizardSelectionChange?.(next);
      return next;
    });
    setSelectedConnectionId((currentId) => {
      if (!currentId) return currentId;
      const stillExists = allConnections.some(
        (connection) => String(connection.id) === String(currentId),
      );
      return stillExists ? currentId : null;
    });
  }, [connections, connectionsLoading, preSelectedConnectionId]);

  const handleSelectionChange = (connection: AnalyticsStudioConnection) => {
    setSelectedConnectionId(String(connection.id));
    setSelectedConnection(connection);
    onWizardSelectionChange?.(connection);
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        compact ? "h-full pl-2 pr-0 pt-0 pb-2" : "px-2 pb-2 pt-0",
      )}
    >
      <Card
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-0 border-border/70 p-0",
          compact ? "border-0 bg-transparent shadow-none" : "shadow-sm",
        )}
      >
        <CardHeader className="border-b border-border/60 gap-0 px-2 pt-0 [.border-b]:pb-2">
          <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {!embedded ? (
                <Button variant="ghost" size="sm" className="!h-7 shrink-0 !px-2" onClick={onBack}>
                  <ArrowLeft className="h-4 w-5" />
                </Button>
              ) : null}
              <div className="flex min-w-0 items-center gap-2 mt-2">
                <Cable className="h-4 w-4 shrink-0 text-primary" />
                <CardTitle className="text-[16px] font-semibold tracking-tight leading-none">Connections</CardTitle>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 mt-2">
              {!isViewOnly ? (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    size="icon"
                    className="!h-7 !w-7 shrink-0 !px-2"
                    onClick={() => void fetchConnections()}
                    disabled={connectionsLoading}
                    title="Refresh connections"
                  >
                    <RefreshCw className={cn("!h-5 !w-4", connectionsLoading && "animate-spin")} />
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col px-0 py-2">
          {connectionsLoading ? (
            <div className="flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Loading connections…</p>
              <p className="text-xs text-muted-foreground">Fetching connection vault data</p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <ConnectionSelectionTable
                connections={connections}
                selectedConnectionId={selectedConnectionId}
                onSelectionChange={isViewOnly ? () => undefined : handleSelectionChange}
                selectionDisabled={isViewOnly}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConnectionSelectionPanel;
