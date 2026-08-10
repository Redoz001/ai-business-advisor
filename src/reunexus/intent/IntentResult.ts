import type {
  IntentSource,
  ReuNexusIntent,
} from "./IntentTypes";

export type IntentResult = {
  intent: ReuNexusIntent;
  confidence: number;
  source: IntentSource;
  originalPrompt: string;
  normalizedPrompt: string;
  requiresClarification: boolean;
  clarificationQuestion?: string;
  metadata: {
    isEditingRequest: boolean;
    isFollowUpRequest: boolean;
    requestedDurationSeconds?: number;
    requestedAspectRatio?: string;
  };
};
