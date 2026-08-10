import React from "react";
import { ConversationEngine } from "../features/conversation";

export default function ReubenAI({
  user,
  activeChat,
  setActiveChat,
}) {
  return (
    <ConversationEngine
      user={user}
      activeChat={activeChat}
      setActiveChat={setActiveChat}
    />
  );
}
