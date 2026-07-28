import type { ScadaSvgAnalysis } from "./scadaSymbolSvgAnalysis";

export function ScadaSymbolAnalysisPanel({ analysis }: { analysis: ScadaSvgAnalysis | null }) {
  if (!analysis) {
    return <p className="text-sm text-muted-foreground">No analysis yet.</p>;
  }
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Aspect ratio</p>
          <p className="font-mono text-xs">{analysis.aspectLabel ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">viewBox</p>
          <p className="break-all font-mono text-xs">{analysis.viewBox ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Width × height</p>
          <p className="font-mono text-xs">
            {analysis.widthAttr ?? "—"} × {analysis.heightAttr ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">tb extension namespace</p>
          <p className="text-xs">{analysis.hasTbNamespace ? "Yes" : "No"}</p>
        </div>
      </div>

      {analysis.metadataJson && Object.keys(analysis.metadataJson).length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">tb:metadata (parsed)</p>
          <pre className="max-h-32 overflow-auto rounded-md border border-border bg-muted/30 p-2 text-xs">
            {JSON.stringify(analysis.metadataJson, null, 2)}
          </pre>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">tb:tag values ({analysis.tbTags.length})</p>
        {analysis.tbTags.length ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {analysis.tbTags.map((t) => (
              <code key={t} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                {t}
              </code>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">None detected.</p>
        )}
      </div>

      {analysis.elementIds.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Element ids ({analysis.elementIds.length})</p>
          <p className="max-h-24 overflow-y-auto break-all font-mono text-[11px] text-muted-foreground">{analysis.elementIds.join(", ")}</p>
        </div>
      ) : null}

      {analysis.warnings.length > 0 ? (
        <ul className="list-inside list-disc space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-2 text-xs text-amber-900 dark:text-amber-100">
          {analysis.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No structural warnings.</p>
      )}
    </div>
  );
}
