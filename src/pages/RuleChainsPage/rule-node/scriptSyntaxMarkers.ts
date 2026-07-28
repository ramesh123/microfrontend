import { parse } from "acorn";

import type { SimpleMarker } from "./monacoTbelSupport";

/**
 * JavaScript / TBEL-ish script body: syntax errors as Monaco markers (line/column from Acorn).
 * TBEL is close enough to JS that this catches many real mistakes; false positives are possible.
 */
export function computeScriptSyntaxMarkers(source: string): SimpleMarker[] {
  const trimmed = source.trim();
  if (!trimmed) return [];
  try {
    parse(source, {
      ecmaVersion: "latest",
      sourceType: "script",
      allowReturnOutsideFunction: true,
      locations: true,
    });
    return [];
  } catch (e) {
    const err = e as {
      message?: string;
      loc?: { line: number; column: number; endColumn?: number };
    };
    const loc = err.loc;
    const msg = typeof err.message === "string" ? err.message : "Syntax error";
    if (loc && typeof loc.line === "number" && typeof loc.column === "number") {
      const line = loc.line;
      const col = loc.column + 1;
      const endCol =
        typeof loc.endColumn === "number" && loc.endColumn > loc.column ? loc.endColumn + 1 : col + 1;
      return [
        {
          startLineNumber: line,
          startColumn: col,
          endLineNumber: line,
          endColumn: Math.max(endCol, col + 1),
          message: msg,
        },
      ];
    }
    return [
      {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 2,
        message: msg,
      },
    ];
  }
}
