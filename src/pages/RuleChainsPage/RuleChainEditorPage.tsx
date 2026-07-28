import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  Controls,
  useEdgesState,
  useNodesState,
  useOnSelectionChange,
  useReactFlow,
  ConnectionLineType,
  PanOnScrollMode,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
  type CoordinateExtent,
  type Viewport,
  MarkerType,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./rule-chain-flow.css";
import { ArrowLeft, Bug, Loader2, Plus, Save, Search, Trash2, Undo2, X } from "lucide-react";
import isEqual from "lodash/isEqual";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  getRuleChain,
  getRuleChainComponents,
  getRuleChainMetadata,
  saveRuleChainMetadata,
  RULE_CHAIN_DEFAULT_COMPONENT_TYPES,
  type RuleChainSummary,
  type RuleNodeComponentDescriptor,
} from "@/controllers/API/ruleChainsApi";
import {
  inferFirstNodeIndex,
  parseRuleChainMetadataPayload,
  reactFlowToTbMetadata,
  tbMetadataToReactFlow,
  tryParseLegacyEntityConfiguration,
  RULE_CHAIN_INPUT_NODE_ID,
  isRuleChainInputNode,
  withVirtualRuleChainInput,
  type TbRuleChainMetadata,
} from "./ruleChainTbAdapter";
import { ruleChainMaterialIconFallback } from "./ruleChainMaterialIcons";
import { RULE_CHAIN_SEGMENTS_TB } from "./ruleChainTbSegmentTheme";
import { RuleChainCanvasClipboardPanel } from "./components/RuleChainCanvasClipboardPanel";
import {
  copyRuleChainSelectionToSessionClipboard,
  getRuleChainCopySelection,
  pasteRuleChainClipboardIntoCanvas,
} from "./rule-node/ruleChainClipboardActions";
import { readRuleChainClipboardPayload } from "./rule-node/ruleChainSessionClipboard";
import { RuleChainDeletableEdge } from "./components/RuleChainDeletableEdge";
import { RuleChainEdgeActionsContext } from "./components/RuleChainEdgeActionsContext";
import { RuleChainInputNode } from "./components/RuleChainInputNode";
import {
  RuleChainFlowNode,
  RuleChainNodeActionsContext,
  type RuleChainFlowNodeData,
} from "./components/RuleChainFlowNode";
import { RuleNodeUnifiedConfigForm } from "./components/RuleNodeUnifiedConfigForm";
import { RuleNodeEventLogsPanel } from "./components/RuleNodeEventLogsPanel";
import { RuleNodeIcon } from "./components/RuleNodeIcon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { entityIdFromTb } from "@/controllers/API/devicesApi";
import { inferDefaultRelationTypes } from "./rule-node/inferRelationTypes";
import {
  parseRuleChainViewportFromAdditionalInfo,
  readStoredRuleChainViewport,
  writeStoredRuleChainViewport,
} from "./rule-node/ruleChainViewport";
import { IOT_GATEWAY_TITLE, iotGatewayFlow } from "./iotGatewayUiLabels";
import {
  normalizeRuleChainEdgeHandles,
  relationFromHandleId,
  RULE_CHAIN_LEGACY_SOURCE_HANDLE_ID,
  RULE_CHAIN_TARGET_HANDLE_ID,
} from "./ruleChainHandles";
import { RULE_CHAIN_DEFAULT_ZOOM } from "./rule-node/ruleChainViewport";
import {
  fitViewOptionsForRuleChain,
  RULE_CHAIN_MAX_ZOOM,
  RULE_CHAIN_MIN_ZOOM,
  ruleChainEdgeStrokeForTheme,
} from "./rule-node/ruleChainCanvasLogic";
import { RuleChainZoomSlider } from "./components/RuleChainZoomSlider";
import { RuleChainTranslateExtentBridge } from "./components/RuleChainTranslateExtentBridge";
import { ruleChainTranslateExtentFromBounds } from "./rule-node/ruleChainCanvasLogic";
import {
  reconcileRuleChainNodeSpacing,
  snapRuleChainFlowPositionClearOfNodes,
} from "./rule-node/ruleChainNodeSpacing";
import { useRuleChainFlowColorMode } from "./ruleChainNodeTheme";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

const DND_TYPE = "application/reactflow";

/**
 * Dedupe palette HTTP calls when effects run twice (e.g. React StrictMode).
 * Clears only on failure so retries work; successful responses stay cached for the session.
 */
let paletteComponentsPromise: Promise<RuleNodeComponentDescriptor[]> | null = null;

function fetchPaletteComponents(): Promise<RuleNodeComponentDescriptor[]> {
  if (!paletteComponentsPromise) {
    paletteComponentsPromise = getRuleChainComponents({
      component_types: RULE_CHAIN_DEFAULT_COMPONENT_TYPES,
      rule_chain_type: "CORE",
    }).catch((err) => {
      paletteComponentsPromise = null;
      throw err;
    });
  }
  return paletteComponentsPromise;
}

/** One in-flight or settled promise per chain id (StrictMode-safe). */
const chainDetailPromises = new Map<string, Promise<RuleChainSummary>>();

function fetchChainDetail(chainId: string): Promise<RuleChainSummary> {
  const hit = chainDetailPromises.get(chainId);
  if (hit) return hit;
  const p = getRuleChain(chainId).catch((err) => {
    chainDetailPromises.delete(chainId);
    throw err;
  });
  chainDetailPromises.set(chainId, p);
  return p;
}

/** Dedupe metadata POST (React StrictMode / remount). */
const ruleChainMetadataInflight = new Map<string, Promise<Record<string, unknown>>>();

function fetchRuleChainMetadataDeduped(chainId: string): Promise<Record<string, unknown>> {
  const hit = ruleChainMetadataInflight.get(chainId);
  if (hit) return hit;
  const p = (async () => {
    try {
      return await getRuleChainMetadata(chainId);
    } finally {
      ruleChainMetadataInflight.delete(chainId);
    }
  })();
  ruleChainMetadataInflight.set(chainId, p);
  return p;
}

/** Accordion segments — colors / tints match ThingsBoard CE rule chain editor. */
const SEGMENTS = RULE_CHAIN_SEGMENTS_TB;

const SEGMENT_IDS = SEGMENTS.map((s) => s.id) as readonly string[];

function segmentIdForDescriptor(d: RuleNodeComponentDescriptor): (typeof SEGMENTS)[number]["id"] {
  const hay = `${d.type ?? ""} ${d.clazz ?? ""}`.toUpperCase();
  for (const seg of SEGMENTS) {
    if (hay.includes(seg.id)) return seg.id;
  }
  return "FLOW";
}

function groupDescriptorsBySegment(list: RuleNodeComponentDescriptor[]): Map<string, RuleNodeComponentDescriptor[]> {
  const map = new Map<string, RuleNodeComponentDescriptor[]>();
  for (const s of SEGMENTS) map.set(s.id, []);
  for (const d of list) {
    const id = segmentIdForDescriptor(d);
    map.get(id)!.push(d);
  }
  return map;
}

/** Map Java `clazz` → palette `iconUrl` / `icon` from get-components (metadata load has no icons). */
function buildClazzIconMap(groups: Map<string, RuleNodeComponentDescriptor[]>): Map<string, { iconUrl?: string; iconName?: string }> {
  const m = new Map<string, { iconUrl?: string; iconName?: string }>();
  for (const arr of groups.values()) {
    for (const d of arr) {
      const clazz = d.clazz?.trim();
      if (!clazz) continue;
      const nd = d.configurationDescriptor?.nodeDefinition;
      const u = nd?.iconUrl?.trim();
      const ic = typeof nd?.icon === "string" ? nd.icon.trim() : "";
      if (u || ic) m.set(clazz, { ...(u ? { iconUrl: u } : {}), ...(ic ? { iconName: ic } : {}) });
    }
  }
  return m;
}

/** Sidebar / catalog display name by Java `clazz` (for `[…]` subtitle under renamed nodes). */
function buildClazzPaletteNameMap(groups: Map<string, RuleNodeComponentDescriptor[]>): Map<string, string> {
  const m = new Map<string, string>();
  for (const arr of groups.values()) {
    for (const d of arr) {
      const clazz = d.clazz?.trim();
      if (!clazz) continue;
      const nm = (d.name || "").trim();
      if (nm) m.set(clazz, nm);
    }
  }
  return m;
}

/** First palette descriptor per Java `clazz` (for `configDirective`, defaults, relation types). */
function buildClazzDescriptorMap(groups: Map<string, RuleNodeComponentDescriptor[]>): Map<string, RuleNodeComponentDescriptor> {
  const m = new Map<string, RuleNodeComponentDescriptor>();
  for (const arr of groups.values()) {
    for (const d of arr) {
      const clazz = d.clazz?.trim();
      if (clazz && !m.has(clazz)) m.set(clazz, d);
    }
  }
  return m;
}

function mergeMissingDescriptorDefaults(
  configuration: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...configuration };
  for (const [k, v] of Object.entries(defaults)) {
    if (out[k] === undefined) out[k] = v;
  }
  return out;
}

function normLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function enrichNodesWithPaletteMetadata(
  nodes: Node[],
  iconMap: Map<string, { iconUrl?: string; iconName?: string }>,
  nameMap: Map<string, string>,
  descriptorByClazz: Map<string, RuleNodeComponentDescriptor>,
): Node[] {
  return nodes.map((n) => {
    const d = n.data as RuleChainFlowNodeData;
    if (d.isRuleChainInput) {
      if (n.draggable === false && n.selectable === true) return n;
      return { ...n, draggable: false, selectable: true, focusable: false };
    }
    const clazz = d.clazz?.trim();
    if (!clazz) return n;
    const hit = iconMap.get(clazz);
    const paletteName = nameMap.get(clazz);
    const desc = descriptorByClazz.get(clazz);
    const nd = desc?.configurationDescriptor?.nodeDefinition;
    let changed = false;
    const next: RuleChainFlowNodeData = { ...d };
    if (hit?.iconUrl && !d.iconUrl) {
      next.iconUrl = hit.iconUrl;
      changed = true;
    }
    if (hit?.iconName && !d.iconName) {
      next.iconName = hit.iconName;
      changed = true;
    }
    if (paletteName) {
      if (normLabel(paletteName) !== normLabel(d.label || "")) {
        if (next.paletteSubtitle !== paletteName) {
          next.paletteSubtitle = paletteName;
          changed = true;
        }
      } else if (next.paletteSubtitle !== undefined) {
        delete next.paletteSubtitle;
        changed = true;
      }
    }
    const dir = nd?.configDirective?.trim();
    if (dir && !d.configDirective?.trim()) {
      next.configDirective = dir;
      changed = true;
    }
    const rt = nd?.relationTypes?.filter((x): x is string => typeof x === "string" && Boolean(x.trim()));
    const hasRels = d.relationTypes?.some((x) => typeof x === "string" && Boolean(x.trim()));
    if (rt?.length && !hasRels) {
      next.relationTypes = [...rt];
      changed = true;
    }
    return changed ? { ...n, data: next } : n;
  });
}

const nodeTypes = { ruleChainNode: RuleChainFlowNode, ruleChainInput: RuleChainInputNode };

const edgeTypes = { ruleChainDeletable: RuleChainDeletableEdge };

function edgeDataRelationType(e: Edge): string {
  const d = e.data as { relationType?: string } | undefined;
  return d?.relationType?.trim() ?? "";
}

