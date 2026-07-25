import api from "./api";
import { executeApiRequestSilent } from "@/utils/exceptionHelper";

export const ACL_RESOURCE_TYPES = ["Location", "Device", "Sensor", "Tag"] as const;
export type AclResourceType = (typeof ACL_RESOURCE_TYPES)[number];

/** API expects Location; map legacy Organization responses. */
export function normalizeResourceType(value: unknown): AclResourceType | null {
  const raw = asString(value);
  if (raw === "Organization") return "Location";
  if ((ACL_RESOURCE_TYPES as readonly string[]).includes(raw)) {
    return raw as AclResourceType;
  }
  return null;
}

export type UserAclEntry = {
  acl_id: string;
  user_id?: string;
  resource_id: string[];
  resource_type: AclResourceType;
};

const asString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

function isAclLikeObject(value: Record<string, unknown>): boolean {
  if (!normalizeResourceType(value.resource_type ?? value.resourceType)) return false;
  return (
    Array.isArray(value.resource_id ?? value.resource_ids ?? value.resourceIds) ||
    asString(value.resource_id ?? value.resource_ids) !== "" ||
    asString(value.acl_id ?? value.id ?? value._id) !== ""
  );
}

export function extractAclArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (!raw || typeof raw !== "object") return [];
  const root = raw as Record<string, unknown>;

  if (isAclLikeObject(root)) return [root];

  if (Array.isArray(root.data)) return root.data as Record<string, unknown>[];

  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    const inner = root.data as Record<string, unknown>;
    if (isAclLikeObject(inner)) return [inner];
    const nested: Record<string, unknown>[] = [];
    if (Array.isArray(inner.data)) nested.push(...(inner.data as Record<string, unknown>[]));
    if (Array.isArray(inner.acls)) nested.push(...(inner.acls as Record<string, unknown>[]));
    if (Array.isArray(inner.items)) nested.push(...(inner.items as Record<string, unknown>[]));
    if (Array.isArray(inner.content)) nested.push(...(inner.content as Record<string, unknown>[]));
    if (nested.length > 0) return nested;
    return extractAclArray(inner);
  }

  if (Array.isArray(root.acls)) return root.acls as Record<string, unknown>[];
  if (Array.isArray(root.items)) return root.items as Record<string, unknown>[];
  return [];
}

/** One ACL row per resource type; merges resource_id across multiple API rows. */
export function mergeAclEntriesByType(entries: UserAclEntry[]): UserAclEntry[] {
  const byType = new Map<AclResourceType, UserAclEntry>();
  entries.forEach((entry) => {
    const existing = byType.get(entry.resource_type);
    if (!existing) {
      byType.set(entry.resource_type, {
        ...entry,
        resource_id: [...entry.resource_id],
      });
      return;
    }
    const mergedIds = [
      ...new Set([...existing.resource_id, ...entry.resource_id].map(String).filter(Boolean)),
    ];
    byType.set(entry.resource_type, {
      ...existing,
      acl_id: existing.acl_id || entry.acl_id,
      user_id: existing.user_id || entry.user_id,
      resource_id: mergedIds,
    });
  });
  return Array.from(byType.values());
}

export function normalizeAclEntry(
  raw: Record<string, unknown>,
): UserAclEntry | null {
  const resourceType = normalizeResourceType(
    raw.resource_type ?? raw.resourceType,
  );
  if (!resourceType) return null;

  const rawResourceIds = raw.resource_id ?? raw.resource_ids ?? raw.resourceIds;
  const resourceIds = Array.isArray(rawResourceIds)
    ? rawResourceIds.map(String).filter(Boolean)
    : asString(rawResourceIds)
      ? [asString(rawResourceIds)]
      : [];

  const aclId = asString(raw.acl_id ?? raw.id ?? raw._id);
  if (!aclId && resourceIds.length === 0) return null;

  const nestedUser =
    raw.user && typeof raw.user === "object" && !Array.isArray(raw.user)
      ? (raw.user as Record<string, unknown>)
      : null;

  return {
    acl_id: aclId,
    user_id: asString(
      raw.user_id ?? raw.userId ?? nestedUser?.id ?? nestedUser?.user_id,
    ),
    resource_id: resourceIds,
    resource_type: resourceType,
  };
}

