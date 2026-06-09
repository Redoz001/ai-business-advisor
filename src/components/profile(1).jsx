import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";

export default function Profile({ user }) {
  const [loading, setLoading] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const channelRef = useRef(null);

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
        .select("*")
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
              updated_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (alive && created) {
          setDisplayName(created.display_name || "");
          setUsername(created.username || "");
          setAvatarUrl(created.avatar_url || "");
        }
      } else if (data && alive) {
        setDisplayName(data.display_name || "");
        setUsername(data.username || "");
        setAvatarUrl(data.avatar_url || "");
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

      const { error: dbError } = await supabase.from("profiles").upsert({
        id: user.id,
        avatar_url: url,
        updated_at: new Date().toISOString(),
      });

      if (dbError) throw dbError;

      console.log("✅ Avatar updated");
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed — please try again.");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 600);
    }
  };

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

  /* =========================
     SAVE PROFILE (UNCHANGED)
  ========================= */
  const saveProfile = async () => {
    try {
      setLoading(true);

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        display_name: displayName,
        username,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      alert("Profile updated!");
    } catch (err) {
      console.error(err);
      alert("Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

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
      {syncing && (
        <div className="text-xs text-blue-400">
          Syncing profile...
        </div>
      )}

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

          <label className="cursor-pointer bg-zinc-800 px-3 py-2 rounded">
            {uploading
              ? `Uploading ${uploadProgress}%`
              : "Upload Avatar"}
            <input type="file" hidden onChange={uploadAvatar} />
          </label>

          <button
            onClick={generateAIAvatar}
            className="bg-purple-500 px-3 py-2 rounded"
          >
            Generate AI Avatar
          </button>

        </div>
      </div>

      {/* DISPLAY NAME */}
      <input
        className="w-full p-2 bg-zinc-900 rounded"
        placeholder="Display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />

      {/* USERNAME */}
      <input
        className="w-full p-2 bg-zinc-900 rounded"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      {/* SAVE */}
      <button
        onClick={saveProfile}
        className="w-full bg-emerald-400 text-black py-2 rounded font-bold"
      >
        Save Profile
      </button>
    </div>
  );
}