/**
 * Outgoing link labels for the source node — ThingsBoard-style precedence (ui-ngx):
 * 1) Known defaults by Java `clazz` when we recognize the node (authoritative for switch / entity-type / …)
 * 2) Union labels already used on outgoing edges from this node (custom script routes, saved metadata)
 * 3) `relationTypes` from the palette/descriptor when clazz is unknown to inference
 * 4) `Success` / `Failure` as generic fallback
 *
 * Clazz-based inference is preferred over stored `relationTypes` so a mis-tagged or merged list cannot
 * show entity-type presets on a script/switch node (see Add link dialog).
 */
function relationChoicesForSource(sourceNode: Node | undefined, canvasEdges: Edge[]): string[] {
  if (!sourceNode) return ["Success", "Failure"];
  if (sourceNode.id === RULE_CHAIN_INPUT_NODE_ID) return ["Success"];
  const d = sourceNode.data as RuleChainFlowNodeData;

  const fromCanvas = [
    ...new Set(
      canvasEdges
        .filter((e) => e.source === sourceNode.id)
        .map((e) => edgeDataRelationType(e))
        .filter(Boolean),
    ),
  ];

  const inferred = inferDefaultRelationTypes(d.clazz);
  if (inferred?.length) {
    return [...new Set([...inferred, ...fromCanvas])];
  }

  const fromDesc = d.relationTypes?.filter((x): x is string => typeof x === "string" && Boolean(x.trim()));
  if (fromDesc?.length) return [...new Set(fromDesc.map((x) => x.trim()))];

  if (fromCanvas.length) return fromCanvas;

  return ["Success", "Failure"];
}

function makeRuleChainEdgePartial(
  source: string,
  target: string,
  relationType: string,
  idx: number,
  flowEdgeStroke: string,
): Edge {
  const id = `tb-${source}-${target}-${relationType}-${idx}-${crypto.randomUUID().slice(0, 10)}`;
  return {
    id,
    source,
    target,
    sourceHandle: RULE_CHAIN_LEGACY_SOURCE_HANDLE_ID,
    targetHandle: RULE_CHAIN_TARGET_HANDLE_ID,
    type: "ruleChainDeletable",
    data: { relationType },
    markerEnd: { type: MarkerType.ArrowClosed, color: flowEdgeStroke, width: 9, height: 9 },
    style: { stroke: flowEdgeStroke, strokeWidth: 1.5 },
  };
}

/** Replace all edges between the same pair with one edge per relation type (ThingsBoard: one connection row per type). */
function replaceParallelEdgesWithTypes(
  eds: Edge[],
  source: string,
  target: string,
  relationTypes: string[],
  flowEdgeStroke: string,
): { next: Edge[]; primaryId?: string } {
  const others = eds.filter((e) => !(e.source === source && e.target === target));
  const uniq = [...new Set(relationTypes.map((t) => t.trim()).filter(Boolean))];
  const list = uniq.length ? uniq : [];
  if (list.length === 0) return { next: others, primaryId: undefined };
  const built = list.map((rel, i) => makeRuleChainEdgePartial(source, target, rel, i, flowEdgeStroke));
  return { next: [...others, ...built], primaryId: built[0]?.id };
}

/** Add link dialog: keep existing parallel types and add newly chosen ones. */
function mergeParallelEdgesForNewLink(
  eds: Edge[],
  source: string,
  target: string,
  newTypes: string[],
  flowEdgeStroke: string,
): Edge[] {
  const existing = eds
    .filter((e) => e.source === source && e.target === target)
    .map(edgeDataRelationType)
    .filter(Boolean);
  const merged = [...new Set([...existing, ...newTypes.map((t) => t.trim()).filter(Boolean)])];
  return replaceParallelEdgesWithTypes(eds, source, target, merged, flowEdgeStroke).next;
}

function isBooleanRelationPair(labels: string[]): boolean {
  if (labels.length !== 2) return false;
  const lowered = new Set(labels.map((l) => l.trim().toLowerCase()));
  return lowered.has("true") && lowered.has("false");
}

/** ThingsBoard-style: False branch first, then True when both are selected. */
function orderBooleanPairForDisplay(labels: string[]): string[] {
  if (!isBooleanRelationPair(labels)) return labels;
  return [...labels].sort((x, y) => {
    const xf = x.trim().toLowerCase() === "false" ? 0 : 1;
    const yf = y.trim().toLowerCase() === "false" ? 0 : 1;
    return xf - yf;
  });
}

function formatRelationChipText(rel: string): string {
  const t = rel.trim().toLowerCase();
  if (t === "true") return "True";
  if (t === "false") return "False";
  return rel.trim();
}

