import valveIcon from "@/assets/images/valve-svgrepo-com.svg";

import type { DeviceProfileOption } from "@/controllers/API/devicesApi";

/** Industrial device catalog (grid view) — names, icons, and descriptions from plant monitoring specs. */
export type DeviceCatalogEntry = {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  tags: string[];
  /** ThingsBoard list-devices `text_search` when it differs from the display name. */
  apiTextSearch?: string;
};

export const DEVICE_CATALOG_ENTRIES: DeviceCatalogEntry[] = [
  {
    id: "barrier-gate",
    name: "Barrier gate",
    iconUrl: "https://iconly.io/icons/barrier?utm_source=chatgpt.com",
    description:
      "Condition Monitoring of Auto/Remote and the Open and close during the Plant ESD",
    tags: ["Condition Monitoring", "ESD"],
  },
  {
    id: "dyke-valve",
    name: "Dyke (Dyke Value)",
    iconUrl: valveIcon,
    description: "Condition Monitoring of dyke during the tank leakage alarm.",
    tags: ["Condition Monitoring", "Tank safety"],
  },
  {
    id: "esd",
    name: "ESD (Emergency Shutdown)",
    iconUrl: "https://www.svgrepo.com/show/228973/power-button-start-button.svg",
    description: "Condition Monitoring of each ESD switches and monitors Cause and its effects.",
    tags: ["Condition Monitoring", "Safety"],
  },
  {
    id: "fire-effect",
    name: "Fire Effect (Fire Engine Interlock)",
    iconUrl: "https://www.svgrepo.com/show/500065/fire-hydrant.svg",
    description:
      "Monitors the Fire system interlock by the system status like Water level, Fire engine remote, Jockey pump run.",
    tags: ["Fire system", "Interlock"],
  },
  {
    id: "fire-pump",
    name: "Fire Pump (Fire Engine)",
    iconUrl: "https://www.svgrepo.com/show/164123/engine.svg",
    description:
      "Monitors the Fire engine Remote/Local modes and check the healthiness and the cause and effect.",
    tags: ["Fire system", "Condition Monitoring"],
  },
  {
    id: "hcd",
    name: "HCD (Hydrocarbon Detector)",
    iconUrl: "https://www.svgrepo.com/show/53099/sphygmomanometer.svg",
    description:
      "HCD monitors carbon level and system status for decate alarms, faults, and misalignment, along with associated cause and effect indications.",
    tags: ["Hydrocarbon", "Alarms"],
  },
  {
    id: "tank",
    name: "Tank",
    iconUrl: "https://www.svgrepo.com/show/296399/tank-cistern.svg",
    description:
      "Tank monitors MOV, ROSOV, VFT, and radar system status, including alarms, faults, and associated cause and effect indications.",
    tags: ["Tank", "MOV / ROSOV"],
  },
  {
    id: "ups",
    name: "UPS",
    iconUrl: "https://www.svgrepo.com/show/503617/ups-outline.svg",
    description:
      "Monitors UPS health status including fault conditions, load status, low battery, and mains failure indications.",
    tags: ["Power", "Health"],
  },
  {
    id: "plc",
    name: "PLC",
    iconUrl: "https://www.svgrepo.com/show/321245/processor.svg",
    description:
      "Monitors PLC system status including PLC Master, PLC Fail Safe along with their normal values, also monitors PLC A and PLC B communication status, ensuring proper signal health.",
    tags: ["PLC", "Communication"],
  },
  {
    id: "bcu-gantry",
    name: "BCU (Gantry)",
    apiTextSearch: "LP",
    iconUrl: "https://www.svgrepo.com/show/521584/cpu.svg",
    description:
      "BCU monitors LP earthing status, flow conditions (no/low/high flow for main and blend), and abnormal events including unauthorized flow, meter overrun, blend/add over/under dose conditions, and loading status.",
    tags: ["Gantry", "Flow"],
  },
  {
    id: "hdr-line-mov",
    name: "HDR Line MOV",
    iconUrl: "https://www.svgrepo.com/show/218850/engine-motor.svg",
    description: "Monitors MOV operation mode (Remote/Local) and verifies system status.",
    tags: ["MOV", "HDR"],
  },
  {
    id: "tank-maintenance",
    name: "Tank Maintenance (VFT, RADAR and Valve Maintenance)",
    iconUrl: "https://www.svgrepo.com/show/198248/motor.svg",
    description:
      "Monitors the health status of VFT, RADAR, ROSOV, and MOV equipment, and generates maintenance indications when any equipment becomes non operational.",
    tags: ["Maintenance", "Tank"],
  },
  {
    id: "product-pump",
    name: "Pump (Product Pump)",
    iconUrl: "https://www.svgrepo.com/show/214458/automobile-motor.svg",
    description:
      "Monitors product pump status and verifies during ESD conditions whether all running pumps are stopped successfully.",
    tags: ["Pump", "ESD"],
  },
  {
    id: "hooter",
    name: "Hooter",
    iconUrl: "https://www.svgrepo.com/show/415340/alarm-alert-bell.svg",
    description:
      "Monitors hooter activation associated with Dyke, VFT, RADAR, and ESD conditions, and verifies interlocks to ensure the required hooter response is generated for every cause and effect condition.",
    tags: ["Alarm", "Interlock"],
  },
  {
    id: "gantry-override",
    name: "Gantry Override",
    iconUrl: "https://www.svgrepo.com/show/486287/operation-and-maintenance-center-periodic-operation.svg",
    description:
      "Gantry override will be activated during manual operations performed from any location SCADA system when safety equipment is unavailable or unhealthy while the location remains in running condition.",
    tags: ["Gantry", "SCADA"],
  },
  {
    id: "lrc-sync",
    name: "LRC Sync Check",
    iconUrl: "https://www.svgrepo.com/show/385076/pc-server-sync-sharing.svg",
    description:
      "LRC server continuously monitors synchronization status, and if any service stops, then immediately triggers alerts and notifications.",
    tags: ["LRC", "Sync"],
  },
  {
    id: "oi",
    name: "OI (Operability Index)",
    apiTextSearch: "Operability Index",
    iconUrl: "https://www.svgrepo.com/show/483055/performance-up-graph.svg",
    description:
      "Performance Index monitors OISD requirements including water and foam volume levels, Fire Engine Remote mode status (minimum 80%), hydrant line pressure, and jockey pump operation.",
    tags: ["Performance", "OISD"],
  },
];

