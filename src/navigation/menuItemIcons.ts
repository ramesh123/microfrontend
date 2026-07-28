import type { LucideIcon } from "lucide-react";
import type { IconType } from "react-icons";
import {
  LayoutDashboardIcon,
  Settings,
  Users,
  CircleUser,
  UserRoundPen,
  Palette,
  FileKey,
  GitMerge,
  GitFork,
  DatabaseZap,
  SquareChartGantt,
  ClipboardCheck,
  Layers2Icon,
  Vault,
  Cable,
  ChartPie,
  FolderCog,
  CalendarClock,
  SquareKanban,
  MessageCircleMore,
  Telescope,
  AlignHorizontalJustifyCenter,
  TrendingUp,
  Brain,
  GitBranch,
  FolderGit2,
  ChartNetwork,
  SlidersHorizontal,
  RadioTower,
  BellRing,
  Upload,
  IdCard,
  Presentation,
  Component,
  CircuitBoard,
  MapPin,
  Shapes,
  HatGlassesIcon,
  Video,
  Network,
  FileText,
} from "lucide-react";
import { AiOutlineReconciliation } from "react-icons/ai";
import { BsDatabaseCheck } from "react-icons/bs";
import { FaRegEye } from "react-icons/fa";
import { TbBrandGoogleAnalytics } from "react-icons/tb";
import { PiFileSql } from "react-icons/pi";

function pathLooksLikeIotGateway(path?: string): boolean {
  if (!path || typeof path !== "string") return false;
  const low = path.toLowerCase();
  if (low.includes("iot-gateway")) return true;
  return low === "/rulechain" || low.startsWith("/rulechain/");
}

/** Same `p_id` → icon mapping as the app sidebar (`convertMenuItemToNavItem` in router). */
const iconMap: Record<string, LucideIcon | IconType> = {
  dashboard: LayoutDashboardIcon,
  metadata: LayoutDashboardIcon,
  templates: GitFork,
  projects: GitFork,
  workflows: GitMerge,
  "workflows-list": FolderGit2,
  "draft_workflows": FolderGit2,
  "create-workflow": GitMerge,
  "virtual-db":DatabaseZap,
  "connection-vault": Vault,
  connections: Cable,
  connectors: DatabaseZap,
  datasets: Layers2Icon,
  "master-data": SquareChartGantt,
  jobs: ClipboardCheck,
  validation: FileKey,
  data_validation: BsDatabaseCheck,
  reconciliation: AiOutlineReconciliation,
  "action-centre": SquareKanban,
  operations: SlidersHorizontal,
  analytics: TbBrandGoogleAnalytics,
  "dynamic-forms": FileText,
  "agentic-run": HatGlassesIcon,
  "sql-runner": PiFileSql,
  charts: ChartPie,
  dashboards: Presentation,
  visualization: FaRegEye,
  exploratory_analysis: ChartNetwork,
  ask: MessageCircleMore,
  explore: Telescope,
  semantics: AlignHorizontalJustifyCenter,
  settings: Settings,
  organization: Settings,
  "orchestration-list" :GitBranch,
  profile: CircleUser,
  users: Users,
  roles: UserRoundPen,
  appearance: Palette,
  orchestration: FolderCog,
  perspectives: Settings,
  schedulers: CalendarClock,
  insights: TrendingUp,
  decisions: Brain,
  scenarios: GitBranch,
  analytic_studio: AlignHorizontalJustifyCenter,
  "analytic-studio": AlignHorizontalJustifyCenter,
  analytical_dataset: ChartNetwork,
  "analytical-dataset": ChartNetwork,
  "semantic-jobs": ClipboardCheck,
  rulechain: ChartNetwork,
  rulechains: ChartNetwork,
  devices: CircuitBoard,
  iot_gateway: RadioTower,
  iotgateway: RadioTower,
  widgets: Component,
  widgets_library: Component,
  widget_library: Component,
  widgetslibrary: Component,
  "widgets-library": Component,
  scada_symbols: Shapes,
  scadasymbols: Shapes,
  scada: Shapes,
  locations: MapPin,
  location: MapPin,
  renewable_energy: ChartNetwork,
  "device-hierarchy": Network,
  "video-analytics": Video,
};

/** Icons for IoT Gateway menu rows from normalized route hint (see `iotGatewayIconPathHint` in router). */
function pathBasedIotGatewayIcon(path: string): LucideIcon | IconType | undefined {
  const low = path.toLowerCase().replace(/\/$/, "") || "";
  if (!pathLooksLikeIotGateway(low)) return undefined;
  if (low === "/iot-gateway") return RadioTower;
  if (/(widget|widgets-library|widget-library|widgetbundle)/i.test(low)) return Component;
  if (low.includes("/rulechains") || low === "/rulechain" || low.startsWith("/rulechain/")) return ChartNetwork;
  if (low.includes("/devices")) return CircuitBoard;
  if (low.includes("/alarms")) return BellRing;
  if (low.includes("/device-profiles")) return IdCard;
  if (low.includes("/device-import")) return Upload;
  if (low.includes("/scada-symbols") || low.includes("/scada_symbols")) return Shapes;
  if (low.includes("/locations") || low.endsWith("/location")) return MapPin;
  if (low.includes("/dashboards") || (low.includes("iot-gateway") && low.endsWith("/dashboard"))) {
    return Presentation;
  }
  if (low.includes("/dynamic-forms")) return FileText;
  if (low.includes("/analytics")) return TbBrandGoogleAnalytics;
  if (low.includes("/renewable_energy")) return ChartNetwork;
  return undefined;
}

/**
 * Resolve menu icon by `p_id`, optionally using `path` so the same `p_id` can differ by section
 * (e.g. `dashboard` under IoT Gateway vs main `/dashboard`).
 */
export function getIconForMenuItem(p_id: string, path?: string): LucideIcon | IconType {
  const pid = String(p_id ?? "").trim();
  const pidNorm = pid.toLowerCase().replace(/[-_]/g, "");
  const pathTrim = path?.trim();
  if (pathTrim) {
    const iotIcon = pathBasedIotGatewayIcon(pathTrim);
    if (iotIcon) return iotIcon;
  }
  // IoT Gateway: dashboards vs widgets library use distinct icons (path wins when present).
  if (pathLooksLikeIotGateway(path) && (pidNorm === "dashboard" || pidNorm === "dashboards")) {
    return Presentation;
  }

  if (iconMap[p_id]) {
    return iconMap[p_id];
  }

  const normalized = pidNorm;
  for (const key in iconMap) {
    if (key.toLowerCase().replace(/[-_]/g, "") === normalized) {
      return iconMap[key];
    }
  }

  const lower = p_id.toLowerCase();
  if (lower.includes("action") && lower.includes("center")) {
    return SquareKanban;
  }

  return LayoutDashboardIcon;
}
