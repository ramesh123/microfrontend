import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

/** Line numbers that should show ThingsBoard-style gutter + line tint. */
export function uniqueErrorLines(markers: { startLineNumber: number }[]): number[] {
  return [...new Set(markers.map((m) => m.startLineNumber).filter((n) => n > 0))].sort((a, b) => a - b);
}

/**
 * Whole-line background + margin glyph (CSS) for script syntax/structure errors — complements Monaco markers.
 */
export function syncRuleChainScriptErrorDecorations(
  ed: editor.IStandaloneCodeEditor,
  monaco: Monaco,
  decoIdsRef: { current: string[] },
  markers: { startLineNumber: number }[],
): void {
  const model = ed.getModel();
  if (!model) return;
  const lines = uniqueErrorLines(markers);
  if (lines.length === 0) {
    decoIdsRef.current = ed.deltaDecorations(decoIdsRef.current, []);
    return;
  }
  const next = lines.map((line) => ({
    range: new monaco.Range(line, 1, line, Math.max(1, model.getLineMaxColumn(line))),
    options: {
      isWholeLine: true,
      className: "rule-chain-script-error-line",
      marginClassName: "rule-chain-script-error-glyph",
    },
  }));
  decoIdsRef.current = ed.deltaDecorations(decoIdsRef.current, next);
}

export function clearRuleChainScriptErrorDecorations(
  ed: editor.IStandaloneCodeEditor,
  decoIdsRef: { current: string[] },
): void {
  decoIdsRef.current = ed.deltaDecorations(decoIdsRef.current, []);
}
