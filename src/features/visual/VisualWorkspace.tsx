"use client";

import { useEffect, useState } from "react";

import BottomPanel from "./components/BottomPanel";
import Canvas from "./components/Canvas";
import PromptBar from "./components/PromptBar";
import PropertiesPanel from "./components/PropertiesPanel";
import SceneExplorer from "./components/SceneExplorer";
import Toolbar from "./components/Toolbar";

import { supabase } from "../../lib/supabase.js";
import { generateVisual } from "../../services/reucore";
import {
  discardVisualSource,
  downloadVisualAsset,
  listVisualAssets,
  saveVisualAsset,
  uploadVisualSource,
} from "./services/visualAssets";
import { editUploadedVideo } from "./services/videoEditor";

import type {
  VisualHistoryItem,
  VisualMediaType,
  VisualStyle,
} from "./types";

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

async function readGeneratedMedia(
  result: Awaited<ReturnType<typeof generateVisual>>,
  type: VisualMediaType
) {
  const url = type === "video" ? result.video?.url : result.url;
  if (url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("The generated media could not be downloaded for saving.");
    return response.blob();
  }
  if (type === "image" && result.svg) {
    const source = URL.createObjectURL(new Blob([result.svg], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const image = new Image();
      image.src = source;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("The generated SVG could not be rendered."));
      });
      const canvas = document.createElement("canvas");
      canvas.width = result.width || image.naturalWidth || 800;
      canvas.height = result.height || image.naturalHeight || 600;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to render the generated image.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!png) throw new Error("The generated image could not be converted to PNG.");
      return png;
    } finally {
      URL.revokeObjectURL(source);
    }
  }
  throw new Error(`The ${type} generator returned no downloadable file.`);
}

