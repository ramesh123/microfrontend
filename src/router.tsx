import React, { lazy, JSX, useMemo, Suspense } from "react"
import { useAuth } from "@/context/auth/authContext";
import { useRbacStore } from "@/stores/useRBACStore";
import { useDynamicFormAssignmentStore } from "@/pages/dynamic-forms/stores/useDynamicFormAssignmentStore";
import LoginPage from "@/pages/LoginPage";
import { Navigate, useRoutes, Outlet, useParams, useLocation } from "react-router";
import type { NavGroup, NavItem, NavLink, NavCollapsible, BaseNavItem } from "./types/sidebar";

const navItemsIncludePath = (items: NavItem[], path: string): boolean => {
  for (const it of items) {
    if ('path' in it && it.path === path) {
      return true;
    }
    if ('children' in it && it.children?.length) {
      if (navItemsIncludePath(it.children as NavItem[], path)) {
        return true;
      }
    }
  }
  return false;
};
import type { IconType } from "react-icons";
import Layout from "./components/layout";
import {
  LayoutDashboardIcon,
  Settings,
  Users,
  CircleUser,
  UserRoundPen,
  Palette,
  FileKey,
  LucideIcon,
  GitMerge,
  GitFork,
  DatabaseZap,
  SquareChartGantt,
  ClipboardCheck,
  Layers,
  FolderGit2,
  SquareKanban,
  Cable,
  ChartPie,
  FolderCog,
  CalendarClock,
  Vault,
  Layers2, 
  Layers2Icon,
  AlignHorizontalJustifyCenter,
  ChartNetwork,
  MessageCircleMore,
  Telescope,
  Brain,
  GitBranch,
  TrendingUp
} from "lucide-react";
import { AiOutlineReconciliation } from "react-icons/ai";
import { BsDatabaseCheck } from "react-icons/bs";
import { SiGoogleanalytics } from "react-icons/si";
import { FaRegEye } from "react-icons/fa";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import { TbBrandGoogleAnalytics, TbSettingsAutomation } from "react-icons/tb";

// Use lazyWithRetry for all lazy imports to handle chunk load errors after deployments
const FlowPage = lazy(() => lazyWithRetry(() => import("./pages/FlowPage"), 'FlowPage'))
const MasterDataUploadPage = lazy(() => lazyWithRetry(() => import("./pages/MasterDataPage"), 'MasterDataPage'))
const CredentialsVault = lazy(() => lazyWithRetry(() => import("./pages/CredVaultPage"), 'CredVaultPage'))
const CredCreate = lazy(() => lazyWithRetry(() => import("./pages/CredVaultPage/CredCreate"), 'CredCreate'))
const UsersComponent = lazy(() => lazyWithRetry(() => import("./pages/UsersPage"), 'UsersPage').
  then((module) => ({ default: module.UsersComponent })));
const RolesComponent = lazy(() => lazyWithRetry(() => import("./pages/RolesPage"), 'RolesPage').
  then((module) => ({ default: module.RolesComponent })));
const CredConnectors = lazy(() => lazyWithRetry(() => import("./pages/CredVaultPage/CredConnectors"), 'CredConnectors'))
// Original JobsComponent - Commented out for Prefect Dashboard integration
const JobsComponent = lazy(() => lazyWithRetry(() => import("./pages/JobsPage"), 'JobsPage').
  then((module) => ({ default: module.JobsComponent })));

// Prefect Dashboard integration
const PrefectDashboard = lazy(() => lazyWithRetry(() => import("./pages/JobsPage/PrefectDashboard"), 'PrefectDashboard'));
const CreateWorkflow = lazy(() => lazyWithRetry(() => import("./pages/HomePage/components/createWorkflow"), 'CreateWorkflow').
  then((module) => ({ default: module.CreateWorkflow })));
const CreateProjectPage = lazy(() => lazyWithRetry(() => import("./pages/HomePage/components/CreateProject"), 'CreateProjectPage'))
const Dashboard = lazy(() => lazyWithRetry(() => import("./pages/HomePage/components/dashboard"), 'Dashboard'))
const ProjectsAndWorkflowsPage = lazy(() => lazyWithRetry(() => import("./pages/HomePage/components/ProjectsAndWorkflowsPage"), 'ProjectsAndWorkflowsPage'))
const WorkflowData = lazy(() => lazyWithRetry(() => import("./pages/HomePage/components/WorkflowData"), 'WorkflowData'))
const DraftWorkflowsData = lazy(() => lazyWithRetry(() => import("./pages/HomePage/components/DraftWorkflowsData"), 'DraftWorkflowsData'))
const DatasetList = lazy(() => lazyWithRetry(() => import("./pages/DataSetPage/DatasetList"), 'DatasetList'))
const CreateDatasetStepper = lazy(() => lazyWithRetry(() => import("./pages/DataSetPage/CreateDatasetStepper"), 'CreateDatasetStepper'))
const OrganizationTabs = lazy(() => lazyWithRetry(() => import("./pages/OrganizationTabsPage"), 'OrganizationTabsPage').
  then((module) => ({ default: module.OrganizationTabs })));
const OrganizationSelection = lazy(() => lazyWithRetry(() => import("./pages/OrganizationSelection"), 'OrganizationSelection'))
const OrchestrationSetupManager = lazy(() => lazyWithRetry(() => import("./pages/AdminConsole/OrchestrationSetup/components/OrchestrationSetupManager"), 'OrchestrationSetupManager').
  then((module) => ({ default: module.OrchestrationSetupManager })));
const PerspectiveCreatorPage = lazy(() => lazyWithRetry(() => import("./pages/AdminConsole/PerspectiveBuilder/components/PerspectiveCreatorPage"), 'PerspectiveCreatorPage').
  then((module) => ({ default: module.PerspectiveCreatorPage })));
