import { cn } from '@/lib/utils';

export interface AgingSegmentOption<T extends string> {
  id: T;
  label: string;
}

interface AgingSegmentToggleProps<T extends string> {
  options: AgingSegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function AgingSegmentToggle<T extends string>({
  options,
  value,
  onChange,
}: AgingSegmentToggleProps<T>) {
  return (
    <div className="inline-flex rounded-lg bg-muted/60 p-0.5 gap-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-all',
            value === option.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
