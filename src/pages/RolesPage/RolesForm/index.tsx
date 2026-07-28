import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useRbacStore } from '@/stores/useRBACStore';
import type { Role } from '@/types/rbac';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Eye, Pencil, Trash2, Play, PlusCircle, Download, Sparkles, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import api from "@/controllers/API/api";
import { executeApiRequestSilent, getDisplayErrorMessage } from "@/utils/exceptionHelper";
import ForwardedIconComponent from '@/components/common/genericIconComponent';
// import { roles } from '@/data/rbac-config';
import { useApiCrud } from '@/hooks/useOrganizationSetup';
import { getAllPerspectivesApi } from '@/controllers/API/orchestrationApi';
import { Switch } from '@/components/ui/switch';
import { getIconForMenuItem } from '@/navigation/menuItemIcons';

/** One in-flight perspectives list load (avoids duplicate /perspectives calls from effect re-runs / Strict Mode). */
let perspectivesListInflight: Promise<unknown> | null = null;
function dedupedPerspectivesLoad(loader: () => Promise<unknown>): Promise<unknown> {
  if (!perspectivesListInflight) {
    perspectivesListInflight = loader().finally(() => {
      perspectivesListInflight = null;
    });
  }
  return perspectivesListInflight;
}

const roleJsonByIdInflight = new Map<string, Promise<any>>();
function dedupedRoleJson(roleId: string, loader: () => Promise<any>): Promise<any> {
  let p = roleJsonByIdInflight.get(roleId);
  if (!p) {
    p = loader().finally(() => {
      roleJsonByIdInflight.delete(roleId);
    });
    roleJsonByIdInflight.set(roleId, p);
  }
  return p;
}

type RoleFormSnapshotInput = {
  name: string;
  description: string;
  status: boolean;
  selectedPerspectives: any[];
  grantedPermissions: Record<string, string[]>;
};

const serializeRoleFormSnapshot = ({
  name,
  description,
  status,
  selectedPerspectives,
  grantedPermissions,
}: RoleFormSnapshotInput): string => {
  const perspectiveIds = (Array.isArray(selectedPerspectives) ? selectedPerspectives : [])
    .map((p) => String(p.id))
    .sort();

  const normalizedGranted = Object.keys(grantedPermissions)
    .sort()
    .map((key) => [key, [...(grantedPermissions[key] ?? [])].map(String).sort()] as const);

  return JSON.stringify({
    name,
    description,
    status,
    perspectiveIds,
    grantedPermissions: normalizedGranted,
  });
};

/** True when router state already carries this role (list page fetched it before navigate). */
function navRoleMatchesRoute(nav: unknown, routeRoleId: string | undefined): boolean {
  if (!nav || typeof nav !== "object" || routeRoleId == null || routeRoleId === "") return false;
  const id = (nav as { id?: unknown }).id;
  if (id == null) return false;
  return String(id) === String(routeRoleId);
}

/** Same convention as perspective builder: action + '-' + menu item p_id. */
function resolvePermissionActionId(perm: any, menuItem: any): string {
  if (perm?.action_id != null && String(perm.action_id).trim() !== "") {
    return String(perm.action_id);
  }
  const action = perm?.action;
  const hostId = menuItem?.p_id ?? menuItem?.id;
  if (action && hostId) return `${action}-${hostId}`;
  if (action && perm?.resource) return `${action}-${perm.resource}`;
  return "";
}

const getAllPermissionIds = (item: any): string[] => {
  const perms = Array.isArray(item?.permissions) ? item.permissions : [];
  let ids = perms
    .map((p: any) => resolvePermissionActionId(p, item))
    .filter(Boolean) as string[];
  const kids = item?.children;
  if (Array.isArray(kids) && kids.length > 0) {
    ids = ids.concat(kids.flatMap(getAllPermissionIds));
  }
  return ids;
};

/** Stable id + row for API/store perspective shapes (perspective_id, unique_id, etc.). */
function normalizePerspectiveRow(p: any): any | null {
  if (!p || typeof p !== "object") return null;
  const rawId = p.id ?? p.perspective_id ?? p.perspective_ids ?? p.unique_id ?? p.p_id;
  if (rawId == null || rawId === "") return null;
  return { ...p, id: rawId };
}