const PerspectiveList = lazy(() => lazyWithRetry(() => import("./pages/AdminConsole/PerspectiveBuilder/components/PerspectiveList"), 'PerspectiveList').
  then((module) => ({ default: module.PerspectiveList })));
import type { MenuItem } from "@/types/rbac";
import { getIconForMenuItem } from "@/navigation/menuItemIcons";
import WorkflowExecution from "./pages/HomePage/components/WorkflowExecution";
import HistoryPage from "./pages/HomePage/components/WorkflowExecution/historydata/history";
import { TaskDetailViewPage } from "./pages/HomePage/components/WorkflowExecution/historydata/details/taskdetailsviewpage";
import WorkflowDetails from "./pages/HomePage/components/WorkflowExecution/Reconcilationtab/Recontab";
import Validationtab from "./pages/HomePage/components/WorkflowExecution/Datavalidationtab/Validationtab";
import Actions from "./pages/HomePage/components/WorkflowExecution/action-center/actions";
import DataReconciliationView from "./pages/HomePage/components/WorkflowExecution/action-center/DataReconciliationView";
import Nodeoperationoutput from "./pages/HomePage/components/WorkflowExecution/Reconcilationtab/Nodeoperationoutput";
import { ChartFormulator } from "./pages/charts/ChartFormulator";
import DashboardsListPage from "./pages/Dashboards/DashboardListPage";
import ChartsListPage from "./pages/charts/ChartsListPage";
import Prefectrun from "./pages/JobsPage/TaskDetailView/prefect/Prefectrun";
import SemanticsStepper from "./pages/ExploratoryAnalysis/Semantics"
import LandingPage from "./pages/LandingPage/LandingPage";
import ComingSoonPage from "./pages/ComingSoonPage";
import Scenarios from "./pages/ExploratoryAnalysis/Scenarios";
// Original Insights component - commented out for AgenticSemantics integration
import Insights from "./pages/ExploratoryAnalysis/Insights";
import AgenticSemantics from "./pages/ExploratoryAnalysis/AgenticSemantics";
import Decisions from "./pages/ExploratoryAnalysis/Decisions";
import Ask from "./pages/ExploratoryAnalysis/Ask";
import Explore from "./pages/ExploratoryAnalysis/Explore";
import SqlRunner from "./pages/ExploratoryAnalysis/SqlRunner";
import DatasetsTabs from "./pages/Dashboards/VirtualDB/datasets";
import AgenticChatHistory from "./pages/ExploratoryAnalysis/AgenticSemantics/AgenticChatHistory";
import WorkflowDB from "./pages/Dashboards/VirtualDB/workflowdb";
const SemanticJobs = lazy(() => lazyWithRetry(() => import("./pages/ExploratoryAnalysis/Jobs"), 'SemanticJobs'));
const CreateDashboard = lazy(() => lazyWithRetry(() => import("./pages/Dashboards/CreateDashboard"), 'CreateDashboard').
  then((module) => ({ default: module.CreateDashboard })));
const RoleForm = lazy(() => lazyWithRetry(() => import("./pages/RolesPage/RolesForm"), 'RoleForm').
  then((module) => ({ default: module.RoleForm })));
const SchedulerPage = lazy(() => lazyWithRetry(() => import("./pages/SchedulerPage"), 'SchedulerPage'));
const SchedulersListPage = lazy(() => lazyWithRetry(() => import("./pages/SchedulersListPage"), 'SchedulersListPage'));
const RuleChainsListPage = lazy(() => lazyWithRetry(() => import("./pages/RuleChainsPage/RuleChainsListPage"), 'RuleChainsListPage'));
const RuleChainEditorPage = lazy(() => lazyWithRetry(() => import("./pages/RuleChainsPage/RuleChainEditorPage"), 'RuleChainEditorPage'));
const DevicesListPage = lazy(() => lazyWithRetry(() => import("./pages/IoTGatewayDevices/DevicesListPage"), 'DevicesListPage'));
const DeviceImportPage = lazy(() => lazyWithRetry(() => import("./pages/IoTGatewayDevices/DeviceImportPage"), 'DeviceImportPage'));
const AlarmsListPage = lazy(() => lazyWithRetry(() => import("./pages/IoTGatewayDevices/AlarmsListPage"), 'AlarmsListPage'));
const DeviceProfilesPage = lazy(() => lazyWithRetry(() => import("./pages/IoTGatewayDevices/DeviceProfilesPage"), 'DeviceProfilesPage'));
const DeviceProfileWorkspacePage = lazy(() =>
  lazyWithRetry(() => import("./pages/IoTGatewayDevices/DeviceProfileWorkspacePage"), 'DeviceProfileWorkspacePage'),
);
const DeviceDetailPage = lazy(() => lazyWithRetry(() => import("./pages/IoTGatewayDevices/DeviceDetailPage"), 'DeviceDetailPage'));
const DeviceTypeDevicesPage = lazy(() =>
  lazyWithRetry(() => import("./pages/IoTGatewayDevices/DeviceTypeDevicesPage"), 'DeviceTypeDevicesPage'),
);
const WidgetsLibraryPage = lazy(() =>
  lazyWithRetry(() => import("./pages/WidgetsLibraryPage"), 'WidgetsLibraryPage')
);
const ThingsboardDashboardsListPage = lazy(() =>
  lazyWithRetry(() => import("./pages/Thingsboard dashboards/listofdashboards"), 'ThingsboardDashboardsListPage')
);
const ThingsboardDashboardEditorPage = lazy(() =>
  lazyWithRetry(
    () => import("./pages/Thingsboard dashboards/ThingsboardDashboardEditorPage"),
    "ThingsboardDashboardEditorPage",
  )
);
const ScadaSymbolsPage = lazy(() =>
  lazyWithRetry(() => import("./pages/IoTGatewayDevices/ScadaSymbolsPage"), "ScadaSymbolsPage"),
);
const LocationsListPage = lazy(() =>
  lazyWithRetry(() => import("./pages/IoTGatewayDevices/location/LocationsListPage"), "LocationsListPage"),
);
const DynamicFormsPage = lazy(() =>
  lazyWithRetry(() => import("./pages/dynamic-forms"), 'DynamicFormsPage')
);
const SimulationTrackPage = lazy(() =>
  lazyWithRetry(() => import("./pages/stimulation"), 'SimulationTrackPage')
);
const AnalyticsStudioPage = lazy(() =>
  lazyWithRetry(() => import("./pages/analyticsstudio"), 'AnalyticsStudioPage')
);
const AnalyticsStudioSourcePage = lazy(() =>
  lazyWithRetry(() => import("./pages/analyticsstudio/SourceSelection"), 'AnalyticsStudioSourcePage')
);
const AnalyticsStudioCreateChartPage = lazy(() =>
  lazyWithRetry(() => import("./pages/analyticsstudio/CreateChart"), 'AnalyticsStudioCreateChartPage')
);
const AnalyticsStudioCreateChartEntryPage = lazy(() =>
  lazyWithRetry(() => import("./pages/analyticsstudio/CreateChartEntry"), 'AnalyticsStudioCreateChartEntryPage')
);
const AnalyticsStudioEditChartPage = lazy(() =>
  lazyWithRetry(() => import("@/pages/analyticsstudio/EditChart"), 'AnalyticsStudioEditChartPage')
);
const AnalyticsStudioViewDashboardPage = lazy(() =>
  lazyWithRetry(() => import("./pages/analyticsstudio/ViewDashboard"), 'AnalyticsStudioViewDashboardPage')
);
const RenewableEnergyPage = lazy(() =>
  lazyWithRetry(() => import("./pages/RenewableEnergyPage"), 'RenewableEnergyPage')
);

