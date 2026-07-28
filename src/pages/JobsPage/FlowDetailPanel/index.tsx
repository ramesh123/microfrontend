import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FlowJob } from '@/types/jobs';
import { Calendar, Hash, GitBranch, CheckCircle, XCircle, Loader, GitCommit, AlertTriangle } from 'lucide-react';
import { formatDateTime, getJobStatusColor, formatJobStatusLabel } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface FlowDetailPanelProps {
  flow: FlowJob;
}

const capitalizeFirst = (str?: string) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

export const FlowDetailPanel: React.FC<FlowDetailPanelProps> = ({ flow }) => {
  const StatusIcon = () => {
    switch (flow.job_status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 shrink-0 text-red-500" />;
      case 'running':
        return <Loader className="h-4 w-4 shrink-0 animate-spin text-blue-500" />;
      default:
        return <div className="h-4 w-4 shrink-0" aria-hidden />;
    }
  };

  return (
    <div className="flex h-full min-w-0 max-w-full flex-col overflow-hidden bg-card text-card-foreground">
      <header className="flex min-w-0 shrink-0 items-center gap-2 border-b px-3 py-2">
        <StatusIcon />
        <h4 className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug">
          {flow.flow_name}
        </h4>
      </header>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="min-w-0 space-y-2 p-2">
          <Card className="min-w-0 gap-2 py-2">
            <CardHeader className="gap-0 px-3 py-0">
              <CardTitle className="text-sm font-semibold">Run Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-2 text-sm">
              <SummaryRow label="Status">
                <Badge
                  variant="outline"
                  className={cn('max-w-full whitespace-normal text-xs', getJobStatusColor(flow.job_status))}
                >
                  {formatJobStatusLabel(flow.job_status)}
                </Badge>
              </SummaryRow>
              <SummaryRow label="Deployment">
                <span className="min-w-0 break-words font-medium">
                  {capitalizeFirst(flow.deployment_name)}
                </span>
              </SummaryRow>
              <SummaryRow label="Last Updated">
                <span className="min-w-0 break-words font-medium tabular-nums text-xs">
                  {formatDateTime(flow.updated_at)}
                </span>
              </SummaryRow>
              <SummaryRow label="Executed By">
                <span className="min-w-0 break-words font-medium">
                  {flow.executed_by || 'System'}
                </span>
              </SummaryRow>
            </CardContent>
          </Card>

          {flow.error_msg ? (
            <Card className="min-w-0 gap-1.5 border-destructive/50 bg-destructive/10 py-2">
              <CardHeader className="gap-0 px-3 py-0">
                <CardTitle className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Error
                </CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 px-3 pb-2 pt-0">
                <div className="max-h-[min(220px,35vh)] overflow-auto rounded-md border border-destructive/20 bg-background/60">
                  <pre className="max-w-full whitespace-pre-wrap break-all p-2 font-mono text-xs leading-relaxed text-destructive/90">
                    {flow.error_msg}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="min-w-0 gap-2 py-2">
            <CardHeader className="gap-0 px-3 py-0">
              <CardTitle className="text-sm font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-2 px-3 pb-2 text-sm">
              <InfoItem icon={Hash} label="Flow Run ID" value={flow.flow_run_id} />
              <Separator />
              <InfoItem icon={GitBranch} label="Flow ID" value={flow.flow_id} />
              <Separator />
              <InfoItem icon={GitCommit} label="Run Name" value={flow.flow_run_name} />
              <Separator />
              <InfoItem icon={Calendar} label="Created" value={formatDateTime(flow.created_at)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const SummaryRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid min-w-0 grid-cols-1 gap-0.5 sm:grid-cols-[minmax(0,6.5rem)_1fr] sm:items-start sm:gap-2">
    <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
    <div className="min-w-0 sm:justify-self-stretch">{children}</div>
  </div>
);

const InfoItem: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({
  icon: Icon,
  label,
  value,
}) => (
  <div className="min-w-0 space-y-0.5">
    <div className="flex min-w-0 items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
    <span className="block min-w-0 max-w-full break-all pl-5 font-mono text-xs text-foreground/90">
      {value}
    </span>
  </div>
);
