import { createContext, useContext, type ReactNode } from 'react';
import type { AnalyticsProps } from './types';
import { useAnalytics } from './hooks/useAnalytics';
import type { AnalyticsViewProps } from './viewTypes';

const AnalyticsDashboardContext = createContext<AnalyticsViewProps | null>(null);

export function useAnalyticsDashboardContext(): AnalyticsViewProps {
  const ctx = useContext(AnalyticsDashboardContext);
  if (!ctx) {
    throw new Error('useAnalyticsDashboardContext must be used within AnalyticsDashboardProvider');
  }
  return ctx;
}

export function AnalyticsDashboardProvider({
  children,
  ...props
}: AnalyticsProps & { children: ReactNode }) {
  const viewProps = useAnalytics(props);
  return (
    <AnalyticsDashboardContext.Provider value={viewProps}>{children}</AnalyticsDashboardContext.Provider>
  );
}

export function useOptionalAnalyticsDashboardContext(): AnalyticsViewProps | null {
  return useContext(AnalyticsDashboardContext);
}
