import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type DashboardSidebarCollapsedRailProps = {
  label: string;
  count?: number;
  icon?: ReactNode;
  onExpand: () => void;
  className?: string;
  title?: string;
};

export function DashboardSidebarCollapsedRail({
  label,
  count,
  icon,
  onExpand,
  className,
  title,
}: DashboardSidebarCollapsedRailProps) {
  const countSuffix = typeof count === 'number' ? ` (${count})` : '';
  const expandTitle = title ?? `Expand ${label}`;

  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-start pt-3 transition-opacity duration-300 pointer-events-auto select-none cursor-pointer space-y-4 bg-muted/30',
        className,
      )}
      onClick={onExpand}
      title={expandTitle}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onExpand();
        }
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary"
        onClick={(event) => {
          event.stopPropagation();
          onExpand();
        }}
        aria-label={expandTitle}
      >
        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
      </Button>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 [writing-mode:vertical-lr] flex items-center gap-1.5">
        {icon}
        {label}
        {countSuffix}
      </span>
    </div>
  );
}
