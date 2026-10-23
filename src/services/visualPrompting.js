function sanitizePrompt(prompt) {
  if (typeof prompt === "string") {
    return prompt.replace(/\s+/g, " ").trim();
  }

  if (prompt == null) {
    return "";
  }

  return String(prompt).replace(/\s+/g, " ").trim();
}

function normalizeType(type) {
  const normalized = typeof type === "string" ? type.trim().toLowerCase() : "image";

  if (normalized === "video" || normalized === "motion") {
    return "video";
  }

  return "image";
}

function normalizeVariantCount(count) {
  const numericCount = Number(count);

  if (!Number.isFinite(numericCount)) {
    return 1;
  }

  const safeCount = Math.floor(Math.abs(numericCount));
  return safeCount > 0 ? safeCount : 1;
}

export function enhanceVisualPrompt(prompt, type = "image") {
  const base = sanitizePrompt(prompt);
  const outputType = normalizeType(type);
  const description =
    outputType === "video"
      ? "cinematic motion, smooth camera movement, dynamic lighting, atmospheric depth, highly detailed composition, ultra-clean motion, natural continuity, no flicker, no warped anatomy, no artifacting"
      : "cinematic, ultra-detailed, high-quality, photorealistic, richly lit, refined textures, no blemishes, no artifacts, no distortion, clean edges, sharp focus, polished realism";

  const finishing =
    outputType === "video"
      ? "professional film framing, premium continuity, natural motion blur, coherent sequence, elegant pacing, crisp detail"
      : "professional framing, polished visual fidelity, natural realism, premium artistic quality, balanced composition, refined color grading";

  if (!base) {
    return `A ${outputType}-quality visual scene with ${description}, ${finishing}.`;
  }

  return `${base}, ${description}, ${finishing}, high fidelity, premium quality, clean composition, realistic lighting, no blemishes, no artifacts, no visual noise`;
}

export function buildMotionPromptVariants(prompt, count = 4) {
  const base = sanitizePrompt(prompt) || "dynamic scene";
  const variantCount = normalizeVariantCount(count);
  const variants = [];
  const styles = [
    "slow cinematic dolly-in, atmospheric depth, soft natural motion, pristine sharpness",
    "dynamic camera drift, dramatic lighting, expressive composition, fluid transitions, realistic motion cues",
    "smooth tracking shot, immersive environment, rich detail, stabilized framing, no jitter, no distortion",
    "high-energy motion, layered depth, crisp focus, realistic motion blur, polished continuity, no artifacts",
    "golden-hour lighting, premium composition, clean edges, coherent motion, luxurious cinematic feel",
    "wide establishing shot, elegant pacing, cinematic contrast, refined realism, seamless frame-to-frame continuity",
  ];

  for (let i = 0; i < variantCount; i += 1) {
    const style = styles[i % styles.length];
    variants.push(
      `${base}, ${style}, premium cinematic quality, motion-aware framing, polished lighting, refined realism, no blemishes, no artifacts, clean composition, high fidelity, visually flawless`
    );
  }

  return variants;
}

export function parseVideoEditInstructions(instruction) {
  const prompt = sanitizePrompt(instruction).toLowerCase();
  const filters = [];

  if (/black and white|grayscale|greyscale|monochrome/.test(prompt)) {
    filters.push("grayscale(1)");
  }
  if (/sepia|vintage/.test(prompt)) filters.push("sepia(1)");
  if (/vivid|saturat/.test(prompt)) filters.push("saturate(1.35)");
  if (/high contrast|more contrast/.test(prompt)) filters.push("contrast(1.2)");
  if (/brighter|brighten/.test(prompt)) filters.push("brightness(1.18)");
  if (/darker|darken/.test(prompt)) filters.push("brightness(0.82)");

  const speed = /slow[- ]motion|slow it down/.test(prompt)
    ? 0.5
    : /speed it up|faster|fast[- ]motion/.test(prompt)
      ? 1.5
      : 1;
  const trimStart = prompt.match(/(?:start|trim from)\s+(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)\b/);
  const trimEnd = prompt.match(/(?:end|trim to|cut at)\s+(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)\b/);
  const caption = sanitizePrompt(instruction).match(
    /(?:caption|title|overlay text|add text)\s*[:\-]\s*["“]?(.+?)["”]?(?:$|[.!?]\s)/i
  )?.[1]?.trim();

  return {
    filters,
    speed,
    trimStartSeconds: trimStart ? Number(trimStart[1]) : 0,
    trimEndSeconds: trimEnd ? Number(trimEnd[1]) : null,
    caption: caption || "",
  };
}

export default {
  enhanceVisualPrompt,
  buildMotionPromptVariants,
  parseVideoEditInstructions,
};
