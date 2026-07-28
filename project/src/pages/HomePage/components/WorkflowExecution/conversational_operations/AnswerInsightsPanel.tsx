import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Database,
  FileSearch,
  Lightbulb,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';
import {
  formatDirectAnswer,
  type RunAssistantAnswerData,
} from '@/controllers/API/runAssistantApi';
import { toast } from 'sonner';

function confidenceVariant(confidence: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const v = confidence.toLowerCase();
  if (v === 'high') return 'default';
  if (v === 'medium') return 'secondary';
  if (v === 'low') return 'destructive';
  return 'outline';
}

type AnswerInsightsPanelProps = {
  answer: RunAssistantAnswerData | null;
  confidence: string;
  recordStatus: string;
};

export function AnswerInsightsPanel({ answer, confidence, recordStatus }: AnswerInsightsPanelProps) {
  const [queriesOpen, setQueriesOpen] = useState(false);

  const directAnswer = answer ? formatDirectAnswer(answer.direct_answer) : '';
  const factsUsed = answer?.facts_used ?? [];
  const queries = answer?.queries_executed ?? [];

  if (!answer) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[200px]">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
            <FileSearch className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">No insights yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ask a question to see the direct answer, facts, and queries used.
            </p>
          </div>
        </CardContent>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <CardContent className="p-4 pb-6 space-y-4">
        {factsUsed.length > 0 ? (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Lightbulb className="size-3.5" />
              Facts used
            </h4>
            <ul className="space-y-1.5">
              {factsUsed.map((fact, idx) => (
                <li
                  key={`${idx}-${fact.slice(0, 24)}`}
                  className="text-sm flex gap-2 rounded-md border bg-card px-3 py-2"
                >
                  <span className="text-primary font-bold text-xs shrink-0 mt-0.5">{idx + 1}</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {queries.length > 0 ? (
          <section className="rounded-lg border overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
              onClick={() => setQueriesOpen((o) => !o)}
            >
              {queriesOpen ? (
                <ChevronDown className="size-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              )}
              <Database className="size-3.5 text-primary shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Queries executed ({queries.length})
              </span>
            </button>
            {queriesOpen ? (
              <div className="border-t divide-y">
                {queries.map((q, idx) => (
                  <div key={`${idx}-${q.target}`} className="px-3 py-3 space-y-1.5 bg-muted/10">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px] h-5 font-mono">
                        {q.query_engine}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground font-mono truncate">{q.target}</span>
                    </div>
                    <p className="text-xs text-foreground">{q.purpose}</p>
                    <pre className="text-[10px] font-mono bg-muted/60 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground">
                      {q.query_text}
                    </pre>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {answer.next_best_action ? (
          <section className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Next best action
            </h4>
            <p className="text-sm">{answer.next_best_action}</p>
          </section>
        ) : null}
      </CardContent>
    </div>
  );
}
