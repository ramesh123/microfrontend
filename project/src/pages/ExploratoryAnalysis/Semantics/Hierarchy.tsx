import { useState, useEffect, useCallback, useRef } from 'react'
import { getDisplayErrorMessage } from '@/utils/exceptionHelper'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  X,
  GripVertical,
  Plus,
  Loader2,
  ChevronRight,
  Layers,
  Pencil,
  Check,
} from 'lucide-react'
import { useSemanticsStore, type HierarchyGroup, type HierarchyLevel } from '@/stores/semanticsStore'
import { fetchHierarchies as fetchHierarchiesApi } from '@/controllers/API/semanticsApi'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// --- Dummy fallback data ---

const DUMMY_HIERARCHIES: HierarchyGroup[] = [
  {
    name: 'Manufacturing Hierarchy',
    description: 'Organizational rollup for manufacturing operations',
    levels: [
      { id: 'l1', name: 'Division', description: 'Top-level business division' },
      { id: 'l2', name: 'Plant', description: 'Manufacturing facility' },
      { id: 'l3', name: 'Production Line', description: 'Assembly line within plant' },
      { id: 'l4', name: 'Work Center', description: 'Individual work station' },
    ],
  },
  {
    name: 'Geographic Hierarchy',
    description: 'Regional geographic structure',
    levels: [
      { id: 'g1', name: 'Region', description: 'Geographic region' },
      { id: 'g2', name: 'Country', description: 'Country level' },
      { id: 'g3', name: 'State', description: 'State or province' },
      { id: 'g4', name: 'City', description: 'City level' },
    ],
  },
]

// --- Drag Preview Component ---

function DragPreview({ level }: { level: HierarchyLevel }) {
  return (
    <div className="fixed pointer-events-none z-[9999] bg-background border-2 border-primary rounded-lg shadow-2xl p-3 min-w-[200px]">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">{level.name}</span>
      </div>
      {level.description && (
        <p className="text-xs text-muted-foreground mt-1 ml-6">{level.description}</p>
      )}
    </div>
  )
}

// --- Main Component ---

