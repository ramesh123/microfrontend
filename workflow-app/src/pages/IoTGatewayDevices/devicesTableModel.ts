import { format } from "date-fns";

import { deviceRowId, entityIdFromTb, type DeviceInfoRecord } from "@/controllers/API/devicesApi";

export type DeviceTableRow = {
  id: string;
  raw: DeviceInfoRecord;
  name: string;
  label: string;
  profile: string;
  createdDisplay: string;
  createdSortKey: number;
  active: boolean;
  customer: string;
  isPublic: boolean;
  isGateway: boolean;
};

const TB_PUBLIC_CUSTOMER_ID = "13814000-1dd2-11b2-8080-808080808080";

function formatCreated(row: DeviceInfoRecord): string {
  const t = row.createdTime ?? row.created_time;
  if (typeof t === "number" && Number.isFinite(t)) {
    try {
      return format(t, "yyyy-MM-dd HH:mm:ss");
    } catch {
      return String(t);
    }
  }
  if (typeof t === "string" && t) return t;
  return "—";
}

function createdSortKey(row: DeviceInfoRecord): number {
  const t = row.createdTime ?? row.created_time;
  if (typeof t === "number" && Number.isFinite(t)) return t;
  if (typeof t === "string") {
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function rowCustomer(raw: DeviceInfoRecord): string {
  if (typeof raw.customerTitle === "string" && raw.customerTitle.trim()) return raw.customerTitle.trim();
  if (typeof raw.customerName === "string" && raw.customerName.trim()) return raw.customerName.trim();
  return "—";
}

function rowIsPublic(raw: DeviceInfoRecord): boolean {
  if (typeof raw.public === "boolean") return raw.public;
  const cid = entityIdFromTb(raw.customerId);
  if (cid === TB_PUBLIC_CUSTOMER_ID) return true;
  const ai = raw.additionalInfo;
  if (ai && typeof ai === "object" && "isPublic" in ai && typeof (ai as { isPublic: unknown }).isPublic === "boolean") {
    return (ai as { isPublic: boolean }).isPublic;
  }
  return false;
}

export function toDeviceTableRow(raw: DeviceInfoRecord): DeviceTableRow | null {
  const id = deviceRowId(raw);
  if (!id) return null;
  const additionalInfo =
    raw.additionalInfo && typeof raw.additionalInfo === "object" ? (raw.additionalInfo as Record<string, unknown>) : {};
  return {
    id,
    raw,
    name: typeof raw.name === "string" ? raw.name : "—",
    label: typeof raw.label === "string" && raw.label ? raw.label : "—",
    profile:
      typeof raw.deviceProfileName === "string"
        ? raw.deviceProfileName
        : typeof raw.type === "string"
          ? raw.type
          : "—",
    createdDisplay: formatCreated(raw),
    createdSortKey: createdSortKey(raw),
    active: Boolean(raw.active),
    customer: rowCustomer(raw),
    isPublic: rowIsPublic(raw),
    isGateway: Boolean(additionalInfo.gateway ?? raw.gateway),
  };
}

export const DEVICES_PAGINATION_STEPS = [10, 20, 50, 100];
