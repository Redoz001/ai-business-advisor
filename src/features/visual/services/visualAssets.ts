import { supabase } from "../../../lib/supabase.js";
import type { VisualHistoryItem, VisualMediaType } from "../types";

const BUCKET = "visual-assets";
const SIGNED_URL_SECONDS = 60 * 60;

type VisualAssetRow = {
  id: string;
  prompt: string;
  media_type: VisualMediaType;
  source_path: string | null;
  output_path: string;
  mime_type: string;
  created_at: string;
};

function extensionForMime(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("mp4")) return "mp4";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("svg")) return "svg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  return "png";
}

function toHistoryItem(row: VisualAssetRow, outputUrl: string): VisualHistoryItem {
  return {
    id: row.id,
    prompt: row.prompt,
    mediaType: row.media_type,
    sourcePath: row.source_path,
    outputPath: row.output_path,
    mimeType: row.mime_type,
    createdAt: new Date(row.created_at).getTime(),
    outputUrl,
  };
}

export async function uploadVisualSource(userId: string, assetId: string, file: File) {
  const extension = extensionForMime(file.type);
  const path = `${userId}/${assetId}/source.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function discardVisualSource(path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn("Could not clean up an unused media upload:", error.message);
}

export async function saveVisualAsset({
  userId,
  id,
  prompt,
  mediaType,
  sourcePath,
  output,
}: {
  userId: string;
  id: string;
  prompt: string;
  mediaType: VisualMediaType;
  sourcePath: string | null;
  output: Blob;
}): Promise<VisualHistoryItem> {
  const mimeType = output.type || (mediaType === "video" ? "video/webm" : "image/png");
  const outputPath = `${userId}/${id}/output.${extensionForMime(mimeType)}`;
  const storage = supabase.storage.from(BUCKET);

  const { error: uploadError } = await storage.upload(outputPath, output, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) {
    if (sourcePath) await discardVisualSource(sourcePath);
    throw uploadError;
  }

  const { data: signedData, error: signedError } = await storage.createSignedUrl(
    outputPath,
    SIGNED_URL_SECONDS
  );
  if (signedError) {
    await storage.remove([outputPath, ...(sourcePath ? [sourcePath] : [])]);
    throw signedError;
  }

  const { data, error: insertError } = await supabase
    .from("visual_assets")
    .insert({
      id,
      user_id: userId,
      prompt,
      media_type: mediaType,
      source_path: sourcePath,
      output_path: outputPath,
      mime_type: mimeType,
    })
    .select("id, prompt, media_type, source_path, output_path, mime_type, created_at")
    .single();

  if (insertError) {
    await storage.remove([outputPath, ...(sourcePath ? [sourcePath] : [])]);
    throw insertError;
  }
  return toHistoryItem(data as VisualAssetRow, signedData.signedUrl);
}

export async function listVisualAssets(userId: string): Promise<VisualHistoryItem[]> {
  const { data, error } = await supabase
    .from("visual_assets")
    .select("id, prompt, media_type, source_path, output_path, mime_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const storage = supabase.storage.from(BUCKET);
  return Promise.all((data ?? []).map(async (row: VisualAssetRow) => {
    const { data: signedData, error: signedError } = await storage.createSignedUrl(
      row.output_path,
      SIGNED_URL_SECONDS
    );
    if (signedError) throw signedError;
    return toHistoryItem(row, signedData.signedUrl);
  }));
}

export async function downloadVisualAsset(asset: VisualHistoryItem) {
  const filename = `reunexus-${asset.mediaType}-${asset.id}.${extensionForMime(asset.mimeType)}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(asset.outputPath, SIGNED_URL_SECONDS, { download: filename });
  if (error) throw error;

  const response = await fetch(data.signedUrl);
  if (!response.ok) throw new Error("Could not download this media file.");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}