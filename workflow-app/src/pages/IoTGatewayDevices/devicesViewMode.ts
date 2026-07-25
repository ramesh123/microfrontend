export type DevicesViewMode = "list" | "grid";

const STORAGE_KEY = "iot-gateway-devices-view-mode";

export function readDevicesViewMode(): DevicesViewMode {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return stored === "list" ? "list" : "grid";
}

export function writeDevicesViewMode(mode: DevicesViewMode): void {
  sessionStorage.setItem(STORAGE_KEY, mode);
}
