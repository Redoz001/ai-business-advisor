import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Profile({ user }) {
  const [loading, setLoading] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  /* =========================
     LOAD PROFILE (SAFE)
  ========================= */
  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle(); // 🔥 FIX: prevents crash if no row

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        setDisplayName(data.display_name || "");
        setUsername(data.username || "");
        setAvatarUrl(data.avatar_url || "");
      }
    };

    load();
  }, [user]);

  /* =========================
     UPLOAD AVATAR (FIXED FLOW)
  ========================= */
  const uploadAvatar = async (file) => {
    if (!file || !user?.id) return;

    setLoading(true);

    const fileName = `${user.id}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error(uploadError);
      setLoading(false);
      return;
    }

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    const publicUrl = data?.publicUrl;

    setAvatarUrl(publicUrl); // 🔥 instant UI update
    setLoading(false);
  };

  /* =========================
     SAVE PROFILE (AUTO UPSERT SAFE)
  ========================= */
  const saveProfile = async () => {
    if (!user?.id) return;

    setLoading(true);

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: displayName,
      username,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    });

    setLoading(false);

    if (error) {
      console.error(error);
      alert("Failed to save profile");
      return;
    }

    alert("Profile updated!");
  };

  /* =========================
     UI GUARD
  ========================= */
  if (!user) {
    return (
      <div className="text-white p-10">
        Please login to view profile
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex justify-center items-start p-10">
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6">

        {/* TITLE */}
        <h1 className="text-2xl font-bold mb-6">Profile</h1>

        {/* AVATAR */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                className="w-full h-full object-cover"
                alt="avatar"
              />
            ) : (
              <span className="text-2xl text-zinc-400">
                {displayName?.[0] ||
                  user?.email?.[0]?.toUpperCase() ||
                  "U"}
              </span>
            )}
          </div>

          <input
            type="file"
            accept="image/*"
            className="mt-3 text-sm text-white"
            onChange={(e) => uploadAvatar(e.target.files[0])}
          />
        </div>

        {/* DISPLAY NAME */}
        <div className="mb-4">
          <label className="text-sm text-zinc-400">Display Name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full mt-1 p-2 bg-zinc-900 rounded-lg outline-none"
            placeholder="Enter display name"
          />
        </div>

        {/* USERNAME */}
        <div className="mb-6">
          <label className="text-sm text-zinc-400">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full mt-1 p-2 bg-zinc-900 rounded-lg outline-none"
            placeholder="Enter username"
          />
        </div>

        {/* SAVE */}
        <button
          onClick={saveProfile}
          disabled={loading}
          className="w-full bg-emerald-400 text-black py-2 rounded-lg font-bold"
        >
          {loading ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </div>
  );
}