import React, { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  downloadAgentConfigFile,
  downloadAgentInstaller,
  extractStoredAgentConfig,
  extractStoredAgentPlatform,
  fetchAgentPlatforms,
  formatAgentConfigPreview,
  loadAgentWizardState,
  parseAgentConfigObject,
  patchAgentWizardInitCache,
  getDefaultPlatformValue,
  platformMatchesValue,
  resolvePlatformValueFromList,
  type AgentWizardPersistedState,
  getWizardStepByAction,
  runConnectorAgentAction,
  saveAgentConfigToConnection,
  type AgentPlatform,
  type AgentSetupStepStatus,
  type RequiredPort,
  type WizardStepConfig,
} from "../agentApi";
import OsPlatformIcon from "../OsPlatformIcon";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import WizardProgressBar from "./WizardProgressBar";
import Step1SelectOs from "./Step1SelectOs";
import Step2GenerateConfig from "./Step2GenerateConfig";
import Step3DownloadAgent from "./Step3DownloadAgent";

export type { WizardStepConfig } from "../agentApi";

export type AgentSetupWizardProps = {
  connectionId?: string | null;
  connectionType: string;
  connectionTypeLabel?: string;
  agentPlatform?: string;
  onPlatformChange?: (platform: string) => void;
  onAgentStateChange?: (state: AgentWizardPersistedState) => void;
  saveConnectionModule?: string;
  steps: WizardStepConfig[];
  formValues: Record<string, unknown>;
};

const UI = { SELECT_OS: 1, GENERATE_CONFIG: 2, DOWNLOAD_AGENT: 3 } as const;

function applyStoredConfigToState(
  stored: ReturnType<typeof extractStoredAgentConfig>,
  setConfigPreview: (v: string | null) => void,
  setConfigFilename: (fn: (prev: string) => string) => void,
  setCompletedSteps: React.Dispatch<React.SetStateAction<Set<number>>>,
  previewText?: string | null,
) {
  const preview =
    previewText ??
    (stored.config ? formatAgentConfigPreview(stored.config) : null);

  if (preview) {
    setConfigPreview(preview);
    setCompletedSteps((prev) => new Set(prev).add(UI.GENERATE_CONFIG));
  }
  if (stored.filename) {
    setConfigFilename(() => stored.filename!);
  } else if (stored.configGenerated) {
    setCompletedSteps((prev) => new Set(prev).add(UI.GENERATE_CONFIG));
  }
}

function resolvePlatformMeta(
  platforms: AgentPlatform[],
  platformValue: string,
): AgentPlatform | undefined {
  const value = resolvePlatformValueFromList(platforms, platformValue);
  if (!value) return undefined;
  return platforms.find((p) => platformMatchesValue(p, value));
}

