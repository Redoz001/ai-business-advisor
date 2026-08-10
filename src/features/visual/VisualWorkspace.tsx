"use client";

import { useState } from "react";

import BottomPanel from "./components/BottomPanel";
import Canvas from "./components/Canvas";
import PromptBar from "./components/PromptBar";
import PropertiesPanel from "./components/PropertiesPanel";
import SceneExplorer from "./components/SceneExplorer";
import Toolbar from "./components/Toolbar";

import { createVisual } from "./services/visualService";

import type {
  VisualHistoryItem,
  VisualStyle,
} from "./types";

export default function VisualWorkspace() {
  const [prompt, setPrompt] = useState("");
  const [svg, setSvg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("Scene");
  const [style, setStyle] = useState<VisualStyle>("futuristic");
  const [history, setHistory] = useState<VisualHistoryItem[]>([]);

  async function handleGenerate() {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt || loading) return;

    setLoading(true);
    setError("");

    try {
      const finalPrompt = `${cleanPrompt}. Visual style: ${style}.`;
      const generatedSvg = await createVisual(finalPrompt);

      setSvg(generatedSvg);

      setHistory((current) => [
        {
          id: crypto.randomUUID(),
          prompt: cleanPrompt,
          svg: generatedSvg,
          createdAt: Date.now(),
        },
        ...current,
      ]);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate the visual."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setPrompt("");
    setSvg("");
    setError("");
    setSelectedEntity("Scene");
    setStyle("futuristic");
  }

  function handleDownload() {
    if (!svg) return;

    const blob = new Blob([svg], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `reunexus-visual-${Date.now()}.svg`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  function handleRestore(item: VisualHistoryItem) {
    setPrompt(item.prompt);
    setSvg(item.svg);
    setError("");
  }

  return (
    <div className="min-h-screen bg-[#020204] p-4 text-white md:p-6">
      <div className="mx-auto max-w-[1800px] overflow-hidden rounded-3xl border border-white/10 bg-[#08080c] shadow-2xl shadow-violet-950/20">
        <Toolbar
          hasVisual={Boolean(svg)}
          onReset={handleReset}
          onDownload={handleDownload}
        />

        <PromptBar
          prompt={prompt}
          loading={loading}
          onPromptChange={setPrompt}
          onGenerate={handleGenerate}
        />

        <div className="grid min-h-[520px] lg:grid-cols-[230px_minmax(0,1fr)_260px]">
          <SceneExplorer
            prompt={prompt}
            selectedEntity={selectedEntity}
            onSelectEntity={setSelectedEntity}
          />

          <Canvas
            svg={svg}
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
