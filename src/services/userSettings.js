export const SETTINGS_STORAGE_KEY = "reunexus-settings";
export const SETTINGS_EVENT = "reunexus-settings-changed";

export function readLocalSettings() {
  if (typeof localStorage === "undefined") return {};

  try {
    return JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function writeLocalSettings(settings) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: settings }));
}
