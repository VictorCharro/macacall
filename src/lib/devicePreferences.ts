export type DeviceKind = "audioinput" | "videoinput" | "audiooutput";
export type DevicePreferences = Partial<Record<DeviceKind, string>>;

export const DEVICE_PREFS_KEY = "macacall-device-prefs";

export function loadDevicePreferences(): DevicePreferences {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(DEVICE_PREFS_KEY) ?? "{}");
  } catch {
    return {};
  }
}
