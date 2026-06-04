import type { RunwayImageRequest } from "./runway.schema.ts";

export function sanitizeRunwayInput(input: Partial<RunwayImageRequest>): RunwayImageRequest {
  return {
    promptText: String(input.promptText ?? ""),
    model: input.model ?? "gen4_image_turbo",
    ratio: input.ratio ?? "1024:1024",

    // 🔥 KEY FIX: NEVER allow undefined
    referenceImages: Array.isArray(input.referenceImages)
      ? input.referenceImages
      : [],
  };
}