const AgentSetupWizard: React.FC<AgentSetupWizardProps> = ({
  connectionId,
  connectionType,
  connectionTypeLabel,
  agentPlatform = "",
  onPlatformChange,
  onAgentStateChange,
  saveConnectionModule = "ingestion",
  steps = [],
  formValues,
}) => {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [loadingAction, setLoadingAction] = useState<
    "generate" | "download-agent" | "download-config" | null
  >(null);
  const [activeStep, setActiveStep] = useState(0);
  const [requiredPorts, setRequiredPorts] = useState<RequiredPort[]>([]);
  const [configPreview, setConfigPreview] = useState<string | null>(null);
  const [configFilename, setConfigFilename] = useState(
    `${connectionType}-agent-config.json`,
  );
  const didHydrateFromFormRef = useRef(false);
  const [agentFilename, setAgentFilename] = useState<string>();
  const [statusLoading, setStatusLoading] = useState(false);
  const [platforms, setPlatforms] = useState<
    Awaited<ReturnType<typeof fetchAgentPlatforms>>
  >([]);
  const [platformsLoading, setPlatformsLoading] = useState(false);

  const selectedPlatform =
    agentPlatform || String(formValues.agent_platform ?? "");

  const resolvedConnectionId = String(
    connectionId ?? formValues.id ?? formValues.connection_id ?? "",
  ).trim();

  const selectedPlatformMeta = resolvePlatformMeta(platforms, selectedPlatform);
  const hasConnectionId = Boolean(resolvedConnectionId);
  const connectionName = String(formValues.name ?? "");

  const applyStatusSteps = useCallback(
    (statusSteps: AgentSetupStepStatus[], platformValue: string) => {
      const completed = new Set<number>();

      statusSteps.forEach((s) => {
        if (s.action === "generate_agent_config" && s.completed) {
          completed.add(UI.GENERATE_CONFIG);
        }
        if (
          (s.action === "download_agent" || s.action === "download_agent_config") &&
          s.completed
        ) {
          completed.add(UI.DOWNLOAD_AGENT);
        }
      });

      if (platformValue || completed.has(UI.GENERATE_CONFIG)) {
        completed.add(UI.SELECT_OS);
      }

      setCompletedSteps(completed);
    },
    [],
  );

  const applyStoredConfig = useCallback(
    (
      stored: ReturnType<typeof extractStoredAgentConfig>,
      previewText?: string | null,
    ) => {
      applyStoredConfigToState(
        stored,
        setConfigPreview,
        setConfigFilename,
        setCompletedSteps,
        previewText,
      );
    },
    [],
  );

  /** Avoid parent setState when the platform value is already in sync. */
  const notifyPlatformChange = useCallback(
    (platform: string) => {
      const next = String(platform ?? "").trim();
      const current = String(agentPlatform ?? "").trim();
      if (!next || next === current) return;
      onPlatformChange?.(next);
    },
    [agentPlatform, onPlatformChange],
  );

  const notifyPlatformChangeRef = useRef(notifyPlatformChange);
  notifyPlatformChangeRef.current = notifyPlatformChange;

  const onAgentStateChangeRef = useRef(onAgentStateChange);
  onAgentStateChangeRef.current = onAgentStateChange;

  const syncAgentStateToParent = useCallback(
    (state: AgentWizardPersistedState) => {
      onAgentStateChangeRef.current?.(state);
    },
    [],
  );

  const applyStoredConfigAndSync = useCallback(
    (
      stored: ReturnType<typeof extractStoredAgentConfig>,
      previewText?: string | null,
      platformOverride?: string,
    ) => {
      applyStoredConfig(stored, previewText);

      const platform = platformOverride ?? selectedPlatform;
      syncAgentStateToParent({
        agent_platform: platform || undefined,
        agent_config: stored.config,
        agent_config_filename: stored.filename ?? undefined,
        config_generated:
          stored.configGenerated || Boolean(stored.config && Object.keys(stored.config).length > 0),
      });
    },
    [applyStoredConfig, selectedPlatform, syncAgentStateToParent],
  );

  const handlePlatformSelect = useCallback(
    (value: string) => {
      notifyPlatformChange(value);
      syncAgentStateToParent({ agent_platform: value });
    },
    [notifyPlatformChange, syncAgentStateToParent],
  );

  const applyPlatformFromStored = useCallback(
    (storedRaw: string, platformList: AgentPlatform[]) => {
      const resolved = resolvePlatformValueFromList(platformList, storedRaw);
      if (!resolved) return;
      notifyPlatformChange(resolved);
      setCompletedSteps((prev) => new Set(prev).add(UI.SELECT_OS));
    },
    [notifyPlatformChange],
  );

  const loadPlatforms = useCallback(async () => {
    if (!connectionType) return;
    setPlatformsLoading(true);
    try {
      const items = await fetchAgentPlatforms(connectionType);
      setPlatforms(items);

      const savedRaw =
        extractStoredAgentPlatform(formValues as Record<string, unknown>) ||
        String(agentPlatform ?? "").trim();

      if (savedRaw) {
        applyPlatformFromStored(savedRaw, items);
      } else if (!resolvedConnectionId && items.length > 0) {
        const defaultPlatform = getDefaultPlatformValue(connectionType, items);
        if (defaultPlatform) notifyPlatformChange(defaultPlatform);
      }
    } catch (error) {
      console.error("Failed to load agent platforms:", error);
    } finally {
      setPlatformsLoading(false);
    }
  }, [
    connectionType,
    agentPlatform,
    formValues,
    resolvedConnectionId,
    applyPlatformFromStored,
    notifyPlatformChange,
  ]);

  useEffect(() => {
    void loadPlatforms();
  }, [loadPlatforms]);

  // Restore OS + config from form edit data before / without waiting on wizard APIs.
  useEffect(() => {
    if (didHydrateFromFormRef.current) return;

    const record = formValues as Record<string, unknown>;
    const platform = extractStoredAgentPlatform(record);
    const stored = extractStoredAgentConfig(record);

    if (!platform && !stored.config && !stored.configGenerated) return;
    didHydrateFromFormRef.current = true;

    if (platform) {
      notifyPlatformChangeRef.current(platform);
      setCompletedSteps((prev) => new Set(prev).add(UI.SELECT_OS));
    }
    if (stored.config || stored.configGenerated) {
      applyStoredConfigAndSync(stored, undefined, platform);
    }
  }, [formValues, applyStoredConfigAndSync]);

  // One cached init per connection (deduped in loadAgentWizardState).
  useEffect(() => {
    if (!resolvedConnectionId || !connectionType) return;

    let cancelled = false;
    setStatusLoading(true);

    void (async () => {
      try {
        const { connection, status, configPreview } = await loadAgentWizardState(
          resolvedConnectionId,
          connectionType,
          saveConnectionModule,
        );

        if (cancelled) return;

        const platformFromConnection = connection
          ? extractStoredAgentPlatform(connection)
          : "";

        if (status?.steps?.length) {
          applyStatusSteps(status.steps, platformFromConnection);
        }
        if (status?.config_generated) {
          setCompletedSteps((prev) => new Set(prev).add(UI.GENERATE_CONFIG));
        }

        if (platformFromConnection) {
          const resolved = resolvePlatformValueFromList(
            platforms,
            platformFromConnection,
          );
          notifyPlatformChangeRef.current(resolved || platformFromConnection);
          setCompletedSteps((prev) => new Set(prev).add(UI.SELECT_OS));
        }

        if (connection) {
          let stored = extractStoredAgentConfig(connection);
          if (!stored.config && configPreview) {
            const parsed = parseAgentConfigObject(configPreview);
            if (parsed) {
              stored = {
                ...stored,
                config: parsed,
                configGenerated: true,
              };
            }
          }
          if (stored.config || stored.configGenerated || configPreview) {
            applyStoredConfigAndSync(
              stored,
              configPreview,
              platformFromConnection,
            );
          }
        }
      } catch (error) {
        console.error("Failed to load agent wizard state:", error);
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    resolvedConnectionId,
    connectionType,
    saveConnectionModule,
    platforms,
    applyStatusSteps,
    applyStoredConfigAndSync,
  ]);

  // Re-apply agent_platform from connection/form when platform list loads or updates.
  useEffect(() => {
    if (!platforms.length) return;

    const savedRaw =
      extractStoredAgentPlatform(formValues as Record<string, unknown>) ||
      String(agentPlatform ?? "").trim();
    if (!savedRaw) return;

    const resolved = resolvePlatformValueFromList(platforms, savedRaw);
    if (!resolved) return;

    if (resolved !== String(agentPlatform ?? "").trim()) {
      notifyPlatformChangeRef.current(resolved);
    }
    setCompletedSteps((prev) => new Set(prev).add(UI.SELECT_OS));
  }, [platforms, agentPlatform, formValues]);

  const handleSelectOsContinue = (skipValidation = false) => {
    if (!skipValidation && !selectedPlatform) {
      toast.info("Select a target architecture first.");
      return;
    }
    if (!hasConnectionId) {
      toast.info("Save the connection first to get a connection ID.");
      return;
    }
    if (selectedPlatform) {
      setCompletedSteps((prev) => new Set(prev).add(UI.SELECT_OS));
    }
    setActiveStep(1);
  };

  const goToStep = (stepIndex: number) => {
    if (stepIndex < 0 || stepIndex > 2) return;

    if (stepIndex < activeStep) {
      setActiveStep(stepIndex);
      return;
    }

    if (stepIndex === activeStep) return;

    if (stepIndex >= 1 && !hasConnectionId) {
      toast.info("Save the connection first to get a connection ID.");
      return;
    }

    if (stepIndex >= 2 && !completedSteps.has(UI.GENERATE_CONFIG)) {
      toast.info("Generate configuration before continuing.");
      return;
    }

    if (stepIndex >= 1 && selectedPlatform) {
      setCompletedSteps((prev) => new Set(prev).add(UI.SELECT_OS));
    }

    setActiveStep(stepIndex);
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleNextFromStep2 = () => {
    if (!completedSteps.has(UI.GENERATE_CONFIG)) {
      toast.info("Generate configuration before continuing.");
      return;
    }
    setActiveStep(2);
  };

  const handleGenerateConfig = async () => {
    if (!hasConnectionId) {
      toast.error("connection_id is required — save the connection first.");
      return;
    }

    setLoadingAction("generate");
    try {
      const { data: actionData, message } = await runConnectorAgentAction({
        actions: "generate_agent_config",
        connection_id: resolvedConnectionId,
        connection_type: connectionType,
      });

      const config = actionData.config as Record<string, unknown> | undefined;
      const filename = actionData.filename
        ? String(actionData.filename)
        : configFilename;

      if (config && typeof config === "object") {
        await saveAgentConfigToConnection(
          saveConnectionModule,
          resolvedConnectionId,
          config,
          {
            filename,
            agentPlatform: selectedPlatform || undefined,
            connectionType,
          },
        );

        const preview = formatAgentConfigPreview(config);
        setConfigPreview(preview);
        setCompletedSteps((prev) => new Set(prev).add(UI.GENERATE_CONFIG));
        patchAgentWizardInitCache(
          resolvedConnectionId,
          connectionType,
          saveConnectionModule,
          { configPreview: preview },
        );

        if (filename) {
          setConfigFilename(filename);
        }

        syncAgentStateToParent({
          agent_platform: selectedPlatform || undefined,
          agent_config: config,
          agent_config_filename: filename,
          config_generated: true,
        });

        toast.success(message ?? "Agent configuration generated and saved");
      } else {
        toast.error("Configuration was not returned by the server.");
      }
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, "Failed to generate configuration"));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownloadAgent = async () => {
    if (!hasConnectionId) {
      toast.info("Save the connection first, then download the agent.");
      return;
    }
    if (!selectedPlatform) {
      toast.info("Select a target architecture first.");
      return;
    }

    setLoadingAction("download-agent");
    try {
      const agentStep = getWizardStepByAction(steps, "download_agent");
      const result = await downloadAgentInstaller({
        connectionId: resolvedConnectionId,
        connectionType,
        platform: selectedPlatform,
        fileDownload: agentStep?.file_download,
        fallbackFilename:
          selectedPlatformMeta?.filename ?? "edge-agent-installer.tar.gz",
      });

      const ports = result.required_ports;
      if (ports?.length) setRequiredPorts(ports);

      if (result.download_available === false) {
        toast.info(
          result.message ??
            "Agent installer is not uploaded yet. Contact your administrator.",
        );
        return;
      }

      if (result.filename) {
        setAgentFilename(result.filename);
      }

      if (!result.downloaded) {
        toast.error("Download URL was not returned by the server.");
        return;
      }

      setCompletedSteps((prev) => new Set(prev).add(UI.DOWNLOAD_AGENT));
      toast.success(result.message ?? "Agent installer download started");
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, "Failed to download agent"));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownloadConfig = async () => {
    if (!hasConnectionId) {
      toast.error("connection_id is required — save the connection first.");
      return;
    }

    setLoadingAction("download-config");
    try {
      await downloadAgentConfigFile(resolvedConnectionId, configFilename);

      setCompletedSteps((prev) => new Set(prev).add(UI.DOWNLOAD_AGENT));
      toast.success("Configuration downloaded");
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, "Failed to download configuration"));
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="col-span-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-3 py-2.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-foreground">Edge Agent Setup</h2>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              Setup Wizard
            </Badge>
            {statusLoading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Select OS → Generate Config → Download Agent / Config
          </p>
        </div>
        {selectedPlatformMeta && (
          <Badge className="gap-1.5 bg-primary/90 px-3 py-1 text-xs uppercase tracking-wide">
            <OsPlatformIcon
              icon={selectedPlatformMeta.icon}
              osSymbol={selectedPlatformMeta.os_symbol}
              os={selectedPlatformMeta.os}
              platformHint={
                selectedPlatformMeta.value || selectedPlatformMeta.label
              }
              className="h-3.5 w-3.5"
            />
            {selectedPlatformMeta.label}
          </Badge>
        )}
      </div>

      <div className="border-b border-border px-3 py-2">
        <WizardProgressBar
          activeStep={activeStep}
          completedSteps={completedSteps}
          variant="horizontal"
          onStepClick={goToStep}
        />
      </div>

      <div className="px-3 py-3">
        {activeStep === 0 && (
          <Step1SelectOs
            platforms={platforms}
            platformsLoading={platformsLoading}
            selectedPlatform={selectedPlatform}
            hasConnectionId={hasConnectionId}
            onPlatformSelect={handlePlatformSelect}
            onNext={() => void handleSelectOsContinue(false)}
          />
        )}

        {activeStep === 1 && (
          <Step2GenerateConfig
            connectionId={resolvedConnectionId || null}
            connectionName={connectionName}
            connectionType={connectionType}
            connectionTypeLabel={connectionTypeLabel}
            selectedPlatform={selectedPlatformMeta}
            selectedPlatformValue={selectedPlatform}
            configPreview={configPreview}
            configFilename={configFilename}
            hasConnectionId={hasConnectionId}
            generating={loadingAction === "generate"}
            downloadingConfig={loadingAction === "download-config"}
            configGenerated={completedSteps.has(UI.GENERATE_CONFIG)}
            onGenerate={() => void handleGenerateConfig()}
            onDownloadConfig={() => void handleDownloadConfig()}
            onBack={handleBack}
            onNext={handleNextFromStep2}
          />
        )}

        {activeStep === 2 && (
          <Step3DownloadAgent
            activeStep={activeStep}
            completedSteps={completedSteps}
            selectedPlatform={selectedPlatformMeta}
            agentFilename={agentFilename}
            configFilename={configFilename}
            configPreview={configPreview}
            configGenerated={completedSteps.has(UI.GENERATE_CONFIG)}
            requiredPorts={requiredPorts}
            hasConnectionId={hasConnectionId}
            connectionId={resolvedConnectionId || null}
            downloadingAgent={loadingAction === "download-agent"}
            onBack={handleBack}
            onStepClick={goToStep}
            onDownloadAgent={() => void handleDownloadAgent()}
            onFinish={() => toast.success("Edge agent setup complete")}
          />
        )}
      </div>
    </div>
  );
};

export default AgentSetupWizard;
