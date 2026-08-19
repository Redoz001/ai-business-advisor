// src/features/conversation/components/MessageRenderer.tsx
import CodeMessage from "./CodeMessage";
import ImageMessage from "./ImageMessage";
import SystemMessage from "./SystemMessage";
import TextMessage from "./TextMessage";
import VideoMessage from "./VideoMessage";

import type { ConversationMessage } from "../types/Message";

type MessageRendererProps = {
  message: ConversationMessage;
  onDownloadImage?: (url: string, filename: string) => void;
  onDownloadVideo?: (url: string, filename: string) => void;
};

export default function MessageRenderer({ message, onDownloadImage, onDownloadVideo }: MessageRendererProps) {
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

    if (!imageData) {
      console.warn("No image payload or image object found for image message.");
      return (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-100">
          <p className="font-medium">Image request recognized</p>
          <p className="mt-2 text-sm text-amber-100/80">
            The system detected an image request, but no image data was returned. Check your visual generation pipeline or API response.
          </p>
        </div>
      );
    }

    console.log("🖼️ IMAGE DATA:", imageData);
    return <ImageMessage content={message.content} image={imageData} onDownload={onDownloadImage} />;
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

    if (!videoData?.url) {
      console.warn("No video payload or video object found for video message.");
      return (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-100">
          <p className="font-medium">Video request recognized</p>
          <p className="mt-2 text-sm text-amber-100/80">
            The system detected a video request, but no video data was returned. The feature may still be under development or the backend returned a placeholder response.
          </p>
        </div>
      );
    }

    return <VideoMessage content={message.content} video={videoData} onDownload={onDownloadVideo} />;
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