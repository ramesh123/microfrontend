import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { postWorkspaceDeployment } from '@/controllers/API/semanticsApi';
import { toast } from 'sonner';
import type { TenantInfo, SchemaPayload } from './index';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

interface DeploymentScreenProps {
  tenant: TenantInfo;
  schemaPayload: SchemaPayload;
  onComplete: (runId: string) => void;
}

function toSchemaPayloadApi(p: SchemaPayload): {
  connection_id: string;
  database: string;
  schemas: { name: string; tables: string[] }[];
} {
  return {
    connection_id: p.connectionId,
    database: p.database,
    schemas: p.schemas.map((s) => ({ name: s.name, tables: s.tables })),
  };
}

export default function DeploymentScreen({ tenant, schemaPayload, onComplete }: DeploymentScreenProps) {
  const [status, setStatus] = useState<'initiating' | 'queued' | 'error'>('initiating');
  const [errorMessage, setErrorMessage] = useState('');
  const initiatedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const initiateRun = useCallback(async () => {
    setStatus('initiating');
    setErrorMessage('');
    try {
      const ctx = schemaPayload.context_text?.trim();
      const response = await postWorkspaceDeployment({
        tenant_id: tenant.tenantId,
        domain_id: tenant.domainId,
        schema_payload: toSchemaPayloadApi(schemaPayload),
        mode: 'full',
        ...(ctx ? { context_text: ctx } : {}),
      });
      setStatus('queued');
      const runId = response.run_id ?? '';
      setTimeout(() => {
        onCompleteRef.current(runId);
      }, 1200);
    } catch (err: unknown) {
      initiatedRef.current = false;
      setStatus('error');
      const message =
        getDisplayErrorMessage(err, 'Failed to start deployment');
      setErrorMessage(message);
      toast.error(message);
    }
  }, [tenant.tenantId, tenant.domainId, schemaPayload]);

  useEffect(() => {
    if (initiatedRef.current) return;
    initiatedRef.current = true;
    initiateRun();
  }, [initiateRun]);

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-background">
        <div className="size-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <AlertCircle className="size-7 text-red-500" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">Deployment failed</p>
        <p className="text-xs text-muted-foreground max-w-sm text-center leading-relaxed mb-4">
          {errorMessage}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-sm gap-1.5"
          onClick={initiateRun}
        >
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-background">
      {/* Cube-style icon */}
      <div className="relative mb-4">
        <div className="size-16 flex items-center justify-center">
          <svg
            viewBox="0 0 64 64"
            fill="none"
            className="size-14 text-primary/80"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M32 4L56 18V46L32 60L8 46V18L32 4Z"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="currentColor"
              fillOpacity="0.06"
            />
            <path
              d="M32 4L56 18L32 32L8 18L32 4Z"
              fill="currentColor"
              fillOpacity="0.12"
            />
            <path d="M32 32V60" stroke="currentColor" strokeWidth="1.5" />
            <path d="M32 32L56 18" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
            <path d="M32 32L8 18" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
          </svg>
        </div>
      </div>

      <p className="text-sm font-medium text-foreground mb-1">
        {status === 'initiating' ? 'Starting agentic run...' : 'Run queued successfully'}
      </p>
      <p className="text-xs text-muted-foreground max-w-sm text-center leading-relaxed">
        {status === 'initiating'
          ? 'Initializing multi-agent semantic build. Please stay on this page.'
          : 'Your agentic run has been queued. Connecting to event stream...'}
      </p>

      {/* Indeterminate progress bar */}
      <div className="mt-4 w-48 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full w-1/3 bg-primary/60 rounded-full"
          style={{
            animation: 'indeterminate 1.5s ease-in-out infinite',
          }}
        />
        <style>{`
          @keyframes indeterminate {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(250%); }
            100% { transform: translateX(-100%); }
          }
        `}</style>
      </div>
    </div>
  );
}
