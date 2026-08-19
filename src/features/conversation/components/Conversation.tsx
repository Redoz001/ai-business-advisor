import {
  useEffect,
  useRef,
} from "react";

import MessageRenderer from "./MessageRenderer";

import type {
  ConversationMessage,
} from "../types/Message";

type ConversationProps = {
  messages: ConversationMessage[];
  welcome: string;
  username: string;
  loadingHistory: boolean;
  onDownloadImage?: (url: string, filename: string) => void;
  onDownloadVideo?: (url: string, filename: string) => void;
};

export default function Conversation({
  messages,
  welcome,
  username,
  loadingHistory,
  onDownloadImage,
  onDownloadVideo,
}: ConversationProps) {
  const bottomRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  if (loadingHistory) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Loading conversation...
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      {messages.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-center">
          <div className="max-w-md">
            <h2 className="mb-3 text-xl font-bold">
              Hey {username} 👋
            </h2>

            <p className="text-zinc-400">
              {welcome}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[85%] rounded-xl p-3 ${
              message.role === "user"
                ? "ml-auto bg-green-400 text-black"
                : "bg-zinc-900 text-white"
            }`}
          >
            <MessageRenderer
              message={message}
              onDownloadImage={onDownloadImage}
              onDownloadVideo={onDownloadVideo}
            />

            {message.status === "streaming" && (
              <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-zinc-400 align-middle" />
            )}
          </div>
        ))}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
