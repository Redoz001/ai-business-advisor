import type { SceneBlueprint } from "./types";

export function buildSceneBlueprint(scene: SceneBlueprint): SceneBlueprint {
  const lowerPrompt = scene.description.toLowerCase();

  const entities = [...scene.entities];

  if (lowerPrompt.includes("ai") || lowerPrompt.includes("artificial intelligence")) {
    entities.push({
      id: "ai-core",
      type: "energy-core",
      label: "AI Core",
      material: "violet holographic energy",
      color: "#8b5cf6",
      position: { x: 0, y: 0, z: 1 },
      scale: 1.2,
    });
  }

  if (lowerPrompt.includes("business") || lowerPrompt.includes("company")) {
    entities.push({
      id: "business-network",
      type: "network",
      label: "Business Network",
      material: "digital connections",
      color: "#22d3ee",
      position: { x: 1, y: 0, z: 0 },
      scale: 1,
    });
  }

  if (lowerPrompt.includes("cloud")) {
    entities.push({
      id: "cloud-system",
      type: "cloud",
      label: "Cloud System",
      material: "soft glowing cloud infrastructure",
      color: "#38bdf8",
      position: { x: -1, y: 0.5, z: 0 },
      scale: 1,
    });
  }

  return {
    ...scene,
    entities,
    relationships: [
      ...scene.relationships,
      {
        from: "main-idea",
        relation: "powered-by",
        to: "ai-core",
      },
    ],
  };
}