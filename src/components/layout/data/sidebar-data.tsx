import { useDashboardMenu } from "@/router";
import {
  AudioWaveform,
  Command,
  Building2,
  GitMerge,
  ClipboardCheck,
  LayoutDashboard,
  LayoutTemplate,
  PlayCircle,
  GitBranch,
  Rocket,
  Database,
  Box,
  FileCode,
  Zap,
  Activity,
  Gauge
} from "lucide-react";
import type { NavGroup, NavItem, NavLink, NavCollapsible, SidebarData } from "@/types/sidebar";
import { useAuth } from "@/context/auth/authContext";
import { useRbacStore } from "@/stores/useRBACStore";
import { useDynamicFormAssignmentStore } from "@/pages/dynamic-forms/stores/useDynamicFormAssignmentStore";

interface ISidebarDataComponent { 
  sidebarData: SidebarData;  
}

// Type guards to help TypeScript understand the union types
const isNavLink = (item: NavItem): item is NavLink => { 
  return 'path' in item && typeof item.path === 'string' && !('children' in item);
};

const isNavCollapsible = (item: NavItem): item is NavCollapsible => {
  return 'children' in item && Array.isArray(item.children);
};

const filterHiddenItems = (navGroups: NavGroup[]): NavGroup[] => { 
  const filterHiddenFromItem = (item: NavItem): NavItem | null => {
    // Skip items that are explicitly hidden
    if (item.hide === true) {
      return null;
    }

    // If it's a NavLink, return it as-is (since it's not hidden)
    if (isNavLink(item)) {
      return item;
    }

    // If it's a collapsible with children, filter the children
    if (isNavCollapsible(item)) {  
      const visibleChildren = item.children
        .map(child => {
          return filterHiddenFromItem(child as NavItem);
        })
        .filter((child): child is NavItem => child !== null);

      // If no visible children, hide the parent too
      if (visibleChildren.length === 0) {
        return null;
      }

      // Create a new NavCollapsible with filtered children
      const result: NavCollapsible = {   
        title: item.title,
        badge: item.badge,
        icon: item.icon,
        hide: item.hide,
        children: visibleChildren as (NavItem & { path: string })[],
      };

      return result;
    }

    // For any other type, show it if not hidden
    return item;
  };

  const result = navGroups
    .map(group => {
      const visibleChildren = group.children
        .map(item => {
          return filterHiddenFromItem(item);
        })
        .filter((item): item is NavItem => item !== null);

      if (visibleChildren.length === 0) {
        return null;
      }

      return {
        ...group,
        children: visibleChildren,
      };
    })
    .filter((group): group is NavGroup => group !== null);  
  return result;
};

