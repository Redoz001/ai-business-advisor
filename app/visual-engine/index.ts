import { reasonFromPrompt } from "./reasoning";
import { applyVisualStyle } from "./styleEngine";
import { buildSceneBlueprint } from "./blueprintEngine";
import { renderSceneToSvg } from "./renderer";

export function generateVisualSvg(prompt: string): string {
  const reasonedScene = reasonFromPrompt(prompt);
  const styledScene = applyVisualStyle(reasonedScene);
  const finalScene = buildSceneBlueprint(styledScene);

  return renderSceneToSvg(finalScene);
}