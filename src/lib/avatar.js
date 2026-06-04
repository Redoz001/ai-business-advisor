import { supabase } from "./supabase";

/* =========================
   UPLOAD AVATAR
========================= */
export async function uploadAvatar(file, userId) {
  const filePath = `${userId}/${Date.now()}-${file.name}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  const publicUrl = data.publicUrl;

  await supabase
    .from("profiles")
    .update({
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  return publicUrl;
}

/* =========================
   AI AVATAR GENERATOR (SVG)
========================= */
export function generateAIAvatar(seed = "user") {
  const colors = ["#22c55e", "#3b82f6", "#a855f7", "#f97316"];
  const color = colors[seed.length % colors.length];

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
    <rect width="200" height="200" fill="${color}" />
    <text x="50%" y="50%" font-size="60" text-anchor="middle" fill="white" dy=".3em">
      ${seed.slice(0, 2).toUpperCase()}
    </text>
  </svg>`;

  return "data:image/svg+xml;base64," + btoa(svg);
}