import { useMemo, useState } from 'react';
import { ChevronDown, Plus, Search, Type } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { FormBuilderFieldType, FormFieldCategoryId } from '../../types';
import { FIELD_CATEGORIES } from '../../constants';
import { FieldTypeIcon } from '../fields/FieldTypeIcon';

interface FieldPaletteProps {
  onAddField: (type: FormBuilderFieldType, label?: string) => void;
}

const DEFAULT_OPEN: Record<FormFieldCategoryId, boolean> = {
  layout: false,
  basic: true,
  selection: false,
  upload: false,
  location: false,
  display: true,
};

const QUICK_FIELDS: { type: FormBuilderFieldType; label: string }[] = [
  { type: 'text', label: 'Text' },
  { type: 'number', label: 'Number' },
  { type: 'select', label: 'Dropdown' },
  { type: 'date', label: 'Date' },
  { type: 'textarea', label: 'Textarea' },
  { type: 'checkbox', label: 'Checkbox' },
];

export function FieldPalette({ onAddField }: FieldPaletteProps) {
  const [search, setSearch] = useState('');
  const [openCategories, setOpenCategories] = useState(DEFAULT_OPEN);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return FIELD_CATEGORIES.map((category) => ({
      ...category,
      fields: category.fields.filter((item) => {
        if (!query) return true;
        return (
          item.label.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.type.toLowerCase().includes(query)
        );
      }),
    })).filter((category) => category.fields.length > 0);
  }, [search]);

  const totalFields = useMemo(
    () => filteredCategories.reduce((sum, category) => sum + category.fields.length, 0),
    [filteredCategories],
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-r border-gray-border bg-background">
      <div className="shrink-0 space-y-3 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-text">Components</p>
            <p className="text-[10px] text-gray-text-muted">Click to add to canvas</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-text-muted" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search..."
            className="h-8 border-gray-border bg-gray-elevated pl-8 text-xs"
          />
        </div>

        {!search.trim() && (
          <div className="flex flex-wrap gap-1.5">
            {QUICK_FIELDS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onAddField(item.type, item.label)}
                className="inline-flex items-center gap-1 rounded-md border border-gray-border bg-gray-elevated px-2 py-1 text-[10px] font-medium text-gray-text transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              >
                <Plus className="h-3 w-3" />
                {item.label}
              </button>
            ))}
          </div>
        )}

        {search.trim() && (
          <p className="text-[10px] text-gray-text-muted">
            {totalFields} result{totalFields === 1 ? '' : 's'}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {filteredCategories.map((category) => {
          const isOpen = openCategories[category.id] ?? true;

          return (
            <Collapsible
              key={category.id}
              open={isOpen}
              onOpenChange={(open) => setOpenCategories((prev) => ({ ...prev, [category.id]: open }))}
              className="overflow-hidden"
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between border border-gray-border mb-1 rounded-md px-2 py-2 text-left transition-colors hover:bg-gray-surface-hover/50"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {category.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] tabular-nums text-gray-text-muted">{category.fields.length}</span>
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 text-gray-text-muted transition-transform duration-200',
                        isOpen && 'rotate-180',
                      )}
                    />
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-0.5 px-1 pb-1">
                {category.fields.map((item) => (
                  <button
                    key={`${category.id}-${item.label}-${item.type}`}
                    type="button"
                    onClick={() => onAddField(item.type, item.label)}
                    className={cn(
                      'form-builder-palette-item group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                      'transition-colors hover:bg-gray-surface-hover/60',
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-surface text-primary">
                      <FieldTypeIcon type={item.type} className="h-3 w-3" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-text">{item.label}</span>
                    <Plus className="form-builder-palette-add h-3 w-3 shrink-0 text-gray-text-muted/50 opacity-0 group-hover:opacity-100" />
                  </button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {filteredCategories.length === 0 && (
          <div className="flex flex-col items-center px-2 py-8 text-center">
            <Type className="mb-2 h-5 w-5 text-gray-text-muted/40" />
            <p className="text-xs font-medium text-gray-text">No matches</p>
          </div>
        )}
      </div>
    </div>
  );
}