/** ThingsBoard-style multi “link labels”: chips + preset menu + custom name (script/switch nodes may use arbitrary strings). */
function RuleChainLinkLabelsField({
  id,
  options,
  value,
  onChange,
}: {
  id: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [customDraft, setCustomDraft] = useState("");
  const optsNorm = [...new Set(options.map((o) => o.trim()).filter(Boolean))];
  const uniqValue = [...new Set(value.map((v) => v.trim()).filter(Boolean))];
  const displayOrder = orderBooleanPairForDisplay(uniqValue);
  const booleanPair = isBooleanRelationPair(uniqValue);
  const toAdd = optsNorm.filter((o) => !uniqValue.includes(o));

  const remove = (rel: string) => {
    onChange(uniqValue.filter((x) => x !== rel));
  };

  const add = (rel: string) => {
    const t = rel.trim();
    if (!t || uniqValue.includes(t)) return;
    onChange([...uniqValue, t]);
  };

  const addCustom = () => {
    const t = customDraft.trim();
    if (!t) return;
    add(t);
    setCustomDraft("");
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        Link labels
      </Label>
      <div
        id={id}
        className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-muted/30 px-2 py-1.5"
      >
        {uniqValue.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">None selected — add a preset or a custom name.</span>
        ) : null}
        {booleanPair ? (
          <span className="basis-full text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            False / True (boolean branches)
          </span>
        ) : null}
        {displayOrder.map((rel) => (
          <Badge
            key={rel}
            variant="secondary"
            className={cn(
              "h-6 gap-0.5 pr-0.5 pl-2 text-xs font-normal leading-none",
              booleanPair &&
                rel.trim().toLowerCase() === "false" &&
                "border-rose-200/80 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-100",
              booleanPair &&
                rel.trim().toLowerCase() === "true" &&
                "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-100",
            )}
          >
            <span>{formatRelationChipText(rel)}</span>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted-foreground/15 hover:text-foreground"
              aria-label={`Remove ${rel}`}
              onClick={() => remove(rel)}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {toAdd.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Preset label
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[min(60vh,280px)] min-w-[10rem] overflow-y-auto p-1">
              {toAdd.map((opt) => (
                <DropdownMenuItem key={opt} className="cursor-pointer text-sm" onSelect={() => add(opt)}>
                  {opt}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Input
          value={customDraft}
          onChange={(e) => setCustomDraft(e.target.value)}
          placeholder="Custom relation name (script switch, etc.)"
          className="h-8 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <Button type="button" variant="secondary" size="sm" className="h-8 shrink-0 px-3 text-xs" onClick={addCustom}>
          Add
        </Button>
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Each label is one ThingsBoard connection. Match names your node expects (see{" "}
        <a
          href="https://github.com/thingsboard/thingsboard/tree/master/ui-ngx"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          ui-ngx
        </a>
        ). Script switch routes use names returned from your script.
      </p>
    </div>
  );
}

function RuleFlowSelectionBridge({
  onNodeId,
  onAnyEdgeSelected,
}: {
  onNodeId: (id: string | null) => void;
  onAnyEdgeSelected: (selected: boolean) => void;
}) {
  const onChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge[] }) => {
      onNodeId(selectedNodes[0]?.id ?? null);
      onAnyEdgeSelected(selectedEdges.length > 0);
    },
    [onAnyEdgeSelected, onNodeId],
  );
  useOnSelectionChange({ onChange });
  return null;
}

function paletteItemDescription(item: RuleNodeComponentDescriptor): string {
  const nd = item.configurationDescriptor?.nodeDefinition;
  const text = (nd?.description || nd?.details || "").trim();
  return text;
}

function cloneDefaultConfiguration(item: RuleNodeComponentDescriptor): Record<string, unknown> {
  const raw = item.configurationDescriptor?.nodeDefinition?.defaultConfiguration;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    try {
      return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

type NodeDropPayload = {
  name: string;
  clazz: string;
  type: string;
  segmentId: string;
  categoryCode: string;
  categoryColor: string;
  iconUrl?: string;
  icon?: string;
  description: string;
  defaultConfiguration: Record<string, unknown>;
  /** ThingsBoard `nodeDefinition.configDirective` (ui-ngx config component key). */
  configDirective?: string;
  /** ThingsBoard `nodeDefinition.relationTypes` for outgoing links. */
  relationTypes?: string[];
};

/** Shared fields for ThingsBoard-style add/edit rule node modal (same dialog as ui-ngx drop flow). */
type ConfigureDialogFields = {
  displayName: string;
  clazz: string;
  typeLabel: string;
  ruleNodeDescription: string;
  nodeDisabled: boolean;
  categoryCode: string;
  categoryColor: string;
  iconUrl?: string;
  iconName?: string;
  paletteLabel: string;
  configDirective?: string;
  relationTypes?: string[];
  /** ThingsBoard-style `debugSettings` (failures / all messages / window). */
  debugFailureMessages: boolean;
  debugAllMessages: boolean;
  debugWindowMinutes: number;
};

type ConfigureDialogState =
  | (ConfigureDialogFields & { mode: "add"; flowPosition: { x: number; y: number } })
  | (ConfigureDialogFields & { mode: "edit"; nodeId: string });

type ConfigureEditorSnapshot = {
  dialog: ConfigureDialogState;
  config: Record<string, unknown>;
};

/** API may send booleans as strings; avoid treating `"false"` as truthy. */
function readRuleNodeDebugBool(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v === null || v === undefined) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0" || s === "") return false;
  }
  return Boolean(v);
}

function parseRuleChainDebugUi(debugSettings: unknown): Pick<
  ConfigureDialogFields,
  "debugFailureMessages" | "debugAllMessages" | "debugWindowMinutes"
> {
  const base = { debugFailureMessages: false, debugAllMessages: false, debugWindowMinutes: 15 };
  if (!debugSettings || typeof debugSettings !== "object" || Array.isArray(debugSettings)) return base;
  const r = debugSettings as Record<string, unknown>;
  const now = Date.now();
  const allUntilRaw = r.allEnabledUntil ?? r.debugAllUntil ?? r.allUntil;
  const allUntil =
    typeof allUntilRaw === "number" && Number.isFinite(allUntilRaw)
      ? allUntilRaw
      : typeof allUntilRaw === "string" && Number.isFinite(Number(allUntilRaw))
        ? Number(allUntilRaw)
        : null;
  const remainingMinutes =
    allUntil && allUntil > now ? Math.max(1, Math.ceil((allUntil - now) / (60 * 1000))) : null;
  const minutesRaw = r.allTTLMinutes ?? r.debugWindowMinutes ?? r.ttlMinutes ?? r.durationMinutes ?? remainingMinutes;
  const minutes =
    typeof minutesRaw === "number" && Number.isFinite(minutesRaw) && minutesRaw > 0 ? Math.round(minutesRaw) : 15;
  const failuresOn =
    readRuleNodeDebugBool(r.debugFailures) ||
    readRuleNodeDebugBool(r.failuresEnabled) ||
    readRuleNodeDebugBool(r.failureEnabled);
  const explicitAllOn =
    readRuleNodeDebugBool(r.debugAll) || readRuleNodeDebugBool(r.allEnabled) || readRuleNodeDebugBool(r.debugAllEnabled);
  const allWindowActive = Boolean(allUntil && allUntil > now);
  return {
    debugFailureMessages: failuresOn,
    debugAllMessages: explicitAllOn || allWindowActive,
    debugWindowMinutes: minutes,
  };
}

function buildRuleChainDebugSettings(ui: Pick<
  ConfigureDialogFields,
  "debugFailureMessages" | "debugAllMessages" | "debugWindowMinutes"
>): Record<string, unknown> {
  const safeMinutes =
    Number.isFinite(ui.debugWindowMinutes) && ui.debugWindowMinutes > 0 ? Math.round(ui.debugWindowMinutes) : 15;
  const debugAllUntil = ui.debugAllMessages ? Date.now() + safeMinutes * 60 * 1000 : Date.now();
  return {
    debugFailures: ui.debugFailureMessages,
    failuresEnabled: ui.debugFailureMessages,
    failureEnabled: ui.debugFailureMessages,
    debugAll: ui.debugAllMessages,
    allEnabled: ui.debugAllMessages,
    debugAllEnabled: ui.debugAllMessages,
    allTTLMinutes: safeMinutes,
    debugWindowMinutes: safeMinutes,
    ttlMinutes: safeMinutes,
    durationMinutes: safeMinutes,
    debugAllUntil,
    allEnabledUntil: debugAllUntil,
  };
}

/** e.g. TbDeviceProfileSwitchNode → device profile switch */
function inferNodeKindTitle(clazz: string, paletteLabel: string): string {
  const last = (clazz || "").split(".").pop() || "";
  if (last.length > 2) {
    let t = last.replace(/^Tb/i, "").replace(/Node$/i, "");
    t = t.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
    t = t.replace(/([a-z\d])([A-Z])/g, "$1 $2");
    const words = t
      .trim()
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter(Boolean);
    if (words.length > 0) return words.join(" ");
  }
  const parts = paletteLabel.trim().split(/\s+/).filter(Boolean);
  return parts.map((p) => p.toLowerCase()).join(" ") || "node";
}

function PaletteItem({
  item,
  seg,
}: {
  item: RuleNodeComponentDescriptor;
  seg: (typeof SEGMENTS)[number];
}) {
  const nd = item.configurationDescriptor?.nodeDefinition;
  const iconUrl = nd?.iconUrl;
  const iconName = nd?.icon;
  const desc = paletteItemDescription(item);

  const onDragStart = (e: React.DragEvent) => {
    const payload: NodeDropPayload = {
      name: item.name,
      clazz: item.clazz,
      type: item.type,
      segmentId: seg.id,
      categoryCode: seg.badge,
      categoryColor: seg.color,
      iconUrl: iconUrl || undefined,
      icon: typeof iconName === "string" && iconName.trim() ? iconName.trim() : undefined,
      description: desc,
      defaultConfiguration: cloneDefaultConfiguration(item),
      configDirective: nd?.configDirective?.trim() || undefined,
      relationTypes: nd?.relationTypes?.length ? [...nd.relationTypes] : undefined,
    };
    e.dataTransfer.setData(DND_TYPE, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="rule-chain-palette-card group active:cursor-grabbing"
      title={item.name}
    >
      <div className="rule-chain-palette-card-icon-col">
        <div className="rule-chain-palette-card-icon-area">
          <RuleNodeIcon
            iconUrl={iconUrl}
            iconName={iconName}
            fallbackMaterialIcon={ruleChainMaterialIconFallback(seg.id)}
            className="rule-chain-palette-card-service-icon"
            style={{ color: seg.color }}
            imgClassName="max-h-7 max-w-7 object-contain"
          />
        </div>
        <div className="rule-chain-palette-card-badge" style={{ backgroundColor: seg.iconColBg }}>
          {seg.badge}
        </div>
      </div>
      <div className="rule-chain-palette-card-body">
        <div className="rule-chain-palette-card-title">{item.name}</div>
        {desc ? <p className="rule-chain-palette-card-desc">{desc}</p> : null}
      </div>
    </div>
  );
}

function RuleChainFlowRfApiSync({
  apiRef,
}: {
  apiRef: React.MutableRefObject<{ getNodes: () => Node[]; getEdges: () => Edge[] } | null>;
}) {
  const { getNodes, getEdges } = useReactFlow();
  apiRef.current = { getNodes, getEdges };
  return null;
}

function RuleChainFlowEditor({
  chainId,
  chainTenantId,
  entityViewport,
  saveActionRef,
  undoActionRef,
  onCanvasDirtyChange,
}: {
  chainId?: string;
  /** ThingsBoard tenant UUID when returned on chain detail (optional; event logs can override). */
  chainTenantId?: string;
  /** `undefined` = chain detail not loaded yet; `null` = no TB uiState. */
  entityViewport?: Viewport | null | undefined;
  saveActionRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  undoActionRef?: React.MutableRefObject<(() => void) | null>;
  onCanvasDirtyChange?: (dirty: boolean) => void;
}) {
  const flowColorMode = useRuleChainFlowColorMode();
  /** ThingsBoard-style curved links (right → left between nodes). */
  const flowEdgeStroke = ruleChainEdgeStrokeForTheme(flowColorMode);
  const defaultEdgeOptionsMemo = useMemo(
    () => ({
      type: "ruleChainDeletable" as const,
      markerEnd: { type: MarkerType.ArrowClosed, color: flowEdgeStroke, width: 9, height: 9 },
      style: {
        stroke: flowEdgeStroke,
        strokeWidth: 1,
      },
    }),
    [flowEdgeStroke],
  );
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);
  const [translateExtent, setTranslateExtent] = useState<CoordinateExtent>(() =>
    ruleChainTranslateExtentFromBounds({ x: 0, y: 0, width: 0, height: 0 }),
  );
  const onTranslateExtent = useCallback((extent: CoordinateExtent) => {
    setTranslateExtent(extent);
  }, []);
  /** Copy rail arms box-select; confirm copy via right-click → Copy or ⌘/Ctrl+C. */
  const [copyMarqueeActive, setCopyMarqueeActive] = useState(false);
  /** Move rail: box-select rule nodes, then drag selection to reposition (Input stays fixed). */
  const [moveMarqueeActive, setMoveMarqueeActive] = useState(false);
  const canvasMarqueeActive = copyMarqueeActive || moveMarqueeActive;
  const flowRfApiRef = useRef<{ getNodes: () => Node[]; getEdges: () => Edge[] } | null>(null);
  type RuleChainFlowCtxMenu = {
    clientX: number;
    clientY: number;
    canCopy: boolean;
    canPaste: boolean;
    /** Same selection as Copy (non–Input rule nodes); context menu Delete removes these. */
    canDelete: boolean;
    pasteFlow: { x: number; y: number };
  };
  const [flowContextMenu, setFlowContextMenu] = useState<RuleChainFlowCtxMenu | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  /** Input is fixed on canvas — block drag / position updates; other nodes move freely. */
  const onNodesChangeGuarded = useCallback(
    (changes: NodeChange[]) => {
      const filtered = changes.filter((change) => {
        if (!("id" in change) || change.id !== RULE_CHAIN_INPUT_NODE_ID) return true;
        return change.type !== "position" && change.type !== "replace";
      });
      if (filtered.length > 0) onNodesChange(filtered);
    },
    [onNodesChange],
  );

  const onNodeDragStop = useCallback(() => {
    setNodes((nds) => reconcileRuleChainNodeSpacing(nds, edgesRef.current));
  }, [setNodes]);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  const [configureDialog, setConfigureDialog] = useState<ConfigureDialogState | null>(null);
  const [configureSheetTab, setConfigureSheetTab] = useState<"config" | "events">("config");
  const [debugConfigModalOpen, setDebugConfigModalOpen] = useState(false);
  const [debugModalFailures, setDebugModalFailures] = useState(false);
  const [debugModalAll, setDebugModalAll] = useState(false);
  const [debugModalWindowMinutes, setDebugModalWindowMinutes] = useState(15);
  /** Bumps when the node config sheet opens or snapshot restores — remounts typed widgets (e.g. originator mapping rows). */
  const [configureFormSession, setConfigureFormSession] = useState(0);
  const [configureFormConfiguration, setConfigureFormConfiguration] = useState<Record<string, unknown>>({});
  const [configureNameError, setConfigureNameError] = useState<string | null>(null);
  const [configureSubmitting, setConfigureSubmitting] = useState(false);
  /** Snapshot when the node editor opens — Cancel restores this (undo unsaved edits). */
  const configureEditorSnapshotRef = useRef<ConfigureEditorSnapshot | null>(null);
  /** ThingsBoard-style: pick outgoing relation (Success / Failure / True / …) when drawing a link. */
  const [connectRelation, setConnectRelation] = useState<{
    connection: Connection;
    options: string[];
    selectedLabels: string[];
    sourceLabel: string;
    targetLabel: string;
  } | null>(null);
  const [editEdgeRelation, setEditEdgeRelation] = useState<{
    edgeId: string;
    options: string[];
    selectedLabels: string[];
    sourceLabel: string;
    targetLabel: string;
  } | null>(null);
  const [pendingNodeDrop, setPendingNodeDrop] = useState<{
    flowPosition: { x: number; y: number };
    payload: NodeDropPayload;
  } | null>(null);
  const [dropNodeName, setDropNodeName] = useState("");
  const [dropNameError, setDropNameError] = useState<string | null>(null);
  const [paletteGroups, setPaletteGroups] = useState<Map<string, RuleNodeComponentDescriptor[]>>(() => {
    const m = new Map<string, RuleNodeComponentDescriptor[]>();
    for (const s of SEGMENTS) m.set(s.id, []);
    return m;
  });
  const [paletteLoading, setPaletteLoading] = useState(true);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [openPaletteSections, setOpenPaletteSections] = useState<string[]>([]);
  const clazzIconMap = useMemo(() => buildClazzIconMap(paletteGroups), [paletteGroups]);
  const clazzNameMap = useMemo(() => buildClazzPaletteNameMap(paletteGroups), [paletteGroups]);
  const clazzDescriptorMap = useMemo(() => buildClazzDescriptorMap(paletteGroups), [paletteGroups]);
  const paletteMapsRef = useRef({ icons: clazzIconMap, names: clazzNameMap, descriptors: clazzDescriptorMap });
  paletteMapsRef.current = { icons: clazzIconMap, names: clazzNameMap, descriptors: clazzDescriptorMap };

  const hadConfigureDialogRef = useRef(false);
  useEffect(() => {
    const open = configureDialog != null;
    if (open && !hadConfigureDialogRef.current) setConfigureSheetTab("config");
    hadConfigureDialogRef.current = open;
  }, [configureDialog]);

  const ruleNodeIdForEventLogs = useMemo(() => {
    if (!configureDialog || configureDialog.mode !== "edit") return "";
    const n = nodes.find((x) => x.id === configureDialog.nodeId);
    const d = n?.data as RuleChainFlowNodeData | undefined;
    return (d?.tbEntityId?.trim() || configureDialog.nodeId).trim();
  }, [configureDialog, nodes]);

  const [metadataVersion, setMetadataVersion] = useState<number | undefined>(undefined);
  /** Last saved / loaded canvas snapshot — Undo restores this without hitting the server. */
  const canvasBaselineRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const pendingCanvasBaselineRef = useRef(false);
  const [canvasDirty, setCanvasDirty] = useState(false);
  const canvasDirtyRef = useRef(false);
  canvasDirtyRef.current = canvasDirty;
  const onCanvasDirtyChangeRef = useRef(onCanvasDirtyChange);
  onCanvasDirtyChangeRef.current = onCanvasDirtyChange;
  const lastReportedCanvasDirtyRef = useRef<boolean | null>(null);
  /** Camera applied once per chain after nodes + entity viewport are known. */
  const cameraSettledForChainRef = useRef<string | null>(null);
  const moveEndPersistTimerRef = useRef<number | undefined>(undefined);

  const handleFlowSelectedNodeId = useCallback((_id: string | null) => {}, []);
  const [anyEdgeSelected, setAnyEdgeSelected] = useState(false);

  const defaultViewportMemo = useMemo((): Viewport => {
    if (entityViewport === undefined) return { x: 0, y: 0, zoom: RULE_CHAIN_DEFAULT_ZOOM };
    const cid = chainId?.trim();
    if (cid) {
      const stored = readStoredRuleChainViewport(cid);
      if (stored) return stored;
    }
    if (entityViewport) return entityViewport;
    return { x: 0, y: 0, zoom: RULE_CHAIN_DEFAULT_ZOOM };
  }, [chainId, entityViewport]);

  const onMoveEnd = useCallback(
    (_evt: unknown, vp: Viewport) => {
      const cid = chainId?.trim();
      if (!cid) return;
      if (moveEndPersistTimerRef.current != null) window.clearTimeout(moveEndPersistTimerRef.current);
      moveEndPersistTimerRef.current = window.setTimeout(() => {
        writeStoredRuleChainViewport(cid, vp);
        moveEndPersistTimerRef.current = undefined;
      }, 400);
    },
    [chainId],
  );

  const applyParsedMetadataToCanvas = useCallback((tb: TbRuleChainMetadata) => {
    const { nodes: n, edges: ed } = tbMetadataToReactFlow(tb);
    const { icons, names, descriptors } = paletteMapsRef.current;
    setNodes(enrichNodesWithPaletteMetadata(n, icons, names, descriptors));
    setEdges(normalizeRuleChainEdgeHandles(ed));
    setMetadataVersion(typeof tb.version === "number" ? tb.version : undefined);
    pendingCanvasBaselineRef.current = true;
  }, [setNodes, setEdges]);

  useEffect(() => {
    canvasBaselineRef.current = null;
    pendingCanvasBaselineRef.current = false;
    setCanvasDirty(false);
    lastReportedCanvasDirtyRef.current = null;
    onCanvasDirtyChangeRef.current?.(false);
  }, [chainId]);

  /** Defer baseline snapshot so Input→entry edge sync and theme styling land first. */
  useEffect(() => {
    if (!pendingCanvasBaselineRef.current) return;
    const t = window.setTimeout(() => {
      if (!pendingCanvasBaselineRef.current) return;
      pendingCanvasBaselineRef.current = false;
      canvasBaselineRef.current = {
        nodes: JSON.parse(JSON.stringify(nodesRef.current)) as Node[],
        edges: JSON.parse(JSON.stringify(edgesRef.current)) as Edge[],
      };
      setCanvasDirty(false);
      if (lastReportedCanvasDirtyRef.current !== false) {
        lastReportedCanvasDirtyRef.current = false;
        onCanvasDirtyChangeRef.current?.(false);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [nodes, edges]);

  useEffect(() => {
    if (pendingCanvasBaselineRef.current) return;
    const b = canvasBaselineRef.current;
    if (!b) {
      setCanvasDirty(false);
      if (lastReportedCanvasDirtyRef.current !== false) {
        lastReportedCanvasDirtyRef.current = false;
        onCanvasDirtyChangeRef.current?.(false);
      }
      return;
    }
    const dirty = !isEqual(nodes, b.nodes) || !isEqual(edges, b.edges);
    setCanvasDirty(dirty);
    if (lastReportedCanvasDirtyRef.current !== dirty) {
      lastReportedCanvasDirtyRef.current = dirty;
      onCanvasDirtyChangeRef.current?.(dirty);
    }
  }, [nodes, edges]);

  const undoCanvasLayout = useCallback(() => {
    const b = canvasBaselineRef.current;
    if (!b) return;
    setNodes(JSON.parse(JSON.stringify(b.nodes)) as Node[]);
    setEdges(JSON.parse(JSON.stringify(b.edges)) as Edge[]);
    setCanvasDirty(false);
    if (lastReportedCanvasDirtyRef.current !== false) {
      lastReportedCanvasDirtyRef.current = false;
      onCanvasDirtyChangeRef.current?.(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    cameraSettledForChainRef.current = null;
    setCopyMarqueeActive(false);
    setMoveMarqueeActive(false);
    setFlowContextMenu(null);
  }, [chainId]);

  /** Restore saved pan/zoom (TB `uiState` / session) or fit whole diagram (large chains zoom out like TB). */
  useEffect(() => {
    const cid = chainId?.trim();
    if (entityViewport === undefined || !cid || !rf || nodes.length === 0) return;
    if (cameraSettledForChainRef.current === cid) return;
    const stored = readStoredRuleChainViewport(cid);
    const custom = stored ?? (entityViewport ?? null);
    const fitOpts = fitViewOptionsForRuleChain(nodes);
    const t = window.setTimeout(() => {
      try {
        if (custom && Number.isFinite(custom.x) && Number.isFinite(custom.y) && Number.isFinite(custom.zoom)) {
          rf.setViewport(custom, { duration: 0 });
        } else {
          rf.fitView(fitOpts);
        }
      } catch {
        /* ignore */
      }
      cameraSettledForChainRef.current = cid;
    }, 50);
    return () => window.clearTimeout(t);
  }, [rf, chainId, entityViewport, nodes.length]);

  useEffect(() => {
    if (!chainId?.trim()) return;
    let cancelled = false;
    void (async () => {
      try {
        const raw = await fetchRuleChainMetadataDeduped(chainId.trim());
        if (cancelled) return;
        const tb = parseRuleChainMetadataPayload(raw);
        if (tb) {
          applyParsedMetadataToCanvas(tb);
          return;
        }
        const legacy = tryParseLegacyEntityConfiguration(raw);
        if (legacy) {
          const fi = inferFirstNodeIndex(legacy.nodes, legacy.edges);
          const w = withVirtualRuleChainInput(legacy.nodes, legacy.edges, fi);
          setNodes(
            enrichNodesWithPaletteMetadata(
              w.nodes,
              paletteMapsRef.current.icons,
              paletteMapsRef.current.names,
              paletteMapsRef.current.descriptors,
            ),
          );
          setEdges(normalizeRuleChainEdgeHandles(w.edges));
          setMetadataVersion(undefined);
          pendingCanvasBaselineRef.current = true;
          return;
        }
        const legacyWrapped = tryParseLegacyEntityConfiguration({ configuration: raw });
        if (legacyWrapped) {
          const fi = inferFirstNodeIndex(legacyWrapped.nodes, legacyWrapped.edges);
          const w = withVirtualRuleChainInput(legacyWrapped.nodes, legacyWrapped.edges, fi);
          setNodes(
            enrichNodesWithPaletteMetadata(
              w.nodes,
              paletteMapsRef.current.icons,
              paletteMapsRef.current.names,
              paletteMapsRef.current.descriptors,
            ),
          );
          setEdges(normalizeRuleChainEdgeHandles(w.edges));
          setMetadataVersion(undefined);
          pendingCanvasBaselineRef.current = true;
          return;
        }
        if (!cancelled) {
          const w = withVirtualRuleChainInput([], [], 0);
          setNodes(
            enrichNodesWithPaletteMetadata(
              w.nodes,
              paletteMapsRef.current.icons,
              paletteMapsRef.current.names,
              paletteMapsRef.current.descriptors,
            ),
          );
          setEdges(normalizeRuleChainEdgeHandles(w.edges));
          setMetadataVersion(undefined);
          pendingCanvasBaselineRef.current = true;
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(getDisplayErrorMessage(e, `Could not load ${iotGatewayFlow} metadata.`));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyParsedMetadataToCanvas, chainId, setNodes, setEdges]);

  /** When palette loads or updates, attach catalog icons, subtitles, `configDirective`, and relation presets by `clazz`. */
  useEffect(() => {
    if (clazzIconMap.size === 0 && clazzNameMap.size === 0 && clazzDescriptorMap.size === 0) return;
    setNodes((nds) => enrichNodesWithPaletteMetadata(nds, clazzIconMap, clazzNameMap, clazzDescriptorMap));
    if (!canvasDirtyRef.current) pendingCanvasBaselineRef.current = true;
  }, [clazzIconMap, clazzNameMap, clazzDescriptorMap, setNodes]);

  /**
   * ThingsBoard: chain input delivers to `nodes[firstNodeIndex]` with implicit Success.
   * Keep exactly one edge Input → current entry rule node (same as inferFirstNodeIndex / save metadata).
   */
  useEffect(() => {
    if (!nodes.some((n) => n.id === RULE_CHAIN_INPUT_NODE_ID)) return;
    const ruleOnly = nodes.filter((n) => !isRuleChainInputNode(n));
    if (ruleOnly.length === 0) {
      setEdges((eds) => {
        if (!eds.some((e) => e.source === RULE_CHAIN_INPUT_NODE_ID)) return eds;
        return eds.filter((e) => e.source !== RULE_CHAIN_INPUT_NODE_ID);
      });
      return;
    }
    const fi = inferFirstNodeIndex(nodes, edges);
    const entry = ruleOnly[fi] ?? ruleOnly[0];
    if (!entry?.id) return;

    setEdges((eds) => {
      const fromInput = eds.filter((e) => e.source === RULE_CHAIN_INPUT_NODE_ID);
      const rel = (fromInput[0]?.data as { relationType?: string } | undefined)?.relationType ?? "";
      const ok =
        fromInput.length === 1 && fromInput[0].target === entry.id && (rel === "Success" || rel === "");
      if (ok) return eds;
      return [
        ...eds.filter((e) => e.source !== RULE_CHAIN_INPUT_NODE_ID),
        {
          id: `tb-input-${entry.id}-success`,
          source: RULE_CHAIN_INPUT_NODE_ID,
          target: entry.id,
          sourceHandle: RULE_CHAIN_LEGACY_SOURCE_HANDLE_ID,
          targetHandle: RULE_CHAIN_TARGET_HANDLE_ID,
          type: "ruleChainDeletable" as const,
          data: { relationType: "Success" },
          markerEnd: { type: MarkerType.ArrowClosed, color: flowEdgeStroke, width: 9, height: 9 },
          style: { stroke: flowEdgeStroke, strokeWidth: 1.5 },
        },
      ];
    });
  }, [nodes, edges, setNodes, setEdges, flowEdgeStroke]);

  useEffect(() => {
    let cancelled = false;
    setPaletteLoading(true);
    void (async () => {
      try {
        const list = await fetchPaletteComponents();
        if (!cancelled) setPaletteGroups(groupDescriptorsBySegment(list));
      } catch {
        if (!cancelled) {
          const fallback: RuleNodeComponentDescriptor[] = [
            {
              type: "FILTER",
              clazz: "demo.filter",
              name: "Message type switch",
              configurationDescriptor: {
                nodeDefinition: {
                  description: "Route messages by type or fields.",
                  defaultConfiguration: {
                    scriptLang: "TBEL",
                    tbelScript: `function nextRelation(metadata, msg) {
  return ['one','nine'];
}
if(msgType == 'POST_TELEMETRY_REQUEST') {
  return ['two'];
}
return nextRelation(metadata, msg);`,
                    jsScript: "",
                  },
                },
              },
            },
            {
              type: "ENRICHMENT",
              clazz: "demo.enrich",
              name: "Related attributes",
              configurationDescriptor: { nodeDefinition: { description: "Add device or related entity data." } },
            },
            {
              type: "TRANSFORMATION",
              clazz: "demo.transform",
              name: "Script",
              configurationDescriptor: { nodeDefinition: { description: "Transform payload with a script." } },
            },
            {
              type: "ACTION",
              clazz: "demo.action",
              name: "Create alarm",
              configurationDescriptor: { nodeDefinition: { description: "Raise or clear alarms from the chain." } },
            },
          ];
          setPaletteGroups(groupDescriptorsBySegment(fallback));
        }
      } finally {
        if (!cancelled) setPaletteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      const sd = sourceNode?.data as RuleChainFlowNodeData | undefined;
      const td = targetNode?.data as RuleChainFlowNodeData | undefined;
      const options = relationChoicesForSource(sourceNode, edges);
      const existingRels = edges
        .filter((e) => e.source === params.source && e.target === params.target)
        .map(edgeDataRelationType)
        .filter(Boolean);
      const fromHandle = relationFromHandleId(params.sourceHandle);
      const selectedLabels = fromHandle
        ? [fromHandle]
        : existingRels.length > 0
          ? [...new Set(existingRels)]
          : [];
      setConnectRelation({
        connection: params,
        options,
        selectedLabels,
        sourceLabel: sd?.label ?? params.source,
        targetLabel: td?.label ?? params.target,
      });
    },
    [nodes, edges],
  );

  const confirmConnectRelation = useCallback(() => {
    if (!connectRelation) return;
    const { connection, selectedLabels } = connectRelation;
    const labels = selectedLabels.map((x) => x.trim()).filter(Boolean);
    if (!labels.length) {
      toast.error("Select at least one link label (preset or custom).");
      return;
    }
    const s = connection.source!;
    const t = connection.target!;
    setEdges((eds) => {
      const next = mergeParallelEdgesForNewLink(eds, s, t, labels, flowEdgeStroke);
      setNodes((nds) => reconcileRuleChainNodeSpacing(nds, next));
      return next;
    });
    setConnectRelation(null);
  }, [connectRelation, flowEdgeStroke, setEdges, setNodes]);

  const dismissConnectRelation = useCallback(() => {
    setConnectRelation(null);
  }, []);

  const dismissEditEdgeRelation = useCallback(() => {
    setEditEdgeRelation(null);
  }, []);

  const onEditEdge = useCallback(
    (edgeId: string) => {
      const edge = edges.find((edg) => edg.id === edgeId);
      if (!edge) return;
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      let options = relationChoicesForSource(sourceNode, edges);
      const parallel = edges.filter((e) => e.source === edge.source && e.target === edge.target);
      const selectedLabels = [...new Set(parallel.map(edgeDataRelationType).filter(Boolean))];
      for (const rel of selectedLabels) {
        if (!options.includes(rel)) options = [...options, rel];
      }
      const sd = sourceNode?.data as RuleChainFlowNodeData | undefined;
      const td = targetNode?.data as RuleChainFlowNodeData | undefined;
      setEditEdgeRelation({
        edgeId,
        options,
        selectedLabels,
        sourceLabel: sd?.label ?? edge.source,
        targetLabel: td?.label ?? edge.target,
      });
    },
    [edges, nodes],
  );

  const confirmEditEdge = useCallback(() => {
    if (!editEdgeRelation) return;
    const { edgeId, selectedLabels } = editEdgeRelation;
    const labels = selectedLabels.map((x) => x.trim()).filter(Boolean);
    if (!labels.length) {
      toast.error("Keep at least one link label, or delete the line on the canvas.");
      return;
    }
    setEdges((eds) => {
      const e = eds.find((x) => x.id === edgeId);
      if (!e) return eds;
      const { next } = replaceParallelEdgesWithTypes(eds, e.source, e.target, labels, flowEdgeStroke);
      return next;
    });
    setEditEdgeRelation(null);
  }, [editEdgeRelation, flowEdgeStroke, setEdges]);

  const dismissPendingNodeDrop = useCallback(() => {
    setPendingNodeDrop(null);
    setDropNodeName("");
    setDropNameError(null);
    setConfigureFormConfiguration({});
  }, []);

  const confirmDropNodeName = useCallback(() => {
    const name = dropNodeName.trim();
    if (!name) {
      setDropNameError("Name is required.");
      return;
    }
    const p = pendingNodeDrop;
    if (!p) return;
    setDropNameError(null);
    setConfigureNameError(null);
    const dialog: ConfigureDialogState = {
      mode: "add",
      flowPosition: p.flowPosition,
      displayName: name,
      clazz: p.payload.clazz,
      typeLabel: p.payload.type,
      ruleNodeDescription: "",
      nodeDisabled: false,
      categoryCode: p.payload.categoryCode,
      categoryColor: p.payload.categoryColor,
      iconUrl: p.payload.iconUrl,
      iconName: p.payload.icon,
      paletteLabel: p.payload.name,
      configDirective: p.payload.configDirective,
      relationTypes: p.payload.relationTypes,
      debugFailureMessages: false,
      debugAllMessages: false,
      debugWindowMinutes: 15,
    };
    configureEditorSnapshotRef.current = {
      dialog: JSON.parse(JSON.stringify(dialog)) as ConfigureDialogState,
      config: JSON.parse(JSON.stringify(configureFormConfiguration)) as Record<string, unknown>,
    };
    setConfigureDialog(dialog);
    setConfigureFormSession((s) => s + 1);
    setPendingNodeDrop(null);
    setDropNodeName("");
  }, [dropNodeName, pendingNodeDrop, configureFormConfiguration]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!rf) return;
      const raw = e.dataTransfer.getData(DND_TYPE);
      if (!raw) return;
      let payload: NodeDropPayload;
      try {
        payload = JSON.parse(raw) as NodeDropPayload;
      } catch {
        return;
      }
      const configuration: Record<string, unknown> =
        payload.defaultConfiguration && typeof payload.defaultConfiguration === "object" && !Array.isArray(payload.defaultConfiguration)
          ? (JSON.parse(JSON.stringify(payload.defaultConfiguration)) as Record<string, unknown>)
          : {};
      const rawPosition = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const flowPosition = snapRuleChainFlowPositionClearOfNodes(rawPosition, nodesRef.current);
      setConfigureNameError(null);
      setDropNameError(null);
      setConfigureFormConfiguration(configuration);
      setDropNodeName("");
      setPendingNodeDrop({ flowPosition, payload });
    },
    [rf],
  );

  const dismissConfigureDialog = useCallback(() => {
    configureEditorSnapshotRef.current = null;
    setConfigureDialog(null);
    setConfigureFormConfiguration({});
    setConfigureNameError(null);
    setConfigureSubmitting(false);
    setPendingNodeDrop(null);
    setDropNodeName("");
    setDropNameError(null);
    setDebugConfigModalOpen(false);
  }, []);

  const restoreConfigureEditorSnapshot = useCallback(() => {
    const s = configureEditorSnapshotRef.current;
    if (!s) {
      toast.message("Nothing to undo yet.");
      return;
    }
    setConfigureDialog(JSON.parse(JSON.stringify(s.dialog)) as ConfigureDialogState);
    setConfigureFormConfiguration(JSON.parse(JSON.stringify(s.config)) as Record<string, unknown>);
    setConfigureFormSession((n) => n + 1);
    setConfigureNameError(null);
    setDebugConfigModalOpen(false);
    toast.info("Restored fields from when you opened this panel.", { duration: 2400 });
  }, []);

  const openDebugConfigurationModal = useCallback(() => {
    if (!configureDialog) return;
    setDebugModalFailures(configureDialog.debugFailureMessages);
    setDebugModalAll(configureDialog.debugAllMessages);
    setDebugModalWindowMinutes(configureDialog.debugWindowMinutes);
    setDebugConfigModalOpen(true);
  }, [configureDialog]);

  const applyDebugConfigurationToAllNodes = useCallback(() => {
    const ui: Pick<ConfigureDialogFields, "debugFailureMessages" | "debugAllMessages" | "debugWindowMinutes"> = {
      debugFailureMessages: debugModalFailures,
      debugAllMessages: debugModalAll,
      debugWindowMinutes: debugModalWindowMinutes,
    };
    const debugSettings = buildRuleChainDebugSettings(ui);
    setNodes((nds) =>
      nds.map((n) => {
        const d = n.data as RuleChainFlowNodeData;
        if (d.isRuleChainInput) return n;
        return {
          ...n,
          data: {
            ...d,
            tbPreserve: {
              ...(d.tbPreserve ?? {}),
              debugSettings,
            },
          },
        };
      }),
    );
    setConfigureDialog((prev) => (prev ? { ...prev, ...ui } : null));
    setDebugConfigModalOpen(false);
    toast.success("Debug configuration applied to all rule nodes on this canvas.");
  }, [debugModalFailures, debugModalAll, debugModalWindowMinutes, setNodes]);

  const saveConfigureDialog = useCallback(async () => {
    if (!configureDialog) return;
    const label = configureDialog.displayName.trim();
    if (!label) {
      setConfigureNameError("Name is required.");
      return;
    }
    const cid = chainId?.trim();
    if (!cid) {
      toast.error(`Cannot save node: missing ${iotGatewayFlow} id.`);
      return;
    }
    setConfigureNameError(null);
    const desc = configureDialog.ruleNodeDescription.trim();
    const debugSettings = buildRuleChainDebugSettings({
      debugFailureMessages: configureDialog.debugFailureMessages,
      debugAllMessages: configureDialog.debugAllMessages,
      debugWindowMinutes: configureDialog.debugWindowMinutes,
    });
    setConfigureSubmitting(true);
    try {
      if (configureDialog.mode === "add") {
        const id = crypto.randomUUID();
        const rel =
          configureDialog.relationTypes?.length
            ? [...configureDialog.relationTypes]
            : inferDefaultRelationTypes(configureDialog.clazz);
        const nodeData: RuleChainFlowNodeData = {
          label,
          description: desc || undefined,
          disabled: configureDialog.nodeDisabled,
          categoryCode: configureDialog.categoryCode,
          categoryColor: configureDialog.categoryColor,
          clazz: configureDialog.clazz,
          type: configureDialog.typeLabel,
          configuration: { ...configureFormConfiguration },
          ...(configureDialog.paletteLabel?.trim()
            ? { paletteSubtitle: configureDialog.paletteLabel.trim() }
            : {}),
          ...(configureDialog.configDirective?.trim()
            ? { configDirective: configureDialog.configDirective.trim() }
            : {}),
          ...(rel?.length ? { relationTypes: rel } : {}),
          ...(configureDialog.iconUrl ? { iconUrl: configureDialog.iconUrl } : {}),
          ...(configureDialog.iconName ? { iconName: configureDialog.iconName } : {}),
          tbPreserve: {
            debugSettings,
            singletonMode: false,
            queueName: null,
            configurationVersion: 0,
          },
        };
        const newNode: Node = {
          id,
          type: "ruleChainNode",
          position: snapRuleChainFlowPositionClearOfNodes(configureDialog.flowPosition, nodes),
          data: nodeData,
        };
        const nextNodes = [...nodes, newNode];
        const meta = reactFlowToTbMetadata(nextNodes, edges, cid, {
          version: metadataVersion,
          firstNodeIndex: inferFirstNodeIndex(nextNodes, edges),
        });
        const res = await saveRuleChainMetadata(cid, meta as Record<string, unknown>);
        const parsed = parseRuleChainMetadataPayload(res);
        if (parsed) {
          applyParsedMetadataToCanvas(parsed);
        } else {
          const v = res && typeof res === "object" && "version" in res ? (res as { version?: unknown }).version : undefined;
          if (typeof v === "number") setMetadataVersion(v);
          setNodes((nds) => nds.concat(newNode));
        }
        toast.success(`Node “${label}” added`);
      } else {
        const nodeId = configureDialog.nodeId;
        const prevNode = nodes.find((n) => n.id === nodeId);
        if (!prevNode) {
          toast.error("That node is no longer on the canvas.");
          return;
        }
        const prev = prevNode.data as RuleChainFlowNodeData;
        const updatedNode: Node = {
          ...prevNode,
          data: {
            ...prev,
            label,
            description: desc || undefined,
            disabled: configureDialog.nodeDisabled,
            configuration: { ...configureFormConfiguration },
            paletteSubtitle:
              configureDialog.paletteLabel?.trim() || prev.paletteSubtitle,
            tbPreserve: {
              ...(prev.tbPreserve ?? {}),
              debugSettings,
            },
          },
        };
        const nextNodes = nodes.map((n) => (n.id === nodeId ? updatedNode : n));
        const meta = reactFlowToTbMetadata(nextNodes, edges, cid, {
          version: metadataVersion,
          firstNodeIndex: inferFirstNodeIndex(nextNodes, edges),
        });
        const res = await saveRuleChainMetadata(cid, meta as Record<string, unknown>);
        const parsed = parseRuleChainMetadataPayload(res);
        if (parsed) {
          applyParsedMetadataToCanvas(parsed);
        } else {
          const v = res && typeof res === "object" && "version" in res ? (res as { version?: unknown }).version : undefined;
          if (typeof v === "number") setMetadataVersion(v);
          setNodes((nds) => nds.map((n) => (n.id === nodeId ? updatedNode : n)));
        }
        toast.success(`Node “${label}” updated`);
      }
      configureEditorSnapshotRef.current = null;
      setConfigureDialog(null);
      setConfigureFormConfiguration({});
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Could not save node to the server."));
    } finally {
      setConfigureSubmitting(false);
    }
  }, [applyParsedMetadataToCanvas, chainId, configureDialog, configureFormConfiguration, edges, metadataVersion, nodes, rf, setEdges, setNodes]);

  const onEditNode = useCallback(
    (nodeId: string) => {
      if (nodeId === RULE_CHAIN_INPUT_NODE_ID) {
        toast.message("Input is fixed for this chain.");
        return;
      }
      const n = nodes.find((x) => x.id === nodeId);
      if (!n) return;
      const d = n.data as RuleChainFlowNodeData;
      setConfigureNameError(null);
      const clazzKey = d.clazz?.trim() ?? "";
      const desc = clazzKey ? clazzDescriptorMap.get(clazzKey) : undefined;
      const defaults = desc ? cloneDefaultConfiguration(desc) : {};
      const cfg = mergeMissingDescriptorDefaults({ ...(d.configuration ?? {}) }, defaults);
      const nd = desc?.configurationDescriptor?.nodeDefinition;
      const rtFromDesc =
        nd?.relationTypes?.filter((x): x is string => typeof x === "string" && Boolean(x.trim())) ?? [];
      const hasNodeRels = d.relationTypes?.some((x) => typeof x === "string" && Boolean(x.trim()));
      const dbg = parseRuleChainDebugUi(d.tbPreserve?.debugSettings);
      const dialog: ConfigureDialogState = {
        mode: "edit",
        nodeId,
        displayName: d.label,
        clazz: d.clazz ?? "",
        typeLabel: d.type ?? "",
        ruleNodeDescription: d.description ?? "",
        nodeDisabled: Boolean(d.disabled),
        categoryCode: d.categoryCode,
        categoryColor: d.categoryColor,
        iconUrl: d.iconUrl,
        iconName: d.iconName,
        paletteLabel: d.paletteSubtitle ?? d.type ?? d.label,
        configDirective: d.configDirective?.trim() || nd?.configDirective?.trim() || undefined,
        relationTypes: hasNodeRels
          ? (d.relationTypes ?? []).filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
          : rtFromDesc.length
            ? [...rtFromDesc]
            : undefined,
        ...dbg,
      };
      configureEditorSnapshotRef.current = {
        dialog: JSON.parse(JSON.stringify(dialog)) as ConfigureDialogState,
        config: JSON.parse(JSON.stringify(cfg)) as Record<string, unknown>,
      };
      setConfigureFormConfiguration(cfg);
      setConfigureDialog(dialog);
      setConfigureFormSession((s) => s + 1);
    },
    [nodes, clazzDescriptorMap],
  );

  const onDeleteNode = useCallback(
    (nodeId: string) => {
      if (nodeId === RULE_CHAIN_INPUT_NODE_ID) {
        toast.info("The chain Input node cannot be removed.");
        return;
      }
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setConfigureDialog((cur) => (cur?.mode === "edit" && cur.nodeId === nodeId ? null : cur));
      toast.success("Node deleted");
    },
    [setNodes, setEdges],
  );

  const nodeActionsValue = useMemo(
    () => ({
      onEditNode,
      onDeleteNode,
    }),
    [onEditNode, onDeleteNode],
  );

  const edgeActionsValue = useMemo(() => ({ onEditEdge }), [onEditEdge]);

  const onPaneClick = useCallback(() => {
    setFlowContextMenu(null);
    if (pendingNodeDrop) {
      dismissPendingNodeDrop();
      return;
    }
    if (configureDialog?.mode === "add") return;
    setConfigureDialog(null);
    setConfigureFormConfiguration({});
    setConfigureNameError(null);
  }, [configureDialog?.mode, dismissPendingNodeDrop, pendingNodeDrop]);

  const dismissFlowContextMenu = useCallback(() => setFlowContextMenu(null), []);

  const onFlowContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const api = flowRfApiRef.current;
      if (!api) return;
      const sel = getRuleChainCopySelection(api.getNodes, api.getEdges);
      const canCopy = copyMarqueeActive && Boolean(sel?.nodes.length);
      const canDelete = Boolean(sel?.nodes.length);
      const clip = readRuleChainClipboardPayload();
      const canPaste = Boolean(clip?.nodes.length);

      if (!canCopy && !canPaste && !canDelete) {
        if (copyMarqueeActive) {
          e.preventDefault();
          toast.message("Select one or more nodes to copy (Input cannot be copied).");
        } else if (moveMarqueeActive) {
          e.preventDefault();
          toast.message("Select one or more rule nodes to move (Input stays fixed).");
        }
        dismissFlowContextMenu();
        return;
      }

      e.preventDefault();
      const pasteFlow = rf
        ? rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
        : { x: 0, y: 0 };
      setFlowContextMenu({
        clientX: e.clientX,
        clientY: e.clientY,
        canCopy,
        canPaste,
        canDelete,
        pasteFlow,
      });
    },
    [copyMarqueeActive, moveMarqueeActive, dismissFlowContextMenu, rf],
  );

  const onFlowContextMenuCopyClick = useCallback(() => {
    if (!copyMarqueeActive) {
      toast.message("Click the Copy icon on the canvas to enter copy mode first.");
      dismissFlowContextMenu();
      return;
    }
    const api = flowRfApiRef.current;
    if (!api) {
      dismissFlowContextMenu();
      return;
    }
    const sel = getRuleChainCopySelection(api.getNodes, api.getEdges);
    if (!sel || sel.nodes.length === 0) {
      toast.message("Nothing to copy.");
      dismissFlowContextMenu();
      return;
    }
    if (!copyRuleChainSelectionToSessionClipboard(api.getNodes, api.getEdges)) {
      dismissFlowContextMenu();
      return;
    }
    setCopyMarqueeActive(false);
    dismissFlowContextMenu();
    toast.success(
      `Copied ${sel.nodes.length} node(s). Right-click the canvas → “Paste here”, or use the Paste button / ⌘/Ctrl+V.`,
    );
  }, [copyMarqueeActive, dismissFlowContextMenu, setCopyMarqueeActive]);

  const onFlowContextMenuPasteClick = useCallback(
    (pasteFlow: { x: number; y: number }) => {
      const p = readRuleChainClipboardPayload();
      if (!p?.nodes.length) {
        toast.message("Nothing to paste.");
        dismissFlowContextMenu();
        return;
      }
      const n = pasteRuleChainClipboardIntoCanvas(p, setNodes, setEdges, pasteFlow);
      dismissFlowContextMenu();
      toast.success(`Pasted ${n} node(s) at this location.`);
    },
    [dismissFlowContextMenu, setEdges, setNodes],
  );

  const onFlowContextMenuDeleteClick = useCallback(() => {
    const api = flowRfApiRef.current;
    if (!api) {
      dismissFlowContextMenu();
      return;
    }
    const sel = getRuleChainCopySelection(api.getNodes, api.getEdges);
    if (!sel?.nodes.length) {
      toast.message("Nothing to delete.");
      dismissFlowContextMenu();
      return;
    }
    const ids = new Set(sel.nodes.map((n) => n.id));
    setCopyMarqueeActive(false);
    setMoveMarqueeActive(false);
    setNodes((nds) => nds.filter((n) => !ids.has(n.id)));
    setEdges((eds) => eds.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
    setConfigureDialog((cur) => (cur?.mode === "edit" && cur.nodeId && ids.has(cur.nodeId) ? null : cur));
    dismissFlowContextMenu();
    toast.success(sel.nodes.length === 1 ? "Node deleted" : `Deleted ${sel.nodes.length} nodes`);
  }, [dismissFlowContextMenu, setConfigureDialog, setCopyMarqueeActive, setMoveMarqueeActive, setEdges, setNodes]);

  useEffect(() => {
    if (!flowContextMenu) return;
    const onPointerDown = (ev: PointerEvent) => {
      const el = ev.target as HTMLElement | null;
      if (el?.closest("[data-rule-chain-ctx-menu]")) return;
      dismissFlowContextMenu();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [flowContextMenu, dismissFlowContextMenu]);

  const saveChainLayout = useCallback(async () => {
    if (!chainId?.trim()) {
      toast.error(`Cannot save: missing ${iotGatewayFlow} id.`);
      return;
    }
    const cid = chainId.trim();
    try {
      const meta = reactFlowToTbMetadata(nodes, edges, cid, {
        version: metadataVersion,
        firstNodeIndex: inferFirstNodeIndex(nodes, edges),
      });
      const res = await saveRuleChainMetadata(cid, meta as Record<string, unknown>);
      const parsed = parseRuleChainMetadataPayload(res);
      if (parsed) {
        applyParsedMetadataToCanvas(parsed);
      } else if (typeof (res as { version?: unknown })?.version === "number") {
        setMetadataVersion((res as { version: number }).version);
        pendingCanvasBaselineRef.current = true;
      }
      try {
        if (rf) writeStoredRuleChainViewport(cid, rf.getViewport());
      } catch {
        /* ignore */
      }
      toast.success(`${iotGatewayFlow} saved`);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Save failed"));
    }
  }, [applyParsedMetadataToCanvas, chainId, edges, metadataVersion, nodes, rf]);

  if (saveActionRef) {
    saveActionRef.current = saveChainLayout;
  }
  if (undoActionRef) {
    undoActionRef.current = undoCanvasLayout;
  }

  const filteredGroups = useMemo(() => {
    const q = paletteSearch.trim().toLowerCase();
    const next = new Map<string, RuleNodeComponentDescriptor[]>();
    for (const s of SEGMENTS) {
      const items = paletteGroups.get(s.id) ?? [];
      next.set(
        s.id,
        q
          ? items.filter((i) => {
              const desc = paletteItemDescription(i).toLowerCase();
              return (
                i.name.toLowerCase().includes(q) ||
                i.type.toLowerCase().includes(q) ||
                i.clazz.toLowerCase().includes(q) ||
                desc.includes(q)
              );
            })
          : items,
      );
    }
    return next;
  }, [paletteGroups, paletteSearch]);

  useEffect(() => {
    const q = paletteSearch.trim();
    if (!q) {
      setOpenPaletteSections([]);
      return;
    }
    setOpenPaletteSections(
      SEGMENTS.filter((s) => (filteredGroups.get(s.id)?.length ?? 0) > 0).map((s) => s.id),
    );
  }, [paletteSearch, filteredGroups]);

  return (
    <>
      <Dialog
        open={pendingNodeDrop != null}
        onOpenChange={(open) => {
          if (!open) dismissPendingNodeDrop();
        }}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          {pendingNodeDrop ? (
            <>
              <DialogHeader className="border-b border-border px-4 py-3 text-left">
                <DialogTitle className="text-base">Name this node</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>Enter a display name for this node on the canvas.</p>
                    <p>
                      Template:{" "}
                      <span className="font-medium text-foreground">{pendingNodeDrop.payload.name}</span> — shown in
                      brackets under the name after you continue (same text as the sidebar).
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 px-4 py-4">
                <Label htmlFor="rule-chain-drop-node-name" className="text-xs text-muted-foreground">
                  Node name
                </Label>
                <Input
                  id="rule-chain-drop-node-name"
                  className="h-9"
                  placeholder="Enter node name"
                  value={dropNodeName}
                  onChange={(ev) => {
                    setDropNodeName(ev.target.value);
                    if (dropNameError) setDropNameError(null);
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") {
                      ev.preventDefault();
                      confirmDropNodeName();
                    }
                  }}
                  autoFocus
                />
                {dropNameError ? <p className="text-xs text-destructive">{dropNameError}</p> : null}
              </div>
              <DialogFooter className="border-t border-border bg-muted/30 px-4 py-3 sm:justify-end">
                <Button type="button" variant="outline" size="sm" onClick={dismissPendingNodeDrop}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={confirmDropNodeName}>
                  Continue
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editEdgeRelation != null}
        onOpenChange={(open) => {
          if (!open) dismissEditEdgeRelation();
        }}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          {editEdgeRelation ? (
            <>
              <DialogHeader className="border-b border-border px-4 py-3 text-left">
                <DialogTitle className="text-base">Edit link</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      From{" "}
                      <span className="font-medium text-foreground">{editEdgeRelation.sourceLabel}</span>
                      {" → "}
                      <span className="font-medium text-foreground">{editEdgeRelation.targetLabel}</span>
                    </p>
                    <p>Set all link labels between these nodes (same as ThingsBoard: one connection per label).</p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 px-4 py-4">
                <RuleChainLinkLabelsField
                  id="rule-chain-edit-link-labels"
                  options={editEdgeRelation.options}
                  value={editEdgeRelation.selectedLabels}
                  onChange={(next) => setEditEdgeRelation((s) => (s ? { ...s, selectedLabels: next } : null))}
                />
              </div>
              <DialogFooter className="border-t border-border bg-muted/30 px-4 py-3 sm:justify-end">
                <Button type="button" variant="outline" size="sm" onClick={dismissEditEdgeRelation}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!editEdgeRelation.selectedLabels.some((x) => x.trim())}
                  onClick={confirmEditEdge}
                >
                  Save
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={connectRelation != null}
        onOpenChange={(open) => {
          if (!open) dismissConnectRelation();
        }}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          {connectRelation ? (
            <>
              <DialogHeader className="border-b border-border px-4 py-3 text-left">
                <DialogTitle className="text-base">Add link</DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      From{' '}
                      <span className="font-medium text-foreground">{connectRelation.sourceLabel}</span>
                      {' → '}
                      <span className="font-medium text-foreground">{connectRelation.targetLabel}</span>
                    </p>
                    <p>Choose one or more link labels; each becomes a separate connection (ThingsBoard-style).</p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 px-4 py-4">
                <RuleChainLinkLabelsField
                  id="rule-chain-add-link-labels"
                  options={connectRelation.options}
                  value={connectRelation.selectedLabels}
                  onChange={(next) => setConnectRelation((s) => (s ? { ...s, selectedLabels: next } : null))}
                />
              </div>
              <DialogFooter className="border-t border-border bg-muted/30 px-4 py-3 sm:justify-end">
                <Button type="button" variant="outline" size="sm" onClick={dismissConnectRelation}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!connectRelation.selectedLabels.some((x) => x.trim())}
                  onClick={confirmConnectRelation}
                >
                  Add
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Sheet
        open={configureDialog != null}
        onOpenChange={(open) => {
          if (!open) dismissConfigureDialog();
        }}
      >
        <SheetContent
          side="right"
          className="flex h-full w-full max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[70rem] xl:max-w-[76rem]"
        >
          {configureDialog ? (
            <>
              <SheetHeader
                className="relative shrink-0 space-y-0 border-b border-l-4 border-border bg-muted/20 px-3 py-2 text-left"
                style={{ borderLeftColor: configureDialog.categoryColor }}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="rule-chain-palette-icon-host flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border bg-background"
                    style={{ ["--seg-color" as string]: configureDialog.categoryColor }}
                  >
                    <RuleNodeIcon
                      iconUrl={configureDialog.iconUrl}
                      iconName={configureDialog.iconName}
                      fallbackMaterialIcon={ruleChainMaterialIconFallback(configureDialog.typeLabel)}
                      className="rule-chain-palette-icon !text-[22px] leading-none"
                      style={{ color: "var(--seg-color)" }}
                      imgClassName="max-h-7 max-w-7 object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-base font-semibold leading-snug text-foreground">
                      {configureDialog.displayName.trim() ||
                        `${configureDialog.mode === "add" ? "Add" : "Edit"} ${inferNodeKindTitle(configureDialog.clazz, configureDialog.paletteLabel)}`}
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                      Configure rule node name, description, and settings.
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <Tabs
                value={configureSheetTab}
                onValueChange={(v) => setConfigureSheetTab(v as "config" | "events")}
                className="flex min-h-0 flex-1 flex-col gap-0"
              >
                <div className="shrink-0 border-b border-border bg-background px-2 pt-1.5 pb-0">
                  <TabsList className="h-8 w-full max-w-md justify-start gap-0.5 rounded-md p-0.5 text-[11px]">
                    <TabsTrigger value="config" className="h-7 px-2.5 text-xs">
                      Configuration
                    </TabsTrigger>
                    <TabsTrigger value="events" className="h-7 px-2.5 text-xs">
                      Event logs
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent
                  value="config"
                  className="scrollbar-hide m-0 min-h-0 flex-1 overflow-y-auto bg-background px-2 py-1.5 focus-visible:outline-none data-[state=inactive]:hidden"
                >
                <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="rule-node-configure-name" className="text-xs text-muted-foreground">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="rule-node-configure-name"
                      value={configureDialog.displayName}
                      onChange={(e) => {
                        setConfigureDialog((d) => (d ? { ...d, displayName: e.target.value } : null));
                        setConfigureNameError(null);
                      }}
                      placeholder="Enter name"
                      aria-label="Node name"
                      className={cn(
                        "h-9 min-w-0 flex-1 border-border bg-background text-sm",
                        configureNameError && "border-destructive ring-1 ring-destructive/30",
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-9 shrink-0 gap-1.5 rounded-full border px-3 text-xs font-medium",
                        configureDialog.debugFailureMessages || configureDialog.debugAllMessages
                          ? "border-border bg-secondary text-secondary-foreground"
                          : "border-border/80 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      onClick={openDebugConfigurationModal}
                      title="Open debug configuration"
                    >
                      <Bug className="h-3.5 w-3.5" aria-hidden />
                      {configureDialog.debugFailureMessages || configureDialog.debugAllMessages ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
                  {configureNameError ? <p className="text-xs text-destructive">{configureNameError}</p> : null}
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    Opens debug options; Apply in the dialog updates every rule node on this canvas.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="rule-node-desc" className="text-xs text-muted-foreground">
                    Rule node description
                  </Label>
                  <Textarea
                    id="rule-node-desc"
                    value={configureDialog.ruleNodeDescription}
                    onChange={(e) =>
                      setConfigureDialog((d) => (d ? { ...d, ruleNodeDescription: e.target.value } : null))
                    }
                    placeholder="Optional"
                    rows={3}
                    className="min-h-[72px] resize-y border-border text-sm"
                    spellCheck={false}
                  />
                </div>

                <div className="border-t border-border pt-2">
                  <RuleNodeUnifiedConfigForm
                    clazz={configureDialog.clazz}
                    configDirective={configureDialog.configDirective}
                    configuration={configureFormConfiguration}
                    onChange={setConfigureFormConfiguration}
                    variant="embedded"
                    configFormSession={configureFormSession}
                    onFillDefaults={() => setConfigureFormSession((s) => s + 1)}
                  />
                </div>
                </div>
                </TabsContent>
                <TabsContent
                  value="events"
                  className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-1.5 focus-visible:outline-none data-[state=inactive]:hidden"
                >
                  <RuleNodeEventLogsPanel
                    key={configureDialog.mode === "edit" ? ruleNodeIdForEventLogs || configureDialog.nodeId : "new-node"}
                    ruleChainId={chainId?.trim() ?? ""}
                    ruleNodeId={ruleNodeIdForEventLogs}
                    chainTenantId={chainTenantId}
                    disabledHint={
                      configureDialog.mode === "add"
                        ? "Save the node on the canvas first. Event logs need a persisted rule node id from the server."
                        : null
                    }
                  />
                </TabsContent>
              </Tabs>
              <SheetFooter className="shrink-0 flex-row flex-wrap justify-end gap-2 border-t border-border bg-muted/20 px-2 py-1.5 sm:flex-row">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  disabled={configureSubmitting}
                  onClick={() => dismissConfigureDialog()}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={configureSubmitting}
                  onClick={() => void saveConfigureDialog()}
                >
                  {configureSubmitting
                    ? configureDialog.mode === "add"
                      ? "Adding…"
                      : "Saving…"
                    : configureDialog.mode === "add"
                      ? "Add"
                      : "Save"}
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={debugConfigModalOpen} onOpenChange={setDebugConfigModalOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="space-y-2 border-b border-border px-4 py-3 text-left">
            <DialogTitle className="text-base">Debug configuration</DialogTitle>
            <DialogDescription className="sr-only">
              Configure whether failed messages or all messages are recorded for rule node debug events. Apply updates every node on this chain.
            </DialogDescription>
            <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs leading-snug text-muted-foreground">
              No more than 50000 rule node debug messages per 1 hour will be recorded.
            </div>
          </DialogHeader>
          <div className="grid gap-4 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="dbg-failures" className="cursor-pointer text-sm font-normal leading-snug">
                Failures only (24/7)
              </Label>
              <Switch
                id="dbg-failures"
                checked={debugModalFailures}
                onCheckedChange={(v) => setDebugModalFailures(v === true)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="dbg-all" className="cursor-pointer text-sm font-normal leading-snug">
                All messages (15 min)
              </Label>
              <Switch id="dbg-all" checked={debugModalAll} onCheckedChange={(v) => setDebugModalAll(v === true)} />
            </div>
            {debugModalAll ? (
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="dbg-window" className="text-xs text-muted-foreground">
                  Window (minutes)
                </Label>
                <Input
                  id="dbg-window"
                  type="number"
                  min={1}
                  max={240}
                  className="h-8 w-20 text-sm"
                  value={debugModalWindowMinutes}
                  onChange={(e) => setDebugModalWindowMinutes(Math.max(1, Math.min(240, Number(e.target.value) || 15)))}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter className="flex flex-col gap-3 border-t border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="link"
              className="h-auto justify-start p-0 text-primary"
              onClick={() => {
                setDebugConfigModalOpen(false);
                setConfigureSheetTab("events");
              }}
            >
              See debug events
            </Button>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDebugConfigModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={applyDebugConfigurationToAllNodes}>
                Apply
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-0 overflow-hidden md:flex-row md:rounded-md md:border md:border-border">
      <aside
        className="rule-chain-palette-sidebar flex w-full shrink-0 flex-col md:border-b-0"
        data-color-mode={flowColorMode}
      >
        <div className="rule-chain-palette-search-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={paletteSearch}
              onChange={(e) => setPaletteSearch(e.target.value)}
              className="h-8 rounded-md border-border bg-background pl-8 text-xs shadow-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="scrollbar-hide max-h-40 min-h-0 shrink-0 overflow-y-auto overflow-x-hidden overscroll-contain p-0 md:max-h-none md:flex-1">
          {paletteLoading ? (
            <div className="flex min-h-[8rem] flex-col items-center justify-center gap-2 px-3 py-10 text-center md:min-h-[12rem]">
              <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
              <p className="text-[10px] font-medium text-muted-foreground">Loading node catalog…</p>
            </div>
          ) : (
            <Accordion
              type="multiple"
              value={openPaletteSections}
              onValueChange={setOpenPaletteSections}
              className="rule-chain-palette-accordion w-full"
            >
              {SEGMENTS.map((seg) => {
                const items = filteredGroups.get(seg.id) ?? [];
                return (
                  <AccordionItem
                    key={seg.id}
                    value={seg.id}
                    className="rule-chain-palette-accordion-item border-b border-border"
                  >
                    <AccordionTrigger className="rule-chain-palette-accordion-trigger px-2 py-2 text-left hover:no-underline [&>svg]:ml-2 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0">
                      <span className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold leading-none text-white"
                          style={{ backgroundColor: seg.iconColBg }}
                        >
                          {seg.badge}
                        </span>
                        <span className="truncate text-xs font-semibold text-foreground">{seg.title}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="rule-chain-palette-accordion-content px-1.5 pb-1.5 pt-0.5">
                      {items.length === 0 ? (
                        <p className="py-2 text-center text-[10px] text-muted-foreground">No components</p>
                      ) : (
                        <div className="flex flex-col">{items.map((item) => <PaletteItem key={item.clazz + item.name} item={item} seg={seg} />)}</div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/20">
        <div
          className="rule-chain-flow-surface relative min-h-[320px] min-w-0 flex-1 md:min-h-0"
          data-color-mode={flowColorMode}
          data-edge-selected={anyEdgeSelected ? "true" : undefined}
        >
          <RuleChainEdgeActionsContext.Provider value={edgeActionsValue}>
            <RuleChainNodeActionsContext.Provider value={nodeActionsValue}>
            <ReactFlow
              key={`${chainId ?? "none"}-${entityViewport === undefined ? "boot" : "go"}`}
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChangeGuarded}
              onNodeDragStop={onNodeDragStop}
              nodesDraggable
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setRf}
              onMoveEnd={onMoveEnd}
              onPaneContextMenu={onFlowContextMenu}
              onNodeContextMenu={onFlowContextMenu}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              colorMode={flowColorMode}
              defaultViewport={defaultViewportMemo}
              minZoom={RULE_CHAIN_MIN_ZOOM}
              maxZoom={RULE_CHAIN_MAX_ZOOM}
              translateExtent={translateExtent}
              onlyRenderVisibleElements
              snapToGrid
              snapGrid={[15, 15]}
              defaultEdgeOptions={defaultEdgeOptionsMemo}
              connectionRadius={22}
              connectionLineType={ConnectionLineType.Bezier}
              connectionLineStyle={{
                stroke: flowEdgeStroke,
                strokeWidth: 1.5,
              }}
              elementsSelectable
              edgesReconnectable={false}
              multiSelectionKeyCode={["Meta", "Control", "Shift"]}
              deleteKeyCode="Delete"
              selectNodesOnDrag={false}
              selectionOnDrag={canvasMarqueeActive}
              selectionMode={SelectionMode.Partial}
              panOnDrag={canvasMarqueeActive ? [1, 2] : true}
              panOnScroll
              panOnScrollMode={PanOnScrollMode.Free}
              panOnScrollSpeed={0.85}
              zoomOnScroll={false}
              zoomOnPinch
              preventScrolling={false}
              nodesConnectable={!canvasMarqueeActive}
              elevateNodesOnSelect
              elevateEdgesOnSelect={false}
              nodeOrigin={[0, 0.5]}
              className={cn("theme-attribution h-full min-h-[320px] md:min-h-0")}
              proOptions={{ hideAttribution: true }}
            >
              <RuleChainFlowRfApiSync apiRef={flowRfApiRef} />
              <RuleChainTranslateExtentBridge onExtent={onTranslateExtent} />
              <Background
                key={flowColorMode}
                id="rule-chain-dots"
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color={flowColorMode === "dark" ? "rgba(148, 163, 184, 0.22)" : "rgba(120, 144, 156, 0.35)"}
              />
              <RuleFlowSelectionBridge onNodeId={handleFlowSelectedNodeId} onAnyEdgeSelected={setAnyEdgeSelected} />
              <RuleChainCanvasClipboardPanel
                copyMarqueeActive={copyMarqueeActive}
                setCopyMarqueeActive={setCopyMarqueeActive}
                moveMarqueeActive={moveMarqueeActive}
                setMoveMarqueeActive={setMoveMarqueeActive}
                onConfirmCopy={onFlowContextMenuCopyClick}
              />
              <Controls className="!m-1 !scale-90" />
              <RuleChainZoomSlider
                position="bottom-right"
                className="!m-2 !scale-95"
                sliderClassName="min-w-[280px] w-[min(48vw,420px)]"
              />
            </ReactFlow>
            {flowContextMenu ? (
              <div
                data-rule-chain-ctx-menu
                className="fixed z-[200] min-w-[9rem] overflow-hidden rounded-md border border-border bg-popover py-0.5 text-popover-foreground shadow-md"
                style={{
                  left: flowContextMenu.clientX + 2,
                  top: flowContextMenu.clientY + 2,
                }}
              >
                {flowContextMenu.canCopy ? (
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted"
                    onClick={() => onFlowContextMenuCopyClick()}
                  >
                    Copy
                  </button>
                ) : null}
                {flowContextMenu.canPaste ? (
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-muted"
                    onClick={() => onFlowContextMenuPasteClick(flowContextMenu.pasteFlow)}
                  >
                    Paste here
                  </button>
                ) : null}
                {flowContextMenu.canDelete ? (
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-medium text-destructive hover:bg-destructive/10"
                    onClick={() => onFlowContextMenuDeleteClick()}
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Delete
                  </button>
                ) : null}
              </div>
            ) : null}
            </RuleChainNodeActionsContext.Provider>
          </RuleChainEdgeActionsContext.Provider>
        </div>
      </div>
    </div>
    </>
  );
}

export default function RuleChainEditorPage() {
  const { chainId } = useParams<{ chainId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState(IOT_GATEWAY_TITLE);
  const [chainTenantId, setChainTenantId] = useState("");
  const saveChainRef = useRef<(() => Promise<void>) | null>(null);
  const undoCanvasRef = useRef<(() => void) | null>(null);
  const [canvasDirty, setCanvasDirty] = useState(false);
  const [entityViewport, setEntityViewport] = useState<Viewport | null | undefined>(undefined);

  useEffect(() => {
    if (!chainId) {
      setEntityViewport(undefined);
      setChainTenantId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const chain = await fetchChainDetail(chainId);
        if (cancelled) return;
        setTitle(chain.name || chainId);
        const ch = chain as Record<string, unknown>;
        setChainTenantId(entityIdFromTb(ch.tenantId ?? ch.tenant_id));
        const ai = chain.additionalInfo ?? chain.additional_info;
        setEntityViewport(parseRuleChainViewportFromAdditionalInfo(ai) ?? null);
      } catch {
        if (!cancelled) {
          setTitle(chainId);
          setEntityViewport(null);
          setChainTenantId("");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chainId]);

  return (
    <div className="flex h-[calc(100dvh-3.25rem)] min-h-0 w-full flex-col gap-1 p-1 md:h-[calc(100dvh-3rem)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border pb-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-xs"
            onClick={() => navigate("/iot-gateway/rulechains")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <h1 className="truncate text-sm font-semibold text-foreground md:text-base">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="hidden max-w-[20rem] truncate text-[10px] text-muted-foreground lg:block">
            Drag palette onto the canvas. Copy: use the Copy icon to box-select nodes, then right-click → Copy (or ⌘/Ctrl+C). Move: use the Move icon to box-select nodes, then drag any selected node to reposition the group. Paste from the rail or ⌘/Ctrl+V. Pan and zoom restore when available.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2.5 text-xs"
            disabled={!canvasDirty}
            title="Revert the canvas to the last saved or loaded state (does not undo the node side panel)"
            onClick={() => undoCanvasRef.current?.()}
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2.5 text-xs"
            disabled={!chainId?.trim()}
            onClick={() => void saveChainRef.current?.()}
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <RuleChainFlowEditor
          chainId={chainId}
          chainTenantId={chainTenantId || undefined}
          entityViewport={entityViewport}
          saveActionRef={saveChainRef}
          undoActionRef={undoCanvasRef}
          onCanvasDirtyChange={setCanvasDirty}
        />
      </div>
    </div>
  );
}