export default function VisualWorkspace() {
  const [prompt, setPrompt] = useState("");
  const [mediaType, setMediaType] = useState<VisualMediaType>("image");
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [activeAsset, setActiveAsset] = useState<VisualHistoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState("Scene");
  const [style, setStyle] = useState<VisualStyle>("futuristic");
  const [history, setHistory] = useState<VisualHistoryItem[]>([]);

  useEffect(() => {
    let active = true;
    const restoreAssets = async () => {
      setLoadingHistory(true);
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!data.user) {
          if (active) setError("Sign in to save and restore your media projects.");
          return;
        }

        const assets = await listVisualAssets(data.user.id);
        if (!active) return;
        setUserId(data.user.id);
        setHistory(assets);
        if (assets[0]) {
          setActiveAsset(assets[0]);
          setMediaType(assets[0].mediaType);
          setPrompt(assets[0].prompt);
        }
      } catch (loadError) {
        if (!active) return;
        console.error("Could not restore visual assets:", loadError);
        setError("Could not load saved media. Apply the visual-assets Supabase migration and try again.");
      } finally {
        if (active) setLoadingHistory(false);
      }
    };

    void restoreAssets();
    return () => {
      active = false;
    };
  }, []);

  async function handleGenerate() {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt || loading) return;
    if (!userId) {
      setError("Sign in before generating media so it can be saved to your account.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    const assetId = crypto.randomUUID();
    let sourcePath: string | null = null;
    let assetSaved = false;

    try {
      if (inputFile) {
        sourcePath = await uploadVisualSource(userId, assetId, inputFile);
      }

      let output: Blob;
      if (inputFile && mediaType === "video") {
        output = await editUploadedVideo(inputFile, cleanPrompt);
      } else if (inputFile) {
        const { data, error: editError } = await supabase.functions.invoke("media-edit", {
          body: { sourcePath, prompt: cleanPrompt },
        });
        if (editError) throw editError;
        if (!data?.imageBase64) {
          throw new Error(data?.error || "The image editor returned no output.");
        }
        const binary = atob(data.imageBase64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        output = new Blob([bytes], { type: data.mimeType || "image/png" });
      } else {
        const finalPrompt = mediaType === "image"
          ? `${cleanPrompt}. Visual style: ${style}.`
          : cleanPrompt;
        const generated = await generateVisual({ prompt: finalPrompt, outputType: mediaType });
        if (!generated.success) throw new Error(generated.error || `Could not generate ${mediaType}.`);
        output = await readGeneratedMedia(generated, mediaType);
      }

      const saved = await saveVisualAsset({
        userId,
        id: assetId,
        prompt: cleanPrompt,
        mediaType,
        sourcePath,
        output,
      });
      assetSaved = true;
      sourcePath = null;
      setActiveAsset(saved);
      setHistory((current) => [saved, ...current]);
      setNotice("Saved to your account. Your media will be here when you return.");
      setInputFile(null);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to edit or generate the media."
      );
    } finally {
      if (sourcePath && !assetSaved) await discardVisualSource(sourcePath);
      setLoading(false);
    }
  }

  function handleReset() {
    setPrompt("");
    setInputFile(null);
    setActiveAsset(null);
    setError("");
    setNotice("");
    setSelectedEntity("Scene");
    setStyle("futuristic");
  }

  async function handleDownload() {
    if (!activeAsset) return;
    setError("");
    try {
      await downloadVisualAsset(activeAsset);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not download this media file.");
    }
  }

  function handleRestore(item: VisualHistoryItem) {
    setPrompt(item.prompt);
    setMediaType(item.mediaType);
    setActiveAsset(item);
    setInputFile(null);
    setError("");
    setNotice("");
  }

  function handleFileChange(file: File | null) {
    setError("");
    setNotice("");
    if (!file) {
      setInputFile(null);
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      setError("Choose a file smaller than 50 MB.");
      return;
    }

    const allowedTypes = [
      "image/png", "image/jpeg", "image/webp", "image/gif",
      "video/mp4", "video/webm", "video/quicktime",
    ];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setError("Choose a PNG, JPEG, WebP, GIF, MP4, WebM, or QuickTime file.");
      return;
    }

    setInputFile(file);
    setActiveAsset(null);
    setMediaType(file.type.startsWith("video/") ? "video" : "image");
  }

  const activeUrl = activeAsset?.outputUrl ?? "";

  return (
    <div className="min-h-screen bg-[#020204] p-4 text-white md:p-6">
      <div className="mx-auto max-w-[1800px] overflow-hidden rounded-3xl border border-white/10 bg-[#08080c] shadow-2xl shadow-violet-950/20">
        <Toolbar
          hasVisual={Boolean(activeAsset)}
          onReset={handleReset}
          onDownload={() => void handleDownload()}
        />

        <PromptBar
          prompt={prompt}
          loading={loading || loadingHistory}
          mediaType={mediaType}
          file={inputFile}
          onPromptChange={setPrompt}
          onMediaTypeChange={setMediaType}
          onFileChange={handleFileChange}
          onGenerate={handleGenerate}
        />

        {notice && <p role="status" className="border-b border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-sm text-emerald-200">{notice}</p>}
        {error && <p role="alert" className="border-b border-red-400/20 bg-red-400/5 px-4 py-2 text-sm text-red-200">{error}</p>}
        {inputFile && mediaType === "video" && (
          <p className="border-b border-white/10 px-4 py-2 text-xs text-gray-400">
            Video edits render in this browser: try “black and white,” “slow motion,” “trim from 2 seconds,” or “caption: your text.”
          </p>
        )}

        <div className="grid min-h-[520px] lg:grid-cols-[230px_minmax(0,1fr)_260px]">
          <SceneExplorer
            prompt={prompt}
            selectedEntity={selectedEntity}
            onSelectEntity={setSelectedEntity}
          />

          <Canvas
            mediaUrl={activeUrl}
            mediaType={activeAsset?.mediaType ?? null}
            loading={loading}
            error={error}
          />

          <PropertiesPanel
            selectedEntity={selectedEntity}
            style={style}
            onStyleChange={setStyle}
          />
        </div>

        <BottomPanel
          history={history}
          onRestore={handleRestore}
        />
      </div>
    </div>
  );
}