type MenuPathMatch = { title: string; menuPath: string };

const findMenuItemForPath = (
  items: MenuItem[],
  pathname: string,
  ancestorHint?: string,
): MenuPathMatch | undefined => {
  for (const item of items) {
    const hint = iotGatewayIconPathHint(item, ancestorHint);
    const childAncestor = nextIotGatewayAncestorHint(item, ancestorHint);
    const normalizedPath = item.path ? normalizeIotGatewayMenuPath(item.path, hint) ?? item.path : undefined;

    if (normalizedPath && !item.navOnly) {
      const pattern = normalizedPath.replace(/:[^/]+/g, "[^/]+");
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(pathname) || normalizedPath === pathname) {
        return { title: item.title, menuPath: normalizedPath };
      }
    }

    if (item.children?.length) {
      const childMatch = findMenuItemForPath(item.children, pathname, childAncestor);
      if (childMatch) return childMatch;
    }
  }
  return undefined;
};

// Layout wrapper component that provides the common layout
const LayoutWrapper = () => <Layout />;

export interface RouteConfig {  
  path?: string;
  element?: React.ReactNode;
  title?: string;
  icon?: LucideIcon | IconType;
  isPrivate?: boolean;
  hide?: boolean;
  children?: RouteConfig[];
  index?: boolean;
  permissions?: string[];
  navOnly?: boolean;
}

/** IoT Gateway: rule chains under `/iot-gateway/rulechains`, devices under `/iot-gateway/devices`, dashboards under `/iot-gateway/dashboards`. */
function normalizeIotGatewayMenuPath(path: string | undefined, ancestorHint?: string): string | undefined {
  if (path == null || path === "") return path;
  let p = path.replace(/\/$/, "") || "/";
  p = p.replace(/rulechanins/g, "rulechains");
  const hint = ancestorHint?.toLowerCase() ?? "";
  const isInIotGatewaySubtree =
    hint.includes("iot-gateway") || hint === "/rulechain" || hint.startsWith("/rulechain/");
  if (isInIotGatewaySubtree && (p === "/dashboard" || p === "/dashboards")) {
    return "/iot-gateway/dashboards";
  }
  if (p === "/rulechain") return "/iot-gateway/rulechains";
  if (p === "/renewable_energy") return "/iot-gateway/device_hierarchy";
  const m = p.match(/^\/rulechain\/([^/]+)\/editor$/);
  if (m) return `/iot-gateway/rulechains/${m[1]}/editor`;
  if (p === "/iot-gateway") return "/iot-gateway/rulechains";
  if (p === "/iot-gateway/dashboard" || p === "/iot-gateway/dashboards") return "/iot-gateway/dashboards";
  const legacyEditor = p.match(/^\/iot-gateway\/([^/]+)\/editor$/);
  if (legacyEditor && legacyEditor[1] !== "rulechains" && legacyEditor[1] !== "devices") {
    return `/iot-gateway/rulechains/${legacyEditor[1]}/editor`;
  }
  return p;
}

function firstPathInIotGatewaySubtree(...candidates: (string | undefined)[]): string | undefined {
  for (const c of candidates) {
    if (!c) continue;
    const low = c.toLowerCase();
    if (low.includes("iot-gateway") || low === "/rulechain" || low.startsWith("/rulechain/")) return c;
  }
  return undefined;
}

function isIotGatewayMenuRootItem(item: MenuItem): boolean {
  const p = (item.p_id || "").toLowerCase().replace(/[-_]/g, "");
  return p === "iotgateway";
}

/** Best path string to classify a menu row as “under IoT Gateway” for icon rules (e.g. `dashboard` vs home). */
function iotGatewayIconPathHint(item: MenuItem, ancestorHint?: string): string | undefined {
  const selfNorm = item.path?.trim()
    ? (normalizeIotGatewayMenuPath(item.path, ancestorHint) ?? item.path)
    : "";
  return (
    firstPathInIotGatewaySubtree(selfNorm, ancestorHint) ??
    (isIotGatewayMenuRootItem(item) ? "/iot-gateway" : undefined)
  );
}

