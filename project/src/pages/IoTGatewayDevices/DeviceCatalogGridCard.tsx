import { useState } from "react";
import { CircuitBoard, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { DeviceCatalogEntry } from "./deviceCatalogEntries";

type DeviceCatalogGridCardProps = {
  entry: DeviceCatalogEntry;
  selected?: boolean;
  matched?: boolean;
  onOpen?: () => void;
};

export function DeviceCatalogGridCard({ entry, selected, matched, onOpen }: DeviceCatalogGridCardProps) {
  const [iconFailed, setIconFailed] = useState(false);

  return (
    <Card
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      className={cn(
        "flex h-full min-h-[10.5rem] flex-col gap-0 overflow-hidden rounded-lg border border-border bg-card py-0 shadow-sm transition-all",
        onOpen && "cursor-pointer hover:border-primary/40 hover:shadow-md",
        selected && "border-primary ring-2 ring-primary/25 shadow-md",
      )}
    >
      <CardContent className="flex flex-1 flex-col gap-2 px-3 pb-2 pt-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/50">
            {!iconFailed ? (
              <img
                src={entry.iconUrl}
                alt=""
                className="h-7 w-7 object-contain opacity-90 dark:invert-[0.88]"
                onError={() => setIconFailed(true)}
              />
            ) : (
              <CircuitBoard className="h-6 w-6 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{entry.name}</h3>
            {matched ? (
              <Badge
                variant="outline"
                className="mt-1 border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-medium text-emerald-700 dark:text-emerald-300"
              >
                On tenant
              </Badge>
            ) : null}
          </div>
        </div>
        <p className="line-clamp-3 min-h-[2.75rem] text-xs leading-relaxed text-muted-foreground">{entry.description}</p>
        <div className="flex flex-wrap gap-1">
          {entry.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="rounded-full px-1.5 py-0 text-[9px] font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="mt-auto border-t border-border/50 bg-muted/20 px-3 py-2">
        <div className="flex w-full items-center justify-between gap-1 text-[10px] text-muted-foreground">
          <span className="truncate">IoT Gateway</span>
          <span className="inline-flex shrink-0 items-center gap-0.5">
            <Star className="h-3 w-3" aria-hidden />
            Favorite
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
