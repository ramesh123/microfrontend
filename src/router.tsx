import React, { lazy, JSX, useMemo, Suspense } from "react"
import { useAuth } from "@/context/auth/authContext";
import { useRbacStore } from "@/stores/useRBACStore";
import LoginPage from "@/pages/LoginPage";
import { Navigate, useRoutes, useLocation } from "react-router";
import type { NavGroup, NavItem, NavLink, NavCollapsible } from "./types/sidebar";
import type { IconType } from "react-icons";
import Layout from "./components/layout";
import { LayoutDashboardIcon, LucideIcon } from "lucide-react";
import type { MenuItem } from "@/types/rbac";
import { getIconForMenuItem } from "@/navigation/menuItemIcons";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import OrganizationSelection from "./pages/OrganizationSelection";
import ComingSoonPage from "./pages/ComingSoonPage";
import RemoteWorkflowApp from "./components/RemoteWorkflowApp";

// Use lazyWithRetry for all lazy imports to handle chunk load errors after deployments
const Dashboard = lazy(() => lazyWithRetry(() => import("./pages/HomePage/components/dashboard"), 'Dashboard'))

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

/** Paths that have a real page implementation (not Coming Soon). */
const IMPLEMENTED_PATH_ELEMENTS: Record<string, React.ReactNode> = {
  '/dashboard': <Dashboard />,
};

const IMPLEMENTED_PATHS = new Set(Object.keys(IMPLEMENTED_PATH_ELEMENTS));
console.log("IMPLEMENTED_PATHS",IMPLEMENTED_PATHS);
const isPathImplemented = (path: string): boolean => IMPLEMENTED_PATHS.has(path);
console.log("isPathImplemented",isPathImplemented);

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
console.log("itemitem",item);
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

    const targetPath = firstMenuItem?.path || firstChildPath || "/dashboard";
    return <Navigate to={targetPath} replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

// Static routes that are always available regardless of perspective
const staticProtectedRoutes: RouteConfig[] = [
  { path: "/dashboard", element: <Dashboard />, isPrivate: true },
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

// Generate all routes including perspective menu paths
export const useAllRoutes = (): RouteConfig[] => {
  const perspectiveRoutes = usePerspectiveRoutes();

  return useMemo(() => {
    // perspectiveRoutes only contains unimplemented sidebar menu paths (Coming Soon)
    const menuRoutes = perspectiveRoutes;

    const routes: RouteConfig[] = [
      ...baseRoutes,
      // Protected routes with layout
      {
        path: "/",
        element: <LayoutWrapper />,
        children: [
          // Default redirect to dashboard after login
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          ...staticProtectedRoutes.map((route) => ({
            ...route,
            element: wrapRouteElement(route.element),
          })),
          ...menuRoutes.map((route) => ({
            ...route,
            element: wrapRouteElement(route.element),
          })),
          // Any business path container doesn't own is delegated to the
          // federated workflow remote, rendered inside this same Layout
          // (Header/Sidebar/Footer stay from container).
          {
            path: "*",
            element: wrapRouteElement(<RemoteWorkflowApp />),
            isPrivate: true,
          },
        ],
      },
      {
        path: "*",
        element: <SmartFallback />,
      },
    ];
    return routes;
  }, [perspectiveRoutes]);
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

    console.log("Dashboard menu items:", {
      isAdmin,
      perspectiveName: perspectiveToUse?.name,
      sourceItemsCount: sourceMenuItems.length,
      navItemsCount: navItems.length
    });

    return [
      {
        title: perspectiveToUse?.name || (isAdmin ? "Admin Menu" : "Main Menu"),
        children: navItems,
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

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return useRoutes(wrapRoutes(allRoutes));
};