/** Hint passed to child menu rows so nested items inherit IoT scope when their own path omits the prefix. */
function nextIotGatewayAncestorHint(item: MenuItem, ancestorHint?: string): string | undefined {
  return iotGatewayIconPathHint(item, ancestorHint) ?? ancestorHint;
}

function LegacyRuleChainEditorRedirect() {
  const { chainId } = useParams<{ chainId: string }>();
  if (!chainId) return <Navigate to="/iot-gateway/rulechains" replace />;
  return <Navigate to={`/iot-gateway/rulechains/${chainId}/editor`} replace />;
}

/** Old bookmarked URLs `/iot-gateway/:chainId/editor` (UUID) → nested rulechains editor. */
function LegacyIotGatewayChainEditorRedirect() {
  const { chainId } = useParams<{ chainId: string }>();
  if (!chainId) return <Navigate to="/iot-gateway/rulechains" replace />;
  if (
    chainId === "rulechains" ||
    chainId === "devices" ||
    chainId === "dashboards" ||
    chainId === "scada-symbols" ||
    chainId === "locations" ||
    chainId === "analytics" ||
    chainId === "renewable_energy" ||
    chainId === "alarms" ||
    chainId === "device-profiles" ||
    chainId === "device-import" ||
    chainId === "widgets" ||
    chainId === "widget-library" ||
    chainId === "widgets-library"
  ) {
    return <Navigate to="/iot-gateway/rulechains" replace />;
  }
  return <Navigate to={`/iot-gateway/rulechains/${encodeURIComponent(chainId)}/editor`} replace />;
}

/** Paths that have a real page implementation (not Coming Soon). */
const IMPLEMENTED_PATH_ELEMENTS: Record<string, React.ReactNode> = {
  '/dashboard': <Dashboard />,
  '/project/templates': <ProjectsAndWorkflowsPage />,
  '/project/create': <CreateProjectPage />,
  '/workflows': <WorkflowData />,
  '/draft_workflows': <DraftWorkflowsData />,
  '/landing': <LandingPage />,
  '/workflows/create': <CreateWorkflow />,
  '/workflows/:id': <FlowPage />,
  '/connection-vault/connections': <CredentialsVault />,
  '/connection-vault/connectors': <CredConnectors />,
  '/connection-vault/create/:selectedConnectorId': <CredCreate />,
  '/datasets': <DatasetList />,
  '/datasets/create': <CreateDatasetStepper />,
  '/datasets/:datasetId/edit': <CreateDatasetStepper />,
  '/master-data': <MasterDataUploadPage />,
  '/jobs': <JobsComponent />,
  '/jobs/:section': <PrefectDashboard />,
  '/exploratory-analysis/semantics': <SemanticsStepper />,
  '/exploratory-analysis/jobs': <SemanticJobs />,
  '/exploratory-analysis/ask': <Ask />,
  '/exploratory-analysis/explore': <Explore />,
  '/exploratory-analysis/agentic-run/create': <AgenticSemantics />,
  '/exploratory-analysis/agentic-run': <AgenticSemantics />,
  '/exploratory-analysis/sql-runner': <SqlRunner />,
  '/settings/organization': <OrganizationTabs />,
  '/settings/users': <UsersComponent />,
  '/settings/roles': <RolesComponent />,
  '/settings/roles/modify/:id?': <RoleForm />,
  '/orchestration': <OrchestrationSetupManager />,
  '/perspectives': <PerspectiveList />,
  '/perspectives/create': <PerspectiveCreatorPage />,
  '/perspectives/:id/edit': <PerspectiveCreatorPage />,
  "/iot-gateway/rulechains": <RuleChainsListPage />,
  "/iot-gateway/rulechains/:chainId/editor": <RuleChainEditorPage />,
  "/iot-gateway/alarms": <AlarmsListPage />,
  "/iot-gateway/device-profiles": <DeviceProfilesPage />,
  "/iot-gateway/device-profiles/:profileId": <DeviceProfileWorkspacePage />,
  "/iot-gateway/device-import": <DeviceImportPage />,
  "/iot-gateway/devices/by-type/:typeId": <DeviceTypeDevicesPage />,
  "/iot-gateway/devices/:deviceId": <DeviceDetailPage />,
  "/iot-gateway/devices": <DevicesListPage />,
  "/iot-gateway/widgets": <WidgetsLibraryPage />,
  "/iot-gateway/widget-library": <WidgetsLibraryPage />,
  "/iot-gateway/widgets-library": <WidgetsLibraryPage />,
  "/widgets-library": <WidgetsLibraryPage />,
  "/iot-gateway/dashboards": <ThingsboardDashboardsListPage />,
  "/iot-gateway/dashboards/:dashboardId/editor": <ThingsboardDashboardEditorPage />,
  "/iot-gateway/scada-symbols": <ScadaSymbolsPage />,
  "/iot-gateway/locations": <LocationsListPage />,
  "/iot-gateway/analytics": <SimulationTrackPage />,
  "/iot-gateway/device_hierarchy": <RenewableEnergyPage />,

  "/iot-gateway": <Navigate to="/iot-gateway/rulechains" replace />,
  '/dynamic-forms': <DynamicFormsPage />,
  "/renewable_energy": <Navigate to="/iot-gateway/device_hierarchy" replace />,
};

const IMPLEMENTED_PATHS = new Set(Object.keys(IMPLEMENTED_PATH_ELEMENTS));

const isPathImplemented = (path: string): boolean => IMPLEMENTED_PATHS.has(path);

