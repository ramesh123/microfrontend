import type React from "react"
import { useCallback, useMemo } from "react"
import type { ColumnMapping, Column } from "@/types/dataValidation"
import type { Source, Connection as AppConnection, ConnectionType } from "@/types"
import { FlowDiagram } from "@/components/common/nway-validation/components/FlowDiagram"
import { cn } from "@/lib/utils"

interface DataSource {
  id: string
  name: string
  columns: Column[]
}

interface MappingViewProps {
  dataSources: DataSource[]
  mappings: ColumnMapping[]
  onSetMappings: (mappings: ColumnMapping[]) => void
  viewType: "column-mapping" | "key-validation"
  isReadOnly?: boolean
}

/** N-Way FlowDiagram: same scrollable columns + SVG edges + card styling. */
const MappingView: React.FC<MappingViewProps> = ({
  dataSources,
  mappings,
  onSetMappings,
  isReadOnly = false,
  viewType,
}) => {
  const emptyConnectionTypes = useMemo(() => new Map<string, ConnectionType>(), [])

  const flowSources: Source[] = useMemo(() => {
    return dataSources.map((ds, i) => ({
      id: ds.id,
      name: ds.name,
      tag: `tag${i + 1}`,
      selected: true,
      data: [] as any[],
      columns: ds.columns.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type || "string",
        sourceId: ds.id,
      })),
    }))
  }, [dataSources])

  const flowConnections: AppConnection[] = useMemo(() => {
    if (dataSources.length < 2) return []
    const [left, right] = dataSources
    return mappings.map((m) => ({
      id: m.id,
      sourceId: left.id,
      targetId: right.id,
      sourceColumn: m.sourceColumn.id,
      targetColumn: m.targetColumn.id,
      sourceTag: "tag1",
      targetTag: "tag2",
    }))
  }, [mappings, dataSources])

  const handleAddConnection = useCallback(
    (conn: AppConnection) => {
      if (isReadOnly) return
      if (dataSources.length < 2) return
      const left = dataSources[0]
      const right = dataSources[1]
      const sourceCol = left.columns.find((c) => c.id === conn.sourceColumn)
      const targetCol = right.columns.find((c) => c.id === conn.targetColumn)
      if (!sourceCol || !targetCol) return

      const filtered = mappings.filter(
        (m) => m.sourceColumn.id !== sourceCol.id && m.targetColumn.id !== targetCol.id,
      )
      const newMapping: ColumnMapping = {
        id: conn.id,
        sourceColumn: sourceCol,
        targetColumn: targetCol,
        colorIndex: filtered.length % 10,
      }
      onSetMappings([...filtered, newMapping])
    },
    [dataSources, mappings, onSetMappings, isReadOnly],
  )

  const handleRemoveConnection = useCallback(
    (connectionId: string) => {
      if (isReadOnly) return
      onSetMappings(mappings.filter((m) => m.id !== connectionId))
    },
    [mappings, onSetMappings, isReadOnly],
  )

  const placeholderText =
    viewType === "column-mapping"
      ? "Please select both a source and target connection above to begin mapping."
      : "Please select connections for both Key and Validation columns to begin pairing."

  if (dataSources.length < 2 && !isReadOnly) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
        <div className="p-4 text-center text-sm text-muted-foreground">
          <p>{placeholderText}</p>
        </div>
      </div>
    )
  }

  if (flowSources.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
        <p className="text-sm text-muted-foreground">{placeholderText}</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden",
        isReadOnly && "pointer-events-none select-none opacity-[0.92]",
      )}
    >
      <FlowDiagram
        sources={flowSources}
        connections={flowConnections}
        onAddConnection={handleAddConnection}
        onRemoveConnection={handleRemoveConnection}
        connectionTypes={emptyConnectionTypes}
      />
    </div>
  )
}

export default MappingView
