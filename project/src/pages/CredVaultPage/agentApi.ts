import api, { API_BASE_URL } from "@/controllers/API/api";
import {
  fetchConnectionById,
  updateConnection,
} from "@/controllers/API/connectionVaultApi";
import {
  assertBlobNotApiError,
  executeApiRequestSilent,
} from "@/utils/exceptionHelper";

export type PlatformInstallStep = {
  label: string;
  command: string;
  description?: string;
};

export type AgentPlatform = {
  platform: string;
  label: string;
  os?: string;
  os_symbol?: string;
  icon?: string;
  arch?: string;
  value: string;
  filename?: string;
  installer_available?: boolean;
  description?: string;
  installation_steps?: PlatformInstallStep[];
  install_steps?: PlatformInstallStep[];
  install_guide?: {
    title?: string;
    steps?: unknown[];
  };
  install_guide_title?: string;
  steps?: unknown[];
};

export function normalizeInstallSteps(raw: unknown): PlatformInstallStep[] {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      if (typeof item === "string") {
        return { label: `Step ${index + 1}`, command: item };
      }
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        const description = String(
          row.description ??
            row.desc ??
            row.info ??
            row.detail ??
            row.summary ??
            "",
        ).trim();
        const rawLabel = String(
          row.label ?? row.title ?? row.name ?? "",
        ).trim();
        const isGenericLabel = /^step\s*\d+$/i.test(rawLabel);
        const label =
          rawLabel && !isGenericLabel
            ? rawLabel
            : description || `Step ${index + 1}`;
        const command = String(
          row.command ?? row.value ?? row.script ?? row.text ?? "",
        );
        return {
          label,
          command,
          description: description || undefined,
        };
      }
      return { label: `Step ${index + 1}`, command: "" };
    })
    .filter((step) => step.label.trim() || step.command.trim());
}

/** Human-readable text for an install step (prefers JSON `description`). */
export function getInstallStepDescription(
  step: PlatformInstallStep,
  index: number,
): string {
  if (step.description?.trim()) return step.description.trim();
  if (step.label.trim() && !/^step\s*\d+$/i.test(step.label.trim())) {
    return step.label.trim();
  }
  return `Step ${index + 1}`;
}

export function normalizeAgentPlatform(raw: Record<string, unknown>): AgentPlatform {
  const value = String(
    raw.value ?? raw.platform ?? raw.id ?? raw.name ?? "",
  );
  const installSteps = normalizeInstallSteps(
    raw.installation_steps ??
      raw.install_steps ??
      (raw.install_guide as Record<string, unknown> | undefined)?.steps ??
      raw.steps,
  );

  return {
    ...raw,
    platform: String(raw.platform ?? value),
    label: String(raw.label ?? raw.display_name ?? raw.platform ?? value),
    value,
    os: raw.os != null ? String(raw.os) : undefined,
    os_symbol: raw.os_symbol != null ? String(raw.os_symbol) : undefined,
    icon: raw.icon != null ? String(raw.icon) : undefined,
    arch: raw.arch != null ? String(raw.arch) : undefined,
    filename: raw.filename != null ? String(raw.filename) : undefined,
    description: raw.description != null ? String(raw.description) : undefined,
    installation_steps: installSteps.length > 0 ? installSteps : undefined,
    install_guide:
      raw.install_guide && typeof raw.install_guide === "object"
        ? (raw.install_guide as AgentPlatform["install_guide"])
        : undefined,
  };
}

export function getPlatformInstallGuide(
  platform: AgentPlatform | undefined,
): { title: string; steps: PlatformInstallStep[] } | null {
  if (!platform) return null;

  const steps =
    platform.installation_steps ??
    normalizeInstallSteps(
      platform.install_steps ??
        platform.install_guide?.steps ??
        platform.steps,
    );

  if (!steps.length) return null;

  const guideTitle =
    platform.install_guide?.title ??
    platform.install_guide_title ??
    `Installation Guide for ${platform.label}`;

  return { title: guideTitle, steps };
}

export type AgentSetupStepStatus = {
  step: number;
  action: string;
  completed: boolean;
  completed_at: string | null;
};

export type AgentSetupStatus = {
  connection_id: string;
  connection_mode: string;
  config_generated?: boolean;
  steps: AgentSetupStepStatus[];
};

export type RequiredPort = {
  name: string;
  port: string;
};

export type ConnectorAgentActionPayload = {
  actions: string;
  connection_id: string;
  connection_type: string;
  connection_mode?: string;
  platform?: string;
};

