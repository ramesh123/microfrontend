import React, { useMemo } from 'react';
import { useRbacStore } from '@/stores/useRBACStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import ForwardedIconComponent from '@/components/common/genericIconComponent';

type PreviewTab = {
  tabKey: string;
  perspective: any;
  grantedPermissionIds: string[];
  showAll: boolean;
};

const resolvePermissionActionId = (perm: any, menuItem: any): string => {
  if (perm?.action_id != null && String(perm.action_id).trim() !== '') {
    return String(perm.action_id);
  }
  const action = perm?.action;
  const hostId = menuItem?.p_id ?? menuItem?.id;
  if (action && hostId) return `${action}-${hostId}`;
  if (action && perm?.resource) return `${action}-${perm.resource}`;
  return '';
};

const normalizeMenuItemsWithActionIds = (items: any[] | null | undefined): any[] => {
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
};

const permissionMatchesGrantedIds = (
  permission: any,
  item: any,
  grantedPermissionIds: string[]
): boolean => {
  const resolvedId = resolvePermissionActionId(permission, item);
  const fallbackId = permission?.id != null ? String(permission.id) : '';
  const resourceKey =
    permission?.action && permission?.resource
      ? `${permission.action}-${permission.resource}`
      : '';

  return (
    (resolvedId && grantedPermissionIds.includes(resolvedId)) ||
    (fallbackId && grantedPermissionIds.includes(fallbackId)) ||
    (resourceKey && grantedPermissionIds.includes(resourceKey)) ||
    (permission?.action && grantedPermissionIds.includes(String(permission.action)))
  );
};

const getFilteredMenuForPreview = (
  menuItems: any[],
  grantedPermissionIds: string[],
  showAll: boolean
): any[] => {
  const normalizedMenu = normalizeMenuItemsWithActionIds(menuItems);
  if (showAll) {
    return normalizedMenu;
  }

  const result: any[] = [];
  for (const item of normalizedMenu) {
    const perms = Array.isArray(item.permissions) ? item.permissions : [];
    const hasDirectPermission = perms.some((permission: any) =>
      permissionMatchesGrantedIds(permission, item, grantedPermissionIds)
    );
    const visibleChildren = Array.isArray(item.children)
      ? getFilteredMenuForPreview(item.children, grantedPermissionIds, false)
      : [];

    if (hasDirectPermission || visibleChildren.length > 0 || (perms.length === 0 && !item.children)) {
      result.push({
        ...item,
        children: visibleChildren.length > 0 ? visibleChildren : undefined,
      });
    }
  }

  return result;
};

const getPermissionBadgeClass = (action: string): string => {
  const baseClass = "text-xs font-medium";
  switch (action.toLowerCase()) {
    case 'view': case 'read': return `${baseClass} bg-blue-100 text-blue-800 border-transparent dark:bg-blue-900/50 dark:text-blue-300`;
    case 'create': case 'generate': return `${baseClass} bg-green-100 text-green-800 border-transparent dark:bg-green-900/50 dark:text-green-300`;
    case 'edit': case 'update': return `${baseClass} bg-yellow-100 text-yellow-800 border-transparent dark:bg-yellow-900/50 dark:text-yellow-300`;
    case 'delete': return `${baseClass} bg-red-100 text-red-800 border-transparent dark:bg-red-900/50 dark:text-red-300`;
    case 'execute': case 'run': case 'use': return `${baseClass} bg-purple-100 text-purple-800 border-transparent dark:bg-purple-900/50 dark:text-purple-300`;
    default: return `${baseClass} bg-gray-100 text-gray-800 border-transparent dark:bg-gray-700 dark:text-gray-300`;
  }
};

const getMenuItemKey = (item: any, index: number): string =>
  String(item?.id ?? item?.p_id ?? item?.path ?? item?.title ?? item?.label ?? index);

