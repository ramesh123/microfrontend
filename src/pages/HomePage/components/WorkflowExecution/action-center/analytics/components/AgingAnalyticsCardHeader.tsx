import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  agingCardHeader,
  agingCardSubtitle,
  agingCardTitle,
  agingIconBadge,
} from '../utils/agingUiTokens';

interface AgingAnalyticsCardHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  className?: string;
}

export function AgingAnalyticsCardHeader({
  icon: Icon,
  title,
  subtitle,
  trailing,
  className,
}: AgingAnalyticsCardHeaderProps) {
  return (
    <div className={cn(agingCardHeader, trailing ? 'justify-between' : undefined, className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <div className={agingIconBadge}>
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className={cn(agingCardTitle, 'truncate')}>{title}</p>
          {subtitle ? <p className={agingCardSubtitle}>{subtitle}</p> : null}
        </div>
      </div>
      {trailing}
    </div>
  );
}
