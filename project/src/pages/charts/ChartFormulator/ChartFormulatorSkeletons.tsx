import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function ChartFormulatorPreviewSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-full w-full min-h-0 flex-col gap-3 p-3', className)}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <Skeleton className="h-3 w-24 rounded-full" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-3 rounded-full" />
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <Skeleton className="absolute left-0 top-2 bottom-8 w-0.5 rounded-full" />
        <Skeleton className="absolute left-6 right-0 bottom-6 h-0.5 rounded-full" />
        <div className="ml-6 mr-2 flex flex-1 items-end justify-around gap-2 pb-8 pt-4">
          <Skeleton className="h-[35%] w-[10%] rounded-t-sm" />
          <Skeleton className="h-[55%] w-[10%] rounded-t-sm" />
          <Skeleton className="h-[42%] w-[10%] rounded-t-sm" />
          <Skeleton className="h-[68%] w-[10%] rounded-t-sm" />
          <Skeleton className="h-[48%] w-[10%] rounded-t-sm" />
          <Skeleton className="h-[62%] w-[10%] rounded-t-sm" />
        </div>
        <div className="ml-6 mr-2 flex shrink-0 items-center justify-between gap-2">
          <Skeleton className="h-2 w-[14%] rounded-full" />
          <Skeleton className="h-2 w-[18%] rounded-full" />
          <Skeleton className="h-2 w-[12%] rounded-full" />
          <Skeleton className="h-2 w-[20%] rounded-full" />
          <Skeleton className="h-2 w-[16%] rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ChartFormulatorTableSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-full w-full min-h-0 flex-col gap-0 overflow-hidden rounded-md border border-border/60', className)}>
      <div className="flex shrink-0 items-center gap-3 border-b border-border/50 bg-muted/30 px-3 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={`th-${i}`} className="h-3 flex-1 rounded-full" />
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0">
        {Array.from({ length: 8 }).map((_, row) => (
          <div
            key={`tr-${row}`}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5',
              row % 2 === 0 ? 'bg-background' : 'bg-muted/20',
            )}
          >
            {Array.from({ length: 5 }).map((_, col) => (
              <Skeleton
                key={`td-${row}-${col}`}
                className={cn('h-2.5 flex-1 rounded-full', col === 0 && 'max-w-[28%]')}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-border/50 px-3 py-2">
        <Skeleton className="h-2.5 w-24 rounded-full" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function ChartSelectorSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex h-auto flex-col overflow-hidden p-1">
      <div className="flex items-center gap-2 overflow-x-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={`chart-type-${i}`}
            className="flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-border/60 px-4 py-2"
          >
            <Skeleton className="size-10 rounded-md" />
            <Skeleton className="h-2 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartFormulatorFormSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-9 w-full rounded-md" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full rounded-md" />
      <Skeleton className="h-4 w-28" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-9 rounded-md" />
        <Skeleton className="h-9 rounded-md" />
      </div>
      <Skeleton className="mt-2 h-9 w-full rounded-md" />
    </div>
  );
}