const getSourceMenuItems = (
  activePerspective: { menu_items?: MenuItem[] } | null,
  currentUser: { role?: string } | null,
  menu_items: MenuItem[],
): MenuItem[] | null => {
  const isAdmin = currentUser?.role === "Admin";
  return activePerspective?.menu_items || (isAdmin ? menu_items : null) || null;
};

// Cache for converted routes to prevent unnecessary recalculations
const routeCache = new Map<string, RouteConfig[]>();

// Convert perspective menu items to route configs
const convertPerspectiveMenuToRoutes = (menuItems: MenuItem[], perspectiveId?: string): RouteConfig[] => {
  // Use cache if available
  const cacheKey = perspectiveId || JSON.stringify(menuItems);
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }

  const routes: RouteConfig[] = [];

  const processMenuItem = (item: MenuItem, ancestorHint?: string) => {
    const hint = iotGatewayIconPathHint(item, ancestorHint);
    const childAncestor = nextIotGatewayAncestorHint(item, ancestorHint);

    if (item.children) {
      item.children.forEach((child) => processMenuItem(child, childAncestor));
    }

    if (item.path && !item.navOnly) {
      const path = normalizeIotGatewayMenuPath(item.path, hint) ?? item.path;
      // Coming Soon only for sidebar menu items that have no real page yet
      if (!isPathImplemented(path)) {
        routes.push({
          path,
          title: item.title,
          icon: getIconForMenuItem(String(item.p_id ?? ""), hint),
          element: <ComingSoonPage title={item.title} path={path} />,
          isPrivate: true,
          hide: item.hidden || false,
          permissions: item.permissions?.map(p => `${p.action}:${p.resource}`) || [],
        });
      }
    }
  };

  menuItems.forEach(item => processMenuItem(item));

  // Cache the result
  routeCache.set(cacheKey, routes);

  return routes;
};

// Convert perspective menu items to navigation items
const convertMenuItemToNavItem = (item: MenuItem, ancestorHint?: string): NavItem | null => {
  if (!item.title) {
    return null;
  }

  // Skip hidden items
  if (item.hidden) {
    return null;
  }

  const hint = iotGatewayIconPathHint(item, ancestorHint);
  const childAncestor = nextIotGatewayAncestorHint(item, ancestorHint);

  // Handle items with children (collapsible)
  if (item.children && item.children.length > 0) {
    const children = item.children
      .map(child => convertMenuItemToNavItem(child, childAncestor))
      .filter((child): child is NavItem => child !== null)
      .filter((child): child is NavItem & { path: string } =>
        'path' in child && typeof child.path === 'string'
      );

    if (children.length > 0 || item.navOnly) {
      const navCollapsible: NavCollapsible = {
        title: item.title,
        icon: getIconForMenuItem(String(item.p_id ?? ""), hint),
        hide: item.hidden || false,
        children: children as (NavItem & { path: string })[],
      };
      
      // Inject hardcoded submenu item for Chat History under Exploratory Analysis
      if (item.p_id === 'exploratory_analysis') {
         // Check if Chat History already exists to prevent duplication
         const hasChatHistory = navCollapsible.children.some(child => child.title === "Chat History");
         
        //  if (!hasChatHistory) {
        //    navCollapsible.children.push({
        //      title: "Chat History",
        //      icon: MessageCircleMore,
        //      path: "/exploratory-analysis/chat-history",
        //      hide: false,
        //    } as unknown as (NavItem & { path: string }));
        //  }
      }

      return navCollapsible;
    }
  }

  // Handle direct navigation links
  if (item.path && !item.navOnly) {
    const path = normalizeIotGatewayMenuPath(item.path, hint) ?? item.path;
    const navLink: NavLink = {
      title: item.title,
      icon: getIconForMenuItem(String(item.p_id ?? ""), hint),
      hide: item.hidden || false,
      path,
    };
    return navLink;
  }

  // Inject if the current leaf item is actually the parent to which we want to add child dynamically, though Exploratory Analysis typically has children.
  return null;
};

// Hook to get perspective-based routes
export const usePerspectiveRoutes = (): RouteConfig[] => {
  const { activePerspective, currentUser, menu_items } = useRbacStore();

  return useMemo(() => {
    const isAdmin = currentUser?.role === "Admin";

    const sourceMenuItems =
      activePerspective?.menu_items || (isAdmin ? menu_items : null);

    if (!sourceMenuItems?.length) return [];

    // Pass perspective ID for better caching
    const perspectiveId = isAdmin
      ? (activePerspective?.perspective_id || activePerspective?.id)
      : (activePerspective?.perspective_id || activePerspective?.id);

    return convertPerspectiveMenuToRoutes(sourceMenuItems, perspectiveId);
  }, [activePerspective?.perspective_id, activePerspective?.id, currentUser?.role, menu_items]);
};

// Static base routes (always available)
const baseRoutes: RouteConfig[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <div>Register</div>,
  },
  {
    title: "Organization",
    path: "/organization",
    icon: LayoutDashboardIcon,
    isPrivate: true,
    element: <OrganizationSelection />,
  },
];

// Component to handle smart fallback routing
const SmartFallback = () => {
  const { currentUser, activePerspective, menu_items } = useRbacStore();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const sourceMenuItems = getSourceMenuItems(activePerspective, currentUser, menu_items);
  const menuMatch = sourceMenuItems?.length
    ? findMenuItemForPath(sourceMenuItems, location.pathname)
    : undefined;

  // Coming Soon only when the URL matches a sidebar menu item without a real page
  if (menuMatch && !isPathImplemented(menuMatch.menuPath)) {
    return <ComingSoonPage title={menuMatch.title} path={location.pathname} />;
  }

  if (currentUser.role !== "Admin" && activePerspective?.menu_items) {
    const firstMenuItem = activePerspective.menu_items.find((item) => item.path && !item.hidden);
    const firstChildPath = activePerspective.menu_items.find(
      (item) => item.children && item.children.length > 0,
    )?.children?.find((child) => child.path && !child.hidden)?.path;

    const targetPath = firstMenuItem?.path || firstChildPath || "/workflows";
    return <Navigate to={targetPath} replace />;
  }

  return <Navigate to="/landing" replace />;
};

