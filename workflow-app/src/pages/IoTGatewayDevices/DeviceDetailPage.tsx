import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Bell,
  Database,
  FileText,
  LayoutDashboard,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Navigate, useNavigate, useParams } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import {
  assignDeviceToCustomer,
  clearDeviceCalculatedEvents,
  createDeviceCalculatedField,
  deleteCalculatedField,
  deleteDevice,
  deleteDeviceAttributes,
  deleteDeviceTelemetry,
  entityIdFromTb,
  getAvailableCustomers,
  getDeviceAlarms,
  getDeviceAuditLogs,
  getDeviceAttributes,
  getDeviceCalculatedEvents,
  getDeviceCalculatedFieldById,
  getDeviceCalculatedFields,
  getDeviceCredentials,
  getDeviceEvents,
  getDeviceInfo,
  getDeviceLatestTimeseries,
  listDeviceProfileInfos,
  saveDevice,
  saveDeviceAttributes,
  saveDeviceTelemetry,
  tenantIdFromDeviceInfo,
  unassignDeviceFromCustomer,
  updateDeviceCredentials,
  type DeviceAttributeScope,
  type DeviceInfoRecord,
  type DeviceProfileOption,
} from "@/controllers/API/devicesApi";
import { DeviceAlarmRulesTab } from "./DeviceAlarmRulesTab";
import { DeviceAlarmsTab } from "./DeviceAlarmsTab";
import { DeviceAttributesTab } from "./DeviceAttributesTab";
import { DeviceCalculatedFieldsTab } from "./DeviceCalculatedFieldsTab";
import {
  DeviceAlarmDetailsDialog,
  DeviceAlarmRuleDialog,
  DeviceAssignDialog,
  DeviceAttributeDialog,
  DeviceCalculatedFieldDialog,
  DeviceConnectivityDialog,
  DeviceCredentialsDialog,
  DeviceDeleteDialog,
  DeviceTelemetryDialog,
  type TelemetryInputType,
} from "./DeviceDetailDialogs";
import { type AttributeRow, type LocalAlarmRule } from "./DeviceDetailTabShared";
import { DeviceDetailsTab } from "./DeviceDetailsTab";
import { DeviceEventsTab } from "./DeviceEventsTab";
import { DeviceAuditLogsTab } from "./DeviceAuditLogsTab";
import { DeviceTelemetryTab } from "./DeviceTelemetryTab";
import { cn } from "@/lib/utils";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

type GenericRow = Record<string, unknown>;
type ConnectivityProtocol = "MQTT" | "HTTP" | "COAP";
type ConnectivityOs = "linux" | "windows";

function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return value == null ? "" : String(value);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pageRows(raw: unknown): GenericRow[] {
  if (Array.isArray(raw)) return raw as GenericRow[];
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  return (Array.isArray(o.data) ? o.data : Array.isArray(o.content) ? o.content : []) as GenericRow[];
}

function pageTotalItems(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  if (!raw || typeof raw !== "object") return 0;
  const o = raw as Record<string, unknown>;
  if (typeof o.totalElements === "number") return o.totalElements;
  if (typeof o.total_elements === "number") return o.total_elements;
  if (typeof o.total === "number") return o.total;
  return pageRows(raw).length;
}

function formatTs(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return formatTs(n);
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return formatTs(parsed);
    return value;
  }
  return "—";
}

function jsonString(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        return value;
      }
    }
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function createdTime(info: DeviceInfoRecord | null): unknown {
  if (!info) return null;
  return info.createdTime ?? info.created_time ?? null;
}

function additionalInfoOf(info: DeviceInfoRecord | null): Record<string, unknown> {
  if (!info) return {};
  return objectValue(info.additionalInfo ?? info.additional_info);
}

function deviceName(info: DeviceInfoRecord | null, fallback: string): string {
  return stringValue(info?.name) || fallback;
}

function deviceLabel(info: DeviceInfoRecord | null): string {
  return stringValue(info?.label) || "—";
}

function deviceDescription(info: DeviceInfoRecord | null): string {
  const ai = additionalInfoOf(info);
  return stringValue(ai.description ?? info?.description) || "—";
}

function deviceGateway(info: DeviceInfoRecord | null): boolean {
  const ai = additionalInfoOf(info);
  return Boolean(ai.gateway ?? info?.gateway);
}

function deviceProfileName(info: DeviceInfoRecord | null): string {
  return stringValue(info?.deviceProfileName ?? info?.profileName ?? info?.type) || "—";
}

function deviceProfileId(info: DeviceInfoRecord | null): string {
  if (!info) return "";
  return entityIdFromTb(info.deviceProfileId ?? info.device_profile_id);
}

function deviceType(info: DeviceInfoRecord | null): string {
  return stringValue(info?.type) || "—";
}

function deviceCustomer(info: DeviceInfoRecord | null): string {
  return stringValue(info?.customerTitle ?? info?.customerName) || "Unassigned";
}

function displayValue(...values: unknown[]): string {
  for (const value of values) {
    const text = stringValue(value).trim();
    if (text) return text;
  }
  return "—";
}

function deviceTransportType(info: DeviceInfoRecord | null): string {
  if (!info) return "—";
  const raw = objectValue(info);
  const profile = objectValue(raw.deviceProfile ?? raw.device_profile);
  return displayValue(
    raw.transportType,
    raw.transport_type,
    profile.transportType,
    profile.transport_type,
  );
}

function deviceAssignedFirmware(info: DeviceInfoRecord | null): string {
  const ai = additionalInfoOf(info);
  const raw = objectValue(info);
  return displayValue(
    ai.assignedFirmware,
    ai.assigned_firmware,
    ai.firmwareName,
    ai.firmwareTitle,
    raw.assignedFirmware,
    raw.assigned_firmware,
    raw.firmwareName,
    raw.firmwareTitle,
  );
}

function deviceAssignedSoftware(info: DeviceInfoRecord | null): string {
  const ai = additionalInfoOf(info);
  const raw = objectValue(info);
  return displayValue(
    ai.assignedSoftware,
    ai.assigned_software,
    ai.softwareName,
    ai.softwareTitle,
    raw.assignedSoftware,
    raw.assigned_software,
    raw.softwareName,
    raw.softwareTitle,
  );
}

function devicePublic(info: DeviceInfoRecord | null): boolean {
  if (!info) return false;
  if (typeof info.public === "boolean") return info.public;
  const ai = additionalInfoOf(info);
  return Boolean(ai.isPublic);
}

function deviceActive(info: DeviceInfoRecord | null): boolean {
  return Boolean(info?.active);
}

function deviceAccessTokenFromCredentials(raw: unknown): string {
  const o = objectValue(raw);
  return (
    stringValue(o.credentialsId) ||
    stringValue(o.credentials_id) ||
    stringValue(o.credentialsValue) ||
    stringValue(o.accessToken)
  );
}

function deviceMqttBasicFromCredentials(raw: unknown): Record<string, string> | null {
  const o = objectValue(raw);
  const inner = objectValue(o.credentialsValue ?? o.credentials_value);
  const username = stringValue(inner.userName ?? inner.username);
  const password = stringValue(inner.password);
  const clientId = stringValue(inner.clientId ?? inner.client_id);
  if (!username && !password && !clientId) return null;
  return { username, password, clientId };
}

function credentialsTypeLabel(raw: unknown): string {
  const o = objectValue(raw);
  const type =
    stringValue(o.credentialsType ?? o.credentials_type ?? o.type ?? o.credentialType).toUpperCase();
  if (type.includes("X509")) return "X.509 certificate";
  if (type.includes("MQTT")) return "MQTT Basic";
  if (deviceMqttBasicFromCredentials(raw)) return "MQTT Basic";
  return "Access Token";
}

function eventTime(row: GenericRow): unknown {
  return row.createdTime ?? row.created_time ?? row.ts ?? row.timestamp ?? row.eventTime;
}

function eventType(row: GenericRow): string {
  return stringValue(row.type ?? row.eventType ?? row.event_type) || "—";
}

function eventBody(row: GenericRow): string {
  const body = row.body ?? row.message ?? row.data ?? row.details;
  if (body == null) return "—";
  if (typeof body === "string") return body;
  return jsonString(body);
}

function alarmOriginator(row: GenericRow): string {
  const originator = objectValue(row.originator);
  return (
    displayValue(
      row.originatorName,
      row.originatorLabel,
      row.originatorEntityName,
      originator.name,
      originator.label,
      row.name,
      row.deviceName,
    ) || "—"
  );
}

function alarmSeverity(row: GenericRow): string {
  return stringValue(row.severity).trim() || "—";
}

function alarmAssignee(row: GenericRow): string {
  const assignee = objectValue(row.assignee);
  const value = displayValue(row.assigneeName, row.assigneeLabel, assignee.name, assignee.email);
  return value === "—" ? "Unassigned" : value;
}

