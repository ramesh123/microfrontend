/**
 * Default outgoing link labels when the component descriptor did not supply `relationTypes`
 * (e.g. chain loaded from metadata only). Aligns with common ThingsBoard rule nodes.
 */

/**
 * Human-readable outgoing names for entity type switch (ThingsBoard routes by originator entity type).
 * Matches typical ui-ngx / rule-engine labels; custom relation names still work via the link dialog.
 */
const TB_ENTITY_TYPE_SWITCH_RELATIONS: string[] = [
  "Tenant",
  "Tenant Profile",
  "Customer",
  "User",
  "Dashboard",
  "Asset",
  "Device",
  "Device Profile",
  "Asset Profile",
  "Alarm",
  "Rule Chain",
  "Rule Node",
  "Edge",
  "Entity View",
  "Widgets Bundle",
  "Widget Type",
  "API Usage State",
  "RPC",
  "Queue",
  "OTA Package",
  "Notification",
  "Failure",
];

/**
 * Default outgoing link labels when the descriptor has no `relationTypes`.
 * Order: more specific classes before generic `TbSwitchNode` (aligns with ThingsBoard ui-ngx / rule-engine).
 * Script/switch nodes can return custom names from the script; we list common presets plus users can add custom labels in the UI.
 */
const KNOWN: { test: (clazz: string) => boolean; types: string[] }[] = [
  { test: (c) => c.includes("TbEntityTypeSwitchNode"), types: [...TB_ENTITY_TYPE_SWITCH_RELATIONS] },
  /** Device profile switch: TB uses a `default` branch plus per-profile relations; `default` + Failure are always valid. */
  { test: (c) => c.includes("TbDeviceProfileSwitchNode"), types: ["default", "Failure"] },
  { test: (c) => c.includes("TbJsFilterNode") || c.includes("TbTbelFilterNode"), types: ["True", "False"] },
  {
    test: (c) => c.includes("TbDeviceTypeSwitchNode"),
    types: ["True", "False", "Failure"],
  },
  {
    test: (c) => c.includes("TbAssetTypeSwitchNode"),
    types: ["True", "False", "Failure"],
  },
  {
    test: (c) => c.includes("TbOriginatorTypeSwitchNode"),
    types: ["True", "False", "Failure"],
  },
  { test: (c) => c.includes("TbMessageTypeSwitchNode"), types: ["True", "False"] },
  { test: (c) => c.includes("TbCheckMessageNode"), types: ["True", "False"] },
  /** Script switch routes by names returned from the script; TB UI still offers common presets. */
  { test: (c) => c.includes("TbScriptSwitchNode"), types: ["True", "False", "Failure"] },
  { test: (c) => c.includes("TbSwitchNode"), types: ["True", "False", "Failure"] },
  { test: (c) => c.includes("TbCreateAlarmNode"), types: ["Created", "Updated", "Failure"] },
  { test: (c) => c.includes("TbClearAlarmNode"), types: ["Cleared", "Failure"] },
  { test: (c) => c.includes("TbMsgGeneratorNode"), types: ["Success", "Failure"] },
  { test: (c) => c.includes("TbCheckpointNode"), types: ["Success"] },
  { test: (c) => c.includes("TbRuleChainInputNode") || c.includes("TbInputNode"), types: ["Success"] },
];

export function inferDefaultRelationTypes(clazz: string | undefined): string[] | undefined {
  if (!clazz?.trim()) return undefined;
  const c = clazz.trim();
  for (const row of KNOWN) {
    if (row.test(c)) return [...row.types];
  }
  return undefined;
}