export type GenerateAgentConfigData = {
  filename?: string;
  config?: Record<string, unknown>;
  download_url?: string;
};

export type StoredAgentConfig = {
  config: Record<string, unknown> | null;
  filename: string | null;
  configGenerated: boolean;
};

export type AgentWizardPersistedState = {
  agent_platform?: string;
  agent_config?: Record<string, unknown> | null;
  agent_config_filename?: string;
  config_generated?: boolean;
};

/** Keys sent on create/update-connection for agent wizard state. */
export const AGENT_CONNECTION_PAYLOAD_KEYS = [
  "agent_platform",
  "agent_config",
  "agent_config_filename",
  "config_generated",
] as const;

/**
 * Merges agent OS + generated config into update-connection payload.
 * Required because processFormDataWithParams only maps schema template fields.
 */
export function mergeAgentFieldsIntoConnectionPayload(
  formData: Record<string, unknown>,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };

  const nestedConfig =
    formData.connection_config &&
    typeof formData.connection_config === "object" &&
    !Array.isArray(formData.connection_config)
      ? (formData.connection_config as Record<string, unknown>)
      : null;

  const platform = String(
    formData.agent_platform ??
      nestedConfig?.agent_platform ??
      "",
  ).trim();

  const agentConfig = parseAgentConfigObject(
    formData.agent_config ?? nestedConfig?.agent_config,
  );

  const filename = String(
    formData.agent_config_filename ?? nestedConfig?.agent_config_filename ?? "",
  ).trim();

  const configGenerated =
    formData.config_generated === true ||
    nestedConfig?.config_generated === true ||
    Boolean(agentConfig && Object.keys(agentConfig).length > 0);

  if (platform) {
    next.agent_platform = platform;
  }

  if (agentConfig && Object.keys(agentConfig).length > 0) {
    next.agent_config = agentConfig;
    next.config_generated = true;
    if (filename) {
      next.agent_config_filename = filename;
    }
  } else if (configGenerated) {
    next.config_generated = true;
    if (filename) {
      next.agent_config_filename = filename;
    }
  }

  // Mirror agent wizard fields under connection_config when that object is sent.
  if (
    next.connection_config &&
    typeof next.connection_config === "object" &&
    !Array.isArray(next.connection_config)
  ) {
    const cc = { ...(next.connection_config as Record<string, unknown>) };
    if (platform) cc.agent_platform = platform;
    if (agentConfig && Object.keys(agentConfig).length > 0) {
      cc.agent_config = agentConfig;
      cc.config_generated = true;
      if (filename) cc.agent_config_filename = filename;
    } else if (configGenerated) {
      cc.config_generated = true;
      if (filename) cc.agent_config_filename = filename;
    }
    next.connection_config = cc;
  }

  return next;
}

export function parseAgentConfigObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

export function extractStoredAgentPlatform(
  connection: Record<string, unknown> | null | undefined,
): string {
  if (!connection) return "";
  const connectionConfig =
    connection.connection_config &&
    typeof connection.connection_config === "object"
      ? (connection.connection_config as Record<string, unknown>)
      : null;

  return String(
    connection.agent_platform ??
      connectionConfig?.agent_platform ??
      connection.platform ??
      connectionConfig?.platform ??
      "",
  ).trim();
}

export function extractStoredAgentConfig(
  connection: Record<string, unknown> | null | undefined,
): StoredAgentConfig {
  if (!connection) {
    return { config: null, filename: null, configGenerated: false };
  }

  const connectionConfig =
    connection.connection_config &&
    typeof connection.connection_config === "object"
      ? (connection.connection_config as Record<string, unknown>)
      : null;

  const rawConfigCandidates: unknown[] = [
    connection.agent_config,
    connection.agent_configuration,
    connection.generated_agent_config,
    connection.edge_agent_config,
    connectionConfig?.agent_config,
    connectionConfig?.agent_configuration,
    connectionConfig?.generated_agent_config,
    connectionConfig?.config,
  ];

  let config: Record<string, unknown> | null = null;
  for (const candidate of rawConfigCandidates) {
    config = parseAgentConfigObject(candidate);
    if (config && Object.keys(config).length > 0) break;
  }

  const filename = String(
    connection.agent_config_filename ??
      connectionConfig?.agent_config_filename ??
      "",
  ).trim();

  const configGenerated = Boolean(
    connection.config_generated ??
      connectionConfig?.config_generated ??
      (config && Object.keys(config).length > 0),
  );

  return {
    config,
    filename: filename || null,
    configGenerated,
  };
}

