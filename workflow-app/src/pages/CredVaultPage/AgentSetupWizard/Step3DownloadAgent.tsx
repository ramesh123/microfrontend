import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Download,
  FileJson,
  Loader2,
  Package,
  Play,
  Square,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { postSimulationAgentStopStart } from "@/controllers/API/simulationTrackApi";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import { cn } from "@/lib/utils";
import type { AgentPlatform, RequiredPort } from "../agentApi";
import {
  getInstallStepDescription,
  getPlatformInstallGuide,
} from "../agentApi";
import OsPlatformIcon from "../OsPlatformIcon";
import WizardProgressBar from "./WizardProgressBar";
import WizardStepNav from "./WizardStepNav";
import { getInstallGuide, getPlatformDescription } from "./constants";

type Step3DownloadAgentProps = {
  activeStep: number;
  completedSteps: Set<number>;
  selectedPlatform?: AgentPlatform;
  agentFilename?: string;
  configFilename: string;
  configPreview: string | null;
  configGenerated: boolean;
  requiredPorts?: RequiredPort[];
  hasConnectionId: boolean;
  connectionId?: string | null;
  downloadingAgent: boolean;
  onBack: () => void;
  onStepClick?: (stepIndex: number) => void;
  onDownloadAgent: () => void;
  onFinish: () => void;
};

export default function Step3DownloadAgent({
  activeStep,
  completedSteps,
  selectedPlatform,
  agentFilename,
  configFilename,
  configGenerated,
  requiredPorts = [],
  hasConnectionId,
  connectionId,
  downloadingAgent,
  onBack,
  onStepClick,
  onDownloadAgent,
  onFinish,
}: Step3DownloadAgentProps) {
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentActionLoading, setAgentActionLoading] = useState(false);

  const handleAgentToggle = useCallback(async () => {
    const action = agentRunning ? "stop" : "start";
    setAgentActionLoading(true);
    try {
      const payload: { action: "start" | "stop"; connection_id?: string } = {
        action,
      };
      const id = String(connectionId ?? "").trim();
      if (id) payload.connection_id = id;

      const response = await postSimulationAgentStopStart(payload);
      if (!response.success) {
        toast.error(response.message ?? `Failed to ${action} agent`);
        return;
      }

      setAgentRunning(action === "start");
      toast.success(action === "start" ? "Agent started" : "Agent stopped");
    } catch (err) {
      toast.error(getDisplayErrorMessage(err, `Failed to ${action} agent`));
    } finally {
      setAgentActionLoading(false);
    }
  }, [agentRunning, connectionId]);

  const guide = selectedPlatform
    ? getPlatformInstallGuide(selectedPlatform) ?? getInstallGuide(selectedPlatform)
    : { title: "Installation Guide", steps: [] };
  const platformDescription = selectedPlatform
    ? getPlatformDescription(selectedPlatform)
    : "";
  const installerName =
    agentFilename ?? selectedPlatform?.filename ?? "datafusion-edge-agent";

  const handleCopyCommands = async () => {
    try {
      await navigator.clipboard.writeText(
        guide.steps
          .map(
            (s, i) =>
              `${i + 1}. ${getInstallStepDescription(s, i)}:\n${s.command}`,
          )
          .join("\n\n"),
      );
      toast.success("Commands copied to clipboard");
    } catch {
      toast.error("Failed to copy commands");
    }
  };

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,180px)_1fr]">
      <div className="space-y-2">
        <WizardProgressBar
          activeStep={activeStep}
          completedSteps={completedSteps}
          variant="vertical"
          onStepClick={onStepClick}
        />
      </div>

      <div className="min-w-0 space-y-2.5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Download Agent / Config
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Download the installer and configuration for{" "}
            {selectedPlatform?.label ?? "your platform"}.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">
                {installerName}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                Agent installer
              </p>
            </div>
            {selectedPlatform && (
              <OsPlatformIcon
                icon={selectedPlatform.icon}
                osSymbol={selectedPlatform.os_symbol}
                os={selectedPlatform.os}
                platformHint={selectedPlatform.value || selectedPlatform.label}
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              />
            )}
          </div>

          {configGenerated && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <FileJson className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">
                  {configFilename}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Generated config
                </p>
              </div>
              <Badge className="h-4 shrink-0 px-1.5 text-[9px]">READY</Badge>
            </div>
          )}
        </div>

        {requiredPorts.length > 0 && (
          <div className="rounded-lg border border-border px-2.5 py-2 text-xs">
            <p className="mb-1 font-medium text-foreground">Required ports</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {requiredPorts.map((port) => (
                <span key={`${port.name}-${port.port}`}>
                  {port.name}: {port.port}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/20 px-2.5 py-1.5">
          <p className="text-xs font-semibold text-foreground">
            {selectedPlatform?.label ?? "Platform"}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {platformDescription}
          </p>
        </div>

        <div className="w-full min-w-0 overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 py-1.5">
            <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
              <Terminal className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{guide.title}</span>
            </div>
            {guide.steps.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 shrink-0 gap-1 px-1.5 text-[10px]"
                onClick={() => void handleCopyCommands()}
              >
                <Copy className="h-3 w-3" />
                Copy
              </Button>
            )}
          </div>
          <div className="w-full min-w-0">
            {guide.steps.length > 0 ? (
              <div className="divide-y divide-border">
                {guide.steps.map((step, i) => (
                  <div key={i} className="w-full min-w-0 space-y-2 bg-background px-3 py-2.5">
                    <p className="text-xs font-semibold text-foreground">
                      Step {i + 1}
                    </p>
                    <p className="text-xs leading-snug text-muted-foreground break-words whitespace-normal">
                      {getInstallStepDescription(step, i)}
                    </p>
                    <pre className="w-full min-w-0 overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap break-words text-zinc-100">
                      {step.command}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-2.5 text-[11px] text-zinc-500">
                Installation steps will appear for the selected platform.
              </p>
            )}
          </div>
        </div>

        {!configGenerated && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            Generate configuration in Step 2 before downloading config.
          </p>
        )}

        {!hasConnectionId && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            Save the connection first to download files.
          </p>
        )}

        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-2",
            agentRunning
              ? "border-destructive/40 bg-destructive/5"
              : "border-border bg-muted/20",
          )}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">
              {agentRunning ? "Agent is running" : "Start agent"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {agentRunning
                ? "Recording — stop when finished before download"
                : "Start the agent before downloading the installer"}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant={agentRunning ? "destructive" : "default"}
            className="h-8 shrink-0 gap-1.5 px-3 text-xs"
            disabled={!hasConnectionId || agentActionLoading}
            onClick={() => void handleAgentToggle()}
          >
            {agentActionLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : agentRunning ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            {agentRunning ? "Stop" : "Start"}
          </Button>
        </div>

        <WizardStepNav
          showNext={false}
          backLabel="Back"
          onBack={onBack}
        >
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs"
            disabled={!hasConnectionId || !selectedPlatform || downloadingAgent}
            onClick={onDownloadAgent}
          >
            {downloadingAgent ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download Agent
          </Button>
        </WizardStepNav>
      </div>
    </div>
  );
}
