import { useDashboardMenu } from "@/router";
import { Command, Building2 } from "lucide-react";
import type { NavGroup, NavItem, NavLink, NavCollapsible, SidebarData } from "@/types/sidebar";
import { useAuth } from "@/context/auth/authContext";
import { useRbacStore } from "@/stores/useRBACStore";

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
  const allRoutes = visibleRoutes;

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