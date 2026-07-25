import React, { useState, useEffect, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Loader2,
  Plus,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MultiSelectCombobox } from "@/components/ui/multi-select";
import { AlternativeSelect } from "@/components/ui/alternative-select";
import { lazyIconsMapping } from "@/icons/lazyIconImports";
import {
  fetchPostgresqlConnectionsForForms,
  postPostgresqlAction,
} from "@/controllers/API/databaseActionsApi";
import { fetchConnectionById } from "@/controllers/API/connectionVaultApi";
import { setTenantScope } from "@/controllers/API/agenticApi";
import { useSemanticsStore, SourceRow } from "@/stores/semanticsStore";
import {
  fetchTenantScope,
  fetchTenantDomain,
  postOnboardScanConnectionAsync,
  type TenantScopeResponse,
} from "@/controllers/API/semanticsApi";
import { FormFieldOption } from "@/types/form";
import { toast } from "sonner";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

// --- Response normalizer ---

function normalizeOptions(responseData: any): FormFieldOption[] {
  const arr = responseData?.data ?? responseData;
  if (!Array.isArray(arr)) return [];
  if (arr.length === 0) return [];
  if (typeof arr[0] === "object" && "label" in arr[0]) {
    return arr.map((item: any) => ({
      label: String(item.label),
      value: String(item.value),
    }));
  }
  return arr.map((item: any) => ({ label: String(item), value: String(item) }));
}

// --- Icon helper ---

function ConnectionIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const [IconComp, setIconComp] = useState<React.LazyExoticComponent<
    React.ComponentType<any>
  > | null>(null);

  useEffect(() => {
    const loader = lazyIconsMapping[type as keyof typeof lazyIconsMapping];
    if (loader) {
      setIconComp(
        lazy(loader as () => Promise<{ default: React.ComponentType<any> }>),
      );
    }
  }, [type]);

  if (!IconComp) {
    return <div className={cn("w-6 h-6 rounded bg-slate-200", className)} />;
  }

  return (
    <Suspense
      fallback={
        <div
          className={cn(
            "w-6 h-6 rounded bg-slate-200 animate-pulse",
            className,
          )}
        />
      }
    >
      <IconComp className={cn("w-6 h-6", className)} />
    </Suspense>
  );
}

// --- Custom Select with Icon (for Connection) ---

interface IconSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; icon?: string }[];
  placeholder?: string;
  disabled?: boolean;
  showIcon?: boolean;
  loading?: boolean;
}

function IconSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  showIcon = false,
  loading = false,
}: IconSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="space-y-1.5 min-w-0">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => !disabled && !loading && setOpen(!open)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors",
            disabled || loading
              ? "opacity-50 cursor-not-allowed bg-slate-50"
              : "hover:border-primary/50 cursor-pointer",
            open ? "border-primary ring-2 ring-primary/20" : "border-input",
          )}
        >
          {showIcon && selected?.icon && (
            <ConnectionIcon type={selected.icon} className="w-6 h-6 shrink-0" />
          )}
          {loading ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </span>
          ) : (
            <span
              className={cn(
                "flex-1 text-sm truncate",
                !value && "text-muted-foreground",
              )}
            >
              {selected?.label || placeholder}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform shrink-0",
              open && "rotate-180",
            )}
          />
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setOpen(false)}
            />
            <div className="absolute top-full left-0 z-[9999] w-full mt-1 rounded-lg bg-popover border shadow-lg max-h-[240px] overflow-y-auto">
              {options.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  No options available
                </div>
              ) : (
                options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-accent",
                      opt.value === value && "bg-accent/50",
                    )}
                  >
                    {showIcon && opt.icon && (
                      <ConnectionIcon
                        type={opt.icon}
                        className="w-5 h-5 shrink-0"
                      />
                    )}
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.value === value && (
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Source Row Component ---

interface SourceRowComponentProps {
  row: SourceRow;
  onUpdate: (updates: Partial<SourceRow>) => void;
  configScopeData?: TenantScopeResponse | null;
}

function SourceRowComponent({ row, onUpdate, configScopeData }: SourceRowComponentProps) {
  const [connections, setConnections] = useState<FormFieldOption[]>([]);
  const [databases, setDatabases] = useState<FormFieldOption[]>([]);
  const [schemas, setSchemas] = useState<FormFieldOption[]>([]);
  const [tables, setTables] = useState<FormFieldOption[]>([]);

  const [loadingConnections, setLoadingConnections] = useState(false);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);

  // Fetch connections on mount
  useEffect(() => {
    const fetchConnections = async () => {
      setLoadingConnections(true);
      try {
        const result = await fetchPostgresqlConnectionsForForms(
          '["id as value", "name as label"]',
        );
        setConnections(normalizeOptions(result));
      } catch (err) {
        console.error("Failed to fetch connections:", err);
        setConnections([]);
      } finally {
        setLoadingConnections(false);
      }
    };
    fetchConnections();
  }, []);

  // In config view, resolve connectionName once connections list is loaded
  useEffect(() => {
    if (!configScopeData || connections.length === 0 || !row.connectionId) return;
    const match = connections.find((c) => String(c.value) === row.connectionId);
    if (match && row.connectionName !== String(match.label)) {
      onUpdate({ connectionName: String(match.label) });
    }
  }, [connections, configScopeData, row.connectionId]);

  // Fetch databases when connection changes
  useEffect(() => {
    setDatabases([]);
    setSchemas([]);
    setTables([]);
    if (!row.connectionId) return;

    const fetchDatabases = async () => {
      setLoadingDatabases(true);
      try {
        const result = await postPostgresqlAction(
          {
            actions: "get_databases",
            connection: row.connectionId,
          },
          "Failed to load databases",
        );
        setDatabases(normalizeOptions(result));
      } catch (err) {
        console.error("Failed to fetch databases:", err);
        setDatabases([]);
      } finally {
        setLoadingDatabases(false);
      }
    };
    fetchDatabases();
  }, [row.connectionId]);

  // Fetch schemas when database changes
  useEffect(() => {
    setSchemas([]);
    setTables([]);
    if (!row.database || !row.connectionId) return;

    const fetchSchemas = async () => {
      setLoadingSchemas(true);
      try {
        const result = await postPostgresqlAction(
          {
            data: { database: row.database },
            actions: "get_schemas",
            connection: row.connectionId,
          },
          "Failed to load schemas",
        );
        setSchemas(normalizeOptions(result));
      } catch (err) {
        console.error("Failed to fetch schemas:", err);
        setSchemas([]);
      } finally {
        setLoadingSchemas(false);
      }
    };
    fetchSchemas();
  }, [row.database, row.connectionId]);

  // Fetch tables when schema changes
  useEffect(() => {
    setTables([]);
    if (!row.schema || !row.database || !row.connectionId) return;

    const fetchTables = async () => {
      setLoadingTables(true);
      try {
        const result = await postPostgresqlAction(
          {
            data: { schema: row.schema, database: row.database },
            actions: "get_tables",
            connection: row.connectionId,
          },
          "Failed to load tables",
        );
        setTables(normalizeOptions(result));
      } catch (err) {
        console.error("Failed to fetch tables:", err);
        setTables([]);
      } finally {
        setLoadingTables(false);
      }
    };
    fetchTables();
  }, [row.schema, row.database, row.connectionId]);

  const connectionOptions = connections.map((c) => ({
    value: String(c.value),
    label: String(c.label),
    icon: "postgresql",
  }));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <IconSelect
        label="Connection Source"
        value={row.connectionId}
        onChange={(val) => {
          const opt = connectionOptions.find((o) => o.value === val);
          onUpdate({ connectionId: val, connectionName: opt?.label || val });
        }}
        options={connectionOptions}
        placeholder="Select a connection..."
        showIcon
        loading={loadingConnections}
      />

      <div className="space-y-1.5 min-w-0">
        <label className="text-sm font-semibold text-foreground">
          Database
        </label>
        <AlternativeSelect
          options={databases}
          value={row.database || undefined}
          onChange={(val) => onUpdate({ database: String(val) })}
          placeholder="Select database..."
          isLoading={loadingDatabases}
          disabled={!row.connectionId}
        />
      </div>

      <div className="space-y-1.5 min-w-0">
        <label className="text-sm font-semibold text-foreground">Schema</label>
        <AlternativeSelect
          options={schemas}
          value={row.schema || undefined}
          onChange={(val) => onUpdate({ schema: String(val) })}
          placeholder="Select schema..."
          isLoading={loadingSchemas}
          disabled={!row.database}
        />
      </div>

      <div className="space-y-1.5 min-w-0">
        <label className="text-sm font-semibold text-foreground">
          Select Tables
        </label>
        {loadingTables ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-slate-50 text-sm text-muted-foreground opacity-50">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <MultiSelectCombobox
            options={tables}
            value={row.selectedTables}
            onChange={(val) => onUpdate({ selectedTables: val })}
            placeholder="Select tables..."
            searchPlaceholder="Filter tables..."
            emptyText={
              !row.schema ? "Select a schema first" : "No tables found."
            }
            disabled={!row.schema}
          />
        )}
      </div>
    </div>
  );
}