// Static routes that are always available regardless of perspective
const staticProtectedRoutes: RouteConfig[] = [
  
  { path: "/dashboard", element: <Dashboard />, isPrivate: true },
  { path: "/project/templates", element: <ProjectsAndWorkflowsPage />, isPrivate: true },
  { path: "/project/create", element: <CreateProjectPage />, isPrivate: true },
  { path: "/workflows", element: <WorkflowData />, isPrivate: true },
  { path: "/draft_workflows", element: <DraftWorkflowsData />, isPrivate: true },
  { path: "/draft_workflows/:draft_id", element: <FlowPage />, isPrivate: true },
  { path: "/workflows/create", element: <CreateWorkflow />, isPrivate: true },
  { path: "/workflows/:id", element: <FlowPage />, isPrivate: true },
  { path: "/landing", element: <LandingPage />, isPrivate: true },
  { path: "/reconciliation/operations",element: <WorkflowExecution/>,isPrivate:true},
  // { path: '/history/:workflowName',element:<HistoryPage/>,isPrivate:true},
  // { path: "/history/:flowId/tasklist", element:<TaskDetailViewPage  />,isPrivate:true},
  // { path: "/operations/:id/processflow", element: <WorkflowDetails />, isPrivate: true },
  // { path: "/reconciliation/operations/operations/output", element: <Nodeoperationoutput />, isPrivate: true },
  { path: "/reconciliation/operations/:id/summary", element: <WorkflowDetails />, isPrivate: true },
  { path: "/reconciliation/operations/:id/report", element: <WorkflowDetails />, isPrivate: true },
  { path: "/reconciliation/operations/:id/dashboard", element: <WorkflowDetails />, isPrivate: true },
  { path: "/reconciliation/operations/:id/jobs", element: <WorkflowDetails />, isPrivate: true },
  { path: "/reconciliation/operations/:id/operations", element: <WorkflowDetails />, isPrivate: true },
  { path: "/reconciliation/operations/:id/conversational-ai", element: <WorkflowDetails />, isPrivate: true },
  { path: "/reconciliation/operations/:id/action-center", element: <WorkflowDetails />, isPrivate: true },
  { path: "/reconciliation/operations/:workflowName", element: <DataReconciliationView />, isPrivate: true },
  { path: "/reconciliation/operations/:workflowname/charts/create", element: <ChartFormulator />, isPrivate: true },
  { path: "/reconciliation/operations/:workflowname/charts/:chartId/edit", element: <ChartFormulator />, isPrivate: true },
  { path: "/reconciliation/operations/:workflowname/charts/:chartId", element: <ChartFormulator />, isPrivate: true },
  { path: "/reconciliation/operations/:workflowname/dashboards", element: <ChartFormulator />, isPrivate: true },
  { path: "/reconciliation/operations/:workflowname/dashboards/create", element: <CreateDashboard />, isPrivate: true },

  { path: "/data-validation",element: <WorkflowExecution/>,isPrivate:true},
  { path: "/data-validation/:id/datalineage",element:<Validationtab/>,isPrivate:true},
  { path: "/data-validation/:id/validation",element:<Validationtab/>,isPrivate:true},
  { path: "/data-validation/:id/report",element:<Validationtab/>,isPrivate:true},
  { path: "/data-validation/:id/dashboard",element:<Validationtab/>,isPrivate:true},
  { path: "/data-validation/:id/jobs",element:<Validationtab/>,isPrivate:true},
  { path: "/data-validation/:id/basepage",element:<Validationtab/>,isPrivate:true},
  { path: "/connection-vault/connections", element: <CredentialsVault />, isPrivate: true },
  { path: "/connection-vault/connectors", element: <CredConnectors />, isPrivate: true },
  { path: "/connection-vault/create/:selectedConnectorId", element: <CredCreate />, isPrivate: true },
  { path: "/datasets", element: <DatasetList />, isPrivate: true },
  { path: "/datasets/create", element: <CreateDatasetStepper />, isPrivate: true },
  { path: "/datasets/:datasetId/edit", element: <CreateDatasetStepper />, isPrivate: true },
  // { path: "/virtual-db", element:<DatasetsTabs/>, isPrivate: true },
  {path:"/virtual-db",element:<WorkflowDB/>,isPrivate:true},
  { path: "/master-data", element: <MasterDataUploadPage />, isPrivate: true },
  { path: "/jobs", element: <JobsComponent />, isPrivate: true }, // Original Jobs
  // { path: "/jobs", element: <PrefectDashboard />, isPrivate: true },
  { path: "/jobs/:section", element: <PrefectDashboard />, isPrivate: true },
  {path: '/jobs/prefectrun/:flowRunId', element: <Prefectrun />, isPrivate: true},
  //  { path: "/visualization/charts", element: <ChartsListPage />, isPrivate: true },
  // { path: "/visualization/charts/create", element: <ChartFormulator />, isPrivate: true },
  // { path: "/visualization/dashboards", element: <DashboardsListPage />, isPrivate: true },
  // { path: "/visualization/dashboards/create", element: <CreateDashboard />, isPrivate: true },
  { path:"/exploratory-analysis/semantics",element:<SemanticsStepper />,isPrivate:true},
  { path:"/exploratory-analysis/jobs",element:<SemanticJobs />,isPrivate:true},
  { path:"/exploratory-analysis/ask",element:<Ask />,isPrivate:true},
  { path:"/exploratory-analysis/explore",element:<Explore />,isPrivate:true},  
  { path: "/exploratory-analysis/insights", element:<Insights />, isPrivate:true },
  { path: "/exploratory-analysis/agentic-run/create", element:<AgenticSemantics />, isPrivate:true },
  { path: "/exploratory-analysis/agentic-run", element:<AgenticSemantics />, isPrivate:true },
  { path: "/exploratory-analysis/chat-history", element:<AgenticChatHistory runId="run_1a0f427c86ec" />, isPrivate:true },
  { path: "/exploratory-analysis/sql-runner", element: <SqlRunner />, isPrivate: true },
  { path: "/analytic-studio", element: <AnalyticsStudioPage />, isPrivate: true },
  { path: "/analytic-studio/dashboards/create", element: <CreateDashboard />, isPrivate: true },
  { path: "/analytic-studio/dashboards/view", element: <AnalyticsStudioViewDashboardPage />, isPrivate: true },
  { path: "/analytic-studio/charts/:chartId/edit", element: <AnalyticsStudioEditChartPage />, isPrivate: true },
  { path: "/analytic-studio/create-chart", element: <AnalyticsStudioCreateChartEntryPage />, isPrivate: true },
  { path: "/analytic-studio/:nodeId/create-chart", element: <AnalyticsStudioCreateChartPage />, isPrivate: true },
  { path: "/analytic-studio/:nodeId", element: <AnalyticsStudioSourcePage />, isPrivate: true },
  { path: "/decisions",element:<Decisions/>,isPrivate:true},
  { path: "/scenarios",element:<Scenarios />,isPrivate:true},
  { path: "/dynamic-forms", element: <DynamicFormsPage />, isPrivate: true },
  { path: "/analytics", element: <Navigate to="/dynamic-forms" replace />, isPrivate: true },
  { path: "/iot-gateway/device_hierarchy", element: <RenewableEnergyPage />, isPrivate: true },
  { path: "/renewable_energy", element: <Navigate to="/iot-gateway/device_hierarchy" replace />, isPrivate: true },
  { path: "/settings/organization", element: <OrganizationTabs />, isPrivate: true },
  { path: "/settings/users", element: <UsersComponent />, isPrivate: true },
  { path: "/settings/roles", element: <RolesComponent />, isPrivate: true },
  { path: "/settings/roles/modify/:id?", element: <RoleForm />, isPrivate: true },
  { path: "/orchestration", element: <OrchestrationSetupManager />, isPrivate: true },
  { path: "/perspectives", element: <PerspectiveList />, isPrivate: true },
  { path: "/perspectives/create", element: <PerspectiveCreatorPage />, isPrivate: true },
  { path: "/perspectives/:id/edit", element: <PerspectiveCreatorPage />, isPrivate: true },
  { path: "/scheduler/create", element: <SchedulerPage />, isPrivate: true },
  { path: "/scheduler/edit/:schedulerId", element: <SchedulerPage />, isPrivate: true },
  { path: "/settings/schedulers", element: <SchedulersListPage />, isPrivate: true },
  { path: "/iot-gateway/alarms", element: <AlarmsListPage />, isPrivate: true },
  { path: "/iot-gateway/device-profiles", element: <DeviceProfilesPage />, isPrivate: true },
  { path: "/iot-gateway/device-profiles/:profileId", element: <DeviceProfileWorkspacePage />, isPrivate: true },
  { path: "/iot-gateway/device-import", element: <DeviceImportPage />, isPrivate: true },
  { path: "/iot-gateway/devices/by-type/:typeId", element: <DeviceTypeDevicesPage />, isPrivate: true },
  { path: "/iot-gateway/devices/:deviceId", element: <DeviceDetailPage />, isPrivate: true },
  { path: "/iot-gateway/devices", element: <DevicesListPage />, isPrivate: true },
  { path: "/iot-gateway/widgets", element: <WidgetsLibraryPage />, isPrivate: true },
  { path: "/iot-gateway/widget-library", element: <WidgetsLibraryPage />, isPrivate: true },
  { path: "/iot-gateway/widgets-library", element: <WidgetsLibraryPage />, isPrivate: true },
  { path: "/widgets-library", element: <WidgetsLibraryPage />, isPrivate: true },
  { path: "/iot-gateway/dashboards", element: <ThingsboardDashboardsListPage />, isPrivate: true },
  { path: "/iot-gateway/dashboards/:dashboardId/editor", element: <ThingsboardDashboardEditorPage />, isPrivate: true },
  { path: "/iot-gateway/scada-symbols", element: <ScadaSymbolsPage />, isPrivate: true },
  { path: "/iot-gateway/locations", element: <LocationsListPage />, isPrivate: true },
  { path: "/iot-gateway/analytics", element: <SimulationTrackPage />, isPrivate: true },
  { path: "/iot-gateway/device_hierarchy", element: <RenewableEnergyPage />, isPrivate: true },

  { path: "/iot-gateway/rulechains/:chainId/editor", element: <RuleChainEditorPage />, isPrivate: true },
  { path: "/iot-gateway/rulechains", element: <RuleChainsListPage />, isPrivate: true },
  { path: "/iot-gateway/:chainId/editor", element: <LegacyIotGatewayChainEditorRedirect />, isPrivate: true },
  { path: "/iot-gateway", element: <Navigate to="/iot-gateway/rulechains" replace />, isPrivate: true },
  { path: "/rulechain", element: <Navigate to="/iot-gateway/rulechains" replace />, isPrivate: true },
  { path: "/rulechain/:chainId/editor", element: <LegacyRuleChainEditorRedirect />, isPrivate: true },
];

