/**
 * Typed rule-node configuration layouts aligned with ThingsBoard rule engine
 * node Java classes (configuration JSON) and shared enums from ui-ngx
 * `rule-node-config.models.ts`. See `./rule-node/tbUiNgxAnchor.ts` for the full ui-ngx map.
 */

import { tbFetchModeSelectOptions, tbFetchToSelectOptions, tbHttpMethodSelectOptions } from "./rule-node/tbSharedEnums";

export type TbFieldKind =
  | "text"
  | "password"
  | "number"
  | "bool"
  | "textarea"
  | "json"
  | "select"
  /** string[] edited as one value per line */
  | "lines"
  /** string[] as ThingsBoard-style chips + “Add attribute key” (Get attributes node). */
  | "attributeNameList"
  /** TbGetOriginatorFieldsNode `dataMapping` — source field + target key rows (ThingsBoard UI). */
  | "originatorDataMapping"
  /** Long rule-engine script fields */
  | "script";

export type TbSelectOption = { value: string; label: string };

export type TbFieldDef = {
  key: string;
  label: string;
  kind: TbFieldKind;
  description?: string;
  placeholder?: string;
  rows?: number;
  options?: TbSelectOption[];
  /** Default when key missing */
  defaultValue?: unknown;
};

export type TbNodeFormSchema = {
  /** Short title shown above fields (ThingsBoard-style panel heading). */
  title: string;
  match: (clazz: string) => boolean;
  fields: TbFieldDef[];
};

const fetchToOptions: TbSelectOption[] = tbFetchToSelectOptions.map((o) => ({
  value: o.value,
  label: o.label,
}));

const messagePropsRabbit: TbSelectOption[] = [
  { value: "NON_PERSISTENT_BASIC", label: "Non-persistent basic" },
  { value: "PERSISTENT_BASIC", label: "Persistent basic" },
  { value: "PERSISTENT_TEXT_PLAIN", label: "Persistent text/plain" },
];

const dedupeStrategy: TbSelectOption[] = tbFetchModeSelectOptions.map((o) => ({
  value: o.value,
  label: o.label,
}));

const alarmScriptLang: TbSelectOption[] = [
  { value: "JS", label: "JavaScript" },
  { value: "TBEL", label: "TBEL" },
];

const severityOptions: TbSelectOption[] = [
  { value: "CRITICAL", label: "Critical" },
  { value: "MAJOR", label: "Major" },
  { value: "MINOR", label: "Minor" },
  { value: "WARNING", label: "Warning" },
  { value: "INDETERMINATE", label: "Indeterminate" },
];

function endsWithNode(clazz: string, simple: string): boolean {
  return clazz === simple || clazz.endsWith(`.${simple}`);
}

/** Keys to hide from the generic “additional properties” editor (TB noise or handled elsewhere). */
export function stripKeysFromRuleNodeRemainder(clazz: string | undefined): Set<string> {
  const out = new Set<string>(["configurationVersion", "version"]);
  const c = clazz?.trim();
  if (!c) return out;
  /** Legacy TB keys not used by this node; keep out of “additional properties” (typed form owns scriptLang now). */
  if (endsWithNode(c, "TbJsFilterNode")) {
    out.add("tbelScript");
  }
  /** Dual TBEL/JS script UIs — typed panel owns these keys (one configuration surface). */
  if (
    endsWithNode(c, "TbScriptSwitchNode") ||
    endsWithNode(c, "TbTbelFilterNode") ||
    endsWithNode(c, "TbTransformMsgNode")
  ) {
    out.add("scriptLang");
    out.add("tbelScript");
    out.add("jsScript");
  }
  if (endsWithNode(c, "TbCreateAlarmNode") || endsWithNode(c, "TbClearAlarmNode")) {
    out.add("scriptLang");
    out.add("alarmDetailsBuildJs");
    out.add("alarmDetailsBuildTbel");
  }
  /** Legacy TB key — migrated into `dataMapping` in the typed editor. */
  if (endsWithNode(c, "TbGetOriginatorFieldsNode")) {
    out.add("fieldsMapping");
  }
  return out;
}

