import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormBuilderField } from '../../types';

interface SectionDividerProps {
  field: FormBuilderField;
  variant?: 'default' | 'canvas' | 'runtime';
}

export function SectionDivider({ field, variant = 'default' }: SectionDividerProps) {
  if (variant === 'runtime') {
    return (
      <div className="pt-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          {field.displayName}
        </p>
        <div className="mt-2 h-px w-full bg-border" />
      </div>
    );
  }

  return (
    <div className={cn('flex w-full min-w-0 items-center gap-2 py-0.5')}>
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <LayoutGrid className="h-3 w-3" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            {field.displayName}
          </span>
          {variant === 'canvas' && (
            <span className="truncate text-[9px] text-muted-foreground">Section group</span>
          )}
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 items-center">
        <div className="h-px w-full bg-gradient-to-r from-primary/50 via-primary/20 to-transparent" />
        <div className="absolute left-1/3 flex -translate-y-1/2 gap-1">
          <span className="h-1 w-1 rounded-full bg-primary/60" />
          <span className="h-1 w-1 rounded-full bg-primary/35" />
          <span className="h-1 w-1 rounded-full bg-primary/20" />
        </div>
      </div>
    </div>
  );
}
