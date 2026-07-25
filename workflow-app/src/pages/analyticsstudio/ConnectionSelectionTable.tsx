import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ConnectorIcon } from "@/pages/CredVaultPage/ConnectorIcon";
import { Check, Database, Inbox, Layers, Server } from "lucide-react";

export interface AnalyticsStudioConnection {
  id: string;
  name: string;
  connection_type: string;
  host?: string;
  port?: string | number;
  user_name?: string;
  username?: string;
  database_name?: string;
  database?: string;
  group_type?: string;
  api_endpoint?: string;
  auth_type?: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface ConnectionSelectionTableProps {
  connections: {
    databases: AnalyticsStudioConnection[];
    storage: AnalyticsStudioConnection[];
    notifications: AnalyticsStudioConnection[];
    ingestion: AnalyticsStudioConnection[];
  };
  selectedConnectionId?: string | null;
  onSelectionChange: (connection: AnalyticsStudioConnection) => void;
  selectionDisabled?: boolean;
}

const SECTION_META = {
  databases: { label: "Databases", icon: Database },
  storage: { label: "Storage", icon: Server },
  notifications: { label: "Notifications", icon: Inbox },
  ingestion: { label: "Ingestion", icon: Layers },
} as const;

function formatConnectionTypeLabel(connectionType: string): string {
  return connectionType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatUpdatedAt(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "N/A";
  }
}

function ConnectionCard({
  connection,
  isSelected,
  onSelect,
  selectionDisabled = false,
}: {
  connection: AnalyticsStudioConnection;
  isSelected: boolean;
  onSelect: () => void;
  selectionDisabled?: boolean;
}) {
  const displayName = connection.name?.trim() || "Unnamed";
  const connectionType = String(connection.connection_type ?? "").trim();
  const isActive = connection.is_active !== false;

  return (
    <button
      type="button"
      onClick={selectionDisabled ? undefined : onSelect}
      disabled={selectionDisabled && !isSelected}
      title={displayName}
      className={cn(
        "group relative w-full rounded-lg border px-2.5 py-2.5 text-left transition-all shadow-sm",
        selectionDisabled
          ? "cursor-default"
          : "hover:border-primary/45 hover:bg-background hover:shadow-md",
        isSelected
          ? "border-primary bg-background shadow-md ring-1 ring-primary/25"
          : "border-border/60 bg-background",
        selectionDisabled && !isSelected && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <div
          // className={cn(
          //   "flex size-8 shrink-0 items-center justify-center rounded-md ring-1",
          //   isSelected
          //     ? "bg-primary/10 text-primary ring-primary/20"
          //     : "bg-muted/50 text-muted-foreground ring-border/40",
          // )}
        >
          {connectionType ? (
            <ConnectorIcon
              icon={connectionType}
              size="sm"
              className="!h-5 !w-5 [&_svg]:!h-4 [&_svg]:!w-4"
            />
          ) : (
            <Database className="size-4" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <p className="truncate text-sm font-semibold leading-5 text-foreground">
              {displayName}
            </p>
            {isSelected ? (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" strokeWidth={3} />
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">
            {connectionType ? formatConnectionTypeLabel(connectionType) : "Unknown"}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1 border-t border-border/40 pt-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              isActive ? "bg-emerald-500" : "bg-slate-400",
            )}
          />
          <span className={isActive ? "text-emerald-700" : "text-slate-600"}>
            {isActive ? "Active" : "Inactive"}
          </span>
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {formatUpdatedAt(connection.updated_at)}
        </span>
      </div>
    </button>
  );
}

function ConnectionGrid({
  connectionsList,
  selectedConnectionId,
  onSelectionChange,
  selectionDisabled = false,
}: {
  connectionsList: AnalyticsStudioConnection[];
  selectedConnectionId?: string | null;
  onSelectionChange: (connection: AnalyticsStudioConnection) => void;
  selectionDisabled?: boolean;
}) {
  if (!connectionsList?.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-background px-4 py-6 text-center shadow-sm">
        <p className="text-xs font-medium text-foreground">No connections found</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Nothing is available in this category yet.
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-[min(420px,50vh)] overflow-y-auto rounded-lg bg-muted/100 p-2.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5">
        {connectionsList.map((connection) => {
          const isSelected =
            selectedConnectionId != null && String(connection.id) === String(selectedConnectionId);

          return (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              isSelected={isSelected}
              selectionDisabled={selectionDisabled}
              onSelect={() => onSelectionChange(connection)}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function ConnectionSelectionTable({
  connections,
  selectedConnectionId = null,
  onSelectionChange,
  selectionDisabled = false,
}: ConnectionSelectionTableProps) {
  const sections = [
    { key: "databases" as const, list: connections.databases ?? [] },
    { key: "storage" as const, list: connections.storage ?? [] },
    { key: "notifications" as const, list: connections.notifications ?? [] },
    { key: "ingestion" as const, list: connections.ingestion ?? [] },
  ];

  const defaultOpen = sections.find((section) => section.list.length > 0)?.key ?? "databases";

  return (
    <div className="w-full">
      <Accordion type="single" collapsible className="w-full space-y-1.5" defaultValue={defaultOpen}>
        {sections.map(({ key, list }) => {
          const meta = SECTION_META[key];
          const Icon = meta.icon;

          return (
            <AccordionItem
              key={key}
              value={key}
              className="overflow-hidden rounded-lg border border-border/60 bg-background px-0.5"
            >
              <AccordionTrigger className="px-2.5 py-2 hover:no-underline">
                <div className="flex w-full items-center gap-2 pr-1">
                  <div className="flex size-6 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border/50">
                    <Icon className="size-3" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-tight text-foreground">{meta.label}</span>
                  <Badge
                    variant="secondary"
                    className="ml-auto h-5 rounded-full px-2 text-[11px] font-semibold"
                  >
                    {list.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-2 pt-0">
                <ConnectionGrid
                  connectionsList={list}
                  selectedConnectionId={selectedConnectionId}
                  onSelectionChange={onSelectionChange}
                  selectionDisabled={selectionDisabled}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