function aclEntryMatchesUser(entry: UserAclEntry, userId: string): boolean {
  const target = userId.trim();
  if (!target) return true;
  const entryUser = String(entry.user_id ?? "").trim();
  if (!entryUser) return false;
  if (entryUser === target) return true;
  const a = Number(entryUser);
  const b = Number(target);
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}

/** List ACL entries (optionally filtered to one user on the client). */
export async function fetchAllAclEntries(
  userId?: string,
): Promise<UserAclEntry[]> {
  const result = await executeApiRequestSilent<unknown>(
    () => api.get("/acl-entries", { params: { skip: 0, limit: 100 } }),
    "Failed to load ACL entries",
  );
  const entries = extractAclArray(result)
    .map(normalizeAclEntry)
    .filter((entry): entry is UserAclEntry => !!entry);

  const id = String(userId ?? "").trim();
  if (!id) return entries;
  const forUser = entries.filter((entry) => aclEntryMatchesUser(entry, id));
  if (forUser.length > 0) return forUser;
  if (entries.every((entry) => !String(entry.user_id ?? "").trim())) {
    return entries;
  }
  return forUser;
}

/** Load ACL configuration for one user via POST /acl-entries/get-id. */
export async function fetchUserAclsById(
  userId: string,
): Promise<UserAclEntry[]> {
  const id = String(userId ?? "").trim();
  if (!id) return [];

  try {
    const result = await executeApiRequestSilent<unknown>(
      () => api.post("/acl-entries/get-id", { user_id: id }),
      "Failed to load user permissions",
    );
    return extractAclArray(result)
      .map(normalizeAclEntry)
      .filter((entry): entry is UserAclEntry => !!entry);
  } catch {
    const fallback = await executeApiRequestSilent<unknown>(
      () => api.get("/acl-entries", { params: { skip: 0, limit: 500 } }),
      "Failed to load user permissions",
    );
    return extractAclArray(fallback)
      .map(normalizeAclEntry)
      .filter(
        (entry): entry is UserAclEntry =>
          !!entry && String(entry.user_id ?? "") === id,
      );
  }
}

export async function saveUserAclForType(
  userId: string,
  existing: UserAclEntry | undefined,
  resourceType: AclResourceType,
  resourceIds: string[],
): Promise<UserAclEntry | null> {
  const cleanIds = resourceIds.map(String).filter(Boolean);

  if (existing?.acl_id && cleanIds.length === 0) {
    await executeApiRequestSilent(
      () => api.post("/acl-entries/delete-acl", { acl_id: existing.acl_id }),
      `Failed to delete ${resourceType.toLowerCase()} permissions`,
    );
    return null;
  }

  if (existing?.acl_id) {
    await executeApiRequestSilent(
      () =>
        api.post("/acl-entries/update-acl", {
          acl_id: existing.acl_id,
          resource_id: cleanIds,
          resource_type: resourceType,
        }),
      `Failed to update ${resourceType.toLowerCase()} permissions`,
    );
    return { ...existing, resource_id: cleanIds };
  }

  if (cleanIds.length === 0) return null;

  const result = await executeApiRequestSilent<unknown>(
    () =>
      api.post("/acl-entries/create-acls", {
        user_id: userId,
        acls: [{ resource_id: cleanIds, resource_type: resourceType }],
      }),
    `Failed to create ${resourceType.toLowerCase()} permissions`,
  );

  const created = extractAclArray(result)
    .map(normalizeAclEntry)
    .find((e) => e?.resource_type === resourceType);

  const root =
    result && typeof result === "object" ? (result as Record<string, unknown>) : {};
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const aclId = asString(
    created?.acl_id ??
      data.acl_id ??
      data.id ??
      data._id ??
      root.acl_id ??
      root.id,
  );

  if (created) {
    return { ...created, acl_id: aclId || created.acl_id, resource_id: cleanIds };
  }

  return {
    acl_id: aclId,
    user_id: userId,
    resource_id: cleanIds,
    resource_type: resourceType,
  };
}
