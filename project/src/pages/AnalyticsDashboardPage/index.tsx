import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

/** Embedded Grafana dashboard (prod sensor events). */
const GRAFANA_SENSOR_EVENTS_URL =
  'https://dashboards.datafusion.algofusiontech.com/d/adhpbnw/prod-sensor-events?orgId=1&from=2026-04-30T04:32:17.000Z&to=2026-04-30T05:28:33.000Z&timezone=browser';

const LOAD_TIMEOUT_MS = 20_000;

const AnalyticsDashboardPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    setErrorMessage('');
  }, []);

  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    setErrorMessage(
      'The analytics dashboard could not be loaded. Check the Grafana server, network, or whether it allows embedding (X-Frame-Options / CSP).'
    );
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');

    const loadTimeout = window.setTimeout(() => {
      setIsLoading((still) => {
        if (still) {
          setHasError(true);
          setErrorMessage(
            'The dashboard is taking too long to load. The server may be unreachable or blocking iframe embedding.'
          );
          return false;
        }
        return still;
      });
    }, LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(loadTimeout);
  }, [refreshKey]);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {hasError && (
        <div className="mx-4 mt-2 shrink-0 p-4 border border-destructive/50 rounded-lg bg-destructive/10">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-destructive mb-1">Unable to load analytics</h3>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <button
                type="button"
                className="mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setHasError(false);
                  setErrorMessage('');
                  setRefreshKey((k) => k + 1);
                }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && !hasError && (
        <div className="flex-1 flex items-center justify-center bg-muted/20 min-h-[200px]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" aria-hidden />
        </div>
      )}

      <div className={`flex-1 min-h-0 relative ${isLoading || hasError ? 'hidden' : ''}`}>
        <iframe
          key={refreshKey}
          src={GRAFANA_SENSOR_EVENTS_URL}
          title="Sensor events analytics (Grafana)"
          className="absolute inset-0 w-full h-full border-0 rounded-md bg-background"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
          allow="fullscreen"
        />
      </div>
    </div>
  );
};

export default AnalyticsDashboardPage;
