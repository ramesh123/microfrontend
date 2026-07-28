import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { ParameterListProps } from '../types';

/**
 * ParameterList Component
 *
 * Renders a dynamic list of key-value parameter pairs with add/remove functionality.
 * Used for both class parameters and function parameters in CustomScripts node.
 */
const ParameterList: React.FC<ParameterListProps> = ({
  label,
  parameters,
  onChange,
  layout = "default",
  hint,
  tableBorderless = false,
}) => {
  const handleAddParameter = useCallback(() => {
    onChange([...parameters, { key: '', value: '' }]);
  }, [parameters, onChange]);

  const handleRemoveParameter = useCallback((index: number) => {
    const updated = parameters.filter((_, i) => i !== index);
    onChange(updated);
  }, [parameters, onChange]);

  const handleParameterChange = useCallback(
    (index: number, field: 'key' | 'value', value: string) => {
      const updated = [...parameters];
      updated[index] = { ...updated[index], [field]: value };
      onChange(updated);
    },
    [parameters, onChange]
  );

  if (layout === "table") {
    const shell = tableBorderless
      ? "overflow-hidden text-sm"
      : "overflow-hidden rounded-lg border border-border bg-card text-sm shadow-sm";
    const head = tableBorderless
      ? "flex items-center justify-between gap-3 border-b border-border/50 pb-2"
      : "flex items-start justify-between gap-3 border-b border-border bg-muted/30 px-3 py-2.5";
    const bodyPad = tableBorderless ? "" : "px-3";
    const rowPad = tableBorderless ? "gap-1.5 py-1.5" : "gap-2 px-3 py-2";

    return (
      <div className={shell}>
        <div className={head}>
          <div className="min-w-0 flex-1 pr-2">
            {label ? (
              <div className="text-sm font-semibold leading-tight text-foreground">
                {label}
              </div>
            ) : null}
            
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddParameter}
            className="!h-8 shrink-0 px-2.5 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add row
          </Button>
        </div>

        {parameters.length === 0 ? (
          <div
            className={
              tableBorderless
                ? "py-4 text-center text-xs text-muted-foreground"
                : "px-3 py-6 text-center text-xs text-muted-foreground"
            }
          >
            No rows yet. Use <span className="font-medium text-foreground">Add row</span> to add
            key/value pairs.
          </div>
        ) : (
          <div className={`divide-y divide-border/60 ${bodyPad}`}>
            <div
              className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-center ${rowPad} text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}
            >
              <span className='font-bold'>Key</span>
              <span className='font-bold'>Value</span>
              <span className="sr-only">Remove</span>
            </div>
            {parameters.map((param, index) => (
              <div
                key={index}
                className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-center ${rowPad}`}
              >
                <Input
                  placeholder="Name"
                  value={param.key}
                  onChange={(e) => handleParameterChange(index, "key", e.target.value)}
                  className={tableBorderless ? "!h-9 text-xs" : "!h-9 text-sm"}
                />
                <Input
                  placeholder="Value"
                  value={param.value}
                  onChange={(e) => handleParameterChange(index, "value", e.target.value)}
                  className={tableBorderless ? "!h-9 text-xs" : "!h-9 text-sm"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveParameter(index)}
                  className={
                    tableBorderless
                      ? "h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      : "h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                  }
                  aria-label="Remove row"
                >
                  <Trash2 className={tableBorderless ? "h-3.5 w-3.5" : "h-4 w-4"} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAddParameter}
          className="h-6 px-2 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {parameters.length === 0 ? (
        <div className="text-xs text-muted-foreground italic py-2 px-3 bg-muted/30 rounded border border-dashed">
          No parameters. Click "Add" to create one.
        </div>
      ) : (
        <div className="space-y-1.5">
          {parameters.map((param, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <Input
                placeholder="Key"
                value={param.key}
                onChange={(e) => handleParameterChange(index, 'key', e.target.value)}
                className="h-7 text-xs flex-1"
              />
              <Input
                placeholder="Value"
                value={param.value}
                onChange={(e) => handleParameterChange(index, 'value', e.target.value)}
                className="h-7 text-xs flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveParameter(index)}
                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ParameterList;