for (const route of staticProtectedRoutes) {
  if (route.path) IMPLEMENTED_PATHS.add(route.path);
}
routeCache.clear();

const wrapRouteElement = (element: React.ReactNode) => (
  <Suspense fallback={<div>Loading...</div>}>
    {element}
  </Suspense>
);

/** Placeholder so created form menu paths match a route; DynamicFormRouteOverride renders the form. */
function DynamicFormCreatedRoutePlaceholder() {
  return (
    <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
      Loading form…
    </div>
  );
}

// Generate all routes including perspective menu paths
export const useAllRoutes = (): RouteConfig[] => {
  const perspectiveRoutes = usePerspectiveRoutes();
  const createdFormMenuItems = useDynamicFormAssignmentStore((state) => state.createdMenuItems);
  const formAssignmentsByPath = useDynamicFormAssignmentStore((state) => state.assignmentsByPath);

  return useMemo(() => {
    // perspectiveRoutes only contains unimplemented sidebar menu paths (Coming Soon)
    const menuRoutes = perspectiveRoutes;
    const knownPaths = new Set<string>([
      ...IMPLEMENTED_PATHS,
      ...menuRoutes.map((route) => route.path).filter((path): path is string => !!path),
    ]);

    // New “Create menu item” paths (+ any assigned path not already routed) so navigation works.
    const dynamicFormPaths = new Set<string>([
      ...createdFormMenuItems.map((item) => item.path),
      ...Object.keys(formAssignmentsByPath),
    ]);
    const dynamicFormRoutes: RouteConfig[] = [...dynamicFormPaths]
      .filter((path) => path && path !== '/dynamic-forms' && !knownPaths.has(path))
      .map((path) => ({
        path,
        title: formAssignmentsByPath[path]?.menuTitle ?? createdFormMenuItems.find((item) => item.path === path)?.title,
        element: <DynamicFormCreatedRoutePlaceholder />,
        isPrivate: true,
      }));

    const routes: RouteConfig[] = [
      ...baseRoutes,
      // Protected routes with layout
      {
        path: "/",
        element: <LayoutWrapper />,
        children: [
          // Default redirect to workflows page after login
          {
            index: true,
            element: <Navigate to="/landing" replace />,
          },
          ...staticProtectedRoutes.map((route) => ({
            ...route,
            element: wrapRouteElement(route.element),
          })),
          ...menuRoutes.map((route) => ({
            ...route,
            element: wrapRouteElement(route.element),
          })),
          ...dynamicFormRoutes.map((route) => ({
            ...route,
            element: wrapRouteElement(route.element),
          })),
        ],
      },
      {
        path: "*",
        element: <SmartFallback />,
      },
    ];
    return routes;
  }, [perspectiveRoutes, createdFormMenuItems, formAssignmentsByPath]);
};

