export type ReuNexusIntent =
  | "text"
  | "image"
  | "video"
  | "image-edit"
  | "video-edit"
  | "code"
  | "document"
  | "unknown";

export type IntentSource =
  | "explicit-command"
  | "rule"
  | "conversation-context"
  | "fallback";

export type ConversationMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  outputType?: ReuNexusIntent;
};

export type IntentContext = {
  messages?: ConversationMessage[];
  hasImageAttachment?: boolean;
  hasVideoAttachment?: boolean;
  hasDocumentAttachment?: boolean;
};
