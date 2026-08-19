"use client";

import { useEffect, useState } from "react";
import ChatInput from "./components/ChatInput";
import Conversation from "./components/Conversation";

import { useConversation } from "./hooks/useConversation";

import type {
  ConversationEngineProps,
} from "./types/Conversation";

export default function ConversationEngine(
  props: ConversationEngineProps
) {
  const conversation =
    useConversation(props);

  const [lastAiResponse, setLastAiResponse] =
    useState("");

  const handleQuickSend = (message: string) => {
    conversation.setInput(message);
    // Need to wait a tick for state to update
    setTimeout(() => {
      conversation.sendMessage();
    }, 50);
  };

  // Watch for new assistant messages to speak them
  const latestAssistant =
    conversation.messages.findLast(
      (m) => m.role === "assistant"
    );

  useEffect(() => {
    if (
      latestAssistant?.content &&
      latestAssistant.content !== lastAiResponse &&
      latestAssistant.content !== "Generating image..." &&
      latestAssistant.content !== "Generating video..."
    ) {
      setLastAiResponse(latestAssistant.content);
    }
  }, [latestAssistant?.content]);

  const username =
    props.user?.email?.split("@")[0] ||
    "there";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-zinc-950 text-white">
      <Conversation
        messages={conversation.messages}
        welcome={conversation.welcome}
        username={username}
        loadingHistory={
          conversation.historyLoading
        }
        onDownloadImage={
          conversation.handleDownloadImage
        }
        onDownloadVideo={
          conversation.handleDownloadVideo
        }
      />

      {conversation.error && (
        <div className="px-3 pb-2 text-sm text-red-400">
          {conversation.error}
        </div>
      )}

      <ChatInput
        input={conversation.input}
        loading={conversation.loading}
        onInputChange={
          conversation.setInput
        }
        onSend={conversation.sendMessage}
        onStop={conversation.stop}
        onImageUpload={
          conversation.handleImageUpload
        }
        onCameraCapture={
          conversation.handleCameraCapture
        }
        onQuickSend={handleQuickSend}
        aiResponseText={lastAiResponse}
      />
    </div>
  );
}
