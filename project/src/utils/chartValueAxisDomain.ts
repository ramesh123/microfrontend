/**
 * Pads value (Y) axis domain for bar/line/area: min=0 when all points are non-negative
 * (unless user fixed bounds); max += 1 when not user-fixed and max >= 0 (headroom for labels / top tick).
 */
export function computePaddedValueAxisDomain(
  allVals: number[],
  minVal: number,
  maxVal: number,
  logEnabled: boolean,
  userTruncate: boolean,
  rawMin: unknown,
  rawMax: unknown,
): { minVal: number; maxVal: number } {
  const parseBound = (v: unknown): number | null => {
    if (v === null || typeof v === 'undefined' || v === '') return null;
    const n = Number(String(v));
    return Number.isFinite(n) ? n : null;
  };
  if (!allVals.length || logEnabled) return { minVal, maxVal };
  const explicitMin = userTruncate && parseBound(rawMin) !== null;
  const explicitMax = userTruncate && parseBound(rawMax) !== null;
  let outMin = minVal;
  let outMax = maxVal;
  if (!explicitMin && allVals.every((v) => v >= 0)) outMin = 0;
  if (!explicitMax && outMax > outMin && outMax >= 0) outMax = outMax + 1;
  return { minVal: outMin, maxVal: outMax };
}
