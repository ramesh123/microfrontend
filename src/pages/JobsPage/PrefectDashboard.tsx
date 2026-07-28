import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { useParams } from 'react-router';

const PREFECT_BASE_URL = "http://140.245.228.72:4201";

const PREFECT_ROUTES: Record<string, string> = {  
  'dashboard': '/dashboard',
  'runs': '/runs',
  'flows': '/flows',
  'deployments': '/deployments',
  'work-pools': '/work-pools',
  'blocks': '/blocks',
  'variables': '/variables',
  'automations': '/automations',
  'events': '/events',
  'concurrency-limits': '/concurrency-limits',
};

const PrefectDashboard: React.FC = () => {
  const { section } = useParams<{ section?: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const prefectPath = section ? PREFECT_ROUTES[section] || '/dashboard' : '/dashboard';
  const dashboardUrl = `${PREFECT_BASE_URL}${prefectPath}`;

  useEffect(() => {
    // Reset states when URL changes
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');

    // Set a timeout to handle perpetual loading
    const loadTimeout = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setHasError(true);
        setErrorMessage(
          'The dashboard is taking too long to load. This might be due to server configuration issues.'
        );
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(loadTimeout);
  }, [refreshKey, section]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
    setErrorMessage(
      'Failed to load the Prefect dashboard. Please check your network connection and server availability.'
    );
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-full'}`}>
      {/* Error Message */}
      {hasError && (
        <div className="mx-6 mt-4 p-4 border border-destructive/50 rounded-lg bg-destructive/10">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-destructive mb-2">Unable to Load Dashboard</h3>
              <p className="text-sm text-muted-foreground mb-3">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !hasError && (
        <div className="flex-1 flex items-center justify-center bg-muted/20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          </div>
        </div>
      )}

      {/* Iframe Container */}
      <div className={`flex-1 relative overflow-hidden ${isLoading || hasError ? 'hidden' : ''}`}>
        <style>
          {`
            /* Crop Prefect's native sidebar by positioning iframe with negative margin */
            .prefect-iframe-wrapper {
              position: relative;
              width: 100%;
              height: 100%;
              overflow: hidden;
            }

            iframe#prefect-frame {
              position: absolute;
              top: 0;
              left: -250px; /* Hide the sidebar width (approximately 250px) */
              width: calc(100% + 250px);
              height: 100%;
              border: 0;
            }
          `}
        </style>
        <div className="prefect-iframe-wrapper">
          <iframe
            id="prefect-frame"
            key={`${refreshKey}-${section}`}
            src={dashboardUrl}
            title="Prefect Dashboard"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
            allow="fullscreen"
          />
        </div>
      </div>
    </div>
  );
};

export default PrefectDashboard;