/** Non-empty perspective id from a role.permissions[] entry, if any. */
function normalizedPerspectiveKeyFromRp(rp: any): string | null {
  const raw = rp?.perspective_id ?? rp?.perspectiveId ?? rp?.perspective_ids;
  if (raw == null) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

function orgIdMatchesCatalog(pOrg: any, rpOrg: any): boolean {
  const ro = String(rpOrg ?? "").trim();
  if (ro === "") return true;
  if (Array.isArray(pOrg)) return pOrg.map(String).some((x) => String(x).trim() === ro);
  return String(pOrg ?? "").trim() === ro;
}

/** Match saved permission block to a catalog perspective (by id, or by name + org when id missing). */
function matchesCatalogPerspective(p: any, rp: any): boolean {
  const key = normalizedPerspectiveKeyFromRp(rp);
  if (key) {
    return (
      String(p.id) === key ||
      String(p.perspective_id ?? "") === key ||
      String(p.perspective_ids ?? "") === key
    );
  }
  const pn = String(p?.name ?? "").trim().toLowerCase();
  const rn = String(rp?.name ?? "").trim().toLowerCase();
  if (!rn || pn !== rn) return false;
  return orgIdMatchesCatalog(p?.org_id, rp?.org_id);
}

function collectActionIdsFromMenuItems(items: any[] | null | undefined): Set<string> {
  const ids = new Set<string>();
  const walk = (list: any[]) => {
    for (const item of list) {
      (item?.permissions ?? []).forEach((perm: any) => {
        const aid = resolvePermissionActionId(perm, item);
        if (aid) ids.add(aid);
      });
      const kids = item?.children;
      if (Array.isArray(kids) && kids.length > 0) walk(kids);
    }
  };
  if (Array.isArray(items)) walk(items);
  return ids;
}

function flattenMenuPIds(items: any[] | null | undefined): Set<string> {
  const s = new Set<string>();
  const walk = (list: any[]) => {
    for (const it of list) {
      if (it?.p_id) s.add(String(it.p_id));
      const kids = it?.children;
      if (Array.isArray(kids) && kids.length > 0) walk(kids);
    }
  };
  if (Array.isArray(items)) walk(items);
  return s;
}

/** Pick catalog perspective(s) whose menu tree overlaps the role's saved menu_items (roles API flat shape). */
function findBestCatalogPerspectivesForRoleMenu(
  roleMenu: any[],
  catalog: any[]
): any[] {
  const rolePids = flattenMenuPIds(roleMenu);
  if (rolePids.size === 0 || !Array.isArray(catalog) || catalog.length === 0) return [];

  let best: { p: any; score: number; catSize: number } | null = null;
  for (const p of catalog) {
    const catPids = flattenMenuPIds(p.menu_items);
    let score = 0;
    for (const pid of rolePids) {
      if (catPids.has(pid)) score++;
    }
    if (!best || score > best.score) {
      best = { p, score, catSize: catPids.size };
    }
  }

  if (!best || best.score <= 0) return [];

  const minOverlap = Math.max(1, Math.min(8, Math.ceil(rolePids.size * 0.02)));
  const catalogCoverage =
    best.catSize > 0 ? best.score / best.catSize : 0;
  const strongCatalogHit = catalogCoverage >= 0.5 && best.score >= 2;
  const enoughAbsoluteHits = best.score >= minOverlap || best.score >= 5;

  if (!strongCatalogHit && !enoughAbsoluteHits) return [];

  return [best.p];
}

/** Ensure every permission row has action_id so checkboxes and save stay consistent. */
function normalizeMenuItemsWithActionIds(items: any[] | null | undefined): any[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...item,
    permissions: (item.permissions ?? []).map((perm: any) => ({
      ...perm,
      action_id: resolvePermissionActionId(perm, item) || perm.action_id,
    })),
    children:
      Array.isArray(item.children) && item.children.length > 0
        ? normalizeMenuItemsWithActionIds(item.children)
        : item.children,
  }));
}

/** Use API permission row as a tab when it is not linked to a catalog perspective. */
function buildEmbeddedPerspectiveFromRp(rp: any, index: number): any {
  const safeName = String(rp?.name ?? "perspective").replace(/[^a-zA-Z0-9_-]+/g, "-");
  const tabId = `role-embedded-${index}-${safeName}`;
  return {
    ...rp,
    id: tabId,
    perspective_id: normalizedPerspectiveKeyFromRp(rp) ?? tabId,
    name: rp.name,
    icon: rp.icon ?? "LayoutTemplate",
    description: rp.description,
    platform: rp.platform,
    org_id: rp.org_id,
    org_name: rp.org_name,
    menu_items: Array.isArray(rp.menu_items) ? rp.menu_items : [],
  };
}

/** Same icon component as the app sidebar (`getIconForMenuItem` by menu `p_id` and optional `path`). */
function GrantMenuItemIcon({ pId, menuPath, className }: { pId: string; menuPath?: string; className?: string }) {
  const Icon = getIconForMenuItem(pId, menuPath);
  return <Icon className={className} />;
}

/** Dot-separated index path (e.g. `0.2.1`) — unique per row even when `p_id` repeats (e.g. multiple "jobs"). */
function getMenuItemByPath(items: any[] | undefined, pathKey: string | null): any | null {
  if (pathKey == null || pathKey === "" || !Array.isArray(items) || items.length === 0) return null;
  const segments = pathKey.split(".").map((s) => parseInt(s, 10));
  if (segments.some((n) => Number.isNaN(n))) return null;
  let currentList: any[] = items;
  let node: any = null;
  for (let d = 0; d < segments.length; d++) {
    const idx = segments[d];
    if (!Array.isArray(currentList) || idx < 0 || idx >= currentList.length) return null;
    node = currentList[idx];
    if (d === segments.length - 1) return node ?? null;
    currentList = Array.isArray(node?.children) ? node.children : [];
  }
  return null;
}

function menuItemExistsAtPath(items: any[] | undefined, pathKey: string | null): boolean {
  return getMenuItemByPath(items, pathKey) != null;
}

