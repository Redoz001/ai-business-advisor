"use client";

import { useState } from "react";
import { generateVisualSvg } from "../visual-engine";

export default function VisualGenerator() {
  const [prompt, setPrompt] = useState("");
  const [svg, setSvg] = useState("");

  function handleGenerate() {
    if (!prompt.trim()) return;
    const output = generateVisualSvg(prompt);
    setSvg(output);
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-3xl font-bold">ReuNexus Visual Engine</h2>

      <p className="mt-3 text-gray-400">
        Generate branded visuals from text prompts.
      </p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Example: A futuristic AI platform helping businesses grow"
        rows={4}
        className="mt-6 w-full rounded-xl border border-white/10 bg-black p-4 text-white outline-none focus:border-violet-500"
      />

      <button
        onClick={handleGenerate}
        className="mt-4 rounded-xl bg-violet-600 px-6 py-3 font-semibold hover:bg-violet-500"
      >
        Generate Visual
      </button>

      {svg && (
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      )}
    </div>
  );
}