import type { RunwayImageRequest } from "./runway.schema.ts";

export function sanitizeRunwayInput(input: Partial<RunwayImageRequest>): RunwayImageRequest {
  return {
    promptText: String(input.promptText ?? ""),
    // ✅ Use gen4_image (text-only) by default, not turbo
    model: input.model ?? "gen4_image",
    ratio: input.ratio ?? "1024:1024",

    // ✅ referenceImages is optional for gen4_image; keep as empty array if not provided
    referenceImages: Array.isArray(input.referenceImages)
      ? input.referenceImages
      : [],
  };
}