/** Ordered list: first matching schema wins. */
export const TB_RULE_NODE_FORM_SCHEMAS: TbNodeFormSchema[] = [
  {
    title: "RabbitMQ (external)",
    match: (c) => endsWithNode(c, "TbRabbitMqNode"),
    fields: [
      { key: "exchangeNamePattern", label: "Exchange name pattern", kind: "text", placeholder: "${...}" },
      { key: "routingKeyPattern", label: "Routing key pattern", kind: "text" },
      { key: "messageProperties", label: "Message properties", kind: "select", options: messagePropsRabbit },
      { key: "host", label: "Host", kind: "text" },
      { key: "port", label: "Port", kind: "number" },
      { key: "virtualHost", label: "Virtual host", kind: "text" },
      { key: "username", label: "Username", kind: "text" },
      { key: "password", label: "Password", kind: "password" },
      { key: "automaticRecoveryEnabled", label: "Automatic recovery", kind: "bool", defaultValue: true },
      { key: "connectionTimeout", label: "Connection timeout (ms)", kind: "number" },
      { key: "handshakeTimeout", label: "Handshake timeout (ms)", kind: "number" },
      { key: "clientProperties", label: "Client properties", kind: "json", description: "JSON object passed to the client." },
    ],
  },
  {
    title: "Get originator fields",
    match: (c) => endsWithNode(c, "TbGetOriginatorFieldsNode"),
    fields: [
      {
        key: "dataMapping",
        label: "Originator fields mapping",
        kind: "originatorDataMapping",
        description:
          "Map each originator JSON path to a target key (ThingsBoard). Replaces raw JSON editing.",
      },
      {
        key: "ignoreNullStrings",
        label: "Skip empty fields",
        kind: "bool",
        defaultValue: false,
        description: "If enabled, null or empty originator values are not written to the message.",
      },
      { key: "fetchTo", label: "Add mapped originator fields to", kind: "select", options: fetchToOptions },
    ],
  },
  {
    title: "Get attributes",
    match: (c) => endsWithNode(c, "TbGetAttributesNode"),
    fields: [
      { key: "tellFailureIfAbsent", label: "Tell failure if absent", kind: "bool", defaultValue: false },
      {
        key: "clientAttributeNames",
        label: "Client attributes",
        kind: "attributeNameList",
        description:
          "Keys from CLIENT_SCOPE. Add many keys (chips). Keys may use ${messageKey} or ${metadataKey} templating (ThingsBoard).",
      },
      {
        key: "sharedAttributeNames",
        label: "Shared attributes",
        kind: "attributeNameList",
        description: "Keys from SHARED_SCOPE — add multiple keys as chips.",
      },
      {
        key: "serverAttributeNames",
        label: "Server attributes",
        kind: "attributeNameList",
        description: "Keys from SERVER_SCOPE — add multiple keys as chips.",
      },
      {
        key: "latestTsKeyNames",
        label: "Latest telemetry",
        kind: "attributeNameList",
        description: "Timeseries key names — add multiple keys as chips.",
      },
      { key: "getLatestValueWithTs", label: "Include timestamp", kind: "bool", defaultValue: false },
      { key: "fetchTo", label: "Add originator attributes to", kind: "select", options: fetchToOptions },
    ],
  },
  {
    title: "JS filter",
    match: (c) => endsWithNode(c, "TbJsFilterNode"),
    fields: [
      {
        key: "scriptLang",
        label: "Language",
        kind: "select",
        options: [{ value: "JS", label: "JavaScript" }],
        defaultValue: "JS",
      },
      {
        key: "jsScript",
        label: "Filter function (JavaScript)",
        kind: "script",
        rows: 14,
        description: "Return true to use the True relation, false for False.",
      },
    ],
  },
  {
    title: "Script switch",
    match: (c) => endsWithNode(c, "TbScriptSwitchNode"),
    fields: [
      { key: "scriptLang", label: "Language", kind: "select", options: alarmScriptLang },
      { key: "tbelScript", label: "TBEL script", kind: "script", rows: 14 },
      { key: "jsScript", label: "JavaScript", kind: "script", rows: 14 },
    ],
  },
  {
    title: "TBEL filter",
    match: (c) => endsWithNode(c, "TbTbelFilterNode"),
    fields: [
      { key: "scriptLang", label: "Language", kind: "select", options: alarmScriptLang },
      { key: "tbelScript", label: "TBEL script", kind: "script", rows: 14 },
      { key: "jsScript", label: "JavaScript (legacy)", kind: "script", rows: 8 },
    ],
  },
  {
    title: "Transform message (script)",
    match: (c) => endsWithNode(c, "TbTransformMsgNode"),
    fields: [
      { key: "scriptLang", label: "Language", kind: "select", options: alarmScriptLang },
      { key: "tbelScript", label: "TBEL script", kind: "script", rows: 14 },
      { key: "jsScript", label: "JavaScript (legacy)", kind: "script", rows: 8 },
    ],
  },
  {
    title: "Save telemetry",
    match: (c) => endsWithNode(c, "TbMsgTimeseriesNode"),
    fields: [
      { key: "defaultTTL", label: "Default TTL (days, 0 = unlimited)", kind: "number", defaultValue: 0 },
      { key: "useServerTs", label: "Use server timestamp", kind: "bool", defaultValue: false },
      {
        key: "processingSettings",
        label: "Processing settings",
        kind: "json",
        rows: 6,
        description: 'Example: { "type": "ON_EVERY_MESSAGE" }',
      },
    ],
  },
  {
    title: "Message deduplication",
    match: (c) => endsWithNode(c, "TbMsgDeduplicationNode"),
    fields: [
      { key: "interval", label: "Interval (seconds)", kind: "number" },
      { key: "strategy", label: "Strategy", kind: "select", options: dedupeStrategy },
      { key: "maxPendingMsgs", label: "Max pending messages", kind: "number" },
      { key: "maxRetries", label: "Max retries", kind: "number" },
    ],
  },
  {
    title: "Create alarm",
    match: (c) => endsWithNode(c, "TbCreateAlarmNode"),
    fields: [
      { key: "scriptLang", label: "Details script language", kind: "select", options: alarmScriptLang },
      { key: "alarmDetailsBuildJs", label: "Alarm details (JavaScript)", kind: "script", rows: 16 },
      { key: "alarmDetailsBuildTbel", label: "Alarm details (TBEL)", kind: "script", rows: 10 },
      { key: "useMessageAlarmData", label: "Use message alarm data", kind: "bool", defaultValue: false },
      { key: "alarmType", label: "Alarm type", kind: "text" },
      { key: "severity", label: "Severity", kind: "select", options: severityOptions },
      { key: "propagate", label: "Propagate to related", kind: "bool", defaultValue: false },
      { key: "propagateToOwner", label: "Propagate to owner", kind: "bool" },
      { key: "propagateToTenant", label: "Propagate to tenant", kind: "bool" },
    ],
  },
  {
    title: "Clear alarm",
    match: (c) => endsWithNode(c, "TbClearAlarmNode"),
    fields: [
      { key: "scriptLang", label: "Details script language", kind: "select", options: alarmScriptLang },
      { key: "alarmDetailsBuildJs", label: "Alarm details (JavaScript)", kind: "script", rows: 14 },
      { key: "alarmDetailsBuildTbel", label: "Alarm details (TBEL)", kind: "script", rows: 10 },
      { key: "alarmType", label: "Alarm type", kind: "text" },
    ],
  },
  {
    title: "REST API call",
    match: (c) => endsWithNode(c, "TbRestApiCallNode"),
    fields: [
      { key: "restEndpointUrlPattern", label: "REST URL pattern", kind: "textarea", rows: 2 },
      {
        key: "requestMethod",
        label: "HTTP method",
        kind: "select",
        options: tbHttpMethodSelectOptions.map((o) => ({ value: o.value, label: o.label })),
      },
      { key: "useSimpleClientHttpFactory", label: "Use simple client HTTP factory", kind: "bool" },
      { key: "enableProxy", label: "Enable proxy", kind: "bool" },
      { key: "useRedisQueueForHttpRequest", label: "Use Redis queue", kind: "bool" },
      { key: "readTimeoutMs", label: "Read timeout (ms)", kind: "number" },
      { key: "maxParallelRequestsCount", label: "Max parallel requests", kind: "number" },
      { key: "headers", label: "Headers", kind: "json" },
      { key: "credentials", label: "Credentials", kind: "json" },
    ],
  },
  {
    title: "Kafka",
    match: (c) => endsWithNode(c, "TbKafkaNode"),
    fields: [
      { key: "topicPattern", label: "Topic pattern", kind: "text" },
      { key: "keyPattern", label: "Key pattern", kind: "text" },
      { key: "bootstrapServers", label: "Bootstrap servers", kind: "text" },
      { key: "retries", label: "Retries", kind: "number" },
      { key: "batchSize", label: "Batch size", kind: "number" },
      { key: "bufferMemory", label: "Buffer memory", kind: "number" },
      { key: "acks", label: "ACKs", kind: "text", placeholder: "all | 1 | 0" },
      { key: "otherProperties", label: "Other properties", kind: "json" },
    ],
  },
  {
    title: "MQTT",
    match: (c) => endsWithNode(c, "TbMqttNode"),
    fields: [
      { key: "topicPattern", label: "Topic pattern", kind: "text" },
      { key: "host", label: "Host", kind: "text" },
      { key: "port", label: "Port", kind: "number" },
      { key: "connectTimeoutSec", label: "Connect timeout (s)", kind: "number" },
      { key: "clientId", label: "Client ID", kind: "text" },
      { key: "cleanSession", label: "Clean session", kind: "bool", defaultValue: true },
      { key: "ssl", label: "SSL", kind: "bool", defaultValue: false },
      { key: "username", label: "Username", kind: "text" },
      { key: "password", label: "Password", kind: "password" },
    ],
  },
];

export function getTbNodeFormSchema(clazz: string | undefined): TbNodeFormSchema | null {
  if (!clazz?.trim()) return null;
  const c = clazz.trim();
  for (const schema of TB_RULE_NODE_FORM_SCHEMAS) {
    if (schema.match(c)) return schema;
  }
  return null;
}

export function schemaFieldKeys(schema: TbNodeFormSchema): Set<string> {
  return new Set(schema.fields.map((f) => f.key));
}
