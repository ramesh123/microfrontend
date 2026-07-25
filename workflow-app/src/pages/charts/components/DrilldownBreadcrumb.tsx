import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Breadcrumb for saved dashboard: "Level:" + active level name (blue) + dot indicators (blue = current, gray = others) */
export interface LevelBreadcrumbProps {
  /** Level labels, e.g. ["Base", "Quarter", "Month", ...] */
  levelLabels: string[];
  /** 0-based index of the currently active level */
  currentLevelIndex: number;
  className?: string;
}

export function LevelBreadcrumb({ levelLabels, currentLevelIndex, className = '' }: LevelBreadcrumbProps) {
  if (levelLabels.length === 0) return null;
  const safeIndex = Math.max(0, Math.min(currentLevelIndex, levelLabels.length - 1));
  const currentLabel = levelLabels[safeIndex];

  return (
    <div className={`flex items-center gap-2 flex-wrap text-sm ${className}`}>
      <span className="text-muted-foreground font-medium">Level:</span>
      <span className="text-primary font-medium" title={currentLabel}>
        {currentLabel}
      </span>
      <div className="flex items-center gap-1">
        {levelLabels.map((_, i) => (
          <span
            key={i}
            className={`inline-block rounded-full shrink-0 ${
              i === safeIndex ? 'bg-primary h-1.5 w-1.5' : 'bg-muted-foreground/40 h-1.5 w-1.5'
            }`}
            title={levelLabels[i]}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

export interface DrilldownFilter {
  field: string;
  value: any;
}

export interface DrilldownLevel {
  drill_filters: Array<{ column: string; value: any }>;
  drill_columns?: Array<{ column: string }>;
}

interface DrilldownBreadcrumbProps {
  /** Legacy: flat list of filters (one per level when levels not provided) */
  filters: DrilldownFilter[];
  /** Level-by-level config: when provided, breadcrumb shows Base → Level 1 → Level 2 … and onNavigate(levelIndex) */
  levels?: DrilldownLevel[];
  onNavigate: (index: number) => void;
  /** When true (e.g. saved dashboard view), breadcrumb is read-only and not clickable */
  viewOnly?: boolean;
}

export function DrilldownBreadcrumb({
  filters,
  levels,
  onNavigate,
  viewOnly = false,
}: DrilldownBreadcrumbProps) {
  const useLevels = Array.isArray(levels) && levels.length > 0;

  const segments: { label: string; levelIndex: number }[] = useLevels
    ? [
        { label: 'Base', levelIndex: 0 },
        ...levels.map((lev, idx) => {
          const label =
            lev.drill_filters.length === 1
              ? `${lev.drill_filters[0].column}: ${lev.drill_filters[0].value}`
              : lev.drill_filters.map((f) => `${f.column}: ${f.value}`).join(', ');
          return { label, levelIndex: idx + 1 };
        }),
      ]
    : filters.length === 0
      ? []
      : filters.map((f, idx) => ({
          label: `${f.field}: ${f.value}`,
          levelIndex: idx,
        }));

  if (segments.length === 0) return null;

  return (
    <div className="mb-2 w-full overflow-x-auto">
     
    </div>
  );
}