export default function Hierarchy({ onNext }: { onNext?: () => void }) {
  const {
    sourceRows,
    tenantId,
    hierarchies,
    hierarchiesLoaded,
    setHierarchies,
    isConfigView,
  } = useSemanticsStore()

  const [isLoading, setIsLoading] = useState(!hierarchiesLoaded)
  const [activeHierarchyIndex, setActiveHierarchyIndex] = useState(0)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [dragPreviewPos, setDragPreviewPos] = useState<{ x: number; y: number } | null>(null)
  const [draggingLevel, setDraggingLevel] = useState<HierarchyLevel | null>(null)

  const activeHierarchy = hierarchies[activeHierarchyIndex] ?? null
  const isFetchingRef = useRef(false)

  const fetchHierarchies = useCallback(async () => {
    // Skip fetch if already loaded (cached)
    if (hierarchiesLoaded) {
      setIsLoading(false)
      return
    }
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    setIsLoading(true)
    try {
      const allHierarchies: HierarchyGroup[] = []

      // Helper to parse hierarchy response into HierarchyGroup[]
      const parseHierarchies = (data: any) => {
        if (data?.hierarchies && Array.isArray(data.hierarchies)) {
          for (const h of data.hierarchies) {
            const levels: HierarchyLevel[] = (h.levels ?? []).map(
              (lvl: string, idx: number) => ({
                id: `${h.name}-${idx}`,
                name: lvl,
                description: '',
              })
            )
            allHierarchies.push({
              name: h.name ?? 'Unnamed Hierarchy',
              description: h.description ?? '',
              levels,
            })
          }
        }
      }

      if (isConfigView) {
        const data = await fetchHierarchiesApi(tenantId)
        parseHierarchies(data)
      } else {
        // Normal wizard flow: single call per tenant (backend resolves from registry)
        const hasValidRow = sourceRows.some(
          (row) => row.connectionId && row.database && row.schema
        )
        if (hasValidRow) {
          const data = await fetchHierarchiesApi(tenantId)
          parseHierarchies(data)
        }
      }

      if (allHierarchies.length > 0) {
        setHierarchies(allHierarchies)
      } else {
        setHierarchies(DUMMY_HIERARCHIES)
        toast.info('No hierarchies returned. Showing sample data.')
      }
    } catch (err) {
      console.error('Failed to fetch hierarchies:', err)
      setHierarchies(DUMMY_HIERARCHIES)
      toast.error(getDisplayErrorMessage(err, 'Failed to fetch hierarchies. Showing sample data.'))
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [sourceRows, tenantId, hierarchiesLoaded, setHierarchies, isConfigView])

  useEffect(() => {
    fetchHierarchies()
  }, [fetchHierarchies])

  // --- Level operations ---

  const addLevel = () => {
    if (!activeHierarchy) return
    const newLevel: HierarchyLevel = {
      id: `new-${Date.now()}`,
      name: `Level ${activeHierarchy.levels.length + 1}`,
      description: 'New level',
    }
    const updated = hierarchies.map((h, i) =>
      i === activeHierarchyIndex ? { ...h, levels: [...h.levels, newLevel] } : h
    )
    setHierarchies(updated)
  }

  const removeLevel = (levelId: string) => {
    if (!activeHierarchy) return
    const updated = hierarchies.map((h, i) =>
      i === activeHierarchyIndex
        ? { ...h, levels: h.levels.filter((l) => l.id !== levelId) }
        : h
    )
    setHierarchies(updated)
  }

  const updateLevelName = (levelId: string, newName: string) => {
    const updated = hierarchies.map((h, i) =>
      i === activeHierarchyIndex
        ? {
            ...h,
            levels: h.levels.map((l) =>
              l.id === levelId ? { ...l, name: newName } : l
            ),
          }
        : h
    )
    setHierarchies(updated)
  }

  const startEditLevel = (level: HierarchyLevel) => {
    setEditingLevelId(level.id)
    setEditingName(level.name)
  }

  const saveEditLevel = () => {
    if (editingLevelId && editingName.trim()) {
      updateLevelName(editingLevelId, editingName.trim())
    }
    setEditingLevelId(null)
    setEditingName('')
  }

  // --- Drag handlers ---

  const move = (fromIndex: number, toIndex: number) => {
    if (!activeHierarchy) return
    const newLevels = [...activeHierarchy.levels]
    const [item] = newLevels.splice(fromIndex, 1)
    newLevels.splice(toIndex, 0, item)
    const updated = hierarchies.map((h, i) =>
      i === activeHierarchyIndex ? { ...h, levels: newLevels } : h
    )
    setHierarchies(updated)
  }

  const handleDragStart = (e: React.DragEvent, level: HierarchyLevel, index: number) => {
    setDraggingId(level.id)
    setDraggingLevel(level)
    setDragOverIndex(index)

    // Create a custom drag image (invisible) - we'll render our own preview
    const emptyImg = new Image()
    emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(emptyImg, 0, 0)

    try {
      e.dataTransfer.setData('text/plain', level.id)
    } catch {}
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrag = (e: React.DragEvent) => {
    if (e.clientX === 0 && e.clientY === 0) return // Ignore final drag event with (0,0)
    setDragPreviewPos({ x: e.clientX, y: e.clientY })
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (!activeHierarchy) return
    const id = draggingId ?? e.dataTransfer.getData('text/plain')
    const fromIndex = activeHierarchy.levels.findIndex((l) => l.id === id)
    if (fromIndex === -1) return
    if (fromIndex !== index) move(fromIndex, index)
    handleDragEnd()
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDraggingLevel(null)
    setDragOverIndex(null)
    setDragPreviewPos(null)
  }

  // --- Render ---

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading hierarchies...</p>
      </div>
    )
  }

  return (
    <div className="w-full px-4 pb-4">
      {/* Custom drag preview */}
      {draggingLevel && dragPreviewPos && (
        <div
          style={{
            position: 'fixed',
            left: dragPreviewPos.x + 12,
            top: dragPreviewPos.y - 20,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          <DragPreview level={draggingLevel} />
        </div>
      )}

      {/* Header */}
      <div className="pt-3 pb-2 text-center w-full">
        <h1 className="text-[16px] font-bold">Hierarchy Editor</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Define how data rolls up in your organization. Drag levels to reorder.
        </p>
      </div>

      {/* Hierarchy selector tabs */}
      {hierarchies.length > 1 && (
        <div className="flex gap-1 mb-3 flex-wrap">
          {hierarchies.map((h, i) => (
            <button
              key={h.name}
              onClick={() => setActiveHierarchyIndex(i)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                i === activeHierarchyIndex
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              <Layers className="h-3 w-3 inline-block mr-1.5" />
              {h.name}
            </button>
          ))}
        </div>
      )}

      {activeHierarchy && (
        <Card className="rounded-lg border shadow-sm py-0">
          <CardHeader className="px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  {activeHierarchy.name}
                </CardTitle>
                {activeHierarchy.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeHierarchy.description}
                  </p>
                )}
              </div>
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {activeHierarchy.levels.length} Levels
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div className="space-y-1.5">
              {activeHierarchy.levels.map((lvl, i) => {
                const isDragging = draggingId === lvl.id
                const isDragOver = dragOverIndex === i && !isDragging
                const isEditing = editingLevelId === lvl.id

                return (
                  <div
                    key={lvl.id}
                    draggable={!isEditing}
                    onDragStart={(e) => handleDragStart(e, lvl, i)}
                    onDrag={handleDrag}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDrop={(e) => handleDrop(e, i)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'group flex items-center justify-between rounded-lg border p-2.5 transition-all',
                      isDragging
                        ? 'opacity-40 border-dashed border-primary bg-primary/5'
                        : 'bg-background hover:bg-muted/30',
                      isDragOver && 'ring-2 ring-primary ring-offset-1 bg-primary/5',
                      !isEditing && 'cursor-grab active:cursor-grabbing'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Level indicator */}
                      <div
                        className={cn(
                          'flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0',
                          isDragging
                            ? 'bg-primary/20 text-primary'
                            : 'bg-primary text-primary-foreground'
                        )}
                      >
                        {i + 1}
                      </div>

                      {/* Drag handle */}
                      <div className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                        <GripVertical className="h-4 w-4" />
                      </div>

                      {/* Level name */}
                      {isEditing ? (
                        <Input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditLevel()
                            if (e.key === 'Escape') {
                              setEditingLevelId(null)
                              setEditingName('')
                            }
                          }}
                          className="h-7 text-sm flex-1 max-w-[200px]"
                        />
                      ) : (
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{lvl.name}</div>
                          {lvl.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {lvl.description}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isEditing ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={saveEditLevel}
                        >
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEditLevel(lvl)}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeLevel(lvl.id)}
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                )
              })}

              {/* Add level button */}
              <Button
                variant="outline"
                className="w-full mt-2 h-9 text-xs border-dashed"
                onClick={addLevel}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Level
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proceed button */}
      <div className="mt-4 flex justify-center">
        <Button onClick={() => onNext && onNext()} className="px-6 gap-1.5 text-sm">
          Proceed to Dims & Facts
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