function firstNavPathKeyInTree(items: any[] | undefined): string | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  return "0";
}

/** Stable perspective id for API payloads (catalog + embedded tabs). */
function perspectiveIdForPayload(p: any): string {
  const raw = p?.perspective_ids ?? p?.perspective_id ?? p?.id;
  if (raw == null || raw === "") return "";
  return String(raw).trim();
}

function grantedIdsForPerspective(
  granted: Record<string, string[]>,
  p: any,
): string[] {
  const tabKey = String(p.id);
  const alt = perspectiveIdForPayload(p);
  const ids = new Set<string>();
  (granted[tabKey] ?? []).forEach((id) => ids.add(String(id)));
  if (alt && alt !== tabKey) {
    (granted[alt] ?? []).forEach((id) => ids.add(String(id)));
  }
  return Array.from(ids);
}

type GrantMenuNavProps = {
  items: any[];
  depth: number;
  pathPrefix: number[];
  activeMenuNavKey: string | null;
  onSelect: (navKey: string) => void;
};

const GrantPermissionMenuNav: React.FC<GrantMenuNavProps> = ({
  items,
  depth,
  pathPrefix,
  activeMenuNavKey,
  onSelect,
}) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const padStyle = { paddingLeft: `max(0.5rem, ${0.5 + depth * 0.65}rem)` } as const;
  const textClass = "text-black dark:text-neutral-100";

  return (
    <>
      {items.map((item, index) => {
        const pId = item?.p_id ?? item?.id;
        if (pId == null) return null;
        const pIdStr = String(pId);
        const segments = [...pathPrefix, index];
        const navKey = segments.join(".");
        const kids = Array.isArray(item?.children) ? item.children : [];
        const hasKids = kids.length > 0;
        const active = activeMenuNavKey === navKey;

        const rowClass = cn(
          "h-auto min-h-8 w-full justify-start gap-2 rounded-md py-1.5 pr-2 text-left text-xs font-normal leading-snug transition-colors sm:text-sm",
          "hover:bg-muted/80",
          active
            ? "bg-primary/15 font-medium text-black shadow-sm ring-1 ring-inset ring-primary/25 hover:bg-primary/20 dark:text-neutral-100"
            : cn(textClass, "hover:bg-muted/60")
        );

        if (hasKids) {
          return (
            <div key={navKey} className="flex w-full flex-col gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                style={padStyle}
                className={cn("group", rowClass, "border-l-2", active ? "border-primary" : "border-transparent")}
                onClick={() => onSelect(navKey)}
              >
                <GrantMenuItemIcon
                  pId={pIdStr}
                  menuPath={typeof item.path === "string" ? item.path : undefined}
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4",
                    active ? "text-primary" : "text-neutral-800 group-hover:text-black dark:text-neutral-300 dark:group-hover:text-neutral-100"
                  )}
                />
                <span className={cn("min-w-0 flex-1 truncate text-left", textClass)}>{item.title}</span>
              </Button>
              <div
                className={cn(
                  "flex flex-col gap-0.5",
                  depth === 0 ? "ml-1 border-l border-border/50 pl-0.5" : "ml-0.5 border-l border-border/40 pl-0.5"
                )}
              >
                <GrantPermissionMenuNav
                  items={kids}
                  depth={depth + 1}
                  pathPrefix={segments}
                  activeMenuNavKey={activeMenuNavKey}
                  onSelect={onSelect}
                />
              </div>
            </div>
          );
        }

        return (
          <div key={navKey} className="flex w-full flex-col gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSelect(navKey)}
              style={padStyle}
              className={cn("group", rowClass, "border-l-2", active ? "border-primary" : "border-transparent")}
            >
              <GrantMenuItemIcon
                pId={pIdStr}
                menuPath={typeof item.path === "string" ? item.path : undefined}
                className={cn(
                  "h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4",
                  active ? "text-primary" : "text-neutral-800 group-hover:text-black dark:text-neutral-300 dark:group-hover:text-neutral-100"
                )}
              />
              <span className={cn("min-w-0 flex-1 truncate", textClass)}>{item.title}</span>
            </Button>
          </div>
        );
      })}
    </>
  );
};

const permissionVisuals: { [key: string]: { icon: React.ElementType; className: string } } = {
  view: { icon: Eye, className: "text-blue-500" },
  read: { icon: Eye, className: "text-blue-500" },
  edit: { icon: Pencil, className: "text-amber-500" },
  update: { icon: Pencil, className: "text-amber-500" },
  delete: { icon: Trash2, className: "text-red-500" },
  run: { icon: Play, className: "text-green-500" },
  execute: { icon: Play, className: "text-green-500" },
  create: { icon: PlusCircle, className: "text-green-500" },
  generate: { icon: Sparkles, className: "text-purple-500" },
  download: { icon: Download, className: "text-slate-500" },
  use: { icon: CheckCircle, className: "text-blue-500" },
  default: { icon: CheckCircle, className: "text-gray-500" }
};

