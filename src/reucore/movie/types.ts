// src/reucore/movie/types.ts
// Frontend mirror of the MovieManifest produced by the edge function's
// screenwriter (supabase/functions/reuben-ai/ai/screenwriter.ts).

export type MovieCamera =
  | "WIDE"
  | "MEDIUM"
  | "CLOSE-UP"
  | "EXTREME-CLOSE-UP"
  | "OVER-THE-SHOULDER"
  | "AERIAL";

export type MovieShot = {
  id: string;
  camera: MovieCamera;
  action: string;
  caption: string;
  seconds: number;
  transition: "cut" | "dissolve" | "fade";
};

export type MovieScene = {
  id: string;
  heading: string;
  location: string;
  timeOfDay: string;
  narration: string;
  shots: MovieShot[];
};

export type MovieManifest = {
  title: string;
  tagline: string;
  genre: string;
  styleTokens: string;
  aspectRatio: "2.39:1" | "16:9";
  director: string;
  runtimeSeconds: number;
  scenes: MovieScene[];
  chapter: number;
};

export type MovieProgress = {
  phase:
    | "idle"
    | "writing"
    | "fetching-keyframes"
    | "rendering"
    | "continuing"
    | "done"
    | "error";
  sceneIndex: number;
  sceneTotal: number;
  shotIndex: number;
  shotTotal: number;
  elapsedSeconds: number;
  renderedSeconds: number;
  detail: string;
};

export type NumberedShot = {
  scene: MovieScene;
  shot: MovieShot;
  absoluteIndex: number;
};