import type { IntentResult } from "../intent/IntentResult";
import type { ReuNexusIntent } from "../intent/IntentTypes";

export type RouteTarget =
  | "text-engine"
  | "image-engine"
  | "video-engine"
  | "code-engine"
  | "document-engine"
  | "clarification";

export type RouteResult = {
  target: RouteTarget;
  intent: ReuNexusIntent;
  confidence: number;
  prompt: string;
  clarificationQuestion?: string;
  metadata: IntentResult["metadata"];
};