function alarmStatus(row: GenericRow): string {
  const direct = stringValue(row.status ?? row.alarmStatus).trim();
  if (direct) return direct;
  const acknowledged = row.acknowledged ?? row.ack;
  const cleared = row.cleared ?? row.clear;
  if (typeof acknowledged === "boolean" || typeof cleared === "boolean") {
    return `${cleared ? "Cleared" : "Active"} ${acknowledged ? "Acknowledged" : "Unacknowledged"}`;
  }
  return "—";
}

function alarmStartTime(row: GenericRow): unknown {
  return row.startTs ?? row.startTime ?? row.createdTime ?? row.created_time;
}

function asTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (seconds || parts.length === 0) parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);
  return parts.join(" ");
}

function alarmDuration(row: GenericRow): string {
  const direct = row.duration ?? row.durationMs ?? row.duration_ms;
  if (typeof direct === "string" && direct.trim()) return direct;
  if (typeof direct === "number" && Number.isFinite(direct)) return formatDuration(direct);
  const start = asTimestamp(alarmStartTime(row));
  if (!start) return "—";
  const end =
    asTimestamp(row.endTs ?? row.endTime ?? row.clearedTime ?? row.clearTs ?? row.clear_time) || Date.now();
  return formatDuration(Math.max(0, end - start));
}

function alarmAdditionalInfo(row: GenericRow): unknown {
  return row.additionalInfo ?? row.additional_info ?? row.details ?? row.body ?? row;
}

function alarmRows(raw: unknown): GenericRow[] {
  return pageRows(raw);
}

function calcRows(raw: unknown): GenericRow[] {
  return pageRows(raw);
}

function eventRows(raw: unknown): GenericRow[] {
  return pageRows(raw);
}

function auditRows(raw: unknown): GenericRow[] {
  return pageRows(raw);
}

function auditCreatedTime(row: GenericRow): unknown {
  return row.createdTime ?? row.created_time ?? row.ts ?? row.timestamp;
}

function auditUser(row: GenericRow): string {
  const user = objectValue(row.user);
  return displayValue(
    row.userName,
    row.userEmail,
    row.email,
    row.username,
    user.name,
    user.email,
    row.authority,
  );
}

function auditAction(row: GenericRow): string {
  return displayValue(row.actionType, row.action, row.type, row.actionName, row.eventType);
}

function auditStatus(row: GenericRow): string {
  return displayValue(row.actionStatus, row.status, row.result, row.outcome);
}

function auditEntity(row: GenericRow): string {
  return displayValue(row.entityName, row.objectName, row.name, row.entityType, row.objectType);
}

function auditDetails(row: GenericRow): string {
  const value = row.actionData ?? row.additionalInfo ?? row.details ?? row.body ?? row.failureDetails ?? row.message;
  if (value == null) return "—";
  if (typeof value === "string") return value.trim() || "—";
  return jsonString(value);
}

function attributeRows(raw: unknown): AttributeRow[] {
  if (Array.isArray(raw)) {
    return raw.map((item, index) => {
      const row = objectValue(item);
      return {
        key: stringValue(row.key) || `item-${index + 1}`,
        value:
          row.value == null
            ? "—"
            : typeof row.value === "string"
              ? row.value
              : jsonString(row.value),
        lastUpdate:
          typeof row.lastUpdateTs === "number"
            ? row.lastUpdateTs
            : typeof row.lastUpdate === "number"
              ? row.lastUpdate
              : 0,
      };
    });
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([key, value]) => {
      const direct = objectValue(value);
      const firstArrayItem =
        Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && value[0] != null
          ? objectValue(value[0])
          : null;
      const firstPoint = firstArrayItem ?? direct;
      const pointValue =
        firstPoint.value ?? firstPoint.strValue ?? firstPoint.boolValue ?? firstPoint.longValue ?? firstPoint.doubleValue ?? value;
      const tsRaw = firstPoint.ts ?? firstPoint.lastUpdateTs ?? firstPoint.lastUpdate;
      const ts =
        typeof tsRaw === "number"
          ? tsRaw
          : typeof tsRaw === "string" && Number.isFinite(Number(tsRaw))
            ? Number(tsRaw)
            : 0;
      return {
        key,
        value: typeof pointValue === "string" ? pointValue : jsonString(pointValue),
        lastUpdate: ts,
      };
    });
  }
  return [];
}

function calcFieldId(row: GenericRow): string {
  return entityIdFromTb(row.id) || entityIdFromTb(row.calculatedFieldId);
}

function calcFieldName(row: GenericRow): string {
  return stringValue(row.name ?? row.title ?? row.calculatedFieldName) || "Calculated field";
}

function calcFieldType(row: GenericRow): string {
  const configuration = objectValue(row.configuration);
  return stringValue(row.type ?? configuration.type) || "SIMPLE";
}

function calcFieldExpression(row: GenericRow): string {
  const configuration = objectValue(row.configuration);
  return stringValue(configuration.expression ?? row.expression) || "—";
}

function calcFieldOutputName(row: GenericRow): string {
  const configuration = objectValue(row.configuration);
  const output = objectValue(configuration.output);
  return stringValue(output.name ?? row.outputName ?? row.key) || "—";
}

function calcFieldArgumentNames(row: GenericRow): string[] {
  const configuration = objectValue(row.configuration);
  const argumentsObject = objectValue(configuration.arguments);
  return Object.keys(argumentsObject);
}

function calcFieldCreatedTime(row: GenericRow): unknown {
  return row.createdTime ?? row.created_time ?? row.ts ?? row.timestamp;
}

function attributeScopeLabel(scope: DeviceAttributeScope): string {
  switch (scope) {
    case "CLIENT_SCOPE":
      return "Client attributes";
    case "SHARED_SCOPE":
      return "Shared attributes";
    case "SERVER_SCOPE":
    default:
      return "Server attributes";
  }
}

const calculatedFieldReservedWords = new Set([
  "abs",
  "acos",
  "asin",
  "atan",
  "ceil",
  "cos",
  "exp",
  "false",
  "floor",
  "if",
  "log",
  "max",
  "min",
  "null",
  "pi",
  "pow",
  "round",
  "sign",
  "sin",
  "sqrt",
  "tan",
  "true",
  "undefined",
]);

function inferCalculatedFieldArguments(expression: string): string[] {
  const tokens = expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  const unique = new Set<string>();
  for (const token of tokens) {
    const normalized = token.trim();
    if (!normalized) continue;
    if (calculatedFieldReservedWords.has(normalized.toLowerCase())) continue;
    unique.add(normalized);
  }
  return Array.from(unique);
}

function connectivityCommand(
  protocol: ConnectivityProtocol,
  os: ConnectivityOs,
  rawCredentials: unknown,
): string {
  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const accessToken = deviceAccessTokenFromCredentials(rawCredentials);
  const mqtt = deviceMqttBasicFromCredentials(rawCredentials);
  const linuxBody = `'{"temperature":25}'`;
  const windowsBody = '"{\\"temperature\\":25}"';
  const body = os === "windows" ? windowsBody : linuxBody;

  if (protocol === "MQTT") {
    if (mqtt?.username || mqtt?.password || mqtt?.clientId) {
      return [
        "mosquitto_pub",
        "-d",
        "-q 1",
        `-h ${host}`,
        "-p 1883",
        '-t "v1/devices/me/telemetry"',
        mqtt.username ? `-u "${mqtt.username}"` : "",
        mqtt.password ? `-P "${mqtt.password}"` : "",
        mqtt.clientId ? `-i "${mqtt.clientId}"` : "",
        `-m ${body}`,
      ]
        .filter(Boolean)
        .join(" ");
    }
    if (accessToken) {
      return `mosquitto_pub -d -q 1 -h ${host} -p 1883 -t "v1/devices/me/telemetry" -u "${accessToken}" -m ${body}`;
    }
    return "Load device credentials to generate an MQTT command.";
  }

  if (!accessToken) {
    return protocol === "COAP"
      ? "Load an Access Token credential to generate a CoAP command."
      : "Load an Access Token credential to generate an HTTP command.";
  }

  if (protocol === "HTTP") {
    return `curl -v -X POST http://${host}/api/v1/${accessToken}/telemetry --header Content-Type:application/json --data ${body}`;
  }

  return `coap-client -m post -t application/json -e ${body} coap://${host}/api/v1/${accessToken}/telemetry`;
}

async function copyToClipboard(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error("Could not copy to clipboard.");
  }
}