// --- Main Component ---

export default function SchemaScanStep({ onNext }: { onNext?: () => void }) {
  const {
    sourceRows,
    addSourceRow,
    removeSourceRow,
    updateSourceRow,
    setSourceRows,
    setScanResult,
    isScanLoading,
    setIsScanLoading,
    tenantId,
    addPendingJob,
    isConfigView,
  } = useSemanticsStore();

  const [scanError, setScanError] = useState<string | null>(null);
  const [configScopeData, setConfigScopeData] = useState<TenantScopeResponse | null>(null);
  const [domainId, setDomainId] = useState<string>('');

  // Fetch tenant domain on mount
  useEffect(() => {
    const loadDomain = async () => {
      try {
        const domainRes = await fetchTenantDomain(tenantId);
        if (domainRes?.domain_id) {
          setDomainId(domainRes.domain_id);
        }
      } catch {
        // Domain not set yet - that's OK for new tenants
      }
    };
    loadDomain();
  }, [tenantId]);

  // In config view, fetch existing scope and store it
  useEffect(() => {
    if (!isConfigView) return;
    const loadScope = async () => {
      try {
        const data = await fetchTenantScope(tenantId);
        if (data) {
          setConfigScopeData(data);
          // Use setSourceRows to bypass cascading-reset logic in updateSourceRow
          if (sourceRows.length > 0) {
            const row = sourceRows[0];
            setSourceRows([{
              ...row,
              connectionId: data.connection_id,
              connectionName: data.connection_id,
              database: data.database,
              schema: data.schema,
              selectedTables: data.tables ?? [],
            }]);
          }
        }
      } catch {
        // No scope registered yet — keep form empty
      }
    };
    loadScope();
  }, [isConfigView, tenantId]);

  const allRowsComplete = sourceRows.every(
    (r) =>
      r.connectionId && r.database && r.schema && r.selectedTables.length > 0,
  );

  const handleProceed = async () => {
    // In config view, skip POST operations - just navigate to next step
    if (isConfigView) {
      if (onNext) onNext();
      return;
    }

    setIsScanLoading(true);
    setScanError(null);
    try {
      // 1. Collect unique connection IDs
      const uniqueConnIds = [...new Set(sourceRows.map((r) => r.connectionId))];

      // 2. Fetch connection details in parallel
      const connDetailsMap: Record<string, any> = {};
      await Promise.all(
        uniqueConnIds.map(async (connId) => {
          const result = await fetchConnectionById("databases", connId);
          if (result?.status && Array.isArray(result.data) && result.data.length > 0) {
            connDetailsMap[connId] = result.data[0];
          }
        }),
      );

      // 3. Group source rows by connectionId → database → schema
      const connectionGroups: Record<string, SourceRow[]> = {};
      for (const row of sourceRows) {
        if (!connectionGroups[row.connectionId]) {
          connectionGroups[row.connectionId] = [];
        }
        connectionGroups[row.connectionId].push(row);
      }

      const connections = Object.entries(connectionGroups).map(
        ([connId, rows]) => {
          const details = connDetailsMap[connId];
          if (!details)
            throw new Error(`Connection details not found for ${connId}`);

          // Group rows by database, then by schema
          const dbMap: Record<string, Record<string, Set<string>>> = {};
          for (const row of rows) {
            if (!dbMap[row.database]) dbMap[row.database] = {};
            if (!dbMap[row.database][row.schema])
              dbMap[row.database][row.schema] = new Set();
            row.selectedTables.forEach((t) =>
              dbMap[row.database][row.schema].add(String(t)),
            );
          }

          return {
            connection_id: connId,
            db_type: details.connection_type ?? "postgres",
            host: details.host,
            port: details.port ? Number(details.port) : 5432,
            user: details.user_name,
            password: details.password,
            sample_rows: 100,
            databases: Object.entries(dbMap).map(([dbName, schemasMap]) => ({
              name: dbName,
              schemas: Object.entries(schemasMap).map(
                ([schemaName, tablesSet]) => ({
                  name: schemaName,
                  tables: [...tablesSet],
                  limit: 20,
                }),
              ),
            })),
          };
        },
      );

      const payload = {
        tenant_id: tenantId,
        connections,
      };

      const scanRes = await postOnboardScanConnectionAsync(payload);

      // 202 = async job accepted; 200 = sync result (backward compat)
      if (scanRes.httpStatus === 202 && scanRes.data?.job_id) {
        addPendingJob("scan_connection", String(scanRes.data.job_id), "scan_connection");
      } else {
        setScanResult(scanRes.data);
      }

      // 5. Register tenant scope for each unique connection+database+schema
      const scopeMap = new Map<
        string,
        {
          connectionId: string;
          database: string;
          schema: string;
          tables: Set<string>;
        }
      >();

      for (const row of sourceRows) {
        const key = `${row.connectionId}|${row.database}|${row.schema}`;
        if (!scopeMap.has(key)) {
          scopeMap.set(key, {
            connectionId: row.connectionId,
            database: row.database,
            schema: row.schema,
            tables: new Set<string>(),
          });
        }
        const entry = scopeMap.get(key)!;
        row.selectedTables.forEach((t) => entry.tables.add(String(t)));
      }

      await Promise.all(
        Array.from(scopeMap.values()).map((scope) =>
          setTenantScope({
            tenant_id: tenantId,
            domain_id: "",
            connection_id: scope.connectionId,
            database: scope.database,
            schema: scope.schema,
            tables: [...scope.tables],
          }),
        ),
      );

      // 6. Navigate to next step
      if (onNext) onNext();
    } catch (err: unknown) {
      console.error("Scan failed:", err);
      const message = getDisplayErrorMessage(err, "Scan failed.");
      setScanError(message);
      toast.error(message);
      // Proceed even on error (e.g. 500)
      if (onNext) onNext();
    } finally {
      setIsScanLoading(false);
    }
  };

  return (
    <div className="w-full px-4 py-2">
      {/* Header */}
      <div className="text-center mb-2">
        <h1 className="text-[16px] font-bold text-foreground">Select Schema</h1>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Select the data source and tables you want Datafusion to analyze.
          We'll automatically detect entities, relationships, and suggest
          metrics.
        </p>
      </div>

      {/* Source Rows */}
      <div className="space-y-2">
        {sourceRows.map((row) => (
          <div
            key={row.id}
            className="rounded-xl border border-dashed border-slate-300 p-3"
          >
            {sourceRows.length > 1 && (
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={addSourceRow}
                  className="flex items-center justify-center h-3 w-3 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  aria-label="Add source"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeSourceRow(row.id)}
                  className="flex items-center justify-center h-3 w-3 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Remove source"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <SourceRowComponent
              row={row}
              onUpdate={(updates) => updateSourceRow(row.id, updates)}
              configScopeData={configScopeData}
            />
          </div>
        ))}
      </div>

      {/* Add Source Button (only when single row) */}
      {/* {sourceRows.length <= 1 && (
        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addSourceRow}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Source
          </Button>
        </div>
      )} */}

      {/* Error display */}
      {scanError && (
        <div className="mt-2 text-sm text-destructive">{scanError}</div>
      )}

      {/* Action: Run Schema Scan */}
      <div className="mt-3 flex justify-end">
        <Button
          variant="default"
          onClick={handleProceed}
          disabled={!allRowsComplete || isScanLoading}
          className="disabled:cursor-not-allowed !h-8"
        >
          {isScanLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Scanning...
            </>
          ) : (
            "Proceed Context"
          )}
        </Button>
      </div>

      {/* Info Card */}
      <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">
            What will happen next?
          </h3>
        </div>
        <div className="space-y-1.5">
          {[
            "Scan the selected database schema for structure and metadata.",
            "Automatically detect primary keys, foreign keys, and temporal columns.",
            "Map columns to industry-standard semantic types for AI analysis.",
          ].map((text, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span className="text-xs">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
