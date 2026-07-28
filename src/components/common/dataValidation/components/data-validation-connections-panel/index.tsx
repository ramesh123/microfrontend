import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Link2, Trash2 } from "lucide-react"
import type { ColumnMapping, KeyValidationPair } from "@/types/dataValidation"
import { cn } from "@/lib/utils"

export type DataValidationPanelTab = "column-mapping" | "key-validation"

interface DataValidationConnectionsPanelProps {
  activeTab: DataValidationPanelTab
  mappings: ColumnMapping[]
  keyValidationPairs: KeyValidationPair[]
  onRemoveMapping: (mappingId: string) => void
  onRemovePair: (pairId: string) => void
  readOnly?: boolean
  className?: string
}

export function DataValidationConnectionsPanel({
  activeTab,
  mappings,
  keyValidationPairs,
  onRemoveMapping,
  onRemovePair,
  readOnly = false,
  className,
}: DataValidationConnectionsPanelProps) {
  const columnEmpty = activeTab === "column-mapping" && mappings.length === 0
  const keyEmpty = activeTab === "key-validation" && keyValidationPairs.length === 0
  const showEmpty = columnEmpty || keyEmpty

  const emptyHint =
    activeTab === "column-mapping"
      ? "Draw lines between columns in the diagram to create mappings."
      : "Pair key columns with validation columns in the editor. Pairs will appear here."

  return (
    <Card
      className={cn(
        "flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card p-0 shadow-sm",
        className,
      )}
    >
      <CardHeader className="shrink-0 rounded-t-xl border-b border-border bg-muted/20 px-3 py-2.5">
        <CardTitle className="text-sm font-semibold leading-tight">Connections & Rules</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-2 pt-2">
        {showEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-8 text-center text-muted-foreground">
            <Link2 className="h-8 w-8 opacity-70" aria-hidden />
            <p className="text-sm font-medium text-foreground">No connections yet</p>
            <p className="max-w-[220px] text-xs leading-snug">{emptyHint}</p>
          </div>
        ) : activeTab === "column-mapping" ? (
          <ul className="space-y-1.5 pr-0.5">
            {mappings.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground" title={m.sourceColumn.name}>
                  {m.sourceColumn.name}
                </span>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground" title={m.targetColumn.name}>
                  {m.targetColumn.name}
                </span>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveMapping(m.id)}
                    aria-label="Remove mapping"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-1.5 pr-0.5">
            {keyValidationPairs.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground" title={p.keyColumn.name}>
                  {p.keyColumn.name}
                </span>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground" title={p.validationColumn.name}>
                  {p.validationColumn.name}
                </span>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemovePair(p.id)}
                    aria-label="Remove pair"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