export async function saveAgentPlatformToConnection(
  module: string,
  connectionId: string,
  agentPlatform: string,
  connectionType?: string,
): Promise<void> {
  const platform = String(agentPlatform ?? "").trim();
  if (!platform) return;

  const payload: Record<string, unknown> = {
    update_id: connectionId,
    agent_platform: platform,
  };
  if (connectionType) {
    payload.connection_type = connectionType;
  }

  await updateConnection(`/${module}/update-connection`, payload);
}

export function formatAgentConfigPreview(
  config: Record<string, unknown>,
): string {
  return JSON.stringify(config, null, 2);
}

export async function saveAgentConfigToConnection(
  module: string,
  connectionId: string,
  config: Record<string, unknown>,
  options?: {
    filename?: string;
    agentPlatform?: string;
    connectionType?: string;
  },
): Promise<void> {
  const payload: Record<string, unknown> = {
    update_id: connectionId,
    agent_config: config,
    config_generated: true,
  };

  if (options?.filename) {
    payload.agent_config_filename = options.filename;
  }
  if (options?.agentPlatform) {
    payload.agent_platform = options.agentPlatform;
  }
  if (options?.connectionType) {
    payload.connection_type = options.connectionType;
  }

  await updateConnection(`/${module}/update-connection`, payload);
}

export type DownloadAgentConfigData = {
  filename?: string;
  content_type?: string;
  content?: string;
  download_url?: string;
};

export type DownloadAgentData = {
  download_available?: boolean;
  download_url?: string;
  filename?: string;
  required_ports?: RequiredPort[];
};

export const DEFAULT_AGENT_INSTALLER_DOWNLOAD_TEMPLATE =
  "/ingestion/connector-agent-actions/download-agent/{{id}}?connection_type={{connection_type}}&platform={{agent_platform}}";

const WINDOWS_DEFAULT_CONNECTORS = new Set([
  "opc_da",
  "opc_da_connector",
  "opc_hda",
  "opc_hda_connector",
  "opc_ae",
  "opc_ae_connector",
]);

/** Normalize platform ids for comparison (linux_amd64 vs linux-amd64). */
export function normalizePlatformKey(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

export function platformMatchesValue(
  platform: AgentPlatform,
  storedValue: string,
): boolean {
  const key = normalizePlatformKey(storedValue);
  if (!key) return false;

  const candidates = [platform.value, platform.platform, platform.label]
    .filter((v) => v != null && String(v).trim() !== "")
    .map((v) => normalizePlatformKey(String(v)));

  return candidates.some(
    (candidate) =>
      candidate === key ||
      candidate.includes(key) ||
      key.includes(candidate),
  );
}

/** Map stored agent_platform from connection API to a list platform value. */
export function resolvePlatformValueFromList(
  platforms: AgentPlatform[],
  storedValue: string,
): string {
  const raw = String(storedValue ?? "").trim();
  if (!raw) return "";
  if (!platforms.length) return raw;

  const match = platforms.find((p) => platformMatchesValue(p, raw));
  return match?.value || match?.platform || raw;
}

export function getDefaultPlatformValue(
  connectionType: string,
  platforms: AgentPlatform[],
): string | undefined {
  if (!platforms.length) return undefined;

  const preferWindows = WINDOWS_DEFAULT_CONNECTORS.has(connectionType);
  const preferred = preferWindows ? "windows-amd64" : "linux-amd64";

  return (
    platforms.find((p) => p.value === preferred)?.value ??
    platforms.find((p) => p.value.includes(preferWindows ? "windows" : "linux-amd64"))?.value ??
    platforms.find((p) =>
      preferWindows ? p.value.includes("windows") : p.value.includes("linux"),
    )?.value ??
    platforms[0]?.value
  );
}

export function substituteTemplates(
  template: unknown,
  values: Record<string, unknown>,
): unknown {
  if (typeof template === "string") {
    const pureMatch = template.match(/^\{\{([^}]+)\}\}$/);
    if (pureMatch) {
      const key = pureMatch[1];
      return values[key] ?? "";
    }
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
      const value = values[key];
      if (value === null || value === undefined) return "";
      return String(value);
    });
  }
  if (Array.isArray(template)) {
    return template.map((item) => substituteTemplates(item, values));
  }
  if (template && typeof template === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = substituteTemplates(value, values);
    }
    return result;
  }
  return template;
}

