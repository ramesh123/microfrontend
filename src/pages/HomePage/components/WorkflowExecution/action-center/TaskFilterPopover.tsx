import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TaskFilters, TaskStatus, QuickTaskCategory } from './types';
import { hasActiveFilters } from './utils';
import { initialColumns } from './mock';

const QUICK_CATEGORY_OPTIONS: { id: QuickTaskCategory; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'completed', label: 'Completed' },
  { id: 'accepted', label: 'Accepted' },
];

interface TaskFilterPopoverProps {
  filters: TaskFilters;
  assignees: string[];
  onChange: (filters: TaskFilters) => void;
  onClear: () => void;
}

function toggleItem<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
}

export function TaskFilterPopover({
  filters,
  assignees,
  onChange,
  onClear,
}: TaskFilterPopoverProps) {
  const active = hasActiveFilters(filters);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`h-8 w-8 border-slate-200 text-slate-500 ${active ? 'border-primary text-primary bg-primary/5' : ''}`}
          aria-label="Filter tasks"
        >
          <Filter className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Filters</span>
          {active && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
              Clear all
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase">Kanban columns</Label>
          {initialColumns.map((col) => (
            <label key={col.id} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={filters.statuses.includes(col.id)}
                onCheckedChange={() =>
                  onChange({
                    ...filters,
                    statuses: toggleItem(filters.statuses, col.id as TaskStatus),
                  })
                }
              />
              <span className="text-sm">{col.title}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase">Quick task sections</Label>
          {QUICK_CATEGORY_OPTIONS.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={filters.quickCategories.includes(opt.id)}
                onCheckedChange={() =>
                  onChange({
                    ...filters,
                    quickCategories: toggleItem(filters.quickCategories, opt.id),
                  })
                }
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>

        {assignees.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase">Assignee</Label>
            {assignees.map((initials) => (
              <label key={initials} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.assignees.includes(initials)}
                  onCheckedChange={() =>
                    onChange({
                      ...filters,
                      assignees: toggleItem(filters.assignees, initials),
                    })
                  }
                />
                <span className="text-sm">{initials}</span>
              </label>
            ))}
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer pt-1 border-t">
          <Checkbox
            checked={filters.overdueOnly}
            onCheckedChange={(checked) =>
              onChange({ ...filters, overdueOnly: checked === true })
            }
          />
          <span className="text-sm">Overdue only</span>
        </label>
      </PopoverContent>
    </Popover>
  );
}
