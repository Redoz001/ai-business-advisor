export type VisualStyle =
  | "futuristic"
  | "cinematic"
  | "corporate"
  | "minimal"
  | "poster"
  | "websiteHero";

export type SceneEntity = {
  id: string;
  type: string;
  label: string;
  material?: string;
  color?: string;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  scale?: number;
};

export type SceneRelationship = {
  from: string;
  relation: string;
  to: string;
};

export type SceneBlueprint = {
  title: string;
  description: string;
  style: VisualStyle;
  mood: string;
  colorPalette: string[];
  entities: SceneEntity[];
  relationships: SceneRelationship[];
  textOverlay?: {
    headline: string;
    subheadline?: string;
    footer?: string;
  };
};