export type WizardStepConfig = {
  step: number;
  title: string;
  description?: string;
  action_label?: string;
  depends_on_step?: number | null;
  fetch?: {
    module: string;
    klass: string;
    method?: string;
    params: Record<string, unknown>;
  };
  file_download?: {
    method?: string;
    url?: string;
    trigger?: string;
    response_field?: string;
  };
};

export function buildDefaultAgentWizardSteps(
  connectionType: string,
): WizardStepConfig[] {
  return [
    {
      step: 1,
      title: "Select OS",
      description: "Select target architecture for the edge agent.",
      depends_on_step: null,
    },
    {
      step: 2,
      title: "Generate Config",
      description: "Generate configuration from the saved connection details.",
      action_label: "Generate Configuration File",
      depends_on_step: 1,
      fetch: {
        module: "ingestion",
        klass: "connector-agent-actions",
        method: "post",
        params: {
          payload: {
            actions: "generate_agent_config",
            connection_id: "{{id}}",
            connection_type: connectionType,
            connection_mode: "agent",
          },
        },
      },
    },
    {
      step: 3,
      title: "Download Agent / Config",
      description:
        "Download the edge agent installer and generated configuration for your selected OS.",
      action_label: "Download Agent Installer",
      depends_on_step: 2,
      fetch: {
        module: "ingestion",
        klass: "connector-agent-actions",
        method: "post",
        params: {
          payload: {
            actions: "download_agent",
            connection_id: "{{id}}",
            connection_type: connectionType,
            platform: "{{agent_platform}}",
          },
        },
      },
      file_download: {
        method: "get",
        url: DEFAULT_AGENT_INSTALLER_DOWNLOAD_TEMPLATE,
        trigger: "after_action_success",
        response_field: "data.download_url",
      },
    },
    {
      step: 4,
      title: "Download Config",
      description: "Download the generated agent configuration file.",
      action_label: "Download Config",
      depends_on_step: 2,
      fetch: {
        module: "ingestion",
        klass: "connector-agent-actions",
        method: "post",
        params: {
          payload: {
            actions: "download_agent_config",
            connection_id: "{{id}}",
            connection_type: connectionType,
          },
        },
      },
      file_download: {
        method: "get",
        url: `/ingestion/connector-agent-actions/download-config/{{id}}`,
        trigger: "after_action_success",
        response_field: "data.download_url",
      },
    },
  ];
}

export async function fetchConnection(
  connectionId: string,
  module = "ingestion",
): Promise<Record<string, unknown> | null> {
  const result = await fetchConnectionById(module, connectionId);
  if (result?.status && Array.isArray(result.data) && result.data.length > 0) {
    return result.data[0] as Record<string, unknown>;
  }
  return null;
}

export async function loadStoredAgentConfigForConnection(
  connectionId: string,
  module = "ingestion",
): Promise<StoredAgentConfig> {
  const connection = await fetchConnection(connectionId, module);
  return extractStoredAgentConfig(connection);
}

/** Coalesce duplicate setup-status reads (React StrictMode). */
const agentSetupStatusInflight = new Map<string, Promise<AgentSetupStatus | null>>();

const agentPlatformsCache = new Map<string, AgentPlatform[]>();
const agentPlatformsInflight = new Map<string, Promise<AgentPlatform[]>>();

export type AgentWizardInitState = {
  connection: Record<string, unknown> | null;
  status: AgentSetupStatus | null;
  configPreview: string | null;
};

const agentWizardInitCache = new Map<string, AgentWizardInitState>();
const agentWizardInitInflight = new Map<string, Promise<AgentWizardInitState>>();

export async function fetchAgentPlatforms(
  connectionType: string,
): Promise<AgentPlatform[]> {
  const key = connectionType.trim();
  const cached = agentPlatformsCache.get(key);
  if (cached) return cached;

  const existing = agentPlatformsInflight.get(key);
  if (existing) return existing;

  const request = (async () => {
    try {
      const result = await executeApiRequestSilent<{
        status?: boolean;
        data?: Record<string, unknown>[];
      }>(
        () =>
          api.post("/ingestion/list-agent-platforms", {
            connection_type: connectionType,
          }),
        "Failed to load agent platforms",
      );
      const items = (result?.data ?? []).map((item) =>
        normalizeAgentPlatform(item),
      );
      agentPlatformsCache.set(key, items);
      return items;
    } finally {
      agentPlatformsInflight.delete(key);
    }
  })();

  agentPlatformsInflight.set(key, request);
  return request;
}

