import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ConnectorIcon } from "@/pages/CredVaultPage/ConnectorIcon";
import { getNodesList } from "@/controllers/API/datasetApi";
import { Node, NodeList } from "@/types/dataset";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";

type DatabaseNode = Node & { enabled?: boolean };

const HIDDEN_DATABASE_NODE_IDS = new Set([
  "sap",
  "s4hana",
  "snowflake",
  "dynamodb",
]);

function isHiddenDatabaseNode(node: DatabaseNode): boolean {
  const keys = [node.node_id, node.name, node.icon].map((v) => v?.toLowerCase().trim());
  return keys.some((key) => key && HIDDEN_DATABASE_NODE_IDS.has(key));
}

const ConnectorCardSkeleton = () => (
  <Card className="grid h-full w-full grid-rows-[auto_1fr_auto] gap-y-2 overflow-hidden rounded-lg border border-border bg-card py-0 shadow-sm">
    <CardContent className="row-start-1 flex flex-col gap-1 px-3 pb-0 pt-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
        <div className="flex min-h-11 min-w-0 flex-1 items-center">
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </CardContent>
    <CardFooter className="row-start-3 border-t border-border/50 bg-muted/20 px-3 py-1.5 [.border-t]:pt-1.5">
      <Skeleton className="h-3 w-24" />
    </CardFooter>
  </Card>
);

interface DatabaseSourcesPanelProps {
  onBack: () => void;
  embedded?: boolean;
  onNodeSelect?: (node: DatabaseNode) => void;
}

const DatabaseSourcesPanel = ({ onBack, embedded = false, onNodeSelect }: DatabaseSourcesPanelProps) => {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<NodeList>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNodesList({ group: ["Databases"] })
      .then(setNodes)
      .catch((err) => setError(getDisplayErrorMessage(err, "Failed to load databases")))
      .finally(() => setIsLoading(false));
  }, []);

  const groupedNodes = useMemo(() => {
    return Object.entries(nodes).reduce((acc, [group, nodeList]) => {
      const enabled = (nodeList as DatabaseNode[])
        .filter((node) => node.enabled !== false)
        .filter((node) => !isHiddenDatabaseNode(node));
      if (enabled.length > 0) {
        acc[group] = enabled;
      }
      return acc;
    }, {} as Record<string, DatabaseNode[]>);
  }, [nodes]);

  const handleNodeSelect = (node: DatabaseNode) => {
    if (onNodeSelect) {
      onNodeSelect(node);
      return;
    }
    navigate(`/analytic-studio/${node.node_id}`, {
      state: {
        displayName: node.display_name,
        icon: node.icon,
        name: node.name,
      },
    });
  };

  const renderNodeCard = (node: DatabaseNode) => (
    <Card
      key={node.node_id}
      role="button"
      tabIndex={0}
      onClick={() => handleNodeSelect(node)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleNodeSelect(node);
        }
      }}
      className={cn(
        "grid h-full w-full grid-rows-[auto_1fr_auto] gap-y-2 overflow-hidden rounded-lg border border-border bg-card py-0 shadow-sm transition-all",
        "cursor-pointer hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
      )}
    >
      <CardContent className="row-start-1 flex flex-col gap-1 px-3 pb-0 pt-3">
        <div className="flex items-center gap-2.5">
          <ConnectorIcon icon={node.icon} size="md" />
          <div className="flex min-h-11 min-w-0 flex-1 items-center">
            <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
              {node.display_name}
            </h3>
          </div>
        </div>
        <p className="line-clamp-4 text-xs leading-snug text-muted-foreground">
          {node.description}
        </p>
      </CardContent>
      <CardFooter className="row-start-3 border-t border-border/50 bg-muted/20 px-3 py-1.5 [.border-t]:pt-1.5">
        <span className="truncate text-[10px] text-muted-foreground">
          {node.group || "Databases"}
        </span>
      </CardFooter>
    </Card>
  );

  const renderNodeGroup = (title: string, nodeList: DatabaseNode[]) => (
    <div key={title} className="mb-4 px-3">
      <div className="mb-3 flex items-center">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {title}
        </h2>
        <div className="ml-3 h-px flex-1 bg-border" />
        <Badge variant="secondary" className="ml-3 shrink-0 px-2 py-0 text-[10px] font-normal tabular-nums">
          {nodeList.length} connector{nodeList.length !== 1 ? "s" : ""}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {nodeList.map((node) => (
          <div key={node.node_id} className="flex h-full min-w-0">
            {renderNodeCard(node)}
          </div>
        ))}
      </div>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="min-h-0 bg-background p-3 text-foreground">
          <div className="mb-4">
            <div className="mb-3 flex items-center px-3">
              <Skeleton className="h-4 w-40" />
              <div className="ml-3 h-px flex-1 bg-border" />
              <Skeleton className="ml-3 h-5 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3 px-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <ConnectorCardSkeleton key={index} />
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center bg-background p-8 text-foreground">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15 ring-1 ring-destructive/25">
              <svg className="h-8 w-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">Error loading databases</h3>
            <p className="mb-4 text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    if (Object.keys(groupedNodes).length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted ring-1 ring-border">
              <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">No databases available</h3>
            <p className="text-sm text-muted-foreground">Check back later for available data sources</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-0 bg-background py-3 text-foreground">
        <div className="mx-auto h-full overflow-auto">
          {Object.entries(groupedNodes).map(([groupName, nodeList]) =>
            renderNodeGroup(groupName, nodeList),
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!embedded ? (
        <div className="border-b border-border px-4 py-2">
          <Button variant="ghost" size="sm" className="!h-8 gap-1.5 px-2" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back to lists
          </Button>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a database to start your analytics workflow
          </p>
        </div>
      ) : (
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Analytical data set</p>
          <p className="text-xs text-muted-foreground">
            Select a database connector to configure your chart source
          </p>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">{renderContent()}</div>
    </div>
  );
};

export default DatabaseSourcesPanel;
