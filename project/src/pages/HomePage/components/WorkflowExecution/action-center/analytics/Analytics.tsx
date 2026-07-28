import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FlowJobsDateFilter,
  type FlowDateFilterValue,
} from '@/components/common/FlowJobsDateFilter';
import type { AnalyticsProps } from './types';
import { AnalyticsView } from './AnalyticsView';
import { AnalyticsAgingView } from './AnalyticsAgingView';
import { AnalyticsDashboardProvider } from './AnalyticsDashboardContext';
import { AnalyticsDashboardTabsRowExtras } from './AnalyticsDashboardTabsRowExtras';

const DEFAULT_DATE_FILTER: FlowDateFilterValue = { mode: 'all' };

function AnalyticsTabs(props: AnalyticsProps & {
  activeTab: 'aging' | 'dashboard';
  setActiveTab: (tab: 'aging' | 'dashboard') => void;
  dateFilter: FlowDateFilterValue;
  setDateFilter: (value: FlowDateFilterValue) => void;
  agingLoading: boolean;
  setAgingLoading: (loading: boolean) => void;
  setAgingRefresh: (fn: (() => void) | null) => void;
}) {
  const {
    activeTab,
    setActiveTab,
    dateFilter,
    setDateFilter,
    agingLoading,
    setAgingLoading,
    setAgingRefresh,
    flowId,
  } = props;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as 'aging' | 'dashboard')}
      className="grid h-full min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-0"
    >
      <div className="mx-0 mb-1 pt-1 grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
        <TabsList className="h-8 w-fit shrink-0">
          <TabsTrigger value="aging" className="px-3 text-xs">
            Day Wise Trends
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="px-3 text-xs">
            Dashboard
          </TabsTrigger>
        </TabsList>

        {activeTab === 'dashboard' ? (
          <AnalyticsDashboardTabsRowExtras />
        ) : (
          <>
            <div aria-hidden className="min-w-0" />
            <div className="flex shrink-0 items-center justify-end gap-2">
              <FlowJobsDateFilter
                value={dateFilter}
                onChange={setDateFilter}
                isLoading={agingLoading}
                idPrefix="analytics-aging"
                onlyAllAndCustom={true}
              />
            </div>
          </>
        )}
      </div>

      <TabsContent
        value="aging"
        className="row-start-2 mt-0 flex min-h-0 flex-col overflow-hidden data-[state=inactive]:hidden"
      >
        <AnalyticsAgingView
          flowId={flowId}
          dateFilter={dateFilter}
          onLoadingChange={setAgingLoading}
          onRegisterRefresh={setAgingRefresh}
        />
      </TabsContent>
      <TabsContent
        value="dashboard"
        className="row-start-2 mt-0 flex min-h-0 flex-col overflow-hidden data-[state=inactive]:hidden"
      >
        {activeTab === 'dashboard' ? <AnalyticsView showToolbar={false} /> : null}
      </TabsContent>
    </Tabs>
  );
}

export function Analytics(props: AnalyticsProps) {
  const [activeTab, setActiveTab] = useState<'aging' | 'dashboard'>('aging');
  const [dateFilter, setDateFilter] = useState<FlowDateFilterValue>(DEFAULT_DATE_FILTER);
  const [agingLoading, setAgingLoading] = useState(false);
  const [, setAgingRefresh] = useState<(() => void) | null>(null);

  const tabProps = {
    ...props,
    activeTab,
    setActiveTab,
    dateFilter,
    setDateFilter,
    agingLoading,
    setAgingLoading,
    setAgingRefresh,
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-0 py-0">
      <AnalyticsDashboardProvider {...props}>
        <AnalyticsTabs {...tabProps} />
      </AnalyticsDashboardProvider>
    </div>
  );
}

export type { AnalyticsProps } from './types';