/** One cached load for wizard mount: connection + setup status + optional config preview. */
export async function loadAgentWizardState(
  connectionId: string,
  connectionType: string,
  module = "ingestion",
): Promise<AgentWizardInitState> {
  const key = `${module}|${connectionId}|${connectionType}`;
  const cached = agentWizardInitCache.get(key);
  if (cached) return cached;

  const inflight = agentWizardInitInflight.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const [connection, status] = await Promise.all([
        fetchConnection(connectionId, module),
        fetchAgentSetupStatus(connectionId, connectionType).catch(() => null),
      ]);

      let stored = extractStoredAgentConfig(connection);
      let configPreview: string | null = null;

      if (stored.config) {
        configPreview = formatAgentConfigPreview(stored.config);
      } else if (stored.configGenerated || status?.config_generated) {
        const downloaded = await fetchStoredAgentConfigPreview(connectionId);
        configPreview = downloaded.preview;
        if (downloaded.config) {
          stored = {
            ...stored,
            config: downloaded.config,
            configGenerated: true,
          };
        }
      }

      const state: AgentWizardInitState = {
        connection,
        status,
        configPreview,
      };
      agentWizardInitCache.set(key, state);
      return state;
    } finally {
      agentWizardInitInflight.delete(key);
    }
  })();

  agentWizardInitInflight.set(key, promise);
  return promise;
}

export function patchAgentWizardInitCache(
  connectionId: string,
  connectionType: string,
  module: string,
  patch: Partial<AgentWizardInitState>,
): void {
  const key = `${module}|${connectionId}|${connectionType}`;
  const prev = agentWizardInitCache.get(key);
  if (prev) {
    agentWizardInitCache.set(key, { ...prev, ...patch });
  }
}

export function invalidateAgentWizardInitCache(
  module: string,
  connectionId: string,
  connectionType: string,
): void {
  const key = `${module}|${connectionId}|${connectionType}`;
  agentWizardInitCache.delete(key);
  agentWizardInitInflight.delete(key);
}

export async function fetchAgentSetupStatus(
  connectionId: string,
  connectionType: string,
): Promise<AgentSetupStatus | null> {
  const key = `status|${connectionId}|${connectionType}`;
  const existing = agentSetupStatusInflight.get(key);
  if (existing) return existing;

  const request = (async () => {
    try {
      const result = await executeApiRequestSilent<{
        status?: boolean;
        data?: AgentSetupStatus;
      }>(
        () =>
          api.post("/ingestion/connector-agent-actions", {
            payload: {
              actions: "get_agent_setup_status",
              connection_id: connectionId,
              connection_type: connectionType,
            },
          }),
        "Failed to load agent setup status",
      );
      return result?.data ?? null;
    } finally {
      agentSetupStatusInflight.delete(key);
    }
  })();

  agentSetupStatusInflight.set(key, request);
  return request;
}

export async function runConnectorAgentAction(
  payload: ConnectorAgentActionPayload,
): Promise<{ data: Record<string, unknown>; message?: string }> {
  const requestPayload: ConnectorAgentActionPayload =
    payload.actions === "generate_agent_config"
      ? { ...payload, connection_mode: payload.connection_mode ?? "agent" }
      : payload;

  const result = await executeApiRequestSilent<{
    status?: boolean;
    message?: string;
    data?: Record<string, unknown>;
  }>(
    () =>
      api.post("/ingestion/connector-agent-actions", {
        payload: requestPayload,
      }),
    "Agent action failed",
  );

  return {
    data: (result?.data as Record<string, unknown>) ?? {},
    message: result?.message,
  };
}

export function getWizardStepByAction(
  steps: WizardStepConfig[],
  action: string,
): WizardStepConfig | undefined {
  return steps.find((step) => {
    const payload = step.fetch?.params?.payload as
      | Record<string, unknown>
      | undefined;
    return payload?.actions === action;
  });
}

export function buildAgentInstallerDownloadUrl(
  connectionId: string,
  connectionType: string,
  platform: string,
  templateUrl = DEFAULT_AGENT_INSTALLER_DOWNLOAD_TEMPLATE,
): string {
  return String(
    substituteTemplates(templateUrl, {
      id: connectionId,
      connection_id: connectionId,
      connection_type: connectionType,
      agent_platform: platform,
    }),
  );
}

