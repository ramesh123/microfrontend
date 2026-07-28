import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchConnectionVaultConnectors } from "@/controllers/API/connectionVaultApi";
import { getDisplayErrorMessage, resolveApiErrorMessage } from "@/utils/exceptionHelper";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { ConnectorIcon } from "../ConnectorIcon";

interface Connector {
  name: string;
  icon: string;
  description: string;
  display_name?: string;
  group?: string;
  enabled?: boolean;
  id: string;
}

interface ApiConnector {
  id: number;
  form_type: string;
  name: string;
  display_name: string;
  form_id: string;
  module: string;
  group: string;
  icon: string;
  description: string;
  enabled: boolean;
}

interface ConnectorCardsGridProps {
  onConnectorSelect: (connector: Connector) => void;
  searchQuery?: string;
}

const ConnectorCardsGrid: React.FC<ConnectorCardsGridProps> = ({
  onConnectorSelect,
  searchQuery = "",
}) => {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConnectors = async () => {
      try {
        setLoading(true);
        setError(null);

        const result = await fetchConnectionVaultConnectors();

        if (!result) {
          throw new Error('Failed to fetch connectors');
        }

        if (result.status && result.data) {
          const transformedConnectors: Connector[] = (result.data as ApiConnector[])
            .filter(item => item.enabled)
            .map(item => ({
              id: item.form_id,
              name: item.display_name,
              icon: item.icon,
              description: item.description,
              display_name: item.display_name,
              group: item.group,
              enabled: item.enabled
            }));

          setConnectors(transformedConnectors);
        } else {
          throw new Error(resolveApiErrorMessage(result, 'Failed to fetch connectors'));
        }
      } catch (err) {
        console.error('Error fetching connectors:', err);
        setError(getDisplayErrorMessage(err, 'An error occurred'));
      } finally {
        setLoading(false);
      }
    };

    fetchConnectors();
  }, []);

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

  const filteredConnectors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return connectors;

    return connectors.filter((connector) => {
      const haystack = [
        connector.name,
        connector.display_name,
        connector.description,
        connector.group,
        connector.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [connectors, searchQuery]);

  const groupedConnectors = filteredConnectors.reduce((acc, connector) => {
    const group = connector.group || 'Other';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(connector);
    return acc;
  }, {} as Record<string, Connector[]>);

  const renderConnectorCard = (connector: Connector) => (
    <Card
      key={connector.id}
      role="button"
      tabIndex={0}
      onClick={() => onConnectorSelect(connector)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onConnectorSelect(connector);
        }
      }}
      className={cn(
        "grid h-full w-full grid-rows-[auto_1fr_auto] gap-y-2 overflow-hidden rounded-lg border border-border bg-card py-0 shadow-sm transition-all",
        "cursor-pointer hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
      )}
    >
      <CardContent className="row-start-1 flex flex-col gap-1 px-3 pb-0 pt-3">
        <div className="flex items-center gap-2.5">
          <ConnectorIcon icon={connector.icon} size="md" />
          <div className="flex min-h-11 min-w-0 flex-1 items-center">
            <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
              {connector.name}
            </h3>
          </div>
        </div>
        <p className="line-clamp-4 text-xs leading-snug text-muted-foreground">
          {connector.description}
        </p>
      </CardContent>
      <CardFooter className="row-start-3 border-t border-border/50 bg-muted/20 px-3 py-1.5 [.border-t]:pt-1.5">
        <span className="truncate text-[10px] text-muted-foreground">
          {connector.group || "Connection Vault"}
        </span>
      </CardFooter>
    </Card>
  );

  const renderConnectorGroup = (title: string, connectorsToRender: Connector[]) => (
    <div key={title} className="mb-4 px-3">
      <div className="mb-3 flex items-center">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {title}
        </h2>
        <div className="ml-3 h-px flex-1 bg-border" />
        <Badge variant="secondary" className="ml-3 shrink-0 px-2 py-0 text-[10px] font-normal tabular-nums">
          {connectorsToRender.length} connector{connectorsToRender.length !== 1 ? "s" : ""}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {connectorsToRender.map((connector) => (
          <div key={connector.id} className="flex min-w-0 h-full">
            {renderConnectorCard(connector)}
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-0 bg-background p-3 text-foreground">
        {Array.from({ length: 3 }).map((_, sectionIndex) => (
          <div key={sectionIndex} className="mb-4">
            <div className="mb-3 flex items-center px-3">
              <Skeleton className="h-4 w-40" />
              <div className="ml-3 h-px flex-1 bg-border" />
              <Skeleton className="ml-3 h-5 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3 px-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <ConnectorCardSkeleton key={index} />
              ))}
            </div>
          </div>
        ))}
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
          <h3 className="mb-2 text-lg font-semibold text-foreground">Error loading connectors</h3>
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

  return (
    <div className="min-h-0 bg-background py-3 text-foreground">
      <div className="mx-auto h-full overflow-auto">
        {Object.entries(groupedConnectors).map(([groupName, groupConnectors]) =>
          renderConnectorGroup(groupName, groupConnectors)
        )}

        {Object.keys(groupedConnectors).length === 0 && connectors.length > 0 && searchQuery.trim() && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted ring-1 ring-border">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">No connectors found</h3>
              <p className="text-sm text-muted-foreground">
                No results for &quot;{searchQuery.trim()}&quot;. Try a different search term.
              </p>
            </div>
          </div>
        )}

        {Object.keys(groupedConnectors).length === 0 && connectors.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted ring-1 ring-border">
                <svg className="h-8 w-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">No connectors available</h3>
              <p className="text-sm text-muted-foreground">Check back later for available data sources</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectorCardsGrid;
