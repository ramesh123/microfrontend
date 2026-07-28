import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { BigNumberCustomizationOptions } from './BigNumberCustmizechart';

/** Outer shell for Big Number customize panels — minimal padding, stacked section cards. */
export const BIG_NUMBER_CUSTOMIZE_PANEL_CLASS = 'space-y-1.5 px-1 pb-1';

export function BigNumberCustomizePanelShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={BIG_NUMBER_CUSTOMIZE_PANEL_CLASS}>
      <div className="px-1 pb-0.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">{title}</h3>
        {description ? <p className="text-[11px] leading-snug text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function BigNumberCustomizeFieldRow({
  label,
  hint,
  children,
  className,
}: {
  label?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {label ? (
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      ) : null}
      {hint ? <div className="text-[10px] leading-snug text-muted-foreground">{hint}</div> : null}
      <div className="w-full">{children}</div>
    </div>
  );
}

export function BigNumberCustomizeToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
  className,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded border border-border/60 bg-muted/40 px-2 py-1.5',
        className,
      )}
    >
      <div className="min-w-0">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {hint ? <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="shrink-0 scale-90" />
    </div>
  );
}

export function BigNumberCustomizeCollapsibleSection({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group overflow-hidden rounded-md border border-border bg-card shadow-sm"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center justify-between gap-2 border-l-[3px] px-2 py-1.5 text-left transition-colors',
            'border-l-border bg-muted/50 hover:bg-muted/70',
            'group-data-[state=open]:border-l-primary group-data-[state=open]:bg-muted/70',
            'group-data-[state=open]:border-b group-data-[state=open]:border-b-border',
          )}
        >
          <div className="min-w-0">
            <div className="text-xs font-semibold text-foreground">{title}</div>
            {description ? (
              <div className="truncate text-[10px] leading-snug text-muted-foreground">{description}</div>
            ) : null}
          </div>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180 text-primary',
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1.5 border-t border-border/60 bg-card px-2 py-1.5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function dispatchBigNumberCustomizationChange<T extends BigNumberCustomizationOptions>(next: T) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('chartCustomizationChanged', { detail: next }));
  (window as any).__chartCustomizationOptions = next;
}

export type BigNumberCustomizeSectionProps = {
  options: BigNumberCustomizationOptions;
  onOptionsChange: (next: BigNumberCustomizationOptions) => void;
};

export function useBigNumberCustomizeHandlers<T extends BigNumberCustomizationOptions>(
  options: T,
  onOptionsChange: (next: T) => void,
) {
  const update = React.useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      const next = { ...(options || {}), [key]: value } as T;
      onOptionsChange(next);
      dispatchBigNumberCustomizationChange(next);
    },
    [options, onOptionsChange],
  );

  const applyOptions = React.useCallback(
    (next: T) => {
      onOptionsChange(next);
      dispatchBigNumberCustomizationChange(next);
    },
    [onOptionsChange],
  );

  return { update, applyOptions };
}
