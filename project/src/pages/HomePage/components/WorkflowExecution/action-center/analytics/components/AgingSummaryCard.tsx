import { cn } from '@/lib/utils';
import { agingKpiLabel, agingKpiValue } from '../utils/agingUiTokens';
import { RECON_STAT_CARD_SURFACE } from '@/pages/HomePage/components/WorkflowExecution/reconciliationStatCardStyles';
import '@/pages/HomePage/components/WorkflowExecution/reconciliationStatCards.css';

interface AgingSummaryCardProps {
  label: string;
  value: string;
  valueClassName?: string;
  isLoading?: boolean;
}

export function AgingSummaryCard({
  label,
  value,
  valueClassName,
  isLoading,
}: AgingSummaryCardProps) {
  return (
    <div
      className={cn(
        RECON_STAT_CARD_SURFACE,
        'flex h-[3.25rem] min-w-[120px] flex-col items-center justify-center px-2 py-1 text-center',
        isLoading && 'animate-pulse opacity-60',
      )}
      title={label}
    >
      <span className={cn(agingKpiLabel, 'line-clamp-1 w-full')}>{label}</span>
      <span className={cn(agingKpiValue, valueClassName ?? 'text-foreground')}>{value}</span>
    </div>
  );
}
