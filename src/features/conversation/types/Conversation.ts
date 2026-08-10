import type { ConversationMessage } from "./Message";

export type ConversationUser = {
  id?: string;
  email?: string;
};

export type ConversationEngineProps = {
  user: ConversationUser | null;
  activeChat: string | null;
  setActiveChat: (chatId: string | null) => void;
};

export type ConversationState = {
  messages: ConversationMessage[];
  input: string;
  loading: boolean;
  error: string | null;
};
