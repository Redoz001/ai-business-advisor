export type VisualStyle =
  | "futuristic"
  | "cinematic"
  | "minimal"
  | "corporate"
  | "poster";

export type VisualHistoryItem = {
  id: string;
  prompt: string;
  svg: string;
  createdAt: number;
};
