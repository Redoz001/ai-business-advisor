// src/features/conversation/components/MessageRenderer.tsx
import CodeMessage from "./CodeMessage";
import ImageMessage from "./ImageMessage";
import SystemMessage from "./SystemMessage";
import TextMessage from "./TextMessage";
import VideoMessage from "./VideoMessage";

import type { ConversationMessage } from "../types/Message";

type MessageRendererProps = {
  message: ConversationMessage;
};

export default function MessageRenderer({ message }: MessageRendererProps) {
  // --- DEBUG LOG ---
  console.log("📨 MessageRenderer received:", message);

  // --- FORCE IMAGE DETECTION ---
  // If the message content looks like a data URL, treat as image
  const isImageDataUrl =
    typeof message.content === "string" &&
    message.content.startsWith("data:image/");

  if (isImageDataUrl) {
    console.log("🖼️ Detected data URL in content, forcing image render.");
    return (
      <ImageMessage
        content={message.content}
        image={{ svg: message.content }}
      />
    );
  }

  // --- IMAGE HANDLING (normal) ---
  if (message.type === "image") {
    let imageData = message.image;

    // If payload exists but image doesn't, convert payload to image
    if (!imageData && message.payload) {
      const payload = message.payload;

      if (typeof payload === "string") {
        const isDataUrl = payload.startsWith("data:image/");
        imageData = isDataUrl
          ? { svg: payload, prompt: message.content }
          : { url: payload, prompt: message.content };
      } else if (typeof payload === "object") {
        if (payload.svg) {
          imageData = { svg: payload.svg, prompt: payload.prompt || message.content };
        } else if (payload.url) {
          imageData = { url: payload.url, prompt: payload.prompt || message.content };
        } else {
          imageData = { url: String(payload), prompt: message.content };
        }
      }
    }

    console.log("🖼️ IMAGE DATA:", imageData);
    return <ImageMessage content={message.content} image={imageData} />;
  }

  // --- VIDEO HANDLING ---
  if (message.type === "video") {
    let videoData = message.video;
    if (!videoData && message.payload) {
      const payload = message.payload;
      if (typeof payload === "string") {
        videoData = { url: payload, prompt: message.content };
      } else if (typeof payload === "object" && payload.url) {
        videoData = { url: payload.url, prompt: payload.prompt || message.content };
      } else {
        videoData = { url: String(payload), prompt: message.content };
      }
    }
    return <VideoMessage content={message.content} video={videoData} />;
  }

  // --- CODE ---
  if (message.type === "code") {
    return <CodeMessage content={message.content} />;
  }

  // --- SYSTEM ---
  if (message.type === "system") {
    return <SystemMessage content={message.content} />;
  }

  // --- TEXT (default) ---
  return <TextMessage content={message.content} />;
}