const PermissionItemNode: React.FC<{
  item: any;
  perspectiveId: string;
  assignedPermissions?: string[];
  onPermissionChange: (perspectiveId: string, permissionIds: string[], checked: boolean) => void;
  level?: number;
}> = ({ item, perspectiveId, assignedPermissions = [], onPermissionChange, level = 0 }) => {
  const safeAssigned = Array.isArray(assignedPermissions) ? assignedPermissions : [];
  const descendantPermissionIds = getAllPermissionIds(item);
  const selectedDescendantCount = descendantPermissionIds.filter(id => safeAssigned.includes(id)).length;
  const isAllSelected = descendantPermissionIds.length > 0 && selectedDescendantCount === descendantPermissionIds.length;
  const isIndeterminate = selectedDescendantCount > 0 && !isAllSelected;

  const handleSelectAllToggle = (checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      onPermissionChange(perspectiveId, descendantPermissionIds, checked);
    }
  };

  return (
    <div className={cn(level > 0 && "ml-3 border-l border-dashed border-border pl-3")}>
      <div className="flex items-center gap-2 py-1.5">
        <Checkbox
          id={`select-all-${perspectiveId}-${item.p_id ?? item.id}`}
          checked={isAllSelected}
          onCheckedChange={handleSelectAllToggle}
          ref={(el: any) => { if (el) el.indeterminate = isIndeterminate; }}
          disabled={descendantPermissionIds.length === 0}
        />
        <Label
          htmlFor={`select-all-${perspectiveId}-${item.p_id ?? item.id}`}
          className="flex cursor-pointer items-center gap-2 text-sm font-semibold leading-tight text-black dark:text-neutral-100"
        >
          <GrantMenuItemIcon
            pId={String(item?.p_id ?? item?.id ?? "")}
            menuPath={typeof item.path === "string" ? item.path : undefined}
            className="h-4 w-4 shrink-0 text-primary"
          />
          {item.title}
        </Label>
      </div>
      {Array.isArray(item.permissions) && item.permissions.length > 0 && (
        <div className="grid grid-cols-1 gap-x-3 gap-y-1.5 py-1 pl-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:pl-2">
          {item.permissions.map((p) => {
            const aid = resolvePermissionActionId(p, item);
            if (!aid) return null;
            const visual = permissionVisuals[p.action] || permissionVisuals.default;
            const IconComponent = visual.icon;
            return (
              <div key={String(aid || p.id)} className="flex items-center space-x-2">
                <Checkbox
                  id={`${perspectiveId}-${aid}`}
                  checked={!!aid && safeAssigned.includes(aid)}
                  onCheckedChange={(checked) => aid && onPermissionChange(perspectiveId, [aid], !!checked)}
                />
                <Label htmlFor={`${perspectiveId}-${aid}`} className="flex cursor-pointer items-center gap-1.5 text-xs font-normal leading-tight sm:text-sm">
                  <IconComponent className={`h-4 w-4 ${visual.className}`} />
                  <span>{p.label}</span>
                </Label>
              </div>
            );
          })}
        </div>
      )}
      {Array.isArray(item.children) && item.children.length > 0 && (
        <div className="pt-1">
          {item.children.map((child, cIdx) => (
            <PermissionItemNode
              key={String(child.p_id ?? child.id ?? `ch-${cIdx}`)}
              item={child}
              perspectiveId={perspectiveId}
              assignedPermissions={safeAssigned}
              onPermissionChange={onPermissionChange}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};


export const RoleForm: React.FC = () => {
  const { id: roleId } = useParams();
  const navigate = useNavigate();
  const roleFromNav = useLocation().state?.roles;
  const [fetchedRole, setFetchedRole] = useState<any | null>(null);

  const effectiveRole = useMemo(
    () => fetchedRole ?? roleFromNav ?? null,
    [roleFromNav, fetchedRole]
  );
  const { perspectives } = useRbacStore();
  const perspectivesList = useMemo(
    () => (Array.isArray(perspectives) ? perspectives : []),
    [perspectives]
  );
  const isEditing = !!roleId;
  const {
    data: perspectivesData,
    loadAll,
    loading: perspectivesLoading,
    error: perspectivesLoadError,
  } = useApiCrud<any>({ getAll: getAllPerspectivesApi });

  const assignablePerspectives = useMemo(() => {
    const fromApi = (Array.isArray(perspectivesData) ? perspectivesData : [])
      .map(normalizePerspectiveRow)
      .filter(Boolean) as any[];
    if (fromApi.length > 0) return fromApi;
    return perspectivesList.map(normalizePerspectiveRow).filter(Boolean) as any[];
  }, [perspectivesData, perspectivesList]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState(true);
  const [grantedPermissions, setGrantedPermissions] = useState<Record<string, string[]>>({});
  const [selectedPerspectives, setSelectedPerspectives] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [activeMenuNavKey, setActiveMenuNavKey] = useState<string | null>(null);
  const [activePerspectiveTab, setActivePerspectiveTab] = useState<string>('');
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [isRoleFormOpen, setIsRoleFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [initialFormSnapshot, setInitialFormSnapshot] = useState<string | null>(null);

  const loadAllRef = useRef(loadAll);
  loadAllRef.current = loadAll;

  // Create: perspectives only (deduped). Edit: perspectives always; role by id only if not already passed from list (avoids duplicate GET /roles/:id).
  useEffect(() => {
    if (!roleId) {
      setFetchedRole(null);
      void dedupedPerspectivesLoad(() => loadAllRef.current());
      return;
    }

    let cancelled = false;

    if (navRoleMatchesRoute(roleFromNav, roleId)) {
      setFetchedRole(null);
      void dedupedPerspectivesLoad(() => loadAllRef.current());
      return () => {
        cancelled = true;
      };
    }

    void Promise.all([
      dedupedPerspectivesLoad(() => loadAllRef.current()),
      dedupedRoleJson(String(roleId), () =>
        executeApiRequestSilent(
          () => api.get(`/roles/${roleId}`),
          "Failed to load role",
        )
      ),
    ])
      .then(([, roleData]) => {
        if (cancelled) return;
        setFetchedRole(roleData);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchedRole(null);
        toast.error("Failed to load role. Try again from the roles list.");
      });

    return () => {
      cancelled = true;
    };
  }, [roleId, roleFromNav]);

  // Create mode: clear form when not on an edit id route.
  useEffect(() => {
    if (roleId) return;
    setName("");
    setDescription("");
    setStatus(true);
    setSelectedPerspectives([]);
    setGrantedPermissions({});
    setActivePerspectiveTab("");
    setActiveMenuNavKey(null);
    setFetchedRole(null);
    setInitialFormSnapshot(null);
  }, [roleId]);

  useEffect(() => {
    if (!isEditing || !effectiveRole) return;

    const r = effectiveRole;
    setName(r.name ?? "");
    setDescription(r.description ?? "");
    setStatus(r.status !== false);

    const rolePermissions = Array.isArray(r.permissions) ? r.permissions.filter(Boolean) : [];
    const perspectivesIdList = Array.isArray(r.perspectives_id) ? r.perspectives_id : [];

    const initialSelected: any[] = [];
    const initialGranted: Record<string, string[]> = {};
    const seenTab = new Set<string>();

    if (rolePermissions.length > 0) {
      rolePermissions.forEach((rp: any, idx: number) => {
        const matched = assignablePerspectives.find((p) => matchesCatalogPerspective(p, rp));
        const entry = matched ?? buildEmbeddedPerspectiveFromRp(rp, idx);
        const tabKey = String(entry.id);
        const ids = collectActionIdsFromMenuItems(rp.menu_items);

        if (!seenTab.has(tabKey)) {
          seenTab.add(tabKey);
          initialSelected.push(entry);
          initialGranted[tabKey] = Array.from(ids);
        } else {
          const cur = new Set(initialGranted[tabKey] ?? []);
          ids.forEach((id) => cur.add(id));
          initialGranted[tabKey] = Array.from(cur);
        }
      });
    } else if (perspectivesIdList.length > 0) {
      assignablePerspectives.forEach((p) => {
        const hit = perspectivesIdList.some(
          (pid: string) =>
            String(pid) === String(p.id) || String(pid) === String((p as any).perspective_ids ?? "")
        );
        if (!hit) return;
        const tabKey = String(p.id);
        if (seenTab.has(tabKey)) return;
        seenTab.add(tabKey);
        initialSelected.push(p);
      });
    } else {
      // Roles API: top-level menu_items + permissions null (flat snapshot of a perspective menu).
      const topLevelMenu = Array.isArray(r.menu_items) ? r.menu_items : [];
      const permissionsEmpty =
        r.permissions == null ||
        (Array.isArray(r.permissions) && r.permissions.length === 0);
      if (permissionsEmpty && topLevelMenu.length > 0) {
        const candidates = findBestCatalogPerspectivesForRoleMenu(
          topLevelMenu,
          assignablePerspectives
        );
        const idsFromRole = collectActionIdsFromMenuItems(topLevelMenu);
        if (candidates.length > 0) {
          for (const p of candidates) {
            const tabKey = String(p.id);
            if (seenTab.has(tabKey)) continue;
            seenTab.add(tabKey);
            initialSelected.push(p);
            initialGranted[tabKey] = Array.from(idsFromRole);
          }
        } else {
          const tabId = "role-flat-menu";
          const emb = {
            ...buildEmbeddedPerspectiveFromRp(
              { name: r.name ?? "Role", menu_items: topLevelMenu },
              0
            ),
            id: tabId,
            menu_items: normalizeMenuItemsWithActionIds(topLevelMenu),
          };
          if (!seenTab.has(tabId)) {
            seenTab.add(tabId);
            initialSelected.push(emb);
            initialGranted[tabId] = Array.from(
              collectActionIdsFromMenuItems(emb.menu_items)
            );
          }
        }
      }
    }

    setSelectedPerspectives(initialSelected);
    setGrantedPermissions(initialGranted);
    setInitialFormSnapshot(
      serializeRoleFormSnapshot({
        name: r.name ?? "",
        description: r.description ?? "",
        status: r.status !== false,
        selectedPerspectives: initialSelected,
        grantedPermissions: initialGranted,
      }),
    );

    if (initialSelected.length > 0) {
      const first = initialSelected[0];
      setActivePerspectiveTab(String(first.id));
      const menuItems = Array.isArray(first.menu_items) ? first.menu_items : [];
      if (menuItems.length > 0) {
        setActiveMenuNavKey(firstNavPathKeyInTree(menuItems));
      } else {
        setActiveMenuNavKey(null);
      }
    } else {
      setActivePerspectiveTab("");
      setActiveMenuNavKey(null);
    }
  }, [isEditing, effectiveRole, assignablePerspectives, roleId]);

  const handlePerspectiveToggle = (p: any) => {
    const tabKey = String(p.id);
    setSelectedPerspectives((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const isSelected = list.some(
        (sp) => String(sp.id) === String(p.id) || matchesCatalogPerspective(p, sp)
      );
      const newSelection = isSelected
        ? list.filter(
            (sp) => String(sp.id) !== String(p.id) && !matchesCatalogPerspective(p, sp)
          )
        : [...list.filter((sp) => !matchesCatalogPerspective(p, sp)), p];

      setGrantedPermissions((currentPerms) => {
        const newPerms = { ...currentPerms };
        if (!isSelected) {
          const merged = new Set<string>(newPerms[tabKey] ?? []);
          list
            .filter((sp) => matchesCatalogPerspective(p, sp))
            .forEach((sp) => {
              (currentPerms[String(sp.id)] ?? []).forEach((id) => merged.add(id));
              delete newPerms[String(sp.id)];
            });
          newPerms[tabKey] = Array.from(merged);
        } else {
          delete newPerms[tabKey];
          delete newPerms[String(p.perspective_ids ?? "")];
          list
            .filter((sp) => matchesCatalogPerspective(p, sp) || String(sp.id) === tabKey)
            .forEach((sp) => delete newPerms[String(sp.id)]);
        }
        return newPerms;
      });

      if (isSelected && String(activePerspectiveTab) === tabKey) {
        setActivePerspectiveTab(newSelection[0] != null ? String(newSelection[0].id) : "");
      } else if (!isSelected && newSelection.length === 1) {
        setActivePerspectiveTab(tabKey);
      }

      return newSelection;
    });
  };

  const handlePermissionChange = (perspectiveId: string, permissionIds: string[], checked: boolean) => {

    // console.log("perspectiveId", perspectiveId)
    // console.log("permissionIds", permissionIds)
    // console.log("checked", checked)

    // return;

    setGrantedPermissions(prev => {
      const newPerms = { ...prev };
      const current = newPerms[perspectiveId] || [];
      if (checked) {
        newPerms[perspectiveId] = [...new Set([...current, ...permissionIds])];
      } else {
        newPerms[perspectiveId] = current.filter(id => !permissionIds.includes(id));
      }
      return newPerms;
    });
  };

  // Create role
  const createRole = async (roleData: any) => {
    try {
      await executeApiRequestSilent(
        () => api.post("/roles/create-role", roleData),
        "Failed to create role",
      );

      toast.success("Role created successfully!");
      setIsRoleFormOpen(false);
      navigate('/settings/roles');
    } catch (error) {
      console.error("Error creating role:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to create role. Please try again."));
    }
  };

  // Update role
  const updateRole = async (roleData: any) => {
    try {
      if (!roleId) {
        throw new Error("No role id for update");
      }

      const updateData = {
        role_id: String(roleId),
        ...roleData,
      };

      await executeApiRequestSilent(
        () => api.post("/roles/update-role", updateData),
        "Failed to update role",
      );

      toast.success("Role updated successfully!");
      setIsRoleFormOpen(false);
      navigate('/settings/roles');
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to update role. Please try again."));
    }
  };

  const handleSave = async () => {
    if (!name) {
      toast.error('Role name is required.');
      return;
    }
    const sp = Array.isArray(selectedPerspectives) ? selectedPerspectives : [];
    const perspectives_id = Array.from(
      new Set(sp.map(perspectiveIdForPayload).filter(Boolean)),
    );

    const finalPermissions: any[] = sp.map((p) => {
      const grantedIds = grantedIdsForPerspective(grantedPermissions, p);
      const isGranted = (actionId: string | undefined) =>
        actionId != null &&
        grantedIds.some((id) => String(id) === String(actionId));

      const buildMenuTree = (items: any[] | null | undefined): any[] => {
        const result: any[] = [];
        for (const item of items ?? []) {
          const grantedPermissionsForThisItem = (item?.permissions ?? []).filter((perm: any) =>
            isGranted(resolvePermissionActionId(perm, item))
          );
          const childList = item?.children;
          const children = Array.isArray(childList) && childList.length > 0 ? buildMenuTree(childList) : [];

          if (grantedPermissionsForThisItem?.length > 0 || children?.length > 0) {
            result.push({
              p_id: item.p_id,
              title: item.title,
              icon: item.icon,
              path: item.path,
              permissions: grantedPermissionsForThisItem.map((perm: any) => ({
                ...perm,
                action_id: resolvePermissionActionId(perm, item),
              })),
              children: children.length > 0 ? children : [],
            });
          }
        }
        return result;
      };

      return {
        name: p.name,
        icon: p?.icon,
        org_id: p?.org_id,
        org_name: p?.org_name,
        perspective_id: p?.perspective_id,
        perspective_ids: p?.perspective_ids ?? p?.perspective_id ?? "",
        platform: p?.platform,
        description: p?.description,
        menu_items: buildMenuTree(Array.isArray(p?.menu_items) ? p.menu_items : []),
      };
    }).filter((p) => Array.isArray(p.menu_items) && p.menu_items.length > 0);

    const roleData: any = {
      name,
      description,
      status,
      perspectives_id,
      permissions: finalPermissions,
      allowed_pages: [],
      menu_items: [],
    };

    console.log("roleData", roleData);

    // return;
    if (isEditing && roleId) {
      await updateRole({ ...roleData, id: roleId });
    } else {
      await createRole(roleData);
    }
    // toast.success(`Role ${isEditing ? 'updated' : 'created'} successfully!`);
    // navigate('/settings/roles');
  };

  useEffect(() => {
    const sp = Array.isArray(selectedPerspectives) ? selectedPerspectives : [];
    const currentPerspective = sp.find(
      (p) => String(p.id) === String(activePerspectiveTab)
    );
    const menuItems = Array.isArray(currentPerspective?.menu_items)
      ? currentPerspective.menu_items
      : [];
    if (currentPerspective && menuItems.length > 0) {
      const safeMenuItems = Array.isArray(menuItems) ? menuItems : [];
      const currentActiveItemExists = menuItemExistsAtPath(safeMenuItems, activeMenuNavKey);
      if (!currentActiveItemExists) {
        setActiveMenuNavKey(firstNavPathKeyInTree(safeMenuItems));
      }
    } else {
      setActiveMenuNavKey(null);
    }
  }, [activePerspectiveTab, selectedPerspectives, activeMenuNavKey]);

  const headerRoleTitle =
    name.trim() ||
    (isEditing ? (effectiveRole?.name ? String(effectiveRole.name) : "Role") : "New role");

  const currentFormSnapshot = useMemo(
    () =>
      serializeRoleFormSnapshot({
        name,
        description,
        status,
        selectedPerspectives,
        grantedPermissions,
      }),
    [name, description, status, selectedPerspectives, grantedPermissions],
  );

  const hasFormChanges =
    !isEditing || initialFormSnapshot === null || currentFormSnapshot !== initialFormSnapshot;

  return (
    <div className="flex h-svh max-h-svh flex-col overflow-hidden bg-muted/40">
      <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-2 py-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-white bg-primary">
            <Link to="/settings/roles" title="Back to roles" aria-label="Back to roles">
              <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
          <h1 className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
            {headerRoleTitle}
          </h1>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasFormChanges}
          size="sm"
          className="h-7 shrink-0 px-3 text-xs disabled:cursor-not-allowed sm:h-8 sm:text-sm"
        >
          Save Role
        </Button>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-1 overflow-hidden p-0 py-1 lg:grid-cols-[minmax(260px,320px)_1fr] lg:items-stretch lg:gap-1 max-w-full">
        <aside className="flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden lg:h-full">
          <Card className="shrink-0 gap-0 border-border/80 py-0 shadow-sm">
            <CardHeader className="space-y-0 border-b border-border/60 px-2 pb-0 gap-0 [.border-b]:pb-2 pt-2">
              <CardTitle className="text-base font-semibold tracking-tight">Role details</CardTitle>
              <CardDescription className="text-xs leading-normal text-muted-foreground">
                Name, description, and active state.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-2 pb-2 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="role-name" className="text-xs font-medium text-foreground">
                  Role name
                </Label>
                <Input
                  id="role-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Admin"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-desc" className="text-xs font-medium text-foreground">
                  Description
                </Label>
                <Input
                  id="role-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short summary"
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border/80 bg-muted/40 px-3 py-2">
                <div className="min-w-0 space-y-0">
                  <Label htmlFor="role-status" className="text-xs font-medium">
                    Active
                  </Label>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Inactive roles cannot be assigned.
                  </p>
                </div>
                <Switch id="role-status" checked={status} onCheckedChange={setStatus} className="shrink-0" />
              </div>
            </CardContent>
          </Card>
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/80 py-0 shadow-sm">
            <CardHeader className="shrink-0 space-y-0 border-b border-border/60 px-2 pb-0 gap-0 [.border-b]:pb-2 pt-2">
              <CardTitle className="text-base font-semibold tracking-tight">Assign perspectives</CardTitle>
              <CardDescription className="text-xs leading-normal text-muted-foreground">
                Menu templates from the perspectives API.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-2 pt-1">
              {perspectivesLoading ? (
                <div className="flex min-h-[10rem] flex-1 items-center justify-center rounded-md border border-dashed border-border/80 bg-muted/30 px-3 py-6 text-xs text-muted-foreground">
                  Loading…
                </div>
              ) : perspectivesLoadError ? (
                <div className="shrink-0 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {perspectivesLoadError}
                </div>
              ) : assignablePerspectives.length === 0 ? (
                <div className="flex min-h-[10rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-border/80 bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
                  <span>No templates found.</span>
                  <span className="text-[11px]">Check admin or API connection.</span>
                </div>
              ) : (
                <ScrollArea className="min-h-0 flex-1 rounded-md border border-border/80 bg-card [&_[data-slot=scroll-area-scrollbar]]:hidden">
                  <div className="flex flex-col gap-2.5 p-2 pr-2 pb-3">
                    {assignablePerspectives.map((p) => {
                    const spList = Array.isArray(selectedPerspectives) ? selectedPerspectives : [];
                      const isSelected = spList.some(
                        (sp) =>
                          String(sp.id) === String(p.id) || matchesCatalogPerspective(p, sp)
                      );
                      const displayName = p.name ?? p.title ?? "Untitled";
                      const iconName = p.icon ?? "LayoutTemplate";
                    return (
                      <div
                          key={String(p.id)}
                          role="button"
                          tabIndex={0}
                        onClick={() => handlePerspectiveToggle(p)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handlePerspectiveToggle(p);
                            }
                          }}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-md border-l-2 border-transparent px-2.5 py-2.5 text-left outline-none ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                            "hover:bg-muted/70",
                            isSelected &&
                              "border-primary bg-primary/15 font-medium text-black shadow-sm ring-1 ring-inset ring-primary/25 dark:text-neutral-100"
                          )}
                      >
                        <Checkbox
                          checked={isSelected}
                          id={`perspective-${p.id}`}
                            aria-label={`Select ${displayName}`}
                            className="pointer-events-none mt-0.5 shrink-0"
                          />
                          <ForwardedIconComponent
                            name={iconName}
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0",
                              isSelected ? "text-primary" : "text-neutral-600 dark:text-neutral-400"
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <Label
                              htmlFor={`perspective-${p.id}`}
                              className="cursor-pointer text-xs font-medium leading-tight text-black sm:text-sm dark:text-neutral-100"
                            >
                              {displayName}
                        </Label>
                            {p.description ? (
                              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-neutral-600 dark:text-neutral-400">
                                {p.description}
                              </p>
                            ) : null}
                          </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              )}
            </CardContent>
          </Card>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:h-full">
          <Card className="flex h-full min-h-0 flex-1 flex-col gap-0 border-border/80 py-0 shadow-sm">
          <CardHeader className="shrink-0 space-y-0 border-b border-border/60 px-2 pb-0 gap-0 [.border-b]:pb-2 pt-2">
          <CardTitle className="text-sm font-semibold tracking-tight sm:text-base">Grant permissions</CardTitle>
              <CardDescription className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                Pick a menu entry, then toggle permissions for this perspective.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-2 pt-1.5">
              {Array.isArray(selectedPerspectives) && selectedPerspectives.length > 0 ? (
                <Tabs
                  value={activePerspectiveTab}
                  onValueChange={setActivePerspectiveTab}
                  className="flex min-h-0 w-full flex-1 flex-col gap-0"
                >
                  <div className="-mx-0.5 w-full overflow-x-auto pb-1">
                    <TabsList className="inline-flex h-auto min-h-8 flex-wrap justify-start gap-0.5 p-1 sm:flex-nowrap">
                      {selectedPerspectives.map((p) => (
                        <TabsTrigger
                          key={p.id}
                          value={String(p.id)}
                          className="max-w-[10rem] shrink-0 truncate px-2.5 py-1 text-xs sm:max-w-none sm:px-3 sm:text-sm"
                        >
                          {p.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                  {selectedPerspectives.map((p) => {
                    const tabMenuItems = Array.isArray(p.menu_items) ? p.menu_items : [];
                    const activeMenuItem =
                      activeMenuNavKey != null ? getMenuItemByPath(tabMenuItems, activeMenuNavKey) : null;
                    return (
                    <TabsContent
                      key={p.id}
                      value={String(p.id)}
                      className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
                    >
                      <div className="flex min-h-0 flex-1 overflow-hidden rounded-md border border-border/80 bg-background">
                        <ScrollArea className="h-full max-h-full min-h-0 w-[12.5rem] shrink-0 border-r border-border/60 bg-muted/30 sm:w-52 md:w-56 [&_[data-slot=scroll-area-scrollbar]]:hidden">
                          <div className="flex flex-col gap-0.5 p-1.5 pb-2">
                            <GrantPermissionMenuNav
                              items={tabMenuItems}
                              depth={0}
                              pathPrefix={[]}
                              activeMenuNavKey={activeMenuNavKey}
                              onSelect={(key) => setActiveMenuNavKey(key)}
                            />
                          </div>
                        </ScrollArea>
                        <ScrollArea className="h-full max-h-full min-h-0 min-w-0 flex-1">
                          <div className="p-2.5 sm:p-3.5">
                            {activeMenuItem ? (
                              <PermissionItemNode
                                item={activeMenuItem}
                                perspectiveId={String(p.id)}
                                assignedPermissions={grantedIdsForPerspective(grantedPermissions, p)}
                                onPermissionChange={handlePermissionChange}
                              />
                            ) : (
                              <div className="flex min-h-[12rem] items-center justify-center px-2 text-center text-xs text-muted-foreground sm:text-sm">
                                Select a menu item to edit permissions.
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    </TabsContent>
                    );
                  })}
                </Tabs>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center text-muted-foreground">
                  <p className="text-sm font-medium text-foreground/90">No perspective selected</p>
                  <p className="max-w-sm text-xs leading-relaxed sm:text-sm">
                    Select one or more templates on the left.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};