export const SidebarDataComponent = (): ISidebarDataComponent => {
  const { state: authState } = useAuth();
  const { 
    availableOrganizations, 
    currentOrganization, 
    activePerspective,
    currentUser 
  } = useRbacStore();
  
  // Get the dashboard menu dynamically from router (based on active perspective)
  const dashboardMenuItems = useDashboardMenu()
  const createdFormMenuItems = useDynamicFormAssignmentStore((state) => state.createdMenuItems)

  // Prioritize RBAC store organizations, then localStorage
  const organizations = availableOrganizations && availableOrganizations.length > 0 
    ? availableOrganizations 
    : [];

  // Use RBAC store user info or fallback to auth context
  const currentUserInfo = currentUser || authState?.authInfo?.user;
  const userForSidebar = {  
    ...currentUserInfo, 
    avatar: "/avatars/shadcn.jpg",
    email: currentUserInfo?.email,
    name: currentUser?.name || `${currentUserInfo?.first_name || ''} ${currentUserInfo?.last_name || ''}`.trim()
  };

  dashboardMenuItems.forEach(group => {  
    group.children.forEach(item => {
      if (isNavLink(item)) {
      } else if (isNavCollapsible(item)) { 
        item.children.forEach(child => {});
      } else {
      }
    });
  });

  // Filter items based only on hide property
  const visibleRoutes = filterHiddenItems(dashboardMenuItems);

  // Inject dynamic-form menu items created from the form builder (in-memory)
  const injectCreatedFormMenus = (groups: NavGroup[]): NavGroup[] => {
    if (!createdFormMenuItems.length) return groups;

    const nextGroups = groups.map((group) => ({
      ...group,
      children: [...group.children],
    }));

    /** Find the collapsible that directly contains a child with `path`. */
    const findCollapsibleContainingPath = (
      items: NavItem[],
      path: string,
    ): NavCollapsible | null => {
      for (const item of items) {
        if (isNavCollapsible(item) && item.children.some((child) => child.path === path)) {
          return item;
        }
        if (isNavCollapsible(item)) {
          const nested = findCollapsibleContainingPath(item.children as NavItem[], path);
          if (nested) return nested;
        }
      }
      return null;
    };

    const promoteLinkWithSibling = (
      items: NavItem[],
      parentPath: string,
      sibling: NavLink,
    ): NavItem[] | null => {
      const parentIndex = items.findIndex(
        (item) => isNavLink(item) && item.path === parentPath,
      );
      if (parentIndex >= 0) {
        const parentLink = items[parentIndex] as NavLink;
        if (parentLink.path === sibling.path) return items;
        const promoted: NavCollapsible = {
          title: parentLink.title,
          icon: parentLink.icon,
          hide: false,
          children: [{ ...parentLink }, sibling],
        };
        return [
          ...items.slice(0, parentIndex),
          promoted,
          ...items.slice(parentIndex + 1),
        ];
      }

      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!isNavCollapsible(item)) continue;
        const nextChildren = promoteLinkWithSibling(
          item.children as NavItem[],
          parentPath,
          sibling,
        );
        if (nextChildren) {
          const next = [...items];
          next[i] = { ...item, children: nextChildren as NavCollapsible['children'] };
          return next;
        }
      }
      return null;
    };

    for (const created of createdFormMenuItems) {
      const link: NavLink = {
        title: created.title,
        path: created.path,
        icon: LayoutTemplate,
        hide: false,
      };

      if (created.parentPath) {
        let placed = false;
        for (let g = 0; g < nextGroups.length; g += 1) {
          const group = nextGroups[g];
          const parent = findCollapsibleContainingPath(group.children, created.parentPath);
          if (parent) {
            if (!parent.children.some((child) => child.path === created.path)) {
              parent.children = [...parent.children, link];
            }
            placed = true;
            break;
          }
          // Parent is a plain link (top-level or nested) — promote to collapsible + sibling.
          const promotedChildren = promoteLinkWithSibling(
            group.children,
            created.parentPath,
            link,
          );
          if (promotedChildren) {
            nextGroups[g] = { ...group, children: promotedChildren };
            placed = true;
            break;
          }
        }
        if (placed) continue;
      }

      if (nextGroups.length === 0) {
        nextGroups.push({
          title: 'Forms',
          children: [link],
        });
      } else {
        const last = nextGroups[nextGroups.length - 1];
        if (!last.children.some((item) => isNavLink(item) && item.path === created.path)) {
          last.children = [...last.children, link];
        }
      }
    }

    return nextGroups;
  };

  const allRoutes = injectCreatedFormMenus(visibleRoutes);
  
  visibleRoutes.forEach(group => {
    group.children.forEach(item => {
      if (isNavLink(item)) {
      } else if (isNavCollapsible(item)) {
        item.children.forEach(child => {});
      }
    });
  });

  // Convert organizations to teams format
  const teams = organizations.map((org: any) => ({
    name: org?.org_name || "",
    logo: Building2,
    plan: org?.plan || "Enterprise",
  }));

  // Fallback to default teams if no organizations available
  const fallbackTeams = [
    {
      name: "Default Organization",
      logo: Building2,
      plan: "Enterprise",
    },
  ];

  return {
    sidebarData: {
      teams: teams.length > 0 ? teams : fallbackTeams,
      user: userForSidebar,
      app: {
        name: "",
        logo: Command,
        plan: "SIROBILT",
      },
      navGroups: allRoutes,
    },
  };
};