const PreviewMenuItem: React.FC<{
  item: any;
  level: number;
  grantedPermissionIds: string[];
  showAll: boolean;
}> = ({ item, level, grantedPermissionIds, showAll }) => {
  const itemPerms = Array.isArray(item.permissions) ? item.permissions : [];
  const grantedPermissionsForItem = showAll
    ? itemPerms
    : itemPerms.filter((permission: any) =>
        permissionMatchesGrantedIds(permission, item, grantedPermissionIds)
      );

  return (
    <>
      <div style={{ paddingLeft: `${level * 1.25}rem` }} className="flex items-start gap-3 py-2 text-sm">
        <ForwardedIconComponent name={item.icon} className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <span className="font-medium">{item.title ?? item.label ?? item.name}</span>
          {grantedPermissionsForItem.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {grantedPermissionsForItem.map((permission: any, index: number) => (
                <Badge
                  key={
                    permission.id ??
                    permission.action_id ??
                    `${permission.action}-${permission.resource ?? index}`
                  }
                  className={cn(getPermissionBadgeClass(String(permission.action ?? '')))}
                >
                  {permission.action}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      {item.children && (
        <div>
          {item.children.map((child: any, index: number) => (
            <PreviewMenuItem
              key={getMenuItemKey(child, index)}
              item={child}
              level={level + 1}
              grantedPermissionIds={grantedPermissionIds}
              showAll={showAll}
            />
          ))}
        </div>
      )}
    </>
  );
};

interface RolePreviewDialogProps {
  role: any | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

function getPermissionsByPerspective(role: any): Record<string, string[]> {
  const raw = role?.permissions;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, string[]>;
  }
  return {};
}

function normalizePerspectiveRow(p: any): any | null {
  if (!p || typeof p !== 'object') return null;
  const rawId = p.id ?? p.perspective_id ?? p.perspective_ids ?? p.unique_id ?? p.p_id;
  if (rawId == null || rawId === '') return null;
  return { ...p, id: rawId };
}

function normalizedPerspectiveKeyFromRolePermission(rp: any): string | null {
  const raw = rp?.perspective_id ?? rp?.perspectiveId ?? rp?.perspective_ids;
  if (raw == null) return null;
  const value = String(raw).trim();
  return value === '' ? null : value;
}

function orgIdMatchesCatalog(pOrg: any, rpOrg: any): boolean {
  const roleOrgId = String(rpOrg ?? '').trim();
  if (roleOrgId === '') return true;
  if (Array.isArray(pOrg)) {
    return pOrg.map(String).some((value) => String(value).trim() === roleOrgId);
  }
  return String(pOrg ?? '').trim() === roleOrgId;
}

function matchesCatalogPerspective(p: any, rp: any): boolean {
  const key = normalizedPerspectiveKeyFromRolePermission(rp);
  if (key) {
    return (
      String(p.id) === key ||
      String(p.perspective_id ?? '') === key ||
      String(p.perspective_ids ?? '') === key
    );
  }

  const perspectiveName = String(p?.name ?? '').trim().toLowerCase();
  const rolePerspectiveName = String(rp?.name ?? '').trim().toLowerCase();
  if (!rolePerspectiveName || perspectiveName !== rolePerspectiveName) return false;
  return orgIdMatchesCatalog(p?.org_id, rp?.org_id);
}

function collectActionIdsFromMenuItems(items: any[] | null | undefined): Set<string> {
  const ids = new Set<string>();

  const walk = (menuList: any[]) => {
    for (const item of menuList) {
      (item?.permissions ?? []).forEach((permission: any) => {
        const resolvedId = resolvePermissionActionId(permission, item);
        if (resolvedId) ids.add(resolvedId);
      });

      const children = item?.children;
      if (Array.isArray(children) && children.length > 0) {
        walk(children);
      }
    }
  };

  if (Array.isArray(items)) walk(items);
  return ids;
}

function flattenMenuPIds(items: any[] | null | undefined): Set<string> {
  const ids = new Set<string>();

  const walk = (menuList: any[]) => {
    for (const item of menuList) {
      if (item?.p_id) ids.add(String(item.p_id));
      const children = item?.children;
      if (Array.isArray(children) && children.length > 0) {
        walk(children);
      }
    }
  };

  if (Array.isArray(items)) walk(items);
  return ids;
}

function findBestCatalogPerspectivesForRoleMenu(roleMenu: any[], catalog: any[]): any[] {
  const rolePids = flattenMenuPIds(roleMenu);
  if (rolePids.size === 0 || !Array.isArray(catalog) || catalog.length === 0) return [];

  let best: { perspective: any; score: number; catalogSize: number } | null = null;

  for (const perspective of catalog) {
    const catalogMenu = perspective.menu_items ?? perspective.menuItems;
    const catalogPids = flattenMenuPIds(catalogMenu);
    let score = 0;

    for (const pid of rolePids) {
      if (catalogPids.has(pid)) score += 1;
    }

    if (!best || score > best.score) {
      best = { perspective, score, catalogSize: catalogPids.size };
    }
  }

  if (!best || best.score <= 0) return [];

  const minOverlap = Math.max(1, Math.min(8, Math.ceil(rolePids.size * 0.02)));
  const catalogCoverage = best.catalogSize > 0 ? best.score / best.catalogSize : 0;
  const strongCatalogHit = catalogCoverage >= 0.5 && best.score >= 2;
  const enoughAbsoluteHits = best.score >= minOverlap || best.score >= 5;

  if (!strongCatalogHit && !enoughAbsoluteHits) return [];
  return [best.perspective];
}

function buildEmbeddedPerspectiveFromRolePermission(rolePermission: any, index: number): any {
  const safeName = String(rolePermission?.name ?? 'perspective').replace(/[^a-zA-Z0-9_-]+/g, '-');
  const tabId = `role-embedded-${index}-${safeName}`;

  return {
    ...rolePermission,
    id: tabId,
    perspective_id: normalizedPerspectiveKeyFromRolePermission(rolePermission) ?? tabId,
    name: rolePermission?.name ?? 'Perspective',
    icon: rolePermission?.icon ?? 'LayoutTemplate',
    description: rolePermission?.description,
    platform: rolePermission?.platform,
    org_id: rolePermission?.org_id,
    org_name: rolePermission?.org_name,
    menu_items: normalizeMenuItemsWithActionIds(rolePermission?.menu_items),
  };
}

function perspectiveMatchesAssignment(p: any, assignedIds: string[]): boolean {
  const normalized = assignedIds.map(String);
  const pid = String(p?.id ?? '');
  const slug = p?.perspective_ids != null ? String(p.perspective_ids) : '';
  return normalized.some((aid) => aid === pid || (slug && aid === slug));
}

function buildPreviewTabs(role: any, catalogPerspectives: any[]): PreviewTab[] {
  if (!role) return [];

  const tabs: PreviewTab[] = [];
  const tabIndexByKey = new Map<string, number>();

  const addTab = (entry: any, grantedPermissionIds: string[], showAll = false) => {
    const tabKey = String(entry?.id ?? entry?.perspective_id ?? entry?.perspective_ids ?? tabs.length);
    const menuItems = Array.isArray(entry?.menu_items)
      ? entry.menu_items
      : Array.isArray(entry?.menuItems)
        ? entry.menuItems
        : [];

    const normalizedMenu = normalizeMenuItemsWithActionIds(menuItems);
    const safeGrantedIds = Array.from(
      new Set((Array.isArray(grantedPermissionIds) ? grantedPermissionIds : []).filter(Boolean).map(String))
    );
    const existingIndex = tabIndexByKey.get(tabKey);

    if (existingIndex != null) {
      const existing = tabs[existingIndex];
      existing.grantedPermissionIds = Array.from(
        new Set([...existing.grantedPermissionIds, ...safeGrantedIds])
      );
      existing.showAll = existing.showAll || showAll;
      if (
        (!Array.isArray(existing.perspective?.menu_items) || existing.perspective.menu_items.length === 0) &&
        normalizedMenu.length > 0
      ) {
        existing.perspective = {
          ...existing.perspective,
          menu_items: normalizedMenu,
        };
      }
      return;
    }

    tabIndexByKey.set(tabKey, tabs.length);
    tabs.push({
      tabKey,
      perspective: {
        ...entry,
        id: entry?.id ?? tabKey,
        menu_items: normalizedMenu,
      },
      grantedPermissionIds: safeGrantedIds,
      showAll,
    });
  };

  const permissionsByPerspective = getPermissionsByPerspective(role);
  const objectPermissionKeys = Object.keys(permissionsByPerspective);
  if (objectPermissionKeys.length > 0) {
    catalogPerspectives.forEach((perspective) => {
      if (!perspectiveMatchesAssignment(perspective, objectPermissionKeys)) return;

      const perspectiveId = String(perspective.id ?? '');
      const slug = perspective.perspective_ids != null ? String(perspective.perspective_ids) : '';
      const grantedPermissionIds = (
        permissionsByPerspective[perspectiveId] ??
        (slug ? permissionsByPerspective[slug] : undefined) ??
        []
      ) as string[];

      addTab(perspective, grantedPermissionIds, false);
    });

    if (tabs.length > 0) return tabs;
  }

  const rolePermissions = Array.isArray(role?.permissions) ? role.permissions.filter(Boolean) : [];
  if (rolePermissions.length > 0) {
    rolePermissions.forEach((rolePermission: any, index: number) => {
      const roleMenu = Array.isArray(rolePermission?.menu_items) ? rolePermission.menu_items : [];
      const grantedPermissionIds = Array.from(collectActionIdsFromMenuItems(roleMenu));
      const useEmbeddedSnapshot = roleMenu.length > 0 && grantedPermissionIds.length === 0;
      const matchedPerspective = useEmbeddedSnapshot
        ? null
        : catalogPerspectives.find((perspective) =>
            matchesCatalogPerspective(perspective, rolePermission)
          );
      const entry =
        matchedPerspective ?? buildEmbeddedPerspectiveFromRolePermission(rolePermission, index);

      addTab(entry, grantedPermissionIds, useEmbeddedSnapshot);
    });

    if (tabs.length > 0) return tabs;
  }

  const perspectiveIds = Array.isArray(role?.perspectives_id) ? role.perspectives_id.map(String) : [];
  if (perspectiveIds.length > 0) {
    catalogPerspectives.forEach((perspective) => {
      if (!perspectiveMatchesAssignment(perspective, perspectiveIds)) return;
      const fullPerspectivePermissionIds = Array.from(
        collectActionIdsFromMenuItems(perspective.menu_items ?? perspective.menuItems)
      );
      addTab(perspective, fullPerspectivePermissionIds, true);
    });

    if (tabs.length > 0) return tabs;
  }

  const topLevelMenu = Array.isArray(role?.menu_items) ? role.menu_items : [];
  const permissionsEmpty =
    role?.permissions == null ||
    (Array.isArray(role?.permissions) && role.permissions.length === 0);

  if (permissionsEmpty && topLevelMenu.length > 0) {
    const grantedPermissionIds = Array.from(collectActionIdsFromMenuItems(topLevelMenu));

    if (grantedPermissionIds.length > 0) {
      const candidates = findBestCatalogPerspectivesForRoleMenu(topLevelMenu, catalogPerspectives);
      if (candidates.length > 0) {
        candidates.forEach((perspective) => addTab(perspective, grantedPermissionIds, false));
        if (tabs.length > 0) return tabs;
      }
    }

    addTab(
      {
        ...buildEmbeddedPerspectiveFromRolePermission(
          { name: role?.name ?? 'Role', description: role?.description, menu_items: topLevelMenu },
          0
        ),
        id: 'role-flat-menu',
      },
      grantedPermissionIds,
      true
    );
  }

  return tabs;
}

export const RolePreviewDialog: React.FC<RolePreviewDialogProps> = ({ role, isOpen, onOpenChange }) => {
  const allPerspectives = useRbacStore((state) => state.perspectives);
  const catalogPerspectives = useMemo(
    () =>
      (Array.isArray(allPerspectives) ? allPerspectives : [])
        .map(normalizePerspectiveRow)
        .filter(Boolean) as any[],
    [allPerspectives]
  );
  const previewTabs = useMemo(
    () => buildPreviewTabs(role, catalogPerspectives),
    [catalogPerspectives, role]
  );
  const dialogKey = String(role?.id ?? role?.name ?? 'role-preview');

  if (!role) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-3xl gap-2">
        <DialogHeader>
          <DialogTitle>Preview: {role.name}</DialogTitle>
          <DialogDescription>
            {role.description ?? 'Review the perspectives and permissions assigned to this role.'}
          </DialogDescription>
        </DialogHeader>
        {previewTabs.length > 0 ? (
          <Tabs key={dialogKey} defaultValue={previewTabs[0].tabKey} className="w-full">
            <TabsList className="mb-2 flex h-auto w-full flex-wrap justify-start gap-1">
              {previewTabs.map((tab) => (
                <TabsTrigger key={tab.tabKey} value={tab.tabKey}>
                  {tab.perspective?.name ?? 'Perspective'}
                </TabsTrigger>
              ))}
            </TabsList>
            {previewTabs.map((tab) => {
              const rawMenu = tab.perspective?.menu_items ?? tab.perspective?.menuItems;
              const menuTree = Array.isArray(rawMenu) ? rawMenu : [];
              const filteredMenu = getFilteredMenuForPreview(
                menuTree,
                tab.grantedPermissionIds,
                tab.showAll
              );

              return (
                <TabsContent key={tab.tabKey} value={tab.tabKey}>
                  <div className="py-0">
                    <h4 className="font-semibold mb-3">Permissions Included:</h4>
                    <ScrollArea className="h-96 rounded-md border p-4">
                      {filteredMenu.length > 0 ? (
                        filteredMenu.map((item: any, index: number) => (
                          <PreviewMenuItem
                            key={getMenuItemKey(item, index)}
                            item={item}
                            level={0}
                            grantedPermissionIds={tab.grantedPermissionIds}
                            showAll={tab.showAll}
                          />
                        ))
                      ) : (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                          No permissions granted for this perspective.
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            This role has no perspectives assigned.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
