import { useState, useEffect, useCallback, useRef } from 'react'
import { getDisplayErrorMessage } from '@/utils/exceptionHelper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Loader2,
  ChevronRight,
  Database,
  Layers3,
  Clock,
  Key,
  BarChart3,
  Tag,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
} from 'lucide-react'
import { apiV2 } from '@/controllers/API/api'
import { useSemanticsStore, type FactItem, type DimensionItem } from '@/stores/semanticsStore'
import { fetchDimensions, fetchFacts, fetchTenantDomain } from '@/controllers/API/semanticsApi'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import JobProcessingBanner from './JobProcessingBanner'

// --- Constants ---

const GRAIN_OPTIONS = [
  { value: 'transaction', label: 'Transaction' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'certified', label: 'Certified' },
]

// --- Fallback dummy data ---

const DUMMY_FACTS: FactItem[] = [
  {
    id: 'fact_1',
    name: 'fact_production_daily',
    grain: 'day',
    time_column: 'production_date',
    measures: ['output_tmt', 'downtime_hours', 'scrap_rate', 'efficiency_pct'],
    dimensions: ['plant_name', 'product_name', 'fiscal_year', 'shift_id'],
    confidence: 0.85,
  },
  {
    id: 'fact_2',
    name: 'fact_sales_transactions',
    grain: 'transaction',
    time_column: 'sale_date',
    measures: ['sale_amount', 'discount', 'quantity', 'profit_margin'],
    dimensions: ['customer_id', 'product_id', 'region', 'channel'],
    confidence: 0.78,
  },
  {
    id: 'fact_3',
    name: 'fact_inventory_snapshot',
    grain: 'day',
    time_column: 'snapshot_date',
    measures: ['qty_on_hand', 'qty_reserved', 'reorder_point'],
    dimensions: ['warehouse_id', 'sku', 'location_bin'],
    confidence: 0.82,
  },
]

const DUMMY_DIMENSIONS: DimensionItem[] = [
  {
    id: 'dim_1',
    name: 'dim_plant',
    keys: ['plant_id'],
    attributes: ['plant_name', 'region_name', 'country', 'capacity_tmt'],
    confidence: 0.88,
  },
  {
    id: 'dim_2',
    name: 'dim_product',
    keys: ['product_id'],
    attributes: ['product_name', 'category', 'subcategory', 'brand', 'unit_cost'],
    confidence: 0.85,
  },
  {
    id: 'dim_3',
    name: 'dim_customer',
    keys: ['customer_id'],
    attributes: ['customer_name', 'segment', 'region', 'tier'],
    confidence: 0.80,
  },
  {
    id: 'dim_4',
    name: 'dim_time',
    keys: ['date_key'],
    attributes: ['fiscal_year', 'fiscal_quarter', 'month_name', 'week_num'],
    confidence: 0.92,
  },
]

// --- Helper: parse comma-separated string to array ---

function parseCSV(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// --- Confidence indicator ---

function ConfidenceIndicator({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-amber-500' : 'text-red-500'
  const bgColor = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', bgColor)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-[10px] font-semibold', color)}>{pct}%</span>
    </div>
  )
}

// --- Fact Edit Form (inline) ---

interface FactEditFormProps {
  fact: FactItem
  onSave: (updates: Partial<FactItem>) => void
  onCancel: () => void
  isSaving: boolean
}

function FactEditForm({ fact, onSave, onCancel, isSaving }: FactEditFormProps) {
  const [form, setForm] = useState({
    name: fact.name,
    grain: fact.grain,
    time_column: fact.time_column,
    measures: fact.measures.join(', '),
    dimensions: fact.dimensions.join(', '),
  })

  return (
    <div className="px-2.5 pb-2.5 pt-0 space-y-2 border-t border-dashed">
      <div className="grid grid-cols-2 gap-2 pt-2">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Name</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Grain</label>
          <Select value={form.grain} onValueChange={(v) => setForm({ ...form, grain: v })}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRAIN_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase">Time Column</label>
        <Input
          value={form.time_column}
          onChange={(e) => setForm({ ...form, time_column: e.target.value })}
          className="h-7 text-xs font-mono"
        />
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase">Measures (comma-separated)</label>
        <Input
          value={form.measures}
          onChange={(e) => setForm({ ...form, measures: e.target.value })}
          className="h-7 text-xs font-mono"
        />
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase">Dimensions (comma-separated)</label>
        <Input
          value={form.dimensions}
          onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
          className="h-7 text-xs font-mono"
        />
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <Button
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={() =>
            onSave({
              name: form.name,
              grain: form.grain,
              time_column: form.time_column,
              measures: parseCSV(form.measures),
              dimensions: parseCSV(form.dimensions),
            })
          }
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
          Save
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={onCancel} disabled={isSaving}>
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  )
}

