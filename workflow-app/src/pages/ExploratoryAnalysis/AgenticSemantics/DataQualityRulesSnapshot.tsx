import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchDataQualityRules,
  type DataQualityRuleRow,
} from "@/controllers/API/dataQualityApi";

function statusPillClass(status: string | null | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s === "active") return "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300";
  if (s === "rejected") return "bg-red-500/12 text-red-800 dark:text-red-300";
  if (s === "needs_review") return "bg-amber-500/12 text-amber-900 dark:text-amber-200";
  return "bg-muted text-muted-foreground";
}

/**
 * Read-only list of data quality rules for an agentic run (no approve / resume actions).
 */
export function DataQualityRulesSnapshot({
  tenantId,
  domainId,
  runId,
  enabled,
}: {
  tenantId: string;
  domainId: string;
  runId: string;
  enabled: boolean;
}) {
  const [rules, setRules] = useState<DataQualityRuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !tenantId.trim() || !domainId.trim() || !runId.trim()) {
      setRules([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetchDataQualityRules({
          tenant_id: tenantId.trim(),
          domain_id: domainId.trim(),
          run_id: runId.trim(),
        });
        const list = Array.isArray(res.rules) ? res.rules : [];
        if (!cancelled) {
          setRules(list);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error)?.message || "Could not load rules");
          setRules([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, tenantId, domainId, runId]);

  if (!enabled) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
        <span>Loading rules…</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-[11px] text-red-600 dark:text-red-400 py-1">{error}</p>;
  }

  if (rules.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground py-1">No rules returned for this run.</p>
    );
  }

  return (
    <div className="rounded-md border border-border/50 bg-muted/10 overflow-hidden">
      <div className="max-h-[320px] overflow-y-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 z-[1] bg-muted/80 backdrop-blur-sm border-b border-border/40">
            <tr className="text-muted-foreground font-medium">
              <th className="px-2 py-1.5 font-medium">Status</th>
              <th className="px-2 py-1.5 font-medium">Type</th>
              <th className="px-2 py-1.5 font-medium">Table · column</th>
              <th className="px-2 py-1.5 font-medium">Rule</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => {
              const loc = [r.table_name, r.column_name].filter(Boolean).join(" · ") || "—";
              const src =
                typeof r.source_text === "string" && r.source_text.trim()
                  ? r.source_text.trim()
                  : "—";
              return (
                <tr key={r.rule_id} className="border-b border-border/30 last:border-0 align-top">
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span
                      className={cn(
                        "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
                        statusPillClass(r.rule_status),
                      )}
                    >
                      {(r.rule_status ?? "—").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                    {r.rule_type ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{loc}</td>
                  <td className="px-2 py-1.5 text-foreground/90 break-words max-w-[min(280px,40vw)]">
                    {src}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
