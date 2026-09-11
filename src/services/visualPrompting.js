export function enhanceVisualPrompt(prompt, type = "image") {
  const base = (prompt || "").trim();
  const description =
    type === "video"
      ? "cinematic motion, smooth camera movement, dynamic lighting, atmospheric depth, highly detailed composition, ultra-clean motion, natural continuity, no flicker, no warped anatomy, no artifacting"
      : "cinematic, ultra-detailed, high-quality, photorealistic, richly lit, refined textures, no blemishes, no artifacts, no distortion, clean edges, sharp focus, polished realism";

  const finishing =
    type === "video"
      ? "professional film framing, premium continuity, natural motion blur, coherent sequence, elegant pacing, crisp detail"
      : "professional framing, polished visual fidelity, natural realism, premium artistic quality, balanced composition, refined color grading";

  if (!base) {
    return `A ${type}-quality visual scene with ${description}, ${finishing}.`;
  }

  return `${base}, ${description}, ${finishing}, high fidelity, premium quality, clean composition, realistic lighting, no blemishes, no artifacts, no visual noise`;
}

export function buildMotionPromptVariants(prompt, count = 4) {
  const base = (prompt || "").trim() || "dynamic scene";
  const variants = [];
  const styles = [
    "slow cinematic dolly-in, atmospheric depth, soft natural motion, pristine sharpness",
    "dynamic camera drift, dramatic lighting, expressive composition, fluid transitions, realistic motion cues",
    "smooth tracking shot, immersive environment, rich detail, stabilized framing, no jitter, no distortion",
    "high-energy motion, layered depth, crisp focus, realistic motion blur, polished continuity, no artifacts",
    "golden-hour lighting, premium composition, clean edges, coherent motion, luxurious cinematic feel",
    "wide establishing shot, elegant pacing, cinematic contrast, refined realism, seamless frame-to-frame continuity",
  ];

  for (let i = 0; i < Math.max(1, Number(count) || 1); i += 1) {
    const style = styles[i % styles.length];
    variants.push(
      `${base}, ${style}, premium cinematic quality, motion-aware framing, polished lighting, refined realism, no blemishes, no artifacts, clean composition, high fidelity, visually flawless`
    );
  }

  return variants;
}

export default {
  enhanceVisualPrompt,
  buildMotionPromptVariants,
};
