import { cn } from '@/lib/utils';
import type { FormBuilderField } from '../../types';

interface FormBigNumberProps {
  field: FormBuilderField;
  value?: string;
  variant?: 'default' | 'canvas' | 'runtime';
  /** When set, card fills this height (from grid resize / layout.h). */
  fillHeight?: boolean;
}

export function FormBigNumber({
  field,
  value,
  variant = 'default',
  fillHeight = false,
}: FormBigNumberProps) {
  const displayValue = value || field.bigNumberValue || '0';
  const accent = field.bigNumberColor ?? '#3B82F6';
  const isCompact = variant === 'canvas';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-gray-border bg-gray-elevated',
        fillHeight ? 'flex h-full min-h-0 flex-col justify-center' : undefined,
        isCompact ? 'px-3 py-1.5' : 'px-4 py-3',
      )}
    >
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <div className={cn('pl-2', isCompact ? 'space-y-0.5' : 'space-y-1')}>
        <p
          className={cn(
            'font-medium text-gray-text-muted',
            isCompact ? 'text-[10px]' : 'text-xs',
          )}
        >
          {field.displayName}
        </p>
        <p
          className={cn(
            'font-semibold tabular-nums tracking-tight text-gray-text',
            isCompact ? 'text-lg leading-none' : 'text-2xl leading-none',
          )}
          style={{ color: accent }}
        >
          {field.bigNumberPrefix}
          {displayValue}
          {field.bigNumberSuffix}
        </p>
        {field.bigNumberSubLabel && (
          <p className={cn('text-gray-text-muted', isCompact ? 'text-[10px]' : 'text-xs')}>
            {field.bigNumberSubLabel}
          </p>
        )}
      </div>
    </div>
  );
}
