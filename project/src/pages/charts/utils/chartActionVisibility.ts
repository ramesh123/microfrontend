type DrilldownLevelLike = {
  drill_columns?: Array<{ column?: string; columns?: string } | string>;
};

export function hasConfiguredDrilldownLevels(levels: unknown): boolean {
  if (!Array.isArray(levels) || levels.length === 0) return false;
  return (levels as DrilldownLevelLike[]).some((level) => {
    const cols = level?.drill_columns;
    return Array.isArray(cols) && cols.length > 0;
  });
}

export function isChartTypeExcludedFromDrilldown(vizName: string): boolean {
  const id = vizName.toLowerCase();
  return (
    /pivot|pivot_table/.test(id) ||
    /table/.test(id) ||
    /number|bignumber|big number/.test(id) ||
    /gauge/.test(id)
  );
}

export function isChartTypeExcludedFromDrillThrough(vizName: string): boolean {
  const id = vizName.toLowerCase();
  return (
    /pivot|pivot_table/.test(id) ||
    /table/.test(id) ||
    /number|bignumber|big number/.test(id)
  );
}

export function canShowDrilldownButton(vizName: string, drilldownLevels: unknown): boolean {
  return !isChartTypeExcludedFromDrilldown(vizName) && hasConfiguredDrilldownLevels(drilldownLevels);
}

/** Chart formulator: show drilldown arm button for supported types (levels added after first drill). */
export function canShowDrilldownButtonInEditor(vizName: string): boolean {
  return !isChartTypeExcludedFromDrilldown(vizName);
}

export function canShowDrillThroughButton(vizName: string): boolean {
  return !isChartTypeExcludedFromDrillThrough(vizName);
}
