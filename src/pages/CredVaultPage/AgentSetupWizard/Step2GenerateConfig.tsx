import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, FileJson, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { AgentPlatform } from "../agentApi";
import WizardStepNav from "./WizardStepNav";

type Step2GenerateConfigProps = {
  connectionId?: string | null;
  connectionName?: string;
  connectionType: string;
  connectionTypeLabel?: string;
  selectedPlatform?: AgentPlatform;
  selectedPlatformValue?: string;
  configPreview: string | null;
  configFilename: string;
  hasConnectionId: boolean;
  generating: boolean;
  downloadingConfig: boolean;
  configGenerated: boolean;
  onGenerate: () => void;
  onDownloadConfig: () => void;
  onBack: () => void;
  onNext: () => void;
};

export default function Step2GenerateConfig({
  connectionId,
  connectionName,
  connectionType,
  connectionTypeLabel,
  selectedPlatform,
  selectedPlatformValue = "",
  configPreview,
  configFilename,
  hasConnectionId,
  generating,
  downloadingConfig,
  configGenerated,
  onGenerate,
  onDownloadConfig,
  onBack,
  onNext,
}: Step2GenerateConfigProps) {
  const handleCopy = async () => {
    if (!configPreview) return;
    try {
      await navigator.clipboard.writeText(configPreview);
      toast.success("Configuration copied to clipboard");
    } catch {
      toast.error("Failed to copy configuration");
    }
  };

  const handleCopyConnectionId = async () => {
    if (!connectionId) return;
    try {
      await navigator.clipboard.writeText(String(connectionId));
      toast.success("Connection ID copied");
    } catch {
      toast.error("Failed to copy connection ID");
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,280px)_1fr]">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Deployment Details
          </p>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Connection ID</dt>
              <dd className="mt-0.5 flex items-center gap-2">
                {hasConnectionId ? (
                  <>
                    <span
                      className="font-mono text-xs font-medium text-foreground break-all"
                      title={String(connectionId)}
                    >
                      {connectionId}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 shrink-0 px-1.5"
                      onClick={() => void handleCopyConnectionId()}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    Save the connection to generate an ID
                  </span>
                )}
              </dd>
            </div>
            {connectionName && (
              <div>
                <dt className="text-muted-foreground">Connection Name</dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {connectionName}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Target Architecture</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {selectedPlatform?.label ??
                  (selectedPlatformValue || "Not selected")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Protocol</dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {connectionTypeLabel ?? connectionType}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
              Automated Validation
            </p>
          </div>
          <p className="text-xs leading-relaxed text-blue-800/90 dark:text-blue-300/90">
            The system validates the endpoint connection and verifies
            cryptographic keys for this configuration.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {configGenerated ? (
              <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                <Check className="h-3 w-3" strokeWidth={2.5} />
                Configuration generated
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              >
                <Lock className="h-3 w-3" />
                Security audits passed
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {configFilename}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {configGenerated && (
              <Badge className="gap-1 bg-emerald-600 text-[10px] uppercase tracking-wide text-white hover:bg-emerald-600">
                <Check className="h-3 w-3" strokeWidth={2.5} />
                Ready
              </Badge>
            )}
            {configPreview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => void handleCopy()}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[min(320px,40vh)] min-h-[160px] overflow-y-auto overflow-x-auto bg-zinc-950 p-4">
          {configPreview ? (
            <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-emerald-400/90">
              {configPreview}
            </pre>
          ) : (
            <p className="text-sm text-zinc-500">
              Configuration preview will appear here after generation.
            </p>
          )}
        </div>

        <div className="border-t border-border p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Clicking the button below will finalize the cryptographic handshake
            and bundle the configuration for secure delivery.
          </p>
          {!hasConnectionId && (
            <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
              connection_id is required — save the connection first to generate
              configuration.
            </p>
          )}
          <WizardStepNav
            backLabel="Back"
            nextLabel={configGenerated ? "Next" : "Continue to Step 3"}
            backDisabled={false}
            nextDisabled={!configGenerated}
            onBack={onBack}
            onNext={onNext}
          >
            {configGenerated && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!hasConnectionId || downloadingConfig}
                onClick={onDownloadConfig}
              >
                {downloadingConfig ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileJson className="h-4 w-4" />
                )}
                Download Configuration
              </Button>
            )}
            {!configGenerated ? (
              <Button
                type="button"
                size="sm"
                disabled={!hasConnectionId || generating}
                onClick={onGenerate}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  "Generate Configuration File"
                )}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasConnectionId || generating}
                onClick={onGenerate}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Regenerating…
                  </>
                ) : (
                  "Regenerate Configuration"
                )}
              </Button>
            )}
          </WizardStepNav>
        </div>
      </div>
    </div>
  );
}
