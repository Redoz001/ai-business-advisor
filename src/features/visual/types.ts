export type VisualStyle =
  | "futuristic"
  | "cinematic"
  | "minimal"
  | "corporate"
  | "poster";

export type VisualHistoryItem = {
  id: string;
  prompt: string;
  mediaType: "image" | "video";
  sourcePath: string | null;
  outputPath: string;
  mimeType: string;
  createdAt: number;
  outputUrl: string;
};

export type VisualMediaType = VisualHistoryItem["mediaType"];
