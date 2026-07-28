import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  ChevronRight,
  ChevronDown,
  Loader2,
  Sparkles,
  Database,
  Table2,
  Layers,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fetchProjectsApi } from "@/controllers/API";
import { fetchConnectionGroup } from "@/controllers/API/connectionVaultApi";
import { postPostgresqlAction } from "@/controllers/API/databaseActionsApi";
import { getNodesList } from "@/controllers/API/datasetApi";
import { useRbacStore } from "@/stores/useRBACStore";
import { ConnectorIcon } from "@/pages/CredVaultPage/ConnectorIcon";
import {
  getRestoredCreateChartState,
  type AnalyticsStudioCreateChartState,
  type AnalyticsStudioFetchType,
  type AnalyticsStudioLocationState,
  type AnalyticsStudioSourcePageState,
  type AnalyticsStudioTableSelection,
} from "./types";
import { resolveAnalyticsStudioConnectionType } from "./connectionType";

const VIRTUAL_DB_FLOW_FIELDS = [
  "name",
  "description",
  "business_process",
  "created_at",
  "updated_at",
  "status",
  "deployment_name",
  "locked",
  "workflow_origin",
  "flow_id",
] as const;

function formatGroupTypeLabel(groupType: string): string {
  return groupType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

interface SchemaTree {
  [schemaName: string]: string[];
}

function mapApiResponseToOptions(responseData: unknown): { label: string; value: string }[] {
  const arr = (responseData as { data?: unknown })?.data ?? responseData;
  if (!Array.isArray(arr)) return [];
  if (arr.length === 0) return [];
  if (typeof arr[0] === "object" && arr[0] != null && "label" in arr[0]) {
    return arr.map((item: { label: unknown; value: unknown }) => ({
      label: String(item.label),
      value: String(item.value),
    }));
  }
  return arr.map((item: unknown) => ({ label: String(item), value: String(item) }));
}

async function fetchConnectionsForNode(nodeId: string, nodeName?: string, fields?: string) {
  const connectionType = resolveAnalyticsStudioConnectionType(nodeId, nodeName);
  return fetchConnectionGroup("/databases/get-connections", {
    ...(fields ? { fields } : {}),
    connection_type: connectionType,
  });
}

function buildInitialSelectedTables(
  restoredSource: AnalyticsStudioCreateChartState | null,
): Map<string, Set<string>> {
  if (!restoredSource?.tables?.length || restoredSource.fetchType === "query") {
    return new Map();
  }

  const map = new Map<string, Set<string>>();
  for (const { schema, table } of restoredSource.tables) {
    if (!map.has(schema)) map.set(schema, new Set());
    map.get(schema)?.add(table);
  }
  return map;
}

export default function AnalyticsStudioSourceSelection({
  embeddedNodeId,
  embeddedInitialState,
  onEmbeddedBack,
  onEmbeddedContinue,
  isViewOnly = false,
}: {
  embeddedNodeId?: string;
  embeddedInitialState?: AnalyticsStudioLocationState;
  onEmbeddedBack?: () => void;
  onEmbeddedContinue?: (state: AnalyticsStudioCreateChartState) => void;
  isViewOnly?: boolean;
} = {}) {
  const navigate = useNavigate();
  const { nodeId: routeNodeId = "" } = useParams<{ nodeId: string }>();
  const nodeId = embeddedNodeId ?? routeNodeId;
  const location = useLocation();
  const locationState = (embeddedInitialState ?? location.state ?? {}) as AnalyticsStudioSourcePageState;
  const routeState = locationState as AnalyticsStudioLocationState;
  const restoredSource = getRestoredCreateChartState(locationState);
  const selectedFromPicker = routeState.selectedConnection;
  const isFromConnectionPicker = !!selectedFromPicker;
  const isEmbeddedRestoreMode = Boolean(embeddedInitialState && restoredSource);
  const isSourceConfigLocked = isFromConnectionPicker || !!restoredSource;
  const pendingDatabaseRestore = useRef(restoredSource?.databaseName?.trim() || null);
  const pendingTableRestore = useRef<AnalyticsStudioTableSelection[] | null>(
    restoredSource?.fetchType !== "query" && restoredSource?.tables?.length
      ? restoredSource.tables
      : null,
  );

  const { currentUser, activePerspective } = useRbacStore();
  const activePerspectiveId = activePerspective?.perspective_id || activePerspective?.id;

  const [displayName, setDisplayName] = useState(
    selectedFromPicker?.name ?? restoredSource?.displayName ?? routeState.displayName ?? "",
  );
  const [icon, setIcon] = useState(
    selectedFromPicker?.connection_type ??
      restoredSource?.icon ??
      routeState.icon ??
      nodeId,
  );
  const [nodeName, setNodeName] = useState(
    selectedFromPicker?.connection_type ??
      restoredSource?.nodeName ??
      routeState.name ??
      "",
  );
  const [groupType, setGroupType] = useState(
    selectedFromPicker?.group_type ?? restoredSource?.groupType ?? "databases",
  );
  const [connectionTypeLabel, setConnectionTypeLabel] = useState(
    selectedFromPicker?.connection_type ?? restoredSource?.connectionType ?? "",
  );

  const [connections, setConnections] = useState<{ value: string; label: string }[]>(
    selectedFromPicker
      ? [{ value: String(selectedFromPicker.id), label: selectedFromPicker.name }]
      : restoredSource?.connectionId
        ? [
            {
              value: restoredSource.connectionId,
              label: restoredSource.displayName ?? restoredSource.connectionId,
            },
          ]
        : [],
  );
  const [databases, setDatabases] = useState<{ value: string; label: string }[]>(
    selectedFromPicker?.database_name
      ? [{ value: selectedFromPicker.database_name, label: selectedFromPicker.database_name }]
      : restoredSource?.databaseName
        ? [{ value: restoredSource.databaseName, label: restoredSource.databaseName }]
        : [],
  );
  const [virtualDbRows, setVirtualDbRows] = useState<
    { flow_id: string; deployment_name?: string; name?: string; id?: number }[]
  >([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [loadingVirtualDbs, setLoadingVirtualDbs] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingNode, setLoadingNode] = useState(
    !embeddedInitialState && !routeState.displayName && !selectedFromPicker,
  );

  const [sourceType, setSourceType] = useState<"database" | "virtual_db">(
    restoredSource?.sourceType ?? "database",
  );
  const [fetchType, setFetchType] = useState<AnalyticsStudioFetchType>(
    restoredSource?.fetchType ?? "table",
  );
  const [selectedConnection, setSelectedConnection] = useState(
    selectedFromPicker ? String(selectedFromPicker.id) : restoredSource?.connectionId ?? "",
  );
  const [selectedDatabase, setSelectedDatabase] = useState(
    selectedFromPicker?.database_name?.trim() ??
      restoredSource?.databaseName?.trim() ??
      "",
  );
  const [selectedVirtualDbFlowId, setSelectedVirtualDbFlowId] = useState(
    restoredSource?.flowId ?? "",
  );
  const [contextText, setContextText] = useState(restoredSource?.contextText ?? "");
  const [sqlQuery, setSqlQuery] = useState(restoredSource?.query ?? "");

  const [schemaTree, setSchemaTree] = useState<SchemaTree>({});
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(() => {
    if (!restoredSource?.tables?.length) return new Set();
    return new Set(restoredSource.tables.map((entry) => entry.schema));
  });
  const [selectedTables, setSelectedTables] = useState<Map<string, Set<string>>>(() =>
    buildInitialSelectedTables(restoredSource),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isContinuing, setIsContinuing] = useState(false);

  const effectiveDatabase = useMemo(
    () =>
      selectedDatabase ||
      restoredSource?.databaseName?.trim() ||
      locationState.databaseName?.trim() ||
      selectedFromPicker?.database_name?.trim() ||
      "",
    [
      locationState.databaseName,
      restoredSource?.databaseName,
      selectedDatabase,
      selectedFromPicker?.database_name,
    ],
  );

  const showLockedDatabase =
    isEmbeddedRestoreMode ||
    Boolean(isSourceConfigLocked && effectiveDatabase) ||
    Boolean(selectedFromPicker?.database_name?.trim());

  useEffect(() => {
    if (embeddedInitialState || routeState.displayName || selectedFromPicker) return;

    const loadNode = async () => {
      setLoadingNode(true);
      try {
        const nodes = await getNodesList({ group: ["Databases"] });
        const match = Object.values(nodes)
          .flat()
          .find((node) => node.node_id === nodeId);
        if (match) {
          setDisplayName(match.display_name);
          setIcon(match.icon);
          setNodeName(match.name);
        }
      } catch {
        setDisplayName(nodeId);
      } finally {
        setLoadingNode(false);
      }
    };

    if (nodeId) loadNode();
  }, [embeddedInitialState, nodeId, routeState.displayName, selectedFromPicker]);

  useEffect(() => {
    if (sourceType !== "virtual_db") return;
    if (!currentUser) return;

    const loadVirtualDbs = async () => {
      setLoadingVirtualDbs(true);
      try {
        const res = await fetchProjectsApi(
          {
            fields: [...VIRTUAL_DB_FLOW_FIELDS],
            org_id: currentUser.organizationIds || [],
            q: "virtualdb_mode=true",
            ...(activePerspectiveId != null && activePerspectiveId !== ""
              ? { perspective_ids: [String(activePerspectiveId)] }
              : {}),
          },
          currentUser.role,
        );
        const raw = res?.data;
        const rows = Array.isArray(raw) ? raw : [];
        setVirtualDbRows(
          rows.map((w: Record<string, unknown>) => ({
            flow_id: String(w.flow_id ?? ""),
            deployment_name: w.deployment_name as string | undefined,
            name: w.name as string | undefined,
            id: typeof w.id === "number" ? w.id : undefined,
          })),
        );
      } catch {
        setVirtualDbRows([]);
      } finally {
        setLoadingVirtualDbs(false);
      }
    };

    loadVirtualDbs();
  }, [sourceType, currentUser, activePerspectiveId]);

  useEffect(() => {
    if (selectedFromPicker) return;
    if (!nodeId) return;

    const fetchConnections = async () => {
      setLoadingConnections(true);
      try {
        const result = await fetchConnectionsForNode(
          nodeId,
          nodeName,
          '["id as value", "name as label"]',
        );
        setConnections(mapApiResponseToOptions(result));
      } catch {
        setConnections([]);
      } finally {
        setLoadingConnections(false);
      }
    };
    fetchConnections();
  }, [nodeId, nodeName, selectedFromPicker]);

  useEffect(() => {
    setSchemaTree({});
    if (!pendingTableRestore.current) {
      setSelectedTables(new Map());
    }
    setExpandedSchemas(new Set());

    if (isEmbeddedRestoreMode || (isSourceConfigLocked && restoredSource?.databaseName?.trim())) {
      const db =
        restoredSource?.databaseName?.trim() ||
        locationState.databaseName?.trim() ||
        pendingDatabaseRestore.current ||
        "";
      if (db) {
        setDatabases([{ value: db, label: db }]);
        setSelectedDatabase(db);
      }
      return;
    }

    if (!selectedConnection) {
      setDatabases([]);
      if (!pendingDatabaseRestore.current) {
        setSelectedDatabase("");
      }
      return;
    }

    const preselectedDb = selectedFromPicker?.database_name?.trim();
    if (preselectedDb) {
      setDatabases([{ value: preselectedDb, label: preselectedDb }]);
      setSelectedDatabase(preselectedDb);
      return;
    }

    setDatabases([]);
    if (!pendingDatabaseRestore.current) {
      setSelectedDatabase("");
    }

    const fetchDatabases = async () => {
      setLoadingDatabases(true);
      try {
        const result = await postPostgresqlAction(
          { actions: "get_databases", connection: selectedConnection },
          "Failed to load databases",
        );
        const options = mapApiResponseToOptions(result);
        setDatabases(options);

        if (pendingDatabaseRestore.current) {
          setSelectedDatabase(pendingDatabaseRestore.current);
          pendingDatabaseRestore.current = null;
        }
      } catch {
        setDatabases([]);
      } finally {
        setLoadingDatabases(false);
      }
    };
    void fetchDatabases();
  }, [
    isEmbeddedRestoreMode,
    isSourceConfigLocked,
    locationState.databaseName,
    restoredSource?.databaseName,
    selectedConnection,
    selectedFromPicker?.database_name,
  ]);

  useEffect(() => {
    setSchemaTree({});
    if (!pendingTableRestore.current) {
      setSelectedTables(new Map());
    }
    setExpandedSchemas(new Set());
    if (!selectedConnection || !effectiveDatabase || fetchType !== "table") return;

    const fetchSchemasAndTables = async () => {
      setLoadingSchemas(true);
      try {
        const schemasRes = await postPostgresqlAction(
          {
            data: { database: effectiveDatabase },
            actions: "get_schemas",
            connection: selectedConnection,
          },
          "Failed to load schemas",
        );
        const schemaList = mapApiResponseToOptions(schemasRes);
        const tree: SchemaTree = {};

        await Promise.all(
          schemaList.map(async (schema) => {
            try {
              const tablesRes = await postPostgresqlAction(
                {
                  data: { schema: schema.value, database: effectiveDatabase },
                  actions: "get_tables",
                  connection: selectedConnection,
                },
                "Failed to load tables",
              );
              tree[schema.value] = mapApiResponseToOptions(tablesRes).map((t) => t.value);
            } catch {
              tree[schema.value] = [];
            }
          }),
        );
        setSchemaTree(tree);
      } catch {
        setSchemaTree({});
      } finally {
        setLoadingSchemas(false);
      }
    };
    fetchSchemasAndTables();
  }, [effectiveDatabase, fetchType, selectedConnection]);

  useEffect(() => {
    if (!pendingTableRestore.current?.length) return;
    if (loadingSchemas) return;
    if (Object.keys(schemaTree).length === 0) return;

    const pending = pendingTableRestore.current;
    pendingTableRestore.current = null;

    setSelectedTables((prev) => {
      const next = new Map(prev);
      for (const { schema, table } of pending) {
        if (!next.has(schema)) next.set(schema, new Set());
        next.get(schema)?.add(table);
      }
      return next;
    });

    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      for (const { schema } of pending) next.add(schema);
      return next;
    });
  }, [loadingSchemas, schemaTree]);

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return schemaTree;
    const q = searchQuery.toLowerCase();
    const result: SchemaTree = {};
    for (const [schema, tables] of Object.entries(schemaTree)) {
      const schemaMatches = schema.toLowerCase().includes(q);
      const matchingTables = tables.filter((t) => t.toLowerCase().includes(q));
      if (schemaMatches || matchingTables.length > 0) {
        result[schema] = schemaMatches ? tables : matchingTables;
      }
    }
    return result;
  }, [schemaTree, searchQuery]);

  const totalSelected = useMemo(() => {
    let count = 0;
    selectedTables.forEach((tables) => (count += tables.size));
    return count;
  }, [selectedTables]);

  const selectedTableEntries = useMemo(() => {
    const out: { schema: string; table: string }[] = [];
    selectedTables.forEach((tables, schema) => {
      tables.forEach((table) => out.push({ schema, table }));
    });
    out.sort((a, b) =>
      a.schema === b.schema ? a.table.localeCompare(b.table) : a.schema.localeCompare(b.schema),
    );
    return out;
  }, [selectedTables]);

  const connectionDisplayLabel = useMemo(
    () =>
      connections.find((connection) => connection.value === selectedConnection)?.label ??
      displayName ??
      selectedFromPicker?.name ??
      selectedConnection,
    [connections, displayName, selectedConnection, selectedFromPicker?.name],
  );

  const virtualDbDisplayLabel = useMemo(() => {
    const match = virtualDbRows.find((row) => row.flow_id === selectedVirtualDbFlowId);
    if (match) {
      return String(match.deployment_name ?? match.name ?? match.flow_id).trim() || match.flow_id;
    }
    return selectedVirtualDbFlowId;
  }, [selectedVirtualDbFlowId, virtualDbRows]);

  const toggleSchema = (schema: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(schema)) next.delete(schema);
      else next.add(schema);
      return next;
    });
  };

  const isSchemaFullySelected = (schema: string) => {
    const tables = schemaTree[schema] ?? [];
    const selected = selectedTables.get(schema);
    return tables.length > 0 && selected?.size === tables.length;
  };

  const isSchemaPartiallySelected = (schema: string) => {
    const selected = selectedTables.get(schema);
    if (!selected || selected.size === 0) return false;
    return selected.size < (schemaTree[schema]?.length ?? 0);
  };

  const toggleSchemaSelection = (schema: string) => {
    if (isViewOnly) return;
    setSelectedTables((prev) => {
      const next = new Map(prev);
      if (isSchemaFullySelected(schema)) {
        next.delete(schema);
      } else {
        next.set(schema, new Set(schemaTree[schema] ?? []));
      }
      return next;
    });
  };

  const toggleTableSelection = (schema: string, table: string) => {
    if (isViewOnly) return;
    setSelectedTables((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(schema) ?? []);
      if (current.has(table)) current.delete(table);
      else current.add(table);
      if (current.size === 0) next.delete(schema);
      else next.set(schema, current);
      return next;
    });
  };

  const isTableSelected = (schema: string, table: string) =>
    selectedTables.get(schema)?.has(table) ?? false;

  const canProceedDatabase =
    !!selectedConnection &&
    !!effectiveDatabase &&
    (fetchType === "query" ? !!sqlQuery.trim() : totalSelected > 0);

  const canProceed =
    !isContinuing &&
    (sourceType === "virtual_db" ? !!selectedVirtualDbFlowId : canProceedDatabase);

  const handleContinue = () => {
    if (!canProceed) return;

    const navigationState: AnalyticsStudioCreateChartState = {
      displayName,
      icon,
      nodeName,
      sourceType,
      groupType,
      fetchType: sourceType === "database" ? fetchType : undefined,
      contextText: contextText.trim() || undefined,
      flowId: sourceType === "virtual_db" ? selectedVirtualDbFlowId : "",
      selectedChartTypeId: locationState.selectedChartTypeId,
      ...(sourceType === "database"
        ? {
            connectionId: selectedConnection,
            databaseName: effectiveDatabase,
            connectionType:
              connectionTypeLabel ||
              selectedFromPicker?.connection_type ||
              resolveAnalyticsStudioConnectionType(nodeId, nodeName),
            ...(fetchType === "query"
              ? { query: sqlQuery.trim() }
              : { tables: selectedTableEntries }),
          }
        : {}),
    };

    setIsContinuing(true);
    if (onEmbeddedContinue) {
      onEmbeddedContinue(navigationState);
      setIsContinuing(false);
      return;
    }
    navigate(`/analytic-studio/${nodeId}/create-chart`, { state: navigationState });
  };

  const handleBack = () => {
    if (onEmbeddedBack) {
      onEmbeddedBack();
      return;
    }
    navigate("/analytic-studio", { state: { view: "sources", tab: "charts" } });
  };

  const resetDatabaseSource = () => {
    setSelectedConnection("");
    setSelectedDatabase("");
    setSchemaTree({});
    setSelectedTables(new Map());
    setExpandedSchemas(new Set());
    setSqlQuery("");
  };

  const handleFetchTypeChange = (next: AnalyticsStudioFetchType) => {
    if (isViewOnly) return;
    setFetchType(next);
    setSchemaTree({});
    setSelectedTables(new Map());
    setExpandedSchemas(new Set());
    setSearchQuery("");
    if (next === "table") {
      setSqlQuery("");
    }
  };

  if (loadingNode) {
    return (
      <div className="flex h-[95vh] items-center justify-center gap-2 bg-background">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading source...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="flex items-center gap-2 border-b bg-background px-4 py-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-xs font-bold uppercase text-foreground tracking-tight">Select Source & Tables</h1>
          <p className="truncate text-xs text-muted-foreground">
            {displayName || nodeId} ·{" "}
            {isViewOnly || isSourceConfigLocked
              ? "Review your selected source and tables"
              : "Choose connection, database, and tables for analytics"}
          </p>
        </div>
      </div>

      <div className="border-b bg-muted/20 px-4 py-2.5">
        <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-start">
          <div className="grid w-full shrink-0 gap-1.5 sm:w-[min(100%,11rem)]">
            <label className="text-xs font-medium text-muted-foreground">Source type</label>
            {isSourceConfigLocked ? (
              <div className="flex h-8 w-full items-center rounded-md border border-input bg-muted/30 px-2.5 shadow-xs">
                <span className="truncate text-sm font-medium capitalize text-foreground">
                  {sourceType === "virtual_db"
                    ? "Virtual DB"
                    : formatGroupTypeLabel(groupType) || "Database"}
                </span>
              </div>
            ) : (
              <Select
                value={sourceType}
                onValueChange={(v) => {
                  const next = v as "database" | "virtual_db";
                  setSourceType(next);
                  if (next === "database") {
                    setSelectedVirtualDbFlowId("");
                  } else {
                    resetDatabaseSource();
                  }
                }}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="Select source..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="database">Database</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {sourceType === "database" && (
            <div className="grid w-full shrink-0 gap-1.5 sm:w-[min(100%,14rem)]">
              <label className="text-xs font-medium text-muted-foreground">Source</label>
              <div className="flex h-8 w-full items-center gap-2 rounded-md border border-input bg-background px-2.5 shadow-xs">
                <ConnectorIcon icon={connectionTypeLabel || icon} size="sm" />
                <span className="truncate text-sm font-medium text-foreground">
                  {connectionTypeLabel || displayName || nodeId}
                </span>
              </div>
            </div>
          )}

          {sourceType === "database" && (
            <div className="grid w-full shrink-0 gap-1.5 sm:w-[min(100%,13rem)]">
              <label className="text-xs font-medium text-muted-foreground">Connection</label>
              {isSourceConfigLocked ? (
                <div className="flex h-8 w-full items-center rounded-md border border-input bg-muted/30 px-2.5 shadow-xs">
                  <span className="truncate text-sm font-medium text-foreground">
                    {connectionDisplayLabel}
                  </span>
                </div>
              ) : (
                <Select
                  value={selectedConnection || undefined}
                  onValueChange={(v) => setSelectedConnection(v ?? "")}
                  disabled={loadingConnections}
                >
                  <SelectTrigger
                    size="sm"
                    className={cn("w-full", !selectedConnection && "text-muted-foreground")}
                  >
                    <SelectValue
                      placeholder={loadingConnections ? "Loading..." : "Select connection..."}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {sourceType === "database" && (
            <div className="grid w-full shrink-0 gap-1.5 sm:w-[min(100%,13rem)]">
              <label className="text-xs font-medium text-muted-foreground">Database</label>
              {showLockedDatabase ? (
                <div className="flex h-8 w-full items-center rounded-md border border-input bg-muted/30 px-2.5 shadow-xs">
                  <span className="truncate text-sm font-medium text-foreground">
                    {effectiveDatabase || "—"}
                  </span>
                </div>
              ) : (
                <Select
                  value={selectedDatabase || undefined}
                  onValueChange={(v) => setSelectedDatabase(v ?? "")}
                  disabled={!selectedConnection || loadingDatabases}
                >
                  <SelectTrigger
                    size="sm"
                    className={cn("w-full", !selectedDatabase && "text-muted-foreground")}
                  >
                    <SelectValue placeholder={loadingDatabases ? "Loading..." : "Select database..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {databases.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {sourceType === "database" && (
            <div className="grid w-full shrink-0 gap-1.5 sm:w-[min(100%,13rem)]">
              <label className="text-xs font-medium text-muted-foreground">Fetch type</label>
              {isSourceConfigLocked ? (
                <div className="flex h-8 w-full items-center rounded-md border border-input bg-muted/30 px-2.5 shadow-xs">
                  <span className="truncate text-sm font-medium capitalize text-foreground">
                    {fetchType === "query" ? "Query" : "Table"}
                  </span>
                </div>
              ) : (
                <Select
                  value={fetchType}
                  onValueChange={(v) => handleFetchTypeChange(v as AnalyticsStudioFetchType)}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="Select fetch type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table">Table</SelectItem>
                    <SelectItem value="query">Query</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {sourceType === "virtual_db" && (
            <div className="grid w-full shrink-0 gap-1.5 sm:w-[min(100%,14rem)]">
              <label className="text-xs font-medium text-muted-foreground">Virtual DB</label>
              {isSourceConfigLocked && selectedVirtualDbFlowId ? (
                <div className="flex h-8 w-full items-center rounded-md border border-input bg-muted/30 px-2.5 shadow-xs">
                  <span className="truncate text-sm font-medium text-foreground">
                    {virtualDbDisplayLabel}
                  </span>
                </div>
              ) : (
                <Select
                  value={selectedVirtualDbFlowId || undefined}
                  onValueChange={(v) => setSelectedVirtualDbFlowId(v ?? "")}
                  disabled={loadingVirtualDbs || !currentUser}
                >
                  <SelectTrigger
                    size="sm"
                    className={cn("w-full", !selectedVirtualDbFlowId && "text-muted-foreground")}
                  >
                    <SelectValue
                      placeholder={
                        loadingVirtualDbs
                          ? "Loading..."
                          : !currentUser
                            ? "Sign in to load..."
                            : virtualDbRows.length === 0
                              ? "No virtual databases"
                              : "Select deployment..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {virtualDbRows.map((row) => {
                      const label =
                        String(row.deployment_name ?? row.name ?? row.flow_id).trim() || row.flow_id;
                      return (
                        <SelectItem key={row.flow_id} value={row.flow_id}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            sourceType === "database" && effectiveDatabase && fetchType === "table" && "lg:flex-row",
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
            {loadingSchemas && fetchType === "table" && (
              <div className="flex items-center justify-start gap-2 py-12">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading schemas and tables...</span>
              </div>
            )}

            {!loadingSchemas && sourceType === "database" && !effectiveDatabase && (
              <div className="flex items-center justify-center gap-2 py-12">
                <Database className="size-5 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Select a connection and database to continue
                </p>
              </div>
            )}

            {!loadingSchemas &&
              sourceType === "database" &&
              effectiveDatabase &&
              fetchType === "query" && (
                <div className="mx-auto w-full max-w-3xl space-y-2">
                  <div>
                    <label htmlFor="analytics-studio-sql-query" className="text-sm font-semibold tracking-tight">
                      SQL Query
                    </label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Enter a SELECT query to fetch columns for chart creation.
                    </p>
                  </div>
                  <Textarea
                    id="analytics-studio-sql-query"
                    className="min-h-[180px] resize-y font-mono text-sm leading-relaxed"
                    placeholder="SELECT status, amount FROM vbak_data WHERE amount IS NOT NULL"
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    readOnly={isViewOnly}
                    disabled={isViewOnly}
                  />
                </div>
              )}

            {!loadingSchemas && effectiveDatabase && fetchType === "table" && Object.keys(schemaTree).length > 0 && (
              <div className="mb-3 w-full shrink-0 border-b border-border/60 pb-3">
                <div className="relative max-w-md">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 pl-8 text-sm"
                    placeholder="Filter schemas and tables..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            )}

            {!loadingSchemas &&
              effectiveDatabase &&
              fetchType === "table" &&
              Object.keys(filteredTree).length === 0 &&
              Object.keys(schemaTree).length > 0 && (
                <div className="flex flex-col items-start justify-start gap-1 py-8">
                  <p className="text-sm text-muted-foreground">
                    No schemas or tables match &quot;{searchQuery}&quot;
                  </p>
                </div>
              )}

            {!loadingSchemas &&
              effectiveDatabase &&
              fetchType === "table" &&
              Object.keys(schemaTree).length === 0 && (
              <div className="flex flex-col items-start justify-start gap-2 py-12">
                <Layers className="size-5 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No schemas found in this database</p>
              </div>
            )}

            {!loadingSchemas && fetchType === "table" && Object.keys(filteredTree).length > 0 && (
              <div className="min-h-0 flex-1 overflow-y-auto bg-background [scrollbar-gutter:stable]">
                <div className="w-full space-y-0.5 p-1">
                  {Object.entries(filteredTree).map(([schema, tables]) => {
                    const isExpanded = expandedSchemas.has(schema);
                    const fullySelected = isSchemaFullySelected(schema);
                    const partiallySelected = isSchemaPartiallySelected(schema);

                    return (
                      <div key={schema}>
                        <div
                          className={cn(
                            "group flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1.5",
                            "transition-colors hover:bg-muted/50",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSchema(schema)}
                            className="flex size-4 shrink-0 items-center justify-center"
                          >
                            {isExpanded ? (
                              <ChevronDown className="size-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-3.5 text-muted-foreground" />
                            )}
                          </button>

                          <Checkbox
                            checked={fullySelected ? true : partiallySelected ? "indeterminate" : false}
                            onCheckedChange={() => toggleSchemaSelection(schema)}
                            disabled={isViewOnly}
                            className="size-4 rounded-sm"
                          />

                          <button
                            type="button"
                            onClick={() => toggleSchema(schema)}
                            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                          >
                            <Layers className="size-3.5 shrink-0 text-primary/70" />
                            <span className="truncate text-sm font-medium">{schema}</span>
                            <span className="text-[11px] tabular-nums text-muted-foreground/60">
                              {tables.length} tables
                            </span>
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="ml-6 !max-h-[350px] overflow-y-auto border-l border-border/40 pl-3 [scrollbar-gutter:stable]">
                            {tables.map((table) => {
                              const checked = isTableSelected(schema, table);
                              return (
                                <label
                                  key={table}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1",
                                    "transition-colors hover:bg-muted/40",
                                    checked && "bg-primary/5",
                                  )}
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleTableSelection(schema, table)}
                                    disabled={isViewOnly}
                                    className="size-3.5 rounded-sm"
                                  />
                                  <Table2 className="size-3 shrink-0 text-muted-foreground/50" />
                                  <span className="truncate text-sm">{table}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div
              className={cn(
                "flex w-full shrink-0 justify-between",
                sourceType === "database" && effectiveDatabase && fetchType === "table"
                  ? "mx-0 max-w-2xl"
                  : "mx-auto max-w-2xl",
                sourceType === "virtual_db"
                  ? "mt-4"
                  : effectiveDatabase && fetchType === "table" && Object.keys(schemaTree).length > 0
                    ? "mt-4 border-t border-border/60 pt-3"
                    : "mt-4",
              )}
            >
              {/* <div className="relative w-full overflow-hidden rounded-2xl border border-border/70 bg-card ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
                <div className="p-2 sm:p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-2">
                    <div className="flex shrink-0 justify-center sm:pt-0.5">
                      <div className="flex size-7 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-inner ring-1 ring-primary/10">
                        <Sparkles className="size-5" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <label htmlFor="analytics-studio-context" className="text-sm font-semibold tracking-tight">
                          Context for AI
                        </label>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          Optional glossary, business rules, or how to interpret this data.
                        </p>
                      </div>
                      <Textarea
                        id="analytics-studio-context"
                        className="min-h-[55px] resize-y text-sm leading-relaxed shadow-none transition-[box-shadow] focus-visible:ring-2"
                        placeholder="e.g. Revenue is net of returns; join customers to orders on customer_id…"
                        value={contextText}
                        onChange={(e) => setContextText(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div> */}
            </div>
          </div>

          {sourceType === "database" && effectiveDatabase && fetchType === "table" && (
            <aside className="flex min-h-0 shrink-0 flex-col border-t bg-muted/15 lg:w-[min(100%,22rem)] lg:border-l lg:border-t-0">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-3.5">
                <div className="mb-2 flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Table2 className="size-3.5 shrink-0 text-primary" />
                  <span>Selected tables</span>
                  <span className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-foreground shadow-sm">
                    {selectedTableEntries.length}
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-background to-muted/25 p-3 shadow-sm ring-1 ring-primary/10">
                  {selectedTableEntries.length === 0 ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Use the list on the left to select tables. They appear here for review before you continue.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2 pr-0.5 [scrollbar-gutter:stable]">
                      {selectedTableEntries.map(({ schema, table }) => (
                        <span
                          key={`${schema}.${table}`}
                          className="inline-flex max-w-full items-center gap-1 rounded-lg border border-primary/25 bg-background/90 py-1 pl-3 pr-1 text-xs shadow-sm"
                        >
                          <span className="truncate font-mono text-[10px] text-muted-foreground">
                            {schema}
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="min-w-0 truncate text-[11px] font-medium text-foreground">
                            {table}
                          </span>
                          {!isViewOnly ? (
                          <button
                            type="button"
                            onClick={() => toggleTableSelection(schema, table)}
                            className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                            title={`Remove ${schema}.${table}`}
                            aria-label={`Remove table ${schema}.${table}`}
                          >
                            <X className="size-3.5" strokeWidth={2.5} />
                          </button>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {!isViewOnly ? (
      <div className="border-t bg-background">
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-2 sm:px-6",
            onEmbeddedBack ? "justify-between" : "justify-end",
          )}
        >
          {onEmbeddedBack ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleBack}
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
          ) : null}
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1.5 px-3 text-sm"
            disabled={!canProceed}
            onClick={handleContinue}
          >
            {isContinuing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {isContinuing ? "Loading..." : "Continue"}
          </Button>
        </div>
      </div>
      ) : null}
    </div>
  );
}
