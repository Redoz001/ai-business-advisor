import type { SceneBlueprint } from "./types";

export function applyVisualStyle(scene: SceneBlueprint): SceneBlueprint {
  const styles = {
    futuristic: {
      mood: "futuristic, intelligent, glowing, premium",
      colorPalette: ["#020617", "#7c3aed", "#22d3ee", "#ffffff"],
    },
    cinematic: {
      mood: "cinematic, dramatic, high contrast, premium",
      colorPalette: ["#030712", "#6d28d9", "#f8fafc", "#111827"],
    },
    corporate: {
      mood: "professional, clean, trustworthy, enterprise",
      colorPalette: ["#020617", "#4f46e5", "#94a3b8", "#ffffff"],
    },
    minimal: {
      mood: "minimal, clean, elegant, simple",
      colorPalette: ["#000000", "#ffffff", "#7c3aed", "#18181b"],
    },
    poster: {
      mood: "bold, branded, social media ready, premium",
      colorPalette: ["#000000", "#8b5cf6", "#c084fc", "#ffffff"],
    },
    websiteHero: {
      mood: "wide, cinematic, premium website hero",
      colorPalette: ["#020617", "#7c3aed", "#06b6d4", "#ffffff"],
    },
  };

  const selected = styles[scene.style];

  return {
    ...scene,
    mood: selected.mood,
    colorPalette: selected.colorPalette,
  };
}