export function resolveActionDownloadUrl(
  actionData: Record<string, unknown>,
  fileDownload: WizardStepConfig["file_download"] | undefined,
  templateValues: Record<string, unknown>,
): string | undefined {
  const responseField = fileDownload?.response_field;
  if (responseField) {
    const fieldName = responseField.startsWith("data.")
      ? responseField.slice("data.".length)
      : responseField;
    const fromResponse = actionData[fieldName];
    if (fromResponse != null && String(fromResponse).trim()) {
      return String(fromResponse);
    }
  }

  if (actionData.download_url != null && String(actionData.download_url).trim()) {
    return String(actionData.download_url);
  }

  if (fileDownload?.url) {
    return String(substituteTemplates(fileDownload.url, templateValues));
  }

  return undefined;
}

export type DownloadAgentInstallerResult = DownloadAgentData & {
  downloaded: boolean;
  message?: string;
};

export async function downloadAgentInstaller(options: {
  connectionId: string;
  connectionType: string;
  platform: string;
  fileDownload?: WizardStepConfig["file_download"];
  fallbackFilename?: string;
}): Promise<DownloadAgentInstallerResult> {
  const { connectionId, connectionType, platform, fileDownload, fallbackFilename } =
    options;

  const templateValues = {
    id: connectionId,
    connection_id: connectionId,
    connection_type: connectionType,
    agent_platform: platform,
  };

  const downloadUrl =
    (fileDownload?.url
      ? String(substituteTemplates(fileDownload.url, templateValues))
      : undefined) ??
    buildAgentInstallerDownloadUrl(connectionId, connectionType, platform);

  const filename = fallbackFilename ?? `datafusion-edge-agent-${platform}.tar.gz`;

  await downloadAgentFile(downloadUrl, filename);
  return {
    downloaded: true,
  };
}

function extractFilename(
  contentDisposition: string | undefined,
  fallback: string,
): string {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(
    /filename="([^"]+)"|filename=([^\s;]+)/i,
  );
  if (!match) return fallback;
  return (match[1] || match[2]).replace(/^["']|["']$/g, "");
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function downloadAgentFile(
  downloadPath: string,
  fallbackFilename: string,
): Promise<void> {
  const path = downloadPath.startsWith("/")
    ? downloadPath
    : `/${downloadPath}`;
  const res = await api.get(path, { responseType: "blob" });
  await assertBlobNotApiError(res.data as Blob, "Failed to download agent");
  const filename = extractFilename(
    res.headers["content-disposition"],
    fallbackFilename,
  );
  triggerBlobDownload(res.data as Blob, filename);
}

export async function downloadConfigFromContent(
  content: string,
  filename: string,
  contentType = "application/json",
): Promise<void> {
  const blob = new Blob([content], { type: contentType });
  triggerBlobDownload(blob, filename);
}

function agentConfigDownloadPath(connectionId: string): string {
  const encodedConnectionId = encodeURIComponent(connectionId);
  return `/ingestion/connector-agent-actions/download-config/${encodedConnectionId}`;
}

/** Load saved config JSON for preview (no browser download). */
export async function fetchStoredAgentConfigPreview(
  connectionId: string,
): Promise<{ config: Record<string, unknown> | null; preview: string | null }> {
  try {
    const res = await api.get(agentConfigDownloadPath(connectionId), {
      responseType: "blob",
    });
    await assertBlobNotApiError(
      res.data as Blob,
      "Failed to load configuration",
    );
    const text = await (res.data as Blob).text();
    const trimmed = text.trim();
    if (!trimmed) {
      return { config: null, preview: null };
    }
    const config = parseAgentConfigObject(trimmed);
    if (config) {
      return { config, preview: formatAgentConfigPreview(config) };
    }
    return { config: null, preview: trimmed };
  } catch {
    return { config: null, preview: null };
  }
}

export async function downloadAgentConfigFile(
  connectionId: string,
  fallbackFilename: string,
): Promise<void> {
  const res = await api.get(agentConfigDownloadPath(connectionId), {
    responseType: "blob",
  });
  await assertBlobNotApiError(res.data as Blob, "Failed to download configuration");
  const filename = extractFilename(
    res.headers["content-disposition"],
    fallbackFilename,
  );
  triggerBlobDownload(res.data as Blob, filename);
}

export function resolveDownloadUrl(downloadUrl: string): string {
  if (downloadUrl.startsWith("http")) return downloadUrl;
  if (downloadUrl.startsWith(API_BASE_URL)) return downloadUrl;
  if (downloadUrl.startsWith("/api/")) return downloadUrl;
  if (downloadUrl.startsWith("/")) return `${API_BASE_URL}${downloadUrl}`;
  return `${API_BASE_URL}/${downloadUrl}`;
}
