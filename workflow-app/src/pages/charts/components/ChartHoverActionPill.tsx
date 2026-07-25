import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChartHoverActionPillProps {
  children: React.ReactNode;
  /** When true (default), toolbar stays visible instead of hover-only. */
  alwaysVisible?: boolean;
  /** @deprecated Use alwaysVisible. Kept for backwards compatibility. */
  pinned?: boolean;
  /** `header` = card title row; `overlay` = floating on chart canvas. */
  placement?: 'header' | 'overlay';
  className?: string;
}

export function ChartHoverActionPill({
  children,
  alwaysVisible = true,
  pinned = false,
  placement = 'overlay',
  className,
}: ChartHoverActionPillProps) {
  const showAlways = alwaysVisible || pinned;

  return (
    <div
      className={cn(
        'z-20',
        placement === 'header' ? 'relative shrink-0' : 'absolute top-2 right-2',
        showAlways
          ? 'opacity-100 pointer-events-auto'
          : 'opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto hover:opacity-100 hover:pointer-events-auto',
        className,
      )}
    >
      <div
        className="flex items-center gap-0 rounded-full border border-border/70 bg-background/95 px-1 py-0 shadow-[0_2px_10px_rgba(15,23,42,0.14)] backdrop-blur-sm"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

interface ChartHoverActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  className?: string;
}

export const ChartHoverActionButton = React.forwardRef<
  HTMLButtonElement,
  ChartHoverActionButtonProps
>(({
  children,
  onClick,
  disabled,
  active,
  title,
  className,
  ...props
}, ref) => {
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon"
      title={title}
      tabIndex={disabled ? -1 : undefined}
      className={cn(
        'h-6 w-6 rounded-full text-muted-foreground transition-colors',
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:bg-muted/70 hover:text-foreground',
        active && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
        className,
      )}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </Button>
  );
});

ChartHoverActionButton.displayName = 'ChartHoverActionButton';