export default function DeviceDetailPage() {
  const { deviceId: deviceIdParam } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const deviceId = deviceIdParam?.trim() ?? "";
  if (deviceId === "import") {
    return <Navigate to="/iot-gateway/device-import" replace />;
  }
  const splitPaneRef = useRef<HTMLDivElement | null>(null);
  const connectivityQuery =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("connectivity") === "1";

  const [activeTab, setActiveTab] = useState("details");
  const [splitPaneHeight, setSplitPaneHeight] = useState(0);
  const [info, setInfo] = useState<DeviceInfoRecord | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [profiles, setProfiles] = useState<DeviceProfileOption[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editProfileId, setEditProfileId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editGateway, setEditGateway] = useState(false);

  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [credsJson, setCredsJson] = useState("");
  const [credsLoading, setCredsLoading] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; title: string }[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [pickCustomer, setPickCustomer] = useState("");

  const [connectivityOpen, setConnectivityOpen] = useState(false);
  const [connectivityProtocol, setConnectivityProtocol] = useState<ConnectivityProtocol>("MQTT");
  const [connectivityOs, setConnectivityOs] = useState<ConnectivityOs>("linux");
  const [connectivityAutoOpened, setConnectivityAutoOpened] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [attrScope, setAttrScope] = useState<DeviceAttributeScope>("SERVER_SCOPE");
  const [attrRows, setAttrRows] = useState<AttributeRow[]>([]);
  const [attrLoading, setAttrLoading] = useState(false);
  const [attrInitialized, setAttrInitialized] = useState(false);
  const [attrDialogOpen, setAttrDialogOpen] = useState(false);
  const [attrSearchOpen, setAttrSearchOpen] = useState(false);
  const [attrSearch, setAttrSearch] = useState("");
  const [attrPage, setAttrPage] = useState(0);
  const [attrPageSize, setAttrPageSize] = useState(10);
  const [attrKey, setAttrKey] = useState("");
  const [attrVal, setAttrVal] = useState("");

  const [teleSaving, setTeleSaving] = useState(false);
  const [latestTelemetryRows, setLatestTelemetryRows] = useState<AttributeRow[]>([]);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [telemetryInitialized, setTelemetryInitialized] = useState(false);
  const [telemetrySearch, setTelemetrySearch] = useState("");
  const [telemetrySearchOpen, setTelemetrySearchOpen] = useState(false);
  const [telemetryDialogOpen, setTelemetryDialogOpen] = useState(false);
  const [telemetryPage, setTelemetryPage] = useState(0);
  const [telemetryPageSize, setTelemetryPageSize] = useState(10);
  const [telemetryEntryKey, setTelemetryEntryKey] = useState("");
  const [telemetryEntryType, setTelemetryEntryType] = useState<TelemetryInputType>("string");
  const [telemetryEntryValue, setTelemetryEntryValue] = useState("");

  const [alarms, setAlarms] = useState<GenericRow[]>([]);
  const [alarmsLoading, setAlarmsLoading] = useState(false);
  const [alarmsInitialized, setAlarmsInitialized] = useState(false);
  const [alarmPage, setAlarmPage] = useState(0);
  const [alarmPageSize, setAlarmPageSize] = useState(10);
  const [selectedAlarm, setSelectedAlarm] = useState<GenericRow | null>(null);

  const [evType, setEvType] = useState<"ERROR" | "LC_EVENT" | "STATS">("LC_EVENT");
  const [evTenant, setEvTenant] = useState("");
  const [evStartTime, setEvStartTime] = useState(() => Date.now() - 24 * 60 * 60 * 1000);
  const [evEndTime, setEvEndTime] = useState(() => Date.now());
  const [evRows, setEvRows] = useState<GenericRow[]>([]);
  const [evLoading, setEvLoading] = useState(false);
  const [eventsInitialized, setEventsInitialized] = useState(false);
  const [eventPage, setEventPage] = useState(0);
  const [eventPageSize, setEventPageSize] = useState(10);

  const [auditLogRows, setAuditLogRows] = useState<GenericRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(0);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const [auditTotalItems, setAuditTotalItems] = useState(0);

  const [cfRows, setCfRows] = useState<GenericRow[]>([]);
  const [cfLoading, setCfLoading] = useState(false);
  const [cfInitialized, setCfInitialized] = useState(false);
  const [cfCreateOpen, setCfCreateOpen] = useState(false);
  const [cfName, setCfName] = useState("calc");
  const [cfArgumentNames, setCfArgumentNames] = useState<string[]>([]);
  const [cfExpr, setCfExpr] = useState("(temperature)");
  const [cfOutputType, setCfOutputType] = useState("TIME_SERIES");
  const [cfOutputKey, setCfOutputKey] = useState("");
  const [cfDecimals, setCfDecimals] = useState("1");
  const [cfUseLatestTs, setCfUseLatestTs] = useState(true);
  const [cfStrategy, setCfStrategy] = useState<"DIRECT" | "RULE_CHAIN">("DIRECT");
  const [cfSelectedId, setCfSelectedId] = useState("");
  const [cfEventsJson, setCfEventsJson] = useState<unknown>(null);
  const [cfBusy, setCfBusy] = useState(false);

  const [alarmRuleRows, setAlarmRuleRows] = useState<LocalAlarmRule[]>([]);
  const [alarmRuleDialogOpen, setAlarmRuleDialogOpen] = useState(false);
  const [alarmRuleSearchOpen, setAlarmRuleSearchOpen] = useState(false);
  const [alarmRuleSearch, setAlarmRuleSearch] = useState("");
  const [alarmRulePage, setAlarmRulePage] = useState(0);
  const [alarmRulePageSize, setAlarmRulePageSize] = useState(10);
  const [alarmRuleType, setAlarmRuleType] = useState("");
  const [alarmRuleIntervalLabel, setAlarmRuleIntervalLabel] = useState("15 min");
  const [alarmRuleSeverity, setAlarmRuleSeverity] = useState("Critical");
  const [alarmRuleArguments, setAlarmRuleArguments] = useState<string[]>([]);
  const [alarmRuleTriggers, setAlarmRuleTriggers] = useState<string[]>([]);
  const [alarmRuleClears, setAlarmRuleClears] = useState<string[]>([]);

  const deviceTitle = useMemo(() => deviceName(info, "Device"), [info]);
  const credentialObject = useMemo(() => {
    if (!credsJson.trim()) return null;
    try {
      return JSON.parse(credsJson) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [credsJson]);
  const connectivityText = useMemo(
    () => connectivityCommand(connectivityProtocol, connectivityOs, credentialObject),
    [connectivityOs, connectivityProtocol, credentialObject],
  );
  const filteredTelemetryRows = useMemo(() => {
    const query = telemetrySearch.trim().toLowerCase();
    return latestTelemetryRows.filter((row) => {
      if (!query) return true;
      return row.key.toLowerCase().includes(query) || row.value.toLowerCase().includes(query);
    });
  }, [latestTelemetryRows, telemetrySearch]);
  const pagedTelemetryRows = useMemo(
    () => filteredTelemetryRows.slice(telemetryPage * telemetryPageSize, telemetryPage * telemetryPageSize + telemetryPageSize),
    [filteredTelemetryRows, telemetryPage, telemetryPageSize],
  );
  const filteredAttrRows = useMemo(() => {
    const query = attrSearch.trim().toLowerCase();
    return attrRows.filter((row) => {
      if (!query) return true;
      return row.key.toLowerCase().includes(query) || row.value.toLowerCase().includes(query);
    });
  }, [attrRows, attrSearch]);
  const pagedAttrRows = useMemo(
    () => filteredAttrRows.slice(attrPage * attrPageSize, attrPage * attrPageSize + attrPageSize),
    [attrPage, attrPageSize, filteredAttrRows],
  );
  const inferredCalculatedFieldArgs = useMemo(() => inferCalculatedFieldArguments(cfExpr), [cfExpr]);
  const effectiveCalculatedFieldArguments = useMemo(
    () => cfArgumentNames.map((item) => item.trim()).filter(Boolean),
    [cfArgumentNames],
  );
  const filteredAlarmRuleRows = useMemo(() => {
    const query = alarmRuleSearch.trim().toLowerCase();
    return alarmRuleRows.filter((row) => {
      if (!query) return true;
      return (
        row.alarmType.toLowerCase().includes(query) ||
        row.severity.toLowerCase().includes(query) ||
        row.triggerConditions.join(" ").toLowerCase().includes(query)
      );
    });
  }, [alarmRuleRows, alarmRuleSearch]);
  const pagedAlarmRuleRows = useMemo(
    () => filteredAlarmRuleRows.slice(alarmRulePage * alarmRulePageSize, alarmRulePage * alarmRulePageSize + alarmRulePageSize),
    [alarmRulePage, alarmRulePageSize, filteredAlarmRuleRows],
  );
  const selectedCalculatedField = useMemo(
    () => cfRows.find((row) => calcFieldId(row) === cfSelectedId) ?? null,
    [cfRows, cfSelectedId],
  );
  const selectedCalculatedFieldData = useMemo(() => {
    const payload = objectValue(cfEventsJson) as GenericRow;
    return calcFieldId(payload) === cfSelectedId ? payload : selectedCalculatedField;
  }, [cfEventsJson, cfSelectedId, selectedCalculatedField]);
  const calculatedFieldTableRows = useMemo(
    () =>
      cfRows.map((row, index) => ({
        id: calcFieldId(row) || `${index}`,
        name: calcFieldName(row),
        type: calcFieldType(row),
        outputKey: calcFieldOutputName(row),
        createdAt: formatTs(calcFieldCreatedTime(row)),
      })),
    [cfRows],
  );
  const calculatedFieldDetails = useMemo(
    () =>
      selectedCalculatedFieldData
        ? {
            name: calcFieldName(selectedCalculatedFieldData),
            type: calcFieldType(selectedCalculatedFieldData),
            outputKey: calcFieldOutputName(selectedCalculatedFieldData),
            arguments: calcFieldArgumentNames(selectedCalculatedFieldData),
            expression: calcFieldExpression(selectedCalculatedFieldData),
            payload: cfEventsJson ?? selectedCalculatedFieldData,
          }
        : null,
    [cfEventsJson, selectedCalculatedFieldData],
  );
  const alarmRuleTableRows = useMemo(
    () =>
      pagedAlarmRuleRows.map((row) => ({
        id: row.id,
        createdAt: formatTs(row.createdTime),
        alarmType: row.alarmType,
        severity: row.severity,
        thresholds: row.triggerConditions.join(", "),
      })),
    [pagedAlarmRuleRows],
  );
  const alarmTableRows = useMemo(
    () =>
      alarms.map((row, index) => ({
        id: `${stringValue(row.id)}-${index}`,
        createdAt: formatTs(alarmStartTime(row)),
        originator: alarmOriginator(row),
        type: stringValue(row.type ?? row.alarmType) || "—",
        severity: alarmSeverity(row),
        assignee: alarmAssignee(row),
        status: alarmStatus(row),
        raw: row,
      })),
    [alarms],
  );
  const pagedAlarmTableRows = useMemo(
    () => alarmTableRows.slice(alarmPage * alarmPageSize, alarmPage * alarmPageSize + alarmPageSize),
    [alarmPage, alarmPageSize, alarmTableRows],
  );
  const eventTableRows = useMemo(
    () =>
      evRows.map((row, index) => ({
        id: `${stringValue(row.id)}-${index}`,
        time: formatTs(eventTime(row)),
        type: eventType(row),
        details: eventBody(row),
      })),
    [evRows],
  );
  const pagedEventTableRows = useMemo(
    () => eventTableRows.slice(eventPage * eventPageSize, eventPage * eventPageSize + eventPageSize),
    [eventPage, eventPageSize, eventTableRows],
  );
  const auditTableRows = useMemo(
    () =>
      auditLogRows.map((row, index) => ({
        id: `${displayValue(row.id, row.actionType, row.createdTime)}-${index}`,
        createdAt: formatTs(auditCreatedTime(row)),
        user: auditUser(row),
        action: auditAction(row),
        entity: auditEntity(row),
        status: auditStatus(row),
        details: auditDetails(row),
      })),
    [auditLogRows],
  );
  const telemetryEmptyState = useMemo(
    () => (telemetryLoading ? "Loading telemetry..." : latestTelemetryRows.length > 0 ? "No telemetry rows found" : "No telemetry found"),
    [latestTelemetryRows.length, telemetryLoading],
  );
  const connectionStateLabel = deviceActive(info) ? "Active" : "Inactive";
  const assignedCustomerLabel = deviceCustomer(info);
  const profileLabel = deviceProfileName(info);
  const visibilityLabel = devicePublic(info) ? "Public device" : "Private device";
  const createdAtLabel = formatTs(createdTime(info));
  const typeLabel = deviceType(info);
  const transportTypeLabel = deviceTransportType(info);
  const descriptionText = deviceDescription(info);
  const gatewayLabel = deviceGateway(info) ? "Gateway enabled" : "Standard device";
  const detailSections = useMemo(
    () => [
      {
        id: "details",
        label: "Device details",
        description: "Ownership, credentials, connectivity controls.",
        icon: LayoutDashboard,
        meta: profileLabel,
      },
      {
        id: "attributes",
        label: "Attributes",
        description: "Server, shared, and client metadata for this device.",
        icon: Database,
        meta: `${filteredAttrRows.length} item${filteredAttrRows.length === 1 ? "" : "s"}`,
      },
      {
        id: "telemetry",
        label: "Latest telemetry",
        description: "Recently reported values and signal health at a glance.",
        icon: Activity,
        meta: `${filteredTelemetryRows.length} key${filteredTelemetryRows.length === 1 ? "" : "s"}`,
      },
      {
        id: "calculated",
        label: "Calculated fields",
        description: "Derived values, formulas, and debugging output.",
        icon: FileText,
        meta: `${calculatedFieldTableRows.length} field${calculatedFieldTableRows.length === 1 ? "" : "s"}`,
      },
      {
        id: "alarm-rules",
        label: "Alarm rules",
        description: "Threshold logic and automation rules for alerts.",
        icon: Bell,
        meta: `${filteredAlarmRuleRows.length} rule${filteredAlarmRuleRows.length === 1 ? "" : "s"}`,
      },
      {
        id: "alarms",
        label: "Alarms",
        description: "Live and historical alarms with severity tracking.",
        icon: Bell,
        meta: `${alarmTableRows.length} alarm${alarmTableRows.length === 1 ? "" : "s"}`,
      },
      {
        id: "events",
        label: "Events",
        description: "Operational event stream filtered by time window.",
        icon: Activity,
        meta: evType.replace(/_/g, " "),
      },
      {
        id: "audit",
        label: "Audit logs",
        description: "Recent device activity, changes, and access history.",
        icon: FileText,
        meta: `${auditTotalItems} entr${auditTotalItems === 1 ? "y" : "ies"}`,
      },
    ],
    [
      alarmTableRows.length,
      auditTotalItems,
      calculatedFieldTableRows.length,
      evType,
      filteredAlarmRuleRows.length,
      filteredAttrRows.length,
      filteredTelemetryRows.length,
      profileLabel,
    ],
  );
  const activeSection = detailSections.find((section) => section.id === activeTab) ?? detailSections[0];

  const loadProfiles = useCallback(async () => {
    try {
      const list = await listDeviceProfileInfos({ page_size: 100, page: 0 });
      setProfiles(list);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load device profiles."));
    }
  }, []);

  const loadInfo = useCallback(async () => {
    if (!deviceId) return;
    setLoadingInfo(true);
    try {
      const data = (await getDeviceInfo(deviceId)) as DeviceInfoRecord;
      setInfo(data);
      const tenantId = tenantIdFromDeviceInfo(data);
      if (tenantId) setEvTenant(tenantId);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load device."));
    } finally {
      setLoadingInfo(false);
    }
  }, [deviceId]);

  const loadCredentials = useCallback(async () => {
    if (!deviceId) return;
    setCredsLoading(true);
    try {
      const data = await getDeviceCredentials(deviceId);
      setCredsJson(jsonString(data));
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load credentials."));
    } finally {
      setCredsLoading(false);
    }
  }, [deviceId]);

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const raw = await getAvailableCustomers({ page_size: 100, page: 0 });
      const rows = pageRows(raw).map((row) => {
        const id = entityIdFromTb(row.id);
        const title = stringValue(row.title ?? row.name) || id;
        return id ? { id, title } : null;
      });
      setCustomers(rows.filter((row): row is { id: string; title: string } => row != null));
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load customers."));
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  const loadAttributes = useCallback(async () => {
    if (!deviceId) return;
    setAttrLoading(true);
    try {
      const raw = await getDeviceAttributes(deviceId, attrScope, "");
      setAttrRows(attributeRows(raw));
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load attributes."));
      setAttrRows([]);
    } finally {
      setAttrLoading(false);
    }
  }, [attrScope, deviceId]);

  const loadAlarms = useCallback(async () => {
    if (!deviceId) return;
    setAlarmsInitialized(true);
    setAlarmsLoading(true);
    try {
      const raw = await getDeviceAlarms({ device_id: deviceId, page_size: 20, page: 0 });
      setAlarms(alarmRows(raw));
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load alarms."));
      setAlarms([]);
    } finally {
      setAlarmsLoading(false);
    }
  }, [deviceId]);

  const loadLatestTelemetry = useCallback(async () => {
    if (!deviceId) return;
    setTelemetryLoading(true);
    try {
      const raw = await getDeviceLatestTimeseries({
        device_id: deviceId,
        use_strict_data_types: false,
      });
      const root = objectValue(raw);
      const payload =
        (root.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data : null) ??
        (root.payload && typeof root.payload === "object" && !Array.isArray(root.payload) ? root.payload : null) ??
        raw;
      setLatestTelemetryRows(attributeRows(payload));
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load latest telemetry."));
      setLatestTelemetryRows([]);
    } finally {
      setTelemetryLoading(false);
    }
  }, [deviceId]);

  const loadEvents = useCallback(
    async (nextStartTime = evStartTime, nextEndTime = evEndTime, tenantIdOverride?: string) => {
    if (!deviceId) return;
    const tenantId = (tenantIdOverride ?? evTenant).trim();
    if (!tenantId) {
      if (tenantIdOverride === undefined) {
        toast.error("Tenant id is required to load device events.");
      }
      return;
    }
    setEvLoading(true);
    try {
      const raw = await getDeviceEvents({
        device_id: deviceId,
        event_type: evType,
        page_size: 20,
        page: 0,
        sort_property: "createdTime",
        sort_order: "DESC",
        start_time: nextStartTime,
        end_time: nextEndTime,
        tenant_id: tenantId,
      });
      setEvRows(eventRows(raw));
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load events."));
      setEvRows([]);
    } finally {
      setEvLoading(false);
    }
    },
    [deviceId, evEndTime, evStartTime, evTenant, evType],
  );

  const loadAuditLogs = useCallback(async () => {
    if (!deviceId) return;
    setAuditLoading(true);
    const end = Date.now();
    const start = end - 24 * 60 * 60 * 1000;
    try {
      const raw = await getDeviceAuditLogs({
        device_id: deviceId,
        pageSize: auditPageSize,
        page: auditPage,
        sortProperty: "createdTime",
        sortOrder: "DESC",
        startTime: start,
        endTime: end,
      });
      const rows = auditRows(raw);
      setAuditLogRows(rows);
      setAuditTotalItems(pageTotalItems(raw));
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load audit logs."));
      setAuditLogRows([]);
      setAuditTotalItems(0);
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage, auditPageSize, deviceId]);

  const loadCalculatedFields = useCallback(async () => {
    if (!deviceId) return;
    setCfLoading(true);
    try {
      const raw = await getDeviceCalculatedFields({ device_id: deviceId, page_size: 50, page: 0 });
      setCfRows(calcRows(raw));
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load calculated fields."));
      setCfRows([]);
    } finally {
      setCfLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    setAlarms([]);
    setAlarmsInitialized(false);
    setAlarmPage(0);
    setSelectedAlarm(null);
    setAttrRows([]);
    setAttrInitialized(false);
    setLatestTelemetryRows([]);
    setTelemetryInitialized(false);
    setEvRows([]);
    setEventsInitialized(false);
    setEventPage(0);
    setAuditLogRows([]);
    setAuditPage(0);
    setAuditTotalItems(0);
    setCfRows([]);
    setCfSelectedId("");
    setCfEventsJson(null);
    setCfInitialized(false);
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId || loadingInfo || !info) return;
    const infoDeviceId = entityIdFromTb(info.id);
    if (!infoDeviceId || infoDeviceId !== deviceId) return;

    setAttrInitialized(true);
    setTelemetryInitialized(true);
    setEventsInitialized(true);
    setCfInitialized(true);

    const tenant = tenantIdFromDeviceInfo(info);

    void Promise.all([
      loadAttributes(),
      loadLatestTelemetry(),
      loadAlarms(),
      loadCalculatedFields(),
      tenant ? loadEvents(evStartTime, evEndTime, tenant) : Promise.resolve(),
    ]);
  }, [
    deviceId,
    loadingInfo,
    info,
    evEndTime,
    evStartTime,
    loadAlarms,
    loadAttributes,
    loadCalculatedFields,
    loadEvents,
    loadLatestTelemetry,
  ]);

  useEffect(() => {
    setAttrRows([]);
    setAttrInitialized(false);
    setAttrPage(0);
  }, [attrScope, deviceId]);

  useEffect(() => {
    setEvRows([]);
    setEventsInitialized(false);
  }, [deviceId, evTenant, evType]);

  useEffect(() => {
    if (activeTab !== "attributes" || attrInitialized || attrLoading) return;
    setAttrInitialized(true);
    void loadAttributes();
  }, [activeTab, attrInitialized, attrLoading, loadAttributes]);

  useEffect(() => {
    if (activeTab !== "telemetry" || telemetryInitialized || telemetryLoading) return;
    setTelemetryInitialized(true);
    void loadLatestTelemetry();
  }, [activeTab, loadLatestTelemetry, telemetryInitialized, telemetryLoading]);

  useEffect(() => {
    setAttrPage(0);
  }, [attrPageSize, attrSearch, filteredAttrRows.length]);

  useEffect(() => {
    setAlarmPage(0);
  }, [alarmPageSize, alarmTableRows.length]);

  useEffect(() => {
    if (activeTab !== "alarms" || alarmsInitialized || alarmsLoading) return;
    void loadAlarms();
  }, [activeTab, alarmsInitialized, alarmsLoading, loadAlarms]);

  useEffect(() => {
    if (activeTab !== "events" || eventsInitialized || evLoading || !evTenant.trim()) return;
    setEventsInitialized(true);
    void loadEvents();
  }, [activeTab, evLoading, evTenant, eventsInitialized, loadEvents]);

  useEffect(() => {
    if (activeTab !== "audit") return;
    void loadAuditLogs();
  }, [activeTab, auditPage, auditPageSize, loadAuditLogs]);

  useEffect(() => {
    setTelemetryPage(0);
  }, [filteredTelemetryRows.length, telemetryPageSize, telemetrySearch]);

  useEffect(() => {
    setEventPage(0);
  }, [eventPageSize, eventTableRows.length]);

  useEffect(() => {
    setAlarmRulePage(0);
  }, [alarmRulePageSize, alarmRuleSearch, filteredAlarmRuleRows.length]);

  useEffect(() => {
    if (activeTab !== "calculated" || cfInitialized || cfLoading) return;
    setCfInitialized(true);
    void loadCalculatedFields();
  }, [activeTab, cfInitialized, cfLoading, loadCalculatedFields]);

  useEffect(() => {
    if (!connectivityQuery || connectivityAutoOpened || !deviceId) return;
    setConnectivityAutoOpened(true);
    setConnectivityOpen(true);
    void loadCredentials();
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("connectivity");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [connectivityAutoOpened, connectivityQuery, deviceId, loadCredentials]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frameId = 0;

    const updateSplitPaneHeight = () => {
      const nextHeight = splitPaneRef.current
        ? Math.max(0, Math.floor(window.innerHeight - splitPaneRef.current.getBoundingClientRect().top - 12))
        : 0;

      setSplitPaneHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateSplitPaneHeight);
    };

    scheduleUpdate();
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [deviceTitle, loadingInfo]);

  const openEdit = async () => {
    if (!profiles.length) await loadProfiles();
    const ai = additionalInfoOf(info);
    setEditName(deviceName(info, ""));
    setEditLabel(stringValue(info?.label));
    setEditProfileId(deviceProfileId(info));
    setEditDescription(stringValue(ai.description));
    setEditGateway(Boolean(ai.gateway));
    setEditOpen(true);
  };

  const openCredentialsDialog = () => {
    setCredentialsOpen(true);
    void loadCredentials();
  };

  const openAssignDialog = () => {
    setAssignOpen(true);
    void loadCustomers();
  };

  const openConnectivityDialog = () => {
    setConnectivityOpen(true);
    void loadCredentials();
  };

  const openAttributeDialog = (row?: AttributeRow) => {
    setAttrKey(row?.key ?? "");
    setAttrVal(row?.value === "—" ? "" : row?.value ?? "");
    setAttrDialogOpen(true);
  };

  const openTelemetryDialog = () => {
    setTelemetryEntryKey("");
    setTelemetryEntryType("string");
    setTelemetryEntryValue("");
    setTelemetryDialogOpen(true);
  };

  const clearTelemetryDraft = useCallback(() => {
    setTelemetryEntryKey("");
    setTelemetryEntryType("string");
    setTelemetryEntryValue("");
  }, []);

  const openCalculatedFieldDialog = () => {
    setCfName("calc");
    setCfExpr("(temperature)");
    setCfArgumentNames([]);
    setCfOutputType("TIME_SERIES");
    setCfOutputKey("");
    setCfDecimals("1");
    setCfUseLatestTs(true);
    setCfStrategy("DIRECT");
    setCfCreateOpen(true);
  };

  const clearCalculatedFieldDraft = useCallback(() => {
    setCfName("calc");
    setCfExpr("(temperature)");
    setCfArgumentNames([]);
    setCfOutputType("TIME_SERIES");
    setCfOutputKey("");
    setCfDecimals("1");
    setCfUseLatestTs(true);
    setCfStrategy("DIRECT");
  }, []);

  const openAlarmRuleDialog = () => {
    setAlarmRuleType("");
    setAlarmRuleIntervalLabel("15 min");
    setAlarmRuleSeverity("Critical");
    setAlarmRuleArguments([]);
    setAlarmRuleTriggers([]);
    setAlarmRuleClears([]);
    setAlarmRuleDialogOpen(true);
  };

  const clearAlarmRuleDraft = useCallback(() => {
    setAlarmRuleType("");
    setAlarmRuleIntervalLabel("15 min");
    setAlarmRuleSeverity("Critical");
    setAlarmRuleArguments([]);
    setAlarmRuleTriggers([]);
    setAlarmRuleClears([]);
  }, []);

  const saveEdit = async () => {
    if (!deviceId) return;
    const name = editName.trim();
    if (!name) {
      toast.error("Device name is required.");
      return;
    }
    if (!editProfileId) {
      toast.error("Device profile is required.");
      return;
    }
    setEditSubmitting(true);
    const ai = additionalInfoOf(info);
    const customerId = entityIdFromTb(info?.customerId);
    const payload: Parameters<typeof saveDevice>[0]["payload"] = {
      id: { entityType: "DEVICE", id: deviceId },
      name,
      label: editLabel.trim() || undefined,
      deviceProfileId: { entityType: "DEVICE_PROFILE", id: editProfileId },
      additionalInfo: {
        ...ai,
        description: editDescription.trim(),
        gateway: editGateway,
      },
      customerId: customerId ? { entityType: "CUSTOMER", id: customerId } : null,
      type: stringValue(info?.type) || undefined,
    };
    try {
      await saveDevice({ payload });
      toast.success("Device updated.");
      setEditOpen(false);
      await loadInfo();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to update device."));
    } finally {
      setEditSubmitting(false);
    }
  };

  const saveCredentials = async () => {
    try {
      const parsed = JSON.parse(credsJson) as Record<string, unknown>;
      const inner =
        "payload" in parsed && parsed.payload && typeof parsed.payload === "object"
          ? (parsed.payload as Record<string, unknown>)
          : parsed;
      await updateDeviceCredentials(inner);
      toast.success("Device credentials updated.");
      await loadCredentials();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Invalid JSON or credentials update failed."));
    }
  };

  const copyDeviceId = async () => {
    await copyToClipboard(deviceId, "Device id copied.");
  };

  const copyBestCredentials = async () => {
    if (!credentialObject) {
      await loadCredentials();
      return;
    }
    const token = deviceAccessTokenFromCredentials(credentialObject);
    if (token) {
      await copyToClipboard(token, "Access token copied.");
      return;
    }
    const mqtt = deviceMqttBasicFromCredentials(credentialObject);
    if (mqtt) {
      await copyToClipboard(jsonString(mqtt), "MQTT credentials copied.");
      return;
    }
    await copyToClipboard(jsonString(credentialObject), "Device credentials copied.");
  };

  const assignCustomer = async () => {
    if (!deviceId || !pickCustomer) {
      toast.error("Select a customer.");
      return;
    }
    setCustomersLoading(true);
    try {
      await assignDeviceToCustomer(pickCustomer, deviceId);
      toast.success("Device assigned to customer.");
      setAssignOpen(false);
      await loadInfo();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to assign device."));
    } finally {
      setCustomersLoading(false);
    }
  };

  const unassignCustomerFromDevice = async () => {
    if (!deviceId) return;
    try {
      await unassignDeviceFromCustomer(deviceId);
      toast.success("Device unassigned from customer.");
      await loadInfo();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to unassign device from customer."));
    }
  };

  const confirmDelete = async () => {
    if (!deviceId) return;
    setDeleteSubmitting(true);
    try {
      await deleteDevice(deviceId);
      toast.success("Device deleted.");
      navigate("/iot-gateway/devices");
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to delete device."));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const saveAttributePair = async () => {
    if (!deviceId || !attrKey.trim()) {
      toast.error("Attribute key is required.");
      return;
    }
    try {
      await saveDeviceAttributes(deviceId, attrScope, { [attrKey.trim()]: attrVal });
      toast.success("Attribute saved.");
      setAttrKey("");
      setAttrVal("");
      setAttrDialogOpen(false);
      await loadAttributes();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to save attribute."));
    }
  };

  const deleteAttributeByKey = async (key: string) => {
    if (!deviceId || !key.trim()) {
      toast.error("Attribute key is required.");
      return;
    }
    try {
      await deleteDeviceAttributes(deviceId, attrScope, key.trim());
      toast.success("Attribute deleted.");
      await loadAttributes();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to delete attribute."));
    }
  };

  const addTelemetryEntry = async () => {
    if (!deviceId) return;
    const key = telemetryEntryKey.trim();
    if (!key) {
      toast.error("Telemetry key is required.");
      return;
    }

    let parsedValue: string | number | boolean = telemetryEntryValue;
    if (telemetryEntryType === "number") {
      const num = Number(telemetryEntryValue);
      if (!Number.isFinite(num)) {
        toast.error("Enter a valid number.");
        return;
      }
      parsedValue = num;
    } else if (telemetryEntryType === "boolean") {
      const normalized = telemetryEntryValue.trim().toLowerCase();
      if (normalized !== "true" && normalized !== "false") {
        toast.error("Boolean value must be true or false.");
        return;
      }
      parsedValue = normalized === "true";
    }

    setTeleSaving(true);
    try {
      await saveDeviceTelemetry(deviceId, "LATEST_TELEMETRY", { [key]: parsedValue });
      await loadLatestTelemetry();
      setTelemetryDialogOpen(false);
      toast.success("Telemetry added.");
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to add telemetry."));
    } finally {
      setTeleSaving(false);
    }
  };

  const deleteTelemetryByKey = async (key: string) => {
    if (!deviceId || !key.trim()) {
      toast.error("Telemetry key is required.");
      return;
    }
    try {
      await deleteDeviceTelemetry(deviceId, "LATEST_TELEMETRY", key.trim());
      toast.success("Telemetry removed.");
      await loadLatestTelemetry();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to delete telemetry."));
    }
  };

  const createCalculatedField = async () => {
    if (!deviceId) return;
    const name = cfName.trim() || "calc";
    const expression = cfExpr.trim() || "0";
    if (!effectiveCalculatedFieldArguments.length && !inferredCalculatedFieldArgs.length) {
      toast.error("Use at least one telemetry key in the expression to create a calculated field.");
      return;
    }
    setCfBusy(true);
    try {
      await createDeviceCalculatedField({
        entityId: { entityType: "DEVICE", id: deviceId },
        configuration: {
          arguments: {},
          useLatestTs: cfUseLatestTs,
          type: "SIMPLE",
          expression,
          output: {
            name: cfOutputKey.trim() || name,
            type: cfOutputType,
            decimalsByDefault: Number.isFinite(Number(cfDecimals)) ? Number(cfDecimals) : 1,
          },
        },
        name,
        type: "SIMPLE",
        debugSettings: { failuresEnabled: true, allEnabled: true },
      });
      toast.success("Calculated field created.");
      setCfCreateOpen(false);
      setCfSelectedId("");
      setCfEventsJson(null);
      await loadCalculatedFields();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to create calculated field."));
    } finally {
      setCfBusy(false);
    }
  };

  const createAlarmRule = () => {
    const type = alarmRuleType.trim();
    const args = alarmRuleArguments.map((item) => item.trim()).filter(Boolean);
    const triggers = alarmRuleTriggers.map((item) => item.trim()).filter(Boolean);
    const clears = alarmRuleClears.map((item) => item.trim()).filter(Boolean);

    if (!type) {
      toast.error("Alarm type is required.");
      return;
    }
    if (!args.length) {
      toast.error("At least one argument is required.");
      return;
    }
    if (!triggers.length) {
      toast.error("At least one trigger condition is required.");
      return;
    }

    setAlarmRuleRows((current) => [
      {
        id: String(Date.now()),
        createdTime: Date.now(),
        alarmType: type,
        intervalLabel: alarmRuleIntervalLabel,
        severity: alarmRuleSeverity,
        arguments: args,
        triggerConditions: triggers,
        clearConditions: clears,
      },
      ...current,
    ]);
    setAlarmRuleDialogOpen(false);
    toast.success("Alarm rule added.");
  };

  const loadCalculatedFieldDetail = async (id: string) => {
    setCfBusy(true);
    try {
      const data = await getDeviceCalculatedFieldById(id);
      setCfSelectedId(id);
      setCfEventsJson(data);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load calculated field."));
    } finally {
      setCfBusy(false);
    }
  };

  const loadCalculatedFieldEvents = async () => {
    const calculatedFieldId = cfSelectedId.trim();
    const tenantId = evTenant.trim();
    if (!calculatedFieldId || !tenantId) {
      toast.error("Select a field and ensure tenant id is available.");
      return;
    }
    setCfBusy(true);
    const end = Date.now();
    const start = end - 60 * 60 * 1000;
    try {
      const raw = await getDeviceCalculatedEvents({
        calculated_field_id: calculatedFieldId,
        event_type: "DEBUG_CALCULATED_FIELD",
        page_size: 20,
        page: 0,
        sort_property: "createdTime",
        sort_order: "DESC",
        start_time: start,
        end_time: end,
        tenant_id: tenantId,
      });
      setCfEventsJson(raw);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to load calculated field events."));
    } finally {
      setCfBusy(false);
    }
  };

  const clearCalculatedFieldEvents = async () => {
    const calculatedFieldId = cfSelectedId.trim();
    const tenantId = evTenant.trim();
    if (!calculatedFieldId || !tenantId) {
      toast.error("Select a field and ensure tenant id is available.");
      return;
    }
    setCfBusy(true);
    const end = Date.now();
    const start = end - 24 * 60 * 60 * 1000;
    try {
      await clearDeviceCalculatedEvents({
        calculated_field_id: calculatedFieldId,
        tenant_id: tenantId,
        start_time: start,
        end_time: end,
        event_type: "DEBUG_CALCULATED_FIELD",
      });
      toast.success("Calculated field events cleared.");
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to clear calculated field events."));
    } finally {
      setCfBusy(false);
    }
  };

  const removeCalculatedField = async (calculatedFieldId: string) => {
    if (!calculatedFieldId) return;
    setCfBusy(true);
    try {
      await deleteCalculatedField(calculatedFieldId);
      if (cfSelectedId === calculatedFieldId) {
        setCfSelectedId("");
        setCfEventsJson(null);
      }
      toast.success("Calculated field deleted.");
      await loadCalculatedFields();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to delete calculated field."));
    } finally {
      setCfBusy(false);
    }
  };

  if (!deviceId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Missing device id.
        <Button variant="link" className="ml-1 h-auto p-0 text-sm" onClick={() => navigate("/iot-gateway/devices")}>
          Back to Devices
        </Button>
      </div>
    );
  }

  const splitPaneStyle = splitPaneHeight
    ? ({ "--device-workspace-height": `${splitPaneHeight}px` } as React.CSSProperties)
    : undefined;

  return (
    <div className="w-full space-y-2 p-0 md:p-0">
      <Card className="overflow-hidden border border-border/70 bg-card p-0 gap-0 text-card-foreground shadow-sm">
        <CardContent className="p-0">
          <div className="border-border/70 bg-gradient-to-br from-primary/10 via-background to-background px-1 py-1 md:px-1">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex items-start gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="mt-0.5 h-6 w-9 shrink-0 rounded-full border-border/70 bg-background/90"
                    onClick={() => navigate("/iot-gateway/devices")}
                    title="Back to devices"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="truncate text-lg font-semibold tracking-tight">{deviceTitle}</CardTitle>
                      {loadingInfo ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                     
                    </div>
                
                  </div>
                </div>
              </div>

            
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} activationMode="manual" className="gap-0 xl:min-h-0">
        <div
          ref={splitPaneRef}
          style={splitPaneStyle}
          className="grid gap-4 xl:min-h-0 xl:grid-cols-[286px_minmax(0,1fr)] xl:[grid-template-rows:minmax(0,1fr)] xl:gap-1 xl:h-[var(--device-workspace-height)]"
        >
          <div className="space-y-1 xl:min-h-0">
            <Card className="border-border/70 shadow-sm p-0 gap-0 xl:flex xl:h-full xl:flex-col">
              <CardHeader className="space-y-0 px-2 py-2 xl:px-2 xl:py-1.5">
                <CardTitle className="text-base font-semibold xl:text-base">Device workspace</CardTitle>
             
              </CardHeader>
              <CardContent className="grid gap-2 px-1.5 pb-1.5 sm:grid-cols-2 xl:min-h-0 xl:flex-1 xl:overflow-hidden xl:grid-cols-1 xl:gap-1">
                {detailSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeTab === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveTab(section.id)}
                      className={cn(
                        "group flex w-full items-start gap-2 rounded-2xl border px-3 py-3 text-left transition-all p-1 xl:gap-2 xl:rounded-xl xl:px-2 xl:py-1.5",
                        isActive
                          ? "border-primary/40 bg-primary/10 shadow-sm ring-1 ring-primary/20"
                          : "border-border/70 bg-background hover:border-primary/20 hover:bg-muted/40",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border xl:h-[2.125rem] xl:w-[2.125rem] xl:rounded-lg",
                          isActive
                            ? "border-primary/30 bg-primary/15 text-primary"
                            : "border-border/70 bg-muted/30 text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 xl:h-4 xl:w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-4 text-foreground xl:text-[13.5px] xl:leading-[1.15rem]">
                              {section.label}
                            </p>
                            <p className="mt-1 text-[11px] leading-[1rem] text-muted-foreground">
                              {section.description}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium xl:px-1.5 xl:py-0.5 xl:text-[10.5px]",
                              isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                            )}
                          >
                            {section.meta}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

          
          </div>

          <div className="min-w-0 xl:min-h-0 xl:overflow-hidden">
            <div className="xl:flex xl:h-full xl:min-h-0 xl:flex-col">
              <DeviceDetailsTab
                assignedCustomer={assignedCustomerLabel}
                name={deviceName(info, "—")}
                profileName={profileLabel}
                label={deviceLabel(info)}
                assignedFirmware={deviceAssignedFirmware(info)}
                assignedSoftware={deviceAssignedSoftware(info)}
                isGateway={deviceGateway(info)}
                description={descriptionText}
                connectionState={connectionStateLabel}
                deviceType={typeLabel}
                transportType={transportTypeLabel}
                publicAccess={visibilityLabel}
                createdAt={createdAtLabel}
                deviceId={deviceId}
                assignActionLabel={assignedCustomerLabel === "Unassigned" ? "Assign" : "Unassign"}
                isEditing={editOpen}
                editSubmitting={editSubmitting}
                editName={editName}
                editProfileId={editProfileId}
                editLabel={editLabel}
                editDescription={editDescription}
                editGateway={editGateway}
                profiles={profiles.map((profile) => ({ id: profile.id, name: profile.name }))}
                onEdit={() => void openEdit()}
                onEditNameChange={setEditName}
                onEditProfileChange={setEditProfileId}
                onEditLabelChange={setEditLabel}
                onEditDescriptionChange={setEditDescription}
                onEditGatewayChange={setEditGateway}
                onCancelEdit={() => setEditOpen(false)}
                onSaveEdit={() => void saveEdit()}
                onAssignOrUnassign={assignedCustomerLabel === "Unassigned" ? openAssignDialog : () => void unassignCustomerFromDevice()}
                onManageCredentials={openCredentialsDialog}
                onConnectivity={openConnectivityDialog}
                onCopyDeviceId={() => void copyDeviceId()}
                onDelete={() => setDeleteOpen(true)}
              />

              <DeviceAttributesTab
                scopeLabel={attributeScopeLabel(attrScope)}
                attrScope={attrScope}
                onScopeChange={(value) => setAttrScope(value)}
                attrLoading={attrLoading}
                attrSearchOpen={attrSearchOpen}
                attrSearch={attrSearch}
                onAttrSearchChange={setAttrSearch}
                onToggleAttrSearch={() => setAttrSearchOpen((open) => !open)}
                rows={pagedAttrRows}
                totalItems={filteredAttrRows.length}
                page={attrPage}
                pageSize={attrPageSize}
                onPageChange={setAttrPage}
                onPageSizeChange={setAttrPageSize}
                onOpenAttributeDialog={openAttributeDialog}
                onRefresh={() => void loadAttributes()}
              />

              <DeviceTelemetryTab
                searchOpen={telemetrySearchOpen}
                search={telemetrySearch}
                onSearchChange={setTelemetrySearch}
                onToggleSearch={() => setTelemetrySearchOpen((open) => !open)}
                rows={pagedTelemetryRows}
                totalItems={filteredTelemetryRows.length}
                page={telemetryPage}
                pageSize={telemetryPageSize}
                onPageChange={setTelemetryPage}
                onPageSizeChange={setTelemetryPageSize}
                emptyState={telemetryEmptyState}
                onOpenDialog={openTelemetryDialog}
                onRemoveKey={(k) => void deleteTelemetryByKey(k)}
              />

              <DeviceCalculatedFieldsTab
                loading={cfLoading}
                rows={calculatedFieldTableRows}
                selectedId={cfSelectedId}
                details={calculatedFieldDetails}
                tenantId={evTenant}
                busy={cfBusy}
                onTenantChange={setEvTenant}
                onRefresh={() => void loadCalculatedFields()}
                onOpenCreate={openCalculatedFieldDialog}
                onView={(id) => void loadCalculatedFieldDetail(id)}
                onDelete={(id) => void removeCalculatedField(id)}
                onReloadDefinition={() => void loadCalculatedFieldDetail(cfSelectedId)}
                onLoadDebugEvents={() => void loadCalculatedFieldEvents()}
                onClearDebugEvents={() => void clearCalculatedFieldEvents()}
              />

              <DeviceAlarmRulesTab
                searchOpen={alarmRuleSearchOpen}
                search={alarmRuleSearch}
                rows={alarmRuleTableRows}
                totalItems={filteredAlarmRuleRows.length}
                page={alarmRulePage}
                pageSize={alarmRulePageSize}
                onSearchChange={setAlarmRuleSearch}
                onToggleSearch={() => setAlarmRuleSearchOpen((open) => !open)}
                onOpenDialog={openAlarmRuleDialog}
                onRefresh={() => {
                  setAlarmRuleSearch("");
                  setAlarmRulePage(0);
                }}
                onPageChange={setAlarmRulePage}
                onPageSizeChange={setAlarmRulePageSize}
              />

              <DeviceAlarmsTab
                loading={alarmsLoading}
                rows={pagedAlarmTableRows}
                totalItems={alarmTableRows.length}
                page={alarmPage}
                pageSize={alarmPageSize}
                onPageChange={setAlarmPage}
                onPageSizeChange={setAlarmPageSize}
                onRefresh={() => void loadAlarms()}
                onOpenDetails={(row) => setSelectedAlarm(row as GenericRow)}
              />

              <DeviceEventsTab
                eventType={evType}
                eventStart={evStartTime}
                eventEnd={evEndTime}
                loading={evLoading}
                rows={pagedEventTableRows}
                totalItems={eventTableRows.length}
                page={eventPage}
                pageSize={eventPageSize}
                onEventTypeChange={(value) => {
                  setEventPage(0);
                  setEvType(value);
                }}
                onPageChange={setEventPage}
                onPageSizeChange={setEventPageSize}
                onTimeRangeChange={(start, end) => {
                  setEventPage(0);
                  setEvStartTime(start);
                  setEvEndTime(end);
                  void loadEvents(start, end);
                }}
                onRefresh={() => void loadEvents()}
              />

              <DeviceAuditLogsTab
                loading={auditLoading}
                rows={auditTableRows}
                totalItems={auditTotalItems}
                page={auditPage}
                pageSize={auditPageSize}
                onRefresh={() => void loadAuditLogs()}
                onPageChange={setAuditPage}
                onPageSizeChange={(pageSize) => {
                  setAuditPage(0);
                  setAuditPageSize(pageSize);
                }}
              />
            </div>
          </div>
        </div>
      </Tabs>

      <DeviceAttributeDialog
        open={attrDialogOpen}
        attrKey={attrKey}
        attrVal={attrVal}
        onOpenChange={setAttrDialogOpen}
        onAttrKeyChange={setAttrKey}
        onAttrValChange={setAttrVal}
        onDelete={() => {
          void deleteAttributeByKey(attrKey);
          setAttrDialogOpen(false);
        }}
        onSave={() => void saveAttributePair()}
      />

      <DeviceTelemetryDialog
        open={telemetryDialogOpen}
        telemetryEntryKey={telemetryEntryKey}
        telemetryEntryType={telemetryEntryType}
        telemetryEntryValue={telemetryEntryValue}
        teleSaving={teleSaving}
        telemetryValuePlaceholder={
          telemetryEntryType === "boolean"
            ? "true / false*"
            : `${stringValue(telemetryEntryType).charAt(0).toUpperCase()}${stringValue(telemetryEntryType).slice(1)} value*`
        }
        onOpenChange={setTelemetryDialogOpen}
        onTelemetryEntryKeyChange={setTelemetryEntryKey}
        onTelemetryEntryTypeChange={setTelemetryEntryType}
        onTelemetryEntryValueChange={setTelemetryEntryValue}
        onAdd={() => void addTelemetryEntry()}
        onClearForm={clearTelemetryDraft}
      />

      <DeviceCalculatedFieldDialog
        open={cfCreateOpen}
        cfName={cfName}
        cfArgumentNames={cfArgumentNames}
        cfExpr={cfExpr}
        cfOutputType={cfOutputType}
        cfOutputKey={cfOutputKey}
        cfDecimals={cfDecimals}
        cfUseLatestTs={cfUseLatestTs}
        cfStrategy={cfStrategy}
        cfBusy={cfBusy}
        hasArguments={effectiveCalculatedFieldArguments.length > 0}
        onOpenChange={setCfCreateOpen}
        onNameChange={setCfName}
        onAddArgument={() => setCfArgumentNames((current) => [...current, ""])}
        onArgumentChange={(index, value) =>
          setCfArgumentNames((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))
        }
        onRemoveArgument={(index) => setCfArgumentNames((current) => current.filter((_, itemIndex) => itemIndex !== index))}
        onExpressionChange={setCfExpr}
        onOutputTypeChange={setCfOutputType}
        onOutputKeyChange={setCfOutputKey}
        onDecimalsChange={setCfDecimals}
        onUseLatestTsChange={setCfUseLatestTs}
        onStrategyChange={setCfStrategy}
        onAdd={() => void createCalculatedField()}
        onClearDraft={clearCalculatedFieldDraft}
      />

      <DeviceAlarmRuleDialog
        open={alarmRuleDialogOpen}
        intervalLabel={alarmRuleIntervalLabel}
        alarmType={alarmRuleType}
        alarmArguments={alarmRuleArguments}
        alarmTriggers={alarmRuleTriggers}
        alarmClears={alarmRuleClears}
        alarmSeverity={alarmRuleSeverity}
        onOpenChange={setAlarmRuleDialogOpen}
        onAlarmTypeChange={setAlarmRuleType}
        onAddArgument={() => setAlarmRuleArguments((current) => [...current, ""])}
        onArgumentChange={(index, value) =>
          setAlarmRuleArguments((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))
        }
        onRemoveArgument={(index) => setAlarmRuleArguments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
        onAddTrigger={() => setAlarmRuleTriggers((current) => [...current, ""])}
        onTriggerChange={(index, value) =>
          setAlarmRuleTriggers((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))
        }
        onRemoveTrigger={(index) => setAlarmRuleTriggers((current) => current.filter((_, itemIndex) => itemIndex !== index))}
        onAddClear={() => setAlarmRuleClears((current) => [...current, ""])}
        onClearChange={(index, value) =>
          setAlarmRuleClears((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))
        }
        onRemoveClear={(index) => setAlarmRuleClears((current) => current.filter((_, itemIndex) => itemIndex !== index))}
        onSeverityChange={setAlarmRuleSeverity}
        onAdd={createAlarmRule}
        onClearDraft={clearAlarmRuleDraft}
      />

      <DeviceAlarmDetailsDialog
        open={selectedAlarm != null}
        originator={selectedAlarm ? alarmOriginator(selectedAlarm) : "—"}
        severity={selectedAlarm ? alarmSeverity(selectedAlarm) : "—"}
        startTime={selectedAlarm ? formatTs(alarmStartTime(selectedAlarm)) : "—"}
        duration={selectedAlarm ? alarmDuration(selectedAlarm) : "—"}
        type={selectedAlarm ? stringValue(selectedAlarm.type ?? selectedAlarm.alarmType) || "—" : "—"}
        status={selectedAlarm ? alarmStatus(selectedAlarm) : "—"}
        assignee={selectedAlarm ? alarmAssignee(selectedAlarm) : "Unassigned"}
        alarmId={
          selectedAlarm
            ? displayValue(entityIdFromTb(selectedAlarm.id), entityIdFromTb(selectedAlarm.alarmId), selectedAlarm.alarmId)
            : "—"
        }
        additionalInfo={selectedAlarm ? alarmAdditionalInfo(selectedAlarm) : null}
        onOpenChange={(open) => !open && setSelectedAlarm(null)}
        showClearAlarm
        onAlarmCleared={() => void loadAlarms()}
      />

      <DeviceCredentialsDialog
        open={credentialsOpen}
        loading={credsLoading}
        credentialsLabel={credentialsTypeLabel(credentialObject)}
        credentialsJson={credsJson}
        onOpenChange={setCredentialsOpen}
        onReload={() => void loadCredentials()}
        onCopy={() => void copyBestCredentials()}
        onJsonChange={setCredsJson}
        onSave={() => void saveCredentials()}
      />

      <DeviceConnectivityDialog
        open={connectivityOpen}
        protocol={connectivityProtocol}
        operatingSystem={connectivityOs}
        command={connectivityText}
        loading={credsLoading}
        onOpenChange={setConnectivityOpen}
        onProtocolChange={setConnectivityProtocol}
        onOperatingSystemChange={setConnectivityOs}
        onReloadCredentials={() => void loadCredentials()}
        onCopyCommand={() => void copyToClipboard(connectivityText, "Connectivity command copied.")}
      />

      <DeviceAssignDialog
        open={assignOpen}
        loading={customersLoading}
        selectedCustomer={pickCustomer}
        customers={customers}
        onOpenChange={setAssignOpen}
        onCustomerChange={setPickCustomer}
        onAssign={() => void assignCustomer()}
      />

      <DeviceDeleteDialog
        open={deleteOpen}
        submitting={deleteSubmitting}
        deviceTitle={deviceTitle}
        onOpenChange={setDeleteOpen}
        onDelete={() => void confirmDelete()}
      />
    </div>
  );
}
