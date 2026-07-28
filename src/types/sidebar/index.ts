import { LucideIcon } from "lucide-react";
import { IconType } from "react-icons";

interface User {
  name: string;
  email: string;
  avatar: string;
}

interface App {
  name: string;
  logo: LucideIcon;
  plan: string;
}

export interface BaseNavItem {
  p_id?: string;
  label?: string;
  title: string;
  badge?: string;
  icon?: LucideIcon | IconType;
  hide?: boolean;
  path?: string;
  children?: NavItem[];
}

interface Team {
  name: string;
  logo: LucideIcon;
  plan: string;
}

type NavLink = BaseNavItem & {
  path: string;
  children?: never;
}

type NavCollapsible = BaseNavItem & {
  children: (BaseNavItem & { path: string })[];
  path?: never;
}

type NavItem = NavCollapsible | NavLink;

interface NavGroup {
  title: string;
  children: NavItem[];
  permissions?: string[];
}

interface SidebarData {
  user: User;
  app: App;
  navGroups: NavGroup[];
  teams: Team[];
}

export type { NavCollapsible, NavGroup, NavItem, NavLink, SidebarData, User, App };


