/**
 * Segment accents for the rule chain canvas + palette.
 * Colors aligned with Datafusion reference (Filters blue, Enrichment purple, etc.).
 */
export const RULE_CHAIN_SEGMENTS_TB = [
  {
    id: "FILTER",
    title: "Filters",
    badge: "F",
    color: "#1e88e5",
    rowBg: "#e3f2fd",
    iconColBg: "#1e88e5",
    iconColBgDark: "#1565c0",
    labelColBgLight: "#ffffff",
    labelColBgDark: "#0d2137",
  },
  {
    id: "ENRICHMENT",
    title: "Enrichment",
    badge: "E",
    color: "#9c27b0",
    rowBg: "#f3e5f5",
    iconColBg: "#9c27b0",
    iconColBgDark: "#6a1b9a",
    labelColBgLight: "#ffffff",
    labelColBgDark: "#1a0a24",
  },
  {
    id: "TRANSFORMATION",
    title: "Transformations",
    badge: "T",
    color: "#009688",
    rowBg: "#e0f2f1",
    iconColBg: "#009688",
    iconColBgDark: "#00695c",
    labelColBgLight: "#ffffff",
    labelColBgDark: "#042f2a",
  },
  {
    id: "ACTION",
    title: "Actions",
    badge: "A",
    color: "#4caf50",
    rowBg: "#e8f5e9",
    iconColBg: "#4caf50",
    iconColBgDark: "#2e7d32",
    labelColBgLight: "#ffffff",
    labelColBgDark: "#0d2610",
  },
  {
    id: "EXTERNAL",
    title: "External",
    badge: "X",
    color: "#ff5722",
    rowBg: "#fbe9e7",
    iconColBg: "#ff5722",
    iconColBgDark: "#d84315",
    labelColBgLight: "#ffffff",
    labelColBgDark: "#2a1208",
  },
  {
    id: "FLOW",
    title: "Flow",
    badge: "L",
    color: "#00bcd4",
    rowBg: "#e0f7fa",
    iconColBg: "#00bcd4",
    iconColBgDark: "#00838f",
    labelColBgLight: "#ffffff",
    labelColBgDark: "#042f35",
  },
] as const;

export type RuleChainSegmentTb = (typeof RULE_CHAIN_SEGMENTS_TB)[number];

function segmentById(id: RuleChainSegmentTb["id"]): RuleChainSegmentTb {
  const hit = RULE_CHAIN_SEGMENTS_TB.find((s) => s.id === id);
  return hit ?? RULE_CHAIN_SEGMENTS_TB[RULE_CHAIN_SEGMENTS_TB.length - 1]!;
}

/**
 * ThingsBoard maps palette sections to Java packages under `org.thingsboard.rule.engine.*`.
 * Many nodes (e.g. save telemetry in `telemetry`) never contain the word "ACTION", so substring
 * checks on segment ids alone would wrongly fall through to Flow (cyan).
 */
function segmentFromEnginePackage(hay: string): RuleChainSegmentTb | null {
  if (!hay.includes("ORG.THINGSBOARD.RULE.ENGINE")) return null;

  const ordered: [needle: string, id: RuleChainSegmentTb["id"]][] = [
    [".RULE.ENGINE.FILTER.", "FILTER"],
    [".RULE.ENGINE.TRANSFORM.", "TRANSFORMATION"],
    [".RULE.ENGINE.ENRICHMENT.", "ENRICHMENT"],
    [".RULE.ENGINE.METADATA.", "ENRICHMENT"],
    [".RULE.ENGINE.ATTRIBUTES.", "ENRICHMENT"],
    [".RULE.ENGINE.ACTION.", "ACTION"],
    [".RULE.ENGINE.TELEMETRY.", "ACTION"],
    [".RULE.ENGINE.AUDIT.", "ACTION"],
    [".RULE.ENGINE.REST.", "ACTION"],
    [".RULE.ENGINE.DEDUPLICATION.", "TRANSFORMATION"],
    [".RULE.ENGINE.EXTERNAL.", "EXTERNAL"],
    [".RULE.ENGINE.INTEGRATION.", "EXTERNAL"],
    [".RULE.ENGINE.MQTT.", "EXTERNAL"],
    [".RULE.ENGINE.KAFKA.", "EXTERNAL"],
    [".RULE.ENGINE.RABBITMQ.", "EXTERNAL"],
    [".RULE.ENGINE.GCP.", "EXTERNAL"],
    [".RULE.ENGINE.AWS.", "EXTERNAL"],
    [".RULE.ENGINE.AZURE.", "EXTERNAL"],
    [".RULE.ENGINE.FLOW.", "FLOW"],
    [".RULE.ENGINE.INTERNAL.", "FLOW"],
  ];

  for (const [needle, id] of ordered) {
    if (hay.includes(needle)) return segmentById(id);
  }
  return null;
}

/** Map Java `clazz` → badge / accent color / type label for canvas + saves. */
export function segmentStyleFromClazz(clazz: string): { categoryCode: string; categoryColor: string; typeLabel: string } {
  const hay = clazz.toUpperCase();
  const fromPkg = segmentFromEnginePackage(hay);
  if (fromPkg) {
    return { categoryCode: fromPkg.badge, categoryColor: fromPkg.color, typeLabel: fromPkg.id };
  }
  for (const s of RULE_CHAIN_SEGMENTS_TB) {
    if (hay.includes(s.id)) return { categoryCode: s.badge, categoryColor: s.color, typeLabel: s.id };
  }
  const flow = RULE_CHAIN_SEGMENTS_TB[RULE_CHAIN_SEGMENTS_TB.length - 1]!;
  return { categoryCode: flow.badge, categoryColor: flow.color, typeLabel: flow.id };
}
