import React, { useState } from "react";
import { uploadAvatar, generateAIAvatar } from "../lib/avatar";
import { supabase } from "../lib/supabase";

export default function AvatarEditor({ user, profile, setProfile }) {
  const [loading, setLoading] = useState(false);

  /* =========================
     FILE UPLOAD
  ========================= */
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);

    try {
      const url = await uploadAvatar(file, user.id);

      setProfile((p) => ({ ...p, avatar_url: url }));
    } catch (err) {
      alert("Upload failed");
      console.error(err);
    }

    setLoading(false);
  };

  /* =========================
     AI AVATAR
  ========================= */
  const handleAI = async () => {
    setLoading(true);

    const url = generateAIAvatar(user.email);

    await supabase
      .from("profiles")
      .update({
        avatar_url: url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setProfile((p) => ({ ...p, avatar_url: url }));

    setLoading(false);
  };

  return (
    <div className="space-y-3">

      {/* CURRENT AVATAR */}
      <div className="w-20 h-20 rounded-full overflow-hidden bg-zinc-800">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white">
            No Avatar
          </div>
        )}
      </div>

      {/* UPLOAD */}
      <input type="file" onChange={handleUpload} />

      {/* AI AVATAR */}
      <button
        onClick={handleAI}
        className="bg-emerald-400 text-black px-3 py-1 rounded"
        disabled={loading}
      >
        Generate AI Avatar
      </button>

    </div>
  );
}