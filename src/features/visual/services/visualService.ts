import { generateVisual } from "../../../services/reucore";

export async function createVisual(prompt: string) {
  const result = await generateVisual({
    prompt,
    outputType: "image",
  });

  if (!result.success || !result.svg) {
    throw new Error(result.error || "Unable to generate the visual.");
  }

  return result.svg;
}