export function getDeviceCatalogEntry(typeId: string): DeviceCatalogEntry | undefined {
  return DEVICE_CATALOG_ENTRIES.find((entry) => entry.id === typeId);
}

export function normalizeDeviceLookupKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Route state when opening devices for a catalog type (grid → type list). */
export type DeviceTypeDevicesLocationState = {
  viewMode?: "grid";
  deviceProfileId?: string;
};

/** Match catalog entry to ThingsBoard device profile id (by profile name). */
export function resolveDeviceProfileIdForCatalog(
  entry: DeviceCatalogEntry,
  profiles: DeviceProfileOption[],
): string | undefined {
  if (!profiles.length) return undefined;

  const catalogKeys = new Set(
    [entry.name, getDeviceCatalogApiTextSearch(entry)]
      .map((n) => normalizeDeviceLookupKey(n))
      .filter(Boolean),
  );

  for (const profile of profiles) {
    const profileKey = normalizeDeviceLookupKey(profile.name);
    if (catalogKeys.has(profileKey)) return profile.id;
  }

  const firstToken = [...catalogKeys][0]?.split(" ")[0] ?? "";
  if (firstToken.length >= 3) {
    for (const profile of profiles) {
      const profileKey = normalizeDeviceLookupKey(profile.name);
      if (profileKey.includes(firstToken) || firstToken.includes(profileKey.split(" ")[0] ?? "")) {
        return profile.id;
      }
    }
  }

  return undefined;
}

/** ThingsBoard list-devices `text_search` for a catalog entry. */
export function getDeviceCatalogApiTextSearch(entry: DeviceCatalogEntry): string {
  if (entry.apiTextSearch?.trim()) return entry.apiTextSearch.trim();
  return deviceCatalogApiTextSearch(entry.name);
}

/** ThingsBoard list-devices `text_search` (e.g. "Barrier gate" → "Barrier Gate"). */
export function deviceCatalogApiTextSearch(name: string): string {
  const acronyms = new Set(["esd", "hcd", "ups", "plc", "oi", "mov", "vft", "radar", "rosov", "lrc", "bcu", "hdr"]);
  return name
    .split(/\s+/)
    .map((word) => {
      const bare = word.replace(/[()]/g, "");
      const lower = bare.toLowerCase();
      if (acronyms.has(lower)) {
        return word.replace(bare, bare.toUpperCase());
      }
      if (word === word.toUpperCase() && word.length <= 4) {
        return word;
      }
      const parts = word.split(/([()])/);
      return parts
        .map((part) => {
          if (part === "(" || part === ")") return part;
          if (!part) return part;
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        })
        .join("");
    })
    .join(" ");
}
