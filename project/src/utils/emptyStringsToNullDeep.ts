/**
 * Recursively maps `""` to `null` in plain objects and arrays.
 * Used for connection payloads where the API distinguishes absent values from empty strings.
 */
export function emptyStringsToNullDeep<T>(input: T): T {
  if (input === "") return null as T;
  if (Array.isArray(input)) {
    return input.map((item) => emptyStringsToNullDeep(item)) as T;
  }
  if (input !== null && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = emptyStringsToNullDeep(v);
    }
    return out as T;
  }
  return input;
}