// --- Dimension Edit Form (inline) ---

interface DimEditFormProps {
  dim: DimensionItem
  onSave: (updates: Partial<DimensionItem>) => void
  onCancel: () => void
  isSaving: boolean
}

function DimEditForm({ dim, onSave, onCancel, isSaving }: DimEditFormProps) {
  const [form, setForm] = useState({
    name: dim.name,
    keys: dim.keys.join(', '),
    attributes: dim.attributes.join(', '),
  })

  return (
    <div className="px-2.5 pb-2.5 pt-0 space-y-2 border-t border-dashed">
      <div className="pt-2">
        <label className="text-[10px] font-medium text-muted-foreground uppercase">Name</label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="h-7 text-xs"
        />
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase">Primary Keys (comma-separated)</label>
        <Input
          value={form.keys}
          onChange={(e) => setForm({ ...form, keys: e.target.value })}
          className="h-7 text-xs font-mono"
        />
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase">Attributes (comma-separated)</label>
        <Input
          value={form.attributes}
          onChange={(e) => setForm({ ...form, attributes: e.target.value })}
          className="h-7 text-xs font-mono"
        />
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <Button
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={() =>
            onSave({
              name: form.name,
              keys: parseCSV(form.keys),
              attributes: parseCSV(form.attributes),
            })
          }
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
          Save
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={onCancel} disabled={isSaving}>
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  )
}

// --- Fact Card ---

