import { ScrollArea } from "@/components/ui/scroll-area";

import { DeviceCatalogGridCard } from "./DeviceCatalogGridCard";
import type { DeviceCatalogEntry } from "./deviceCatalogEntries";

type DeviceCatalogGridViewProps = {
  entries: DeviceCatalogEntry[];
  tenantDeviceIds: Set<string>;
  onSelectEntry: (entry: DeviceCatalogEntry) => void;
};

export function DeviceCatalogGridView({ entries, tenantDeviceIds, onSelectEntry }: DeviceCatalogGridViewProps) {
  if (entries.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">No device types match your search.</p>
    );
  }

  return (
    <section className="border-b border-border/60 bg-muted/10" aria-label="Device types">
      <ScrollArea className="h-[min(58rem,85vh)] w-full">
        <div className="grid grid-cols-5 gap-3 p-3">
          {entries.map((entry) => (
            <div key={entry.id} className="min-w-0">
              <DeviceCatalogGridCard
                entry={entry}
                matched={tenantDeviceIds.has(entry.id)}
                onOpen={() => onSelectEntry(entry)}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}
