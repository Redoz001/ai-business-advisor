import { useEffect } from "react";
import {
  SETTINGS_EVENT,
  readLocalSettings,
} from "../services/userSettings.js";

function applySettings(settings) {
  const root = document.documentElement;
  const accentColors = {
    default: "#00ffcc",
    blue: "#38bdf8",
    green: "#4ade80",
    purple: "#c084fc",
    pink: "#f472b6",
    orange: "#fb923c",
  };
  const isLight = settings.theme === "light";

  root.dataset.theme = settings.theme || "dark";
  root.dataset.contrast = settings.contrast || "system";
  root.dataset.accent = settings.accent_color || "default";
  root.dataset.density = settings.chat_density || "comfortable";
  root.dataset.fontSize = settings.font_size || "medium";
  root.dataset.compact = settings.compact_mode ? "true" : "false";
  root.style.setProperty("--primary", accentColors[settings.accent_color] || accentColors.default);
  root.style.setProperty("--bg-dark", isLight ? "#f4f4f5" : "#000000");
  root.style.setProperty("--bg-panel", isLight ? "#ffffff" : "#0a0a0a");
  root.style.setProperty("--text-main", isLight ? "#18181b" : "#ffffff");
  document.body.style.fontSize = settings.font_size === "small"
    ? "14px"
    : settings.font_size === "large"
      ? "18px"
      : "16px";
  document.body.style.filter = settings.contrast === "high" ? "contrast(1.08)" : "none";
}

async function enableBackgroundAssistant(settings) {
  if (!settings.background_assistant) return;

  if (!("Notification" in window)) {
    console.warn("Background assistant notifications are unsupported in this browser.");
    return;
  }

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }

  if (Notification.permission !== "granted") return;

  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.ready;
  }

  if (settings.background_greeting) {
    new Notification("ReuNexus background assistant enabled", {
      body: "I can notify you about completed work while this app is open or installed.",
      tag: "reunexus-background-enabled",
    });
  }
}

export default function BackgroundAssistant() {
  useEffect(() => {
    const sync = (event) => {
      const settings = event.detail || readLocalSettings();
      applySettings(settings);
      enableBackgroundAssistant(settings).catch((error) => {
        console.warn("Background assistant setup failed:", error);
      });
    };

    sync({ detail: readLocalSettings() });
    window.addEventListener(SETTINGS_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_EVENT, sync);
  }, []);

  return null;
}