function FactCard({
  fact,
  isExpanded,
  isEditing,
  isSaving,
  onToggle,
  onEdit,
  onSave,
  onCancelEdit,
  onDelete,
}: {
  fact: FactItem
  isExpanded: boolean
  isEditing: boolean
  isSaving: boolean
  onToggle: () => void
  onEdit: () => void
  onSave: (updates: Partial<FactItem>) => void
  onCancelEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'border rounded-lg transition-all',
        isExpanded ? 'bg-primary/[0.02] border-primary/30' : 'bg-background hover:bg-muted/20'
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-2.5 text-left"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-500/10 shrink-0">
          <Database className="h-3.5 w-3.5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{fact.name}</span>
            <ConfidenceIndicator value={fact.confidence} />
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {fact.grain}
            </span>
            <span className="flex items-center gap-1">
              <BarChart3 className="h-2.5 w-2.5" />
              {fact.measures.length} measures
            </span>
            <span className="flex items-center gap-1">
              <Tag className="h-2.5 w-2.5" />
              {fact.dimensions.length} dims
            </span>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        isEditing ? (
          <FactEditForm fact={fact} onSave={onSave} onCancel={onCancelEdit} isSaving={isSaving} />
        ) : (
          <div className="px-2.5 pb-2.5 pt-0 space-y-2 border-t border-dashed">
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="bg-muted/30 rounded-md p-2">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Time Column
                </div>
                <code className="text-xs font-mono text-foreground">{fact.time_column}</code>
              </div>
              <div className="bg-muted/30 rounded-md p-2">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Grain
                </div>
                <span className="text-xs font-medium">{fact.grain}</span>
              </div>
            </div>

            <div className="bg-muted/30 rounded-md p-2">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                Measures
              </div>
              <div className="flex flex-wrap gap-1">
                {fact.measures.map((m) => (
                  <span
                    key={m}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-700 font-medium"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-muted/30 rounded-md p-2">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                Dimensions
              </div>
              <div className="flex flex-wrap gap-1">
                {fact.dimensions.map((d) => (
                  <span
                    key={d}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-medium"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1 pt-1">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={onEdit}>
                <Pencil className="h-2.5 w-2.5 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-2.5 w-2.5 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  )
}

// --- Dimension Card ---

function DimensionCard({
  dim,
  isExpanded,
  isEditing,
  isSaving,
  onToggle,
  onEdit,
  onSave,
  onCancelEdit,
  onDelete,
}: {
  dim: DimensionItem
  isExpanded: boolean
  isEditing: boolean
  isSaving: boolean
  onToggle: () => void
  onEdit: () => void
  onSave: (updates: Partial<DimensionItem>) => void
  onCancelEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'border rounded-lg transition-all',
        isExpanded ? 'bg-primary/[0.02] border-primary/30' : 'bg-background hover:bg-muted/20'
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-2.5 text-left"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-500/10 shrink-0">
          <Layers3 className="h-3.5 w-3.5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{dim.name}</span>
            <ConfidenceIndicator value={dim.confidence} />
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              <Key className="h-2.5 w-2.5" />
              {dim.keys.length} key{dim.keys.length > 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <Tag className="h-2.5 w-2.5" />
              {dim.attributes.length} attrs
            </span>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        isEditing ? (
          <DimEditForm dim={dim} onSave={onSave} onCancel={onCancelEdit} isSaving={isSaving} />
        ) : (
          <div className="px-2.5 pb-2.5 pt-0 space-y-2 border-t border-dashed">
            <div className="bg-muted/30 rounded-md p-2 mt-2">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                Primary Keys
              </div>
              <div className="flex flex-wrap gap-1">
                {dim.keys.map((k) => (
                  <span
                    key={k}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-700 font-medium"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-muted/30 rounded-md p-2">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                Attributes
              </div>
              <div className="flex flex-wrap gap-1">
                {dim.attributes.map((a) => (
                  <span
                    key={a}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-medium"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1 pt-1">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={onEdit}>
                <Pencil className="h-2.5 w-2.5 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-2.5 w-2.5 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  )
}

// --- Create Fact Dialog ---

function CreateFactDialog({
  open,
  onOpenChange,
  onCreate,
  isSaving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (fact: {
    table_name: string
    grain: string
    time_column: string
    measures: string[]
    dimensions: string[]
    description: string
    status: string
  }) => void
  isSaving: boolean
}) {
  const [form, setForm] = useState({
    table_name: '',
    grain: 'day',
    time_column: '',
    measures: '',
    dimensions: '',
    description: '',
    status: 'draft',
  })

  const resetForm = () =>
    setForm({ table_name: '', grain: 'day', time_column: '', measures: '', dimensions: '', description: '', status: 'draft' })

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-600" />
            Create Fact Table
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2.5">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">Table Name</label>
            <Input
              value={form.table_name}
              onChange={(e) => setForm({ ...form, table_name: e.target.value })}
              className="h-7 text-xs"
              placeholder="e.g. fact_production_daily"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Grain</label>
              <Select value={form.grain} onValueChange={(v) => setForm({ ...form, grain: v })}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRAIN_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">Time Column</label>
            <Input
              value={form.time_column}
              onChange={(e) => setForm({ ...form, time_column: e.target.value })}
              className="h-7 text-xs font-mono"
              placeholder="e.g. production_date"
            />
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">Measures (comma-separated)</label>
            <Input
              value={form.measures}
              onChange={(e) => setForm({ ...form, measures: e.target.value })}
              className="h-7 text-xs font-mono"
              placeholder="e.g. output_tmt, downtime_hours"
            />
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">Dimensions (comma-separated)</label>
            <Input
              value={form.dimensions}
              onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
              className="h-7 text-xs font-mono"
              placeholder="e.g. plant_id, product_id"
            />
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">Description</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="text-xs min-h-[unset] resize-none"
              placeholder="Describe this fact table..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!form.table_name.trim() || isSaving}
            onClick={() => {
              onCreate({
                table_name: form.table_name.trim(),
                grain: form.grain,
                time_column: form.time_column.trim(),
                measures: parseCSV(form.measures),
                dimensions: parseCSV(form.dimensions),
                description: form.description.trim(),
                status: form.status,
              })
              resetForm()
            }}
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Create Dimension Dialog ---

function CreateDimensionDialog({
  open,
  onOpenChange,
  onCreate,
  isSaving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (dim: {
    name: string
    keys: string[]
    attributes: string[]
    description: string
    status: string
  }) => void
  isSaving: boolean
}) {
  const [form, setForm] = useState({
    name: '',
    keys: '',
    attributes: '',
    description: '',
    status: 'draft',
  })

  const resetForm = () =>
    setForm({ name: '', keys: '', attributes: '', description: '', status: 'draft' })

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-emerald-600" />
            Create Dimension
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-7 text-xs"
                placeholder="e.g. dim_plant"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">Primary Keys (comma-separated)</label>
            <Input
              value={form.keys}
              onChange={(e) => setForm({ ...form, keys: e.target.value })}
              className="h-7 text-xs font-mono"
              placeholder="e.g. plant_id"
            />
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">Attributes (comma-separated)</label>
            <Input
              value={form.attributes}
              onChange={(e) => setForm({ ...form, attributes: e.target.value })}
              className="h-7 text-xs font-mono"
              placeholder="e.g. plant_name, region_name"
            />
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase">Description</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="text-xs min-h-[unset] resize-none"
              placeholder="Describe this dimension..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!form.name.trim() || isSaving}
            onClick={() => {
              onCreate({
                name: form.name.trim(),
                keys: parseCSV(form.keys),
                attributes: parseCSV(form.attributes),
                description: form.description.trim(),
                status: form.status,
              })
              resetForm()
            }}
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Main Component ---

export default function DimsAndFacts({ onNext }: { onNext?: () => void }) {
  const {
    sourceRows,
    tenantId,
    facts,
    dimensions,
    dimsFactsLoaded,
    setFacts,
    setDimensions,
    setDimsFactsLoaded,
    addFact,
    updateFact,
    removeFact,
    addDimension,
    updateDimension,
    removeDimension,
    pendingJobs,
    addPendingJob,
    isConfigView,
  } = useSemanticsStore()

  const [domainId, setDomainId] = useState('')
  const [isLoading, setIsLoading] = useState(!dimsFactsLoaded)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedFactId, setExpandedFactId] = useState<string | null>(null)
  const [expandedDimId, setExpandedDimId] = useState<string | null>(null)
  const [editingFactId, setEditingFactId] = useState<string | null>(null)
  const [editingDimId, setEditingDimId] = useState<string | null>(null)
  const [showCreateFact, setShowCreateFact] = useState(false)
  const [showCreateDim, setShowCreateDim] = useState(false)
  const isFetchingRef = useRef(false)

  // Fetch tenant domain on mount
  useEffect(() => {
    const loadDomain = async () => {
      try {
        const domainRes = await fetchTenantDomain(tenantId)
        if (domainRes?.domain_id) {
          setDomainId(domainRes.domain_id)
        }
      } catch (error) {
        // Domain not set yet - that's OK
      }
    }
    loadDomain()
  }, [tenantId])

  const fetchModels = useCallback(async () => {
    if (dimsFactsLoaded) {
      setIsLoading(false)
      return
    }
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    setIsLoading(true)
    try {
      const allFacts: FactItem[] = []
      const allDimensions: DimensionItem[] = []
      let asyncJobStarted = false

      // In config view, use GET /dimensions and /facts
      if (isConfigView) {
        try {
          const [dimsRes, factsRes] = await Promise.all([
            fetchDimensions(tenantId),
            fetchFacts(tenantId),
          ])

          // Map dimensions
          if (dimsRes?.dimensions && Array.isArray(dimsRes.dimensions)) {
            for (const d of dimsRes.dimensions) {
              allDimensions.push({
                id: d.dimension_id ?? d.id ?? `dim_${allDimensions.length + 1}`,
                name: d.name ?? 'Unnamed Dimension',
                keys: (d.keys ?? []) as string[],
                attributes: (d.attributes ?? []) as string[],
                confidence: Number(d.confidence ?? 0.8),
              })
            }
          }

          // Map facts
          if (factsRes?.facts && Array.isArray(factsRes.facts)) {
            for (const f of factsRes.facts) {
              allFacts.push({
                id: f.fact_id ?? f.id ?? `fact_${allFacts.length + 1}`,
                name: f.table_name ?? f.name ?? 'Unnamed Fact',
                grain: f.grain ?? 'day',
                time_column: f.time_column ?? '',
                measures: (f.measures ?? []) as string[],
                dimensions: (f.dimensions ?? []) as string[],
                confidence: Number(f.confidence ?? 0.8),
              })
            }
          }

          if (allFacts.length > 0 || allDimensions.length > 0) {
            setFacts(allFacts)
            setDimensions(allDimensions)
            setDimsFactsLoaded(true)
          } else {
            setFacts(DUMMY_FACTS)
            setDimensions(DUMMY_DIMENSIONS)
            setDimsFactsLoaded(true)
            toast.info('No models returned. Showing sample data.')
          }
          setIsLoading(false)
          isFetchingRef.current = false
          return
        } catch (err) {
          console.error('Failed to fetch dims/facts:', err)
          setFacts(DUMMY_FACTS)
          setDimensions(DUMMY_DIMENSIONS)
          setDimsFactsLoaded(true)
          toast.error(getDisplayErrorMessage(err, 'Failed to fetch models. Showing sample data.'))
          setIsLoading(false)
          isFetchingRef.current = false
          return
        }
      }

      // Normal wizard flow: POST to trigger inference
      await Promise.all(
        sourceRows.map(async (row) => {
          if (
            !row.connectionId ||
            !row.database ||
            !row.schema ||
            row.selectedTables.length === 0
          )
            return

          const payload = {
            tenant_id: tenantId,
            use_llm: true,
          }

          const res = await apiV2.post('/onboard/infer-models/async', payload)

          // 202 = async job accepted — wait for onComplete to call GET /dimensions + /facts
          if (res.status === 202 && res.data?.job_id) {
            addPendingJob('dims_and_facts', res.data.job_id, 'infer_models')
            asyncJobStarted = true
            return
          }

          const data = res.data

          if (data?.facts && Array.isArray(data.facts)) {
            for (const f of data.facts) {
              allFacts.push({
                id: f.id ?? `fact_${allFacts.length + 1}`,
                name: f.name ?? 'Unnamed Fact',
                grain: f.grain ?? 'unknown',
                time_column: f.time_column ?? '',
                measures: f.measures ?? [],
                dimensions: f.dimensions ?? [],
                confidence: f.confidence ?? 0.5,
              })
            }
          }

          if (data?.dimensions && Array.isArray(data.dimensions)) {
            for (const d of data.dimensions) {
              allDimensions.push({
                id: d.id ?? `dim_${allDimensions.length + 1}`,
                name: d.name ?? 'Unnamed Dimension',
                keys: (d.keys ?? []) as string[],
                attributes: (d.attributes ?? []) as string[],
                confidence: Number(d.confidence ?? 0.5),
              })
            }
          }
        })
      )

      // If async job was started, don't set data yet — GET APIs will be called on job completion
      if (asyncJobStarted) {
        setIsLoading(false)
        isFetchingRef.current = false
        return
      }

      if (allFacts.length > 0 || allDimensions.length > 0) {
        setFacts(allFacts)
        setDimensions(allDimensions)
        setDimsFactsLoaded(true)
      } else {
        setFacts(DUMMY_FACTS)
        setDimensions(DUMMY_DIMENSIONS)
        setDimsFactsLoaded(true)
        toast.info('No models returned. Showing sample data.')
      }
    } catch (err) {
      console.error('Failed to fetch dims/facts:', err)
      setFacts(DUMMY_FACTS)
      setDimensions(DUMMY_DIMENSIONS)
      setDimsFactsLoaded(true)
      toast.error(getDisplayErrorMessage(err, 'Failed to fetch models. Showing sample data.'))
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [sourceRows, tenantId, dimsFactsLoaded, setFacts, setDimensions, setDimsFactsLoaded, isConfigView])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  // Fetch dimensions & facts from GET APIs after async job completes (called once)
  const fetchDimsFactsData = useCallback(async () => {
    try {
      const [dimsRes, factsRes] = await Promise.all([
        fetchDimensions(tenantId),
        fetchFacts(tenantId),
      ])

      const fetchedDimensions: DimensionItem[] = []
      const fetchedFacts: FactItem[] = []

      // Map dimensions from GET response
      if (dimsRes?.dimensions && Array.isArray(dimsRes.dimensions)) {
        for (const d of dimsRes.dimensions) {
          fetchedDimensions.push({
            id: d.dimension_id ?? d.id ?? `dim_${fetchedDimensions.length + 1}`,
            name: d.name ?? 'Unnamed Dimension',
            keys: (d.keys ?? []) as string[],
            attributes: (d.attributes ?? []) as string[],
            confidence: Number(d.confidence ?? 0.8),
          })
        }
      }

      // Map facts from GET response
      if (factsRes?.facts && Array.isArray(factsRes.facts)) {
        for (const f of factsRes.facts) {
          fetchedFacts.push({
            id: f.fact_id ?? f.id ?? `fact_${fetchedFacts.length + 1}`,
            name: f.table_name ?? f.name ?? 'Unnamed Fact',
            grain: f.grain ?? 'day',
            time_column: f.time_column ?? '',
            measures: (f.measures ?? []) as string[],
            dimensions: (f.dimensions ?? []) as string[],
            confidence: Number(f.confidence ?? 0.8),
          })
        }
      }

      if (fetchedFacts.length > 0 || fetchedDimensions.length > 0) {
        setFacts(fetchedFacts)
        setDimensions(fetchedDimensions)
      } else {
        setFacts(DUMMY_FACTS)
        setDimensions(DUMMY_DIMENSIONS)
        toast.info('No models returned. Showing sample data.')
      }
      setDimsFactsLoaded(true)
    } catch (err) {
      console.error('Failed to fetch dims/facts data:', err)
      setFacts(DUMMY_FACTS)
      setDimensions(DUMMY_DIMENSIONS)
      setDimsFactsLoaded(true)
      toast.error(getDisplayErrorMessage(err, 'Failed to load dimensions & facts. Showing sample data.'))
    } finally {
      setIsLoading(false)
    }
  }, [tenantId, setFacts, setDimensions, setDimsFactsLoaded])

  // --- CRUD Handlers: Facts ---

  const handleCreateFact = async (payload: {
    table_name: string
    grain: string
    time_column: string
    measures: string[]
    dimensions: string[]
    description: string
    status: string
  }) => {
    setIsSaving(true)
    try {
      const res = await apiV2.post('/facts', {
        tenant_id: tenantId,
        domain_id: domainId,
        ...payload,
      })

      const created = res.data
      addFact({
        id: created?.fact_id ?? created?.id ?? `fact_${Date.now()}`,
        name: payload.table_name,
        grain: payload.grain,
        time_column: payload.time_column,
        measures: payload.measures,
        dimensions: payload.dimensions,
        confidence: 1.0,
      })
      setShowCreateFact(false)
      toast.success('Fact created')
    } catch (err) {
      console.error('Failed to create fact:', err)
      toast.error(getDisplayErrorMessage(err, 'Failed to create fact'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateFact = async (factId: string, updates: Partial<FactItem>) => {
    setIsSaving(true)
    try {
      const params = new URLSearchParams({ tenant_id: tenantId })
      await apiV2.patch(`/facts/${factId}?${params.toString()}`, {
        grain: updates.grain,
        measures: updates.measures,
        dimensions: updates.dimensions,
      })

      updateFact(factId, updates)
      setEditingFactId(null)
      toast.success('Fact updated')
    } catch (err) {
      console.error('Failed to update fact:', err)
      toast.error(getDisplayErrorMessage(err, 'Failed to update fact'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteFact = async (factId: string) => {
    try {
      const params = new URLSearchParams({ tenant_id: tenantId })
      await apiV2.delete(`/facts/${factId}?${params.toString()}`)

      removeFact(factId)
      if (expandedFactId === factId) setExpandedFactId(null)
      toast.success('Fact removed')
    } catch (err) {
      console.error('Failed to delete fact:', err)
      toast.error(getDisplayErrorMessage(err, 'Failed to delete fact'))
    }
  }

  // --- CRUD Handlers: Dimensions ---

  const handleCreateDimension = async (payload: {
    name: string
    keys: string[]
    attributes: string[]
    description: string
    status: string
  }) => {
    setIsSaving(true)
    try {
      const res = await apiV2.post('/dimensions', {
        tenant_id: tenantId,
        domain_id: domainId,
        ...payload,
      })

      const created = res.data
      addDimension({
        id: created?.dimension_id ?? created?.id ?? `dim_${Date.now()}`,
        name: payload.name,
        keys: payload.keys,
        attributes: payload.attributes,
        confidence: 1.0,
      })
      setShowCreateDim(false)
      toast.success('Dimension created')
    } catch (err) {
      console.error('Failed to create dimension:', err)
      toast.error(getDisplayErrorMessage(err, 'Failed to create dimension'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateDimension = async (dimId: string, updates: Partial<DimensionItem>) => {
    setIsSaving(true)
    try {
      const params = new URLSearchParams({ tenant_id: tenantId })
      await apiV2.patch(`/dimensions/${dimId}?${params.toString()}`, {
        keys: updates.keys,
        attributes: updates.attributes,
      })

      updateDimension(dimId, updates)
      setEditingDimId(null)
      toast.success('Dimension updated')
    } catch (err) {
      console.error('Failed to update dimension:', err)
      toast.error(getDisplayErrorMessage(err, 'Failed to update dimension'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteDimension = async (dimId: string) => {
    try {
      const params = new URLSearchParams({ tenant_id: tenantId })
      await apiV2.delete(`/dimensions/${dimId}?${params.toString()}`)

      removeDimension(dimId)
      if (expandedDimId === dimId) setExpandedDimId(null)
      toast.success('Dimension removed')
    } catch (err) {
      console.error('Failed to delete dimension:', err)
      toast.error(getDisplayErrorMessage(err, 'Failed to delete dimension'))
    }
  }

  // --- Render ---

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Inferring Dims & Facts...</p>
      </div>
    )
  }

  return (
    <div className="w-full px-4 pb-4">
      {/* Header */}
      <div className="pt-3 pb-2 text-center w-full">
        <h1 className="text-[16px] font-bold">Dimensions & Facts</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Review the inferred semantic model. Click to expand details.
        </p>
      </div>

      {/* Show processing banner for pending async jobs */}
      {pendingJobs.some((j) => j.stepName === 'dims_and_facts') && (
        <div className="mb-3">
          {pendingJobs
            .filter((j) => j.stepName === 'dims_and_facts')
            .map((j) => (
              <JobProcessingBanner
                key={j.jobId}
                jobId={j.jobId}
                jobType={j.jobType}
                label="Dims & Facts Inference"
                onComplete={() => fetchDimsFactsData()}
              />
            ))}
        </div>
      )}

      {/* Summary stats */}
      <div className="flex items-center justify-center gap-4 mb-3">
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-5 h-5 rounded bg-blue-500/10 flex items-center justify-center">
            <Database className="h-3 w-3 text-blue-600" />
          </div>
          <span className="font-medium">{facts.length}</span>
          <span className="text-muted-foreground">Facts</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-5 h-5 rounded bg-emerald-500/10 flex items-center justify-center">
            <Layers3 className="h-3 w-3 text-emerald-600" />
          </div>
          <span className="font-medium">{dimensions.length}</span>
          <span className="text-muted-foreground">Dimensions</span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Facts column */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1 mb-1">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Facts
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setShowCreateFact(true)}
            >
              <Plus className="h-2.5 w-2.5 mr-1" />
              Add
            </Button>
          </div>
          {facts.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground border rounded-lg border-dashed">
              No fact tables inferred
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              {facts.map((fact) => (
                <FactCard
                  key={fact.id}
                  fact={fact}
                  isExpanded={expandedFactId === fact.id}
                  isEditing={editingFactId === fact.id}
                  isSaving={isSaving}
                  onToggle={() => {
                    setExpandedFactId((prev) => (prev === fact.id ? null : fact.id))
                    if (editingFactId === fact.id) setEditingFactId(null)
                  }}
                  onEdit={() => setEditingFactId(fact.id)}
                  onSave={(updates) => handleUpdateFact(fact.id, updates)}
                  onCancelEdit={() => setEditingFactId(null)}
                  onDelete={() => handleDeleteFact(fact.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Dimensions column */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1 mb-1">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Dimensions
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setShowCreateDim(true)}
            >
              <Plus className="h-2.5 w-2.5 mr-1" />
              Add
            </Button>
          </div>
          {dimensions.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground border rounded-lg border-dashed">
              No dimension tables inferred
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              {dimensions.map((dim) => (
                <DimensionCard
                  key={dim.id}
                  dim={dim}
                  isExpanded={expandedDimId === dim.id}
                  isEditing={editingDimId === dim.id}
                  isSaving={isSaving}
                  onToggle={() => {
                    setExpandedDimId((prev) => (prev === dim.id ? null : dim.id))
                    if (editingDimId === dim.id) setEditingDimId(null)
                  }}
                  onEdit={() => setEditingDimId(dim.id)}
                  onSave={(updates) => handleUpdateDimension(dim.id, updates)}
                  onCancelEdit={() => setEditingDimId(null)}
                  onDelete={() => handleDeleteDimension(dim.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Proceed button */}
      <div className="mt-4 flex justify-center">
        <Button onClick={() => onNext && onNext()} className="px-2 gap-1.5 text-sm !h-8 ">
          Proceed to Metrics
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Create Dialogs */}
      <CreateFactDialog
        open={showCreateFact}
        onOpenChange={setShowCreateFact}
        onCreate={handleCreateFact}
        isSaving={isSaving}
      />
      <CreateDimensionDialog
        open={showCreateDim}
        onOpenChange={setShowCreateDim}
        onCreate={handleCreateDimension}
        isSaving={isSaving}
      />
    </div>
  )
}