export const useDashboardMenu = (): NavGroup[] => {
  const { activePerspective, currentOrganization, currentUser, menu_items } = useRbacStore();

  return useMemo(() => {
    const perspectiveToUse = activePerspective;

    // Choose the correct menu source based on role and active perspective
    const isAdmin = currentUser?.role === "Admin";

    // If there's an active perspective, use its menu items regardless of role
    // Otherwise, admin users fall back to menu_items
    const sourceMenuItems = perspectiveToUse?.menu_items || (isAdmin ? menu_items : null);

    if (!sourceMenuItems || sourceMenuItems.length === 0) {
      console.warn("No menu items available. Admin:", isAdmin, "Perspective:", perspectiveToUse?.name);
      // Return empty menu if nothing is available
      return [];
    }

    const navItems = sourceMenuItems
      .map(item => convertMenuItemToNavItem(item))
      .filter((item): item is NavItem => item !== null);

    // const analyticsLink: NavLink = {
    //   title: 'Analytics',
    //   path: '/analytics',
    //   icon: TbBrandGoogleAnalytics,
    //   hide: false,
    // };
    const childrenWithDynamicForms = navItemsIncludePath(navItems, '/dynamic-forms')
      ? navItems
      : [...navItems];

    console.log("Dashboard menu items:", {
      isAdmin,
      perspectiveName: perspectiveToUse?.name,
      sourceItemsCount: sourceMenuItems.length,
      navItemsCount: navItems.length
    });

    return [
      {
        title: perspectiveToUse?.name || (isAdmin ? "Admin Menu" : "Main Menu"),
        children: childrenWithDynamicForms,
      }
    ];
  }, [activePerspective, currentOrganization, currentUser, menu_items]);
};

// Legacy DashboardMenu function for backward compatibility
export const DashboardMenu = (): NavGroup[] => {
  return useDashboardMenu();
};

// Updated ProtectedRoute to handle admin users with fallback perspective
const ProtectedRoute = ({
  isPrivate,
  element,
}: {
  isPrivate?: boolean;
  element: JSX.Element;
}) => {
  const { state: authState } = useAuth();
  const { currentUser, activePerspective } = useRbacStore();

  // Early return for unauthenticated users on private routes
  if (isPrivate && (!authState.isAuthenticated || !currentUser)) {
    return <Navigate to="/login" replace />;
  }

  // Non-private routes or authenticated users
  if (!isPrivate) {
    return element;
  }

  const isOnOrganizationPage = window.location.pathname === "/organization";

  if (currentUser && !activePerspective && !isOnOrganizationPage) {
    if (currentUser.role === "Admin") {
      // Admin → allow direct access (menu comes from menu_items)
      return element;
    } else {
      // Non-admin → must select org first
      return <Navigate to="/organization" replace />;
    }
  }

  return element;
};

const wrapRoutes = (routes: any[]): any[] =>
  routes.map((route) => {
    const wrapped = {
      ...route,
      element: route.element ? (
        <ProtectedRoute isPrivate={route.isPrivate} element={route.element} />
      ) : undefined,
    };

    if (route.children) {
      wrapped.children = wrapRoutes(route.children);
    }

    return wrapped;
  });

export const RoutesApp = () => {
  const { hydrated } = useAuth();
  const allRoutes = useAllRoutes();

  console.log("allRoutes", allRoutes);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return useRoutes(wrapRoutes(allRoutes));
};


