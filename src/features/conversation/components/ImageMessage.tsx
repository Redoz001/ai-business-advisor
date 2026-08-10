// src/features/conversation/components/ImageMessage.tsx
import React from "react";

interface ImageMessageProps {
  content?: string;
  image?: {
    url?: string;
    svg?: string;
    prompt?: string;
    width?: number;
    height?: number;
    mimeType?: string;
  };
}

export default function ImageMessage({ content, image }: ImageMessageProps) {
  if (!image) {
    return <div className="text-gray-400">No image data</div>;
  }

  // --- SVG HANDLING ---
  if (image.svg) {
    let svgString = image.svg;

    // If it's a data URL, extract the SVG string
    if (typeof image.svg === "string" && image.svg.startsWith("data:image/svg+xml;base64,")) {
      try {
        const base64 = image.svg.split(",")[1];
        svgString = atob(base64);
      } catch (e) {
        console.warn("Failed to decode SVG data URL", e);
        return <div className="text-red-400">Image decoding failed</div>;
      }
    }

    try {
      return (
        <div className="reunexus-image-container" style={{ maxWidth: "100%" }}>
          <div
            dangerouslySetInnerHTML={{ __html: svgString }}
            style={{
              maxWidth: "100%",
              borderRadius: "8px",
              overflow: "hidden",
              background: "#0a0a0a",
            }}
          />
          {(content || image.prompt) && (
            <div className="text-sm text-gray-400 mt-2">{content || image.prompt}</div>
          )}
          {image.width && image.height && (
            <div className="text-xs text-gray-500 mt-1">
              {image.width} × {image.height}
            </div>
          )}
        </div>
      );
    } catch (e) {
      console.error("❌ SVG rendering error:", e);
      // Fallback: render as image tag
      return (
        <div className="reunexus-image-container" style={{ maxWidth: "100%" }}>
          <img
            src={image.svg}
            alt={content || "Generated image"}
            style={{ maxWidth: "100%", borderRadius: "8px" }}
            onError={(e) => {
              console.error("❌ Image load error");
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          {(content || image.prompt) && (
            <div className="text-sm text-gray-400 mt-2">{content || image.prompt}</div>
          )}
        </div>
      );
    }
  }

  // --- URL HANDLING (Runway or external) ---
  if (image.url) {
    return (
      <div className="reunexus-image-container" style={{ maxWidth: "100%" }}>
        <img
          src={image.url}
          alt={content || image.prompt || "Generated image"}
          style={{ maxWidth: "100%", borderRadius: "8px" }}
          loading="lazy"
        />
        {(content || image.prompt) && (
          <div className="text-sm text-gray-400 mt-2">{content || image.prompt}</div>
        )}
        {image.width && image.height && (
          <div className="text-xs text-gray-500 mt-1">{image.width} × {image.height}</div>
        )}
      </div>
    );
  }

  return <div className="text-gray-400">Unsupported image format</div>;
}