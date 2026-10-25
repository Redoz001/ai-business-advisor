import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";

export default function Profile({ user, onProfileSaved }) {
  const [loading, setLoading] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [plan, setPlan] = useState("normal");
  const [requestsUsed, setRequestsUsed] = useState(0);
  const [requestsLimit, setRequestsLimit] = useState(20);
  const [requestResetAt, setRequestResetAt] = useState(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [fieldSaved, setFieldSaved] = useState({
    displayName: false,
    username: false,
    avatar: false,
  });

  const channelRef = useRef(null);
  const lastSavedRef = useRef({ displayName: "", username: "", avatarUrl: "" });
  const hasHydratedProfileRef = useRef(false);
  const savedTimeoutRef = useRef(null);

  const formatResetDate = (value) => {
    if (!value) return "No reset scheduled";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No reset scheduled";

    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  /* =========================
     LOAD PROFILE (FIXED SAFE VERSION)
  ========================= */
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let alive = true;

    // 🔥 prevents infinite black screen freeze
    const timeout = setTimeout(() => {
      if (alive) setLoading(false);
    }, 5000);

    const load = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("*, plan, subscription_status, subscription_tier, requests_used, requests_limit, request_reset_at")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Load profile error:", error);
      }

      // CREATE PROFILE IF MISSING
      if (!data && !error) {
        const { data: created } = await supabase
          .from("profiles")
          .insert([
            {
              id: user.id,
              display_name: "",
              username: "",
              avatar_url: "",
              plan: "normal",
              subscription_tier: "normal",
              subscription_status: "inactive",
              updated_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (alive && created) {
          setDisplayName(created.display_name || "");
          setUsername(created.username || "");
          setAvatarUrl(created.avatar_url || "");
          setPlan(String(created.plan || "normal").toLowerCase());
          setRequestsUsed(Number(created.requests_used ?? 0));
          setRequestsLimit(Number(created.requests_limit ?? 20));
          setRequestResetAt(created.request_reset_at || null);
          lastSavedRef.current = {
            displayName: created.display_name || "",
            username: created.username || "",
            avatarUrl: created.avatar_url || "",
          };
          hasHydratedProfileRef.current = true;
        }
      } else if (data && alive) {
        setDisplayName(data.display_name || "");
        setUsername(data.username || "");
        setAvatarUrl(data.avatar_url || "");
        setPlan(String(data.plan || data.subscription_tier || "normal").toLowerCase());
        setRequestsUsed(Number(data.requests_used ?? 0));
        setRequestsLimit(Number(data.requests_limit ?? 20));
        setRequestResetAt(data.request_reset_at || null);
        lastSavedRef.current = {
          displayName: data.display_name || "",
          username: data.username || "",
          avatarUrl: data.avatar_url || "",
        };
        hasHydratedProfileRef.current = true;
      }

      if (alive) {
        setLoading(false);
        clearTimeout(timeout);
      }
    };

    load();

    return () => {
      alive = false;
      clearTimeout(timeout);
    };
  }, [user?.id]);

  /* =========================
     REALTIME SYNC (UNCHANGED BUT SAFE)
  ========================= */
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("profile-sync")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const p = payload.new;

          setSyncing(true);

          setDisplayName(p.display_name || "");
          setUsername(p.username || "");
          setAvatarUrl(p.avatar_url || "");
          setRequestsUsed(Number(p.requests_used ?? requestsUsed));
          setRequestsLimit(Number(p.requests_limit ?? requestsLimit));
          setRequestResetAt(p.request_reset_at || requestResetAt);

          setTimeout(() => setSyncing(false), 800);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  /* =========================
     AVATAR UPLOAD (UNCHANGED)
  ========================= */
  const persistProfile = async (nextValues = { displayName, username, avatarUrl }) => {
    if (!user?.id) return false;

    setSyncing(true);
    setSaveStatus("saving");

    const payload = {
      id: user.id,
      display_name: nextValues.displayName,
      username: nextValues.username,
      avatar_url: nextValues.avatarUrl,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from("profiles").upsert(payload, {
        onConflict: "id",
      });

      if (error) throw error;

      lastSavedRef.current = {
        displayName: nextValues.displayName,
        username: nextValues.username,
        avatarUrl: nextValues.avatarUrl,
      };

      const nextFieldState = {
        displayName: Boolean(nextValues.displayName || lastSavedRef.current.displayName),
        username: Boolean(nextValues.username || lastSavedRef.current.username),
        avatar: Boolean(nextValues.avatarUrl || lastSavedRef.current.avatarUrl),
      };

      setFieldSaved(nextFieldState);

      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }

      setSaveStatus("saved");
      onProfileSaved?.();
      savedTimeoutRef.current = setTimeout(() => {
        setSaveStatus("idle");
        setFieldSaved({
          displayName: false,
          username: false,
          avatar: false,
        });
      }, 1200);
      return true;
    } catch (err) {
      console.error("Profile save error:", err);
      setSaveStatus("error");
      return false;
    } finally {
      setSyncing(false);
    }
  };

  const uploadAvatar = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file || !user?.id) return;

      setUploading(true);
      setUploadProgress(0);

      const fileName = `${user.id}/${Date.now()}-${file.name}`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (error) throw error;

      setUploadProgress(70);

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const url = `${data.publicUrl}?t=${Date.now()}`;

      setUploadProgress(100);
      setAvatarUrl(url);

      const saved = await persistProfile({
        displayName,
        username,
        avatarUrl: url,
      });

      if (!saved) {
        throw new Error("Avatar upload saved but profile sync failed.");
      }

      console.log("✅ Avatar updated");
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed — please try again.");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 600);
      if (e.target) e.target.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  /* =========================
     AI AVATAR (UNCHANGED)
  ========================= */
  const generateAIAvatar = async () => {
    const seed = user.email || user.id;

    const colors = ["#22c55e", "#3b82f6", "#a855f7", "#f97316"];
    const color = colors[seed.length % colors.length];

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
        <rect width="200" height="200" fill="${color}" />
        <text x="50%" y="50%" font-size="60" text-anchor="middle" fill="white" dy=".3em">
          ${seed.slice(0, 2).toUpperCase()}
        </text>
      </svg>
    `;

    const base64 = "data:image/svg+xml;base64," + btoa(svg);

    setAvatarUrl(base64);

    await supabase.from("profiles").upsert({
      id: user.id,
      avatar_url: base64,
      updated_at: new Date().toISOString(),
    });
  };

  const upgradeToIntelligence = async () => {
    if (!user?.id) {
      alert("Please sign in before upgrading.");
      return;
    }

    try {
      setUpgradeLoading(true);
      const { data, error } = await supabase.functions.invoke("billing-checkout", {
        body: {
          userId: user.id,
          email: user.email,
          plan: "intelligence",
        },
      });

      if (error) {
        // Try to extract the server-side error message
        let message = error.message;
        try {
          const body = await error.context?.json?.();
          if (body?.error) message = body.error;
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }
      if (!data?.url) throw new Error("Checkout URL was not returned.");

      window.location.href = data.url;
    } catch (err) {
      console.error("Upgrade failed:", err);
      alert(`Could not start the Intelligence checkout: ${err?.message || "Please try again."}`);
    } finally {
      setUpgradeLoading(false);
    }
  };

  /* =========================
     SAVE PROFILE
  ========================= */
  const saveProfile = async () => {
    if (!user?.id) return;

    setLoading(true);

    try {
      const saved = await persistProfile({ displayName, username, avatarUrl });
      if (!saved) {
        alert("Failed to save profile.");
      } else {
        setTimeout(() => setSaveStatus("idle"), 1200);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id || !hasHydratedProfileRef.current) return;

    const currentSnapshot = {
      displayName,
      username,
      avatarUrl,
    };

    const lastSnapshot = lastSavedRef.current;
    const hasChanged = (
      currentSnapshot.displayName !== lastSnapshot.displayName ||
      currentSnapshot.username !== lastSnapshot.username ||
      currentSnapshot.avatarUrl !== lastSnapshot.avatarUrl
    );

    if (!hasChanged) return;

    const timer = setTimeout(() => {
      persistProfile(currentSnapshot);
    }, 450);

    return () => clearTimeout(timer);
  }, [displayName, username, avatarUrl, user?.id]);

  /* =========================
     UI
  ========================= */

  // 🔥 FIXED LOADING GUARD (prevents black freeze feel)
  if (loading && !displayName && !username) {
    return <div className="p-6 text-white">Loading profile...</div>;
  }

  return (
    <div className="p-6 text-white space-y-4">

      {/* SYNC INDICATOR */}
      {syncing || saveStatus !== "idle" ? (
        <div className={`text-xs ${saveStatus === "error" ? "text-red-400" : "text-emerald-400"}`}>
          {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Save failed" : "Syncing profile..."}
        </div>
      ) : null}

      {/* AVATAR */}
      <div className="flex items-center gap-4">

        <div className="w-20 h-20 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              className="w-full h-full object-cover"
              alt="avatar"
            />
          ) : (
            <span className="text-xl">👤</span>
          )}
        </div>

        <div className="flex flex-col gap-2">

          <div className="flex items-center gap-2">
            <label className="cursor-pointer bg-zinc-800 px-3 py-2 rounded">
              {uploading
                ? `Uploading ${uploadProgress}%`
                : "Upload Avatar"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={uploadAvatar}
              />
            </label>
            {fieldSaved.avatar && (
              <span className="text-emerald-400 text-lg" title="Saved">✓</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={generateAIAvatar}
              className="bg-purple-500 px-3 py-2 rounded"
            >
              Generate AI Avatar
            </button>
            {fieldSaved.avatar && (
              <span className="text-emerald-400 text-lg" title="Saved">✓</span>
            )}
          </div>

        </div>
      </div>

      <div className="flex items-center justify-between rounded border border-zinc-700 bg-zinc-900 px-3 py-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Plan</p>
          <p className="mt-1 text-sm font-medium capitalize text-white">{plan}</p>
        </div>

        {plan !== "intelligence" ? (
          <button
            onClick={upgradeToIntelligence}
            disabled={upgradeLoading}
            className="rounded bg-violet-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {upgradeLoading ? "Redirecting..." : "Upgrade to Intelligence"}
          </button>
        ) : (
          <span className="rounded bg-emerald-500/20 px-3 py-2 text-sm font-medium text-emerald-300">
            Intelligence active
          </span>
        )}
      </div>

      <div className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Usage</p>
          <span className="text-xs text-zinc-300">
            {plan === "intelligence" ? "Unlimited" : `${requestsUsed}/${requestsLimit}`}
          </span>
        </div>

        <div className="mt-2 text-sm text-zinc-200">
          {plan === "intelligence"
            ? "Your Intelligence plan includes unlimited AI requests."
            : `Requests used this billing cycle: ${requestsUsed} / ${requestsLimit}`}
        </div>

        {plan !== "intelligence" && (
          <div className="mt-2 text-xs text-zinc-400">
            Next reset: {formatResetDate(requestResetAt)}
          </div>
        )}
      </div>

      {/* DISPLAY NAME */}
      <div className="relative">
        <input
          className="w-full p-2 pr-10 bg-zinc-900 rounded"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onBlur={saveProfile}
        />
        {fieldSaved.displayName && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 text-sm" title="Saved">✓</span>
        )}
      </div>

      {/* USERNAME */}
      <div className="relative">
        <input
          className="w-full p-2 pr-10 bg-zinc-900 rounded"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onBlur={saveProfile}
        />
        {fieldSaved.username && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 text-sm" title="Saved">✓</span>
        )}
      </div>

      {/* SAVE */}
      <button
        onClick={saveProfile}
        className="w-full bg-emerald-400 text-black py-2 rounded font-bold"
      >
        {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save Profile"}
      </button>
    </div>
  );
}