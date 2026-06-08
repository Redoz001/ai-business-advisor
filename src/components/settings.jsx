import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* =========================
   DEFAULTS (BASE SYSTEM)
========================= */
const DEFAULT_SETTINGS = {
  theme: "dark",
  compact_mode: false,
  auto_save: true,
  accent_color: "default",
  contrast: "system",
  language: "auto",

  notifications: true,
  email_notifications: true,
  sound_enabled: true,

  ai_personality: "balanced",
  chat_density: "comfortable",

  privacy_mode: "standard",
  data_collection: true,
  analytics: true,

  font_size: "medium",

  role: "user", // enterprise addition
  feature_flags: {
    new_ui: false,
    beta_ai: false,
  },
};

/* =========================
   ENTERPRISE SETTINGS ENGINE
========================= */
export default function Settings({ user }) {
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState("user"); // user | workspace | org

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  /* =========================
     ENTERPRISE SCHEMA
  ========================= */
  const schema = useMemo(() => {
    const isAdmin = settings.role === "admin";

    return [
      {
        title: "Identity & Access",
        items: [
          {
            key: "mfa",
            label: "Multi-Factor Authentication",
            type: "action",
            actionLabel: "Enable",
            onClick: () => alert("MFA coming soon"),
          },
          {
            key: "role",
            label: "Account Role",
            type: "select",
            options: isAdmin
              ? ["user", "admin", "owner"]
              : ["user"],
          },
        ],
      },

      {
        title: "Feature Flags (Enterprise Control)",
        items: [
          {
            key: "feature_flags.new_ui",
            label: "New UI System",
            type: "toggle",
          },
          {
            key: "feature_flags.beta_ai",
            label: "Beta AI Features",
            type: "toggle",
          },
        ],
      },

      {
        title: "Appearance",
        items: [
          {
            key: "theme",
            label: "Theme",
            type: "select",
            options: ["system", "dark", "light", "amoled"],
          },
          {
            key: "contrast",
            label: "Contrast",
            type: "select",
            options: ["system", "low", "high"],
          },
          {
            key: "accent_color",
            label: "Accent Color",
            type: "select",
            options: ["default", "blue", "green", "purple", "pink", "orange"],
          },
          {
            key: "font_size",
            label: "Font Size",
            type: "select",
            options: ["small", "medium", "large"],
          },
          {
            key: "compact_mode",
            label: "Compact Mode",
            type: "toggle",
          },
        ],
      },

      {
        title: "Chat Intelligence",
        items: [
          {
            key: "ai_personality",
            label: "AI Personality",
            type: "select",
            options: ["precise", "balanced", "creative", "strict"],
          },
          {
            key: "chat_density",
            label: "Chat Density",
            type: "select",
            options: ["compact", "comfortable", "spacious"],
          },
          {
            key: "auto_save",
            label: "Auto Save Chats",
            type: "toggle",
          },
        ],
      },

      {
        title: "Privacy & Compliance",
        items: [
          {
            key: "privacy_mode",
            label: "Privacy Mode",
            type: "select",
            options: ["standard", "enhanced", "maximum"],
          },
          {
            key: "data_collection",
            label: "Data Collection",
            type: "toggle",
          },
          {
            key: "analytics",
            label: "Analytics Sharing",
            type: "toggle",
          },
        ],
      },

      {
        title: "Notifications",
        items: [
          {
            key: "notifications",
            label: "Push Notifications",
            type: "toggle",
          },
          {
            key: "email_notifications",
            label: "Email Notifications",
            type: "toggle",
          },
          {
            key: "sound_enabled",
            label: "Sound Effects",
            type: "toggle",
          },
        ],
      },

      {
        title: "Language & Localization",
        items: [
          {
            key: "language",
            label: "Language",
            type: "select",
            options: ["auto", "en", "ar", "fr", "es", "de", "zh", "hi"],
          },
        ],
      },

      {
        title: "Danger Zone",
        items: [
          {
            key: "reset",
            label: "Reset Settings",
            type: "action",
            actionLabel: "Reset",
            onClick: async () => {
              if (!confirm("Reset all settings?")) return;

              await supabase
                .from("user_settings")
                .update(DEFAULT_SETTINGS)
                .eq("user_id", user.id);

              setSettings(DEFAULT_SETTINGS);
            },
          },
        ],
      },
    ];
  }, [settings.role]);

  /* =========================
     LOAD SETTINGS (MERGED SYSTEM)
  ========================= */
  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      setLoading(true);

      const { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          feature_flags: {
            ...DEFAULT_SETTINGS.feature_flags,
            ...(data.feature_flags || {}),
          },
        });
      } else {
        await supabase.from("user_settings").upsert({
          user_id: user.id,
          ...DEFAULT_SETTINGS,
        });
      }

      setLoading(false);
    };

    load();
  }, [user?.id]);

  /* =========================
     DEEP UPDATE SUPPORT
  ========================= */
  const setNestedValue = (obj, path, value) => {
    const keys = path.split(".");
    const copy = { ...obj };
    let ref = copy;

    keys.forEach((k, i) => {
      if (i === keys.length - 1) {
        ref[k] = value;
      } else {
        ref[k] = { ...ref[k] };
        ref = ref[k];
      }
    });

    return copy;
  };

  const update = async (key, value) => {
    const newSettings = setNestedValue(settings, key, value);
    setSettings(newSettings);

    await supabase.from("user_settings").upsert({
      user_id: user.id,
      ...newSettings,
      updated_at: new Date().toISOString(),
    });
  };

  /* =========================
     RENDER SYSTEM
  ========================= */
  const renderItem = (item) => {
    const value = item.key.includes(".")
      ? item.key.split(".").reduce((acc, k) => acc?.[k], settings)
      : settings[item.key];

    if (item.type === "toggle") {
      return (
        <button
          onClick={() => update(item.key, !value)}
          className="w-full p-3 rounded bg-zinc-900 hover:bg-zinc-800 text-left"
        >
          {item.label}:{" "}
          <span className="text-emerald-400">
            {value ? "ON" : "OFF"}
          </span>
        </button>
      );
    }

    if (item.type === "select") {
      return (
        <div className="w-full p-3 rounded bg-zinc-900">
          <div className="mb-2">{item.label}</div>
          <select
            value={value}
            onChange={(e) => update(item.key, e.target.value)}
            className="w-full bg-black p-2 rounded"
          >
            {item.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (item.type === "action") {
      return (
        <button
          onClick={item.onClick}
          className="w-full p-3 rounded bg-zinc-900 hover:bg-zinc-800 text-left flex justify-between"
        >
          <span>{item.label}</span>
          <span className="text-emerald-400">
            {item.actionLabel}
          </span>
        </button>
      );
    }

    return null;
  };

  /* =========================
     LOADING
  ========================= */
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-white bg-black">
        Loading enterprise settings...
      </div>
    );
  }

  /* =========================
     UI
  ========================= */
  return (
    <div className="h-full bg-black text-white p-6 max-w-3xl mx-auto space-y-8">

      <div>
        <h1 className="text-2xl font-bold">
          Enterprise Settings
        </h1>
        <p className="text-zinc-500 text-sm">
          Scoped • Role-based • Feature-flag driven system
        </p>
      </div>

      {schema.map((section) => (
        <div
          key={section.title}
          className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3"
        >
          <h2 className="text-lg font-semibold">
            {section.title}
          </h2>

          {section.items.map((item) => (
            <div key={item.key}>{renderItem(item)}</div>
          ))}
        </div>
      ))}

      <div className="text-xs text-zinc-500">
        Enterprise config engine • Supabase synced • schema-driven
      </div>
    </div>
  );
}