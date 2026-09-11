import { ProceduralImageGenerator } from "../reucore/image/ProceduralImageGenerator";
import {
  enhanceVisualPrompt,
  buildMotionPromptVariants,
} from "./visualPrompting.js";

export type ReuCoreOutputType = "image" | "video";

export type GenerateVisualRequest = {
  prompt: string;
  outputType?: ReuCoreOutputType;
  quality?: "standard" | "high";
};

export type GenerateVisualResult = {
  success: boolean;
  svg?: string;
  url?: string;
  width?: number;
  height?: number;
  seed?: number;
  video?: { url: string; mimeType?: string; duration?: number };
  error?: string;
};

const imageGenerator = new ProceduralImageGenerator();

// Pollinations.ai - free AI image generation, no API key needed
const POLLINATIONS_URL = "https://image.pollinations.ai/prompt/";

async function generateRealImage(
  prompt: string,
  width = 1024,
  height = 1024,
  seed?: number,
  quality: "standard" | "high" = "standard"
): Promise<string | null> {
  try {
    const refinedPrompt = enhanceVisualPrompt(prompt, "image");
    const qualityPrompt =
      quality === "high"
        ? `${refinedPrompt}, crisp detail, clean composition, no artifacts, no blemishes, no distortion, clean edges, sharp focus, rich texture, balanced lighting, high fidelity, premium realism, elegant color grading, polished final render`
        : `${refinedPrompt}, clean composition, balanced lighting, high fidelity, no artifacts, no blemishes`;

    const encodedPrompt = encodeURIComponent(qualityPrompt);
    const seedParam = seed ? `&seed=${seed}` : `&seed=${Math.floor(Math.random() * 100000)}`;
    const url = `${POLLINATIONS_URL}${encodedPrompt}?width=${width}&height=${height}&nologo=true${seedParam}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const blob = await response.blob();
    if (blob.size < 1000) return null;

    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn("Pollinations.ai failed:", err);
    return null;
  }
}

// Generate multiple frames for animation storyboard
async function generateAnimationFrames(
  prompt: string,
  frameCount: number,
  quality: "standard" | "high" = "standard"
): Promise<HTMLImageElement[]> {
  const frames: HTMLImageElement[] = [];
  const motionPrompts = buildMotionPromptVariants(prompt, frameCount);

  for (let i = 0; i < frameCount; i++) {
    const motionPrompt = motionPrompts[i % motionPrompts.length];
    const seed = 1000 + i * 137;
    const url = await generateRealImage(motionPrompt, 1024, 1024, seed, quality);
    if (!url) continue;

    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = url;
    });
    frames.push(img);
  }

  return frames;
}

// Fallback: multi-frame animation storyboard
async function generateFallbackVideo(
  prompt: string,
  baseImageUrl: string,
  quality: "standard" | "high" = "standard"
): Promise<string | null> {
  try {
    const width = 1024;
    const height = 1024;
    const fps = 24;
    const duration = 4;
    const totalFrames = fps * duration;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Try to get multiple frames for animation
    const frames = await generateAnimationFrames(prompt, 6, quality);

    // If we got multiple frames, use them; otherwise use the single base image
    const hasMultipleFrames = frames.length > 1;
    const primaryImg = hasMultipleFrames ? frames[0] : await loadImage(baseImageUrl);

    if (!primaryImg) return null;

    const stream = canvas.captureStream(fps);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size) chunks.push(ev.data);
    };

    const stoppedPromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    recorder.start();

    for (let i = 0; i < totalFrames; i++) {
      const t = i / Math.max(1, totalFrames - 1);

      if (hasMultipleFrames) {
        // Crossfade between frames
        const frameProgress = t * (frames.length - 1);
        const frameIndex = Math.min(frames.length - 1, Math.floor(frameProgress));
        const nextIndex = Math.min(frames.length - 1, frameIndex + 1);
        const blend = frameProgress - frameIndex;

        const currentFrame = frames[frameIndex];
        const nextFrame = frames[nextIndex];

        ctx.clearRect(0, 0, width, height);

        // Draw current frame with camera motion
        const scale = 1 + Math.sin(t * Math.PI) * 0.03;
        const offsetX = Math.sin(t * Math.PI * 2) * 15;
        const offsetY = Math.cos(t * Math.PI * 2.3) * 10;

        ctx.save();
        ctx.translate(width / 2 + offsetX, height / 2 + offsetY);
        ctx.scale(scale, scale);
        ctx.drawImage(currentFrame, -width / 2, -height / 2, width, height);
        ctx.restore();

        // Crossfade to next frame
        if (blend > 0.1 && nextFrame !== currentFrame) {
          ctx.globalAlpha = blend * 0.5;
          ctx.save();
          ctx.translate(width / 2 - offsetX, height / 2 - offsetY);
          ctx.scale(1.02, 1.02);
          ctx.drawImage(nextFrame, -width / 2, -height / 2, width, height);
          ctx.restore();
          ctx.globalAlpha = 1;
        }
      } else {
        // Single image with camera motion
        const scale = 1 + Math.sin(t * Math.PI) * 0.04;
        const offsetX = Math.sin(t * Math.PI * 2) * 20;
        const offsetY = Math.cos(t * Math.PI * 2.3) * 15;

        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.translate(width / 2 + offsetX, height / 2 + offsetY);
        ctx.rotate(Math.sin(t * Math.PI * 1.7) * 0.008);
        ctx.scale(scale, scale);
        ctx.drawImage(primaryImg, -width / 2, -height / 2, width, height);
        ctx.restore();
      }

      await new Promise((r) => setTimeout(r, 1000 / fps));
    }

    recorder.stop();
    const videoBlob = await stoppedPromise;
    return URL.createObjectURL(videoBlob);
  } catch (err) {
    console.error("Fallback video generation failed:", err);
    return null;
  }
}

// Helper to load image
async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = src;
    });
    return img;
  } catch {
    return null;
  }
}

export async function generateVisual(
  request: GenerateVisualRequest
): Promise<GenerateVisualResult> {
  const prompt = String(request?.prompt || "").trim();

  if (!prompt) {
    return { success: false, error: "Enter a prompt before generating." };
  }

  // ============ VIDEO PATH ============
  if (request.outputType === "video") {
    try {
      // Generate base image first
      const quality = request.quality || "standard";
      const baseImageUrl = await generateRealImage(prompt, 1024, 1024, undefined, quality);

      if (!baseImageUrl) {
        return { success: false, error: "Unable to generate base image for video." };
      }

      // Use multi-frame animation as primary video generation
      console.log("Generating multi-frame video animation...");
      let videoUrl = await generateFallbackVideo(prompt, baseImageUrl, quality);

      if (!videoUrl) {
        URL.revokeObjectURL(baseImageUrl);
        return { success: false, error: "Unable to generate video." };
      }

      return {
        success: true,
        video: { url: videoUrl, mimeType: "video/webm", duration: 4 },
        width: 1024,
        height: 1024,
        seed: Math.floor(Math.random() * 100000),
      };
    } catch (err) {
      console.error("Video generation failed:", err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ============ IMAGE PATH ============
  try {
    const quality = request.quality || "standard";
    const realImageUrl = await generateRealImage(prompt, 1024, 1024, undefined, quality);

    if (realImageUrl) {
      return {
        success: true,
        url: realImageUrl,
        width: 1024,
        height: 1024,
        seed: Math.floor(Math.random() * 100000),
      };
    }

    // Fallback to procedural SVG
    const generated = imageGenerator.generate(
      enhanceVisualPrompt(prompt, "image"),
      { animated: false }
    );

    if (request.quality === "high") {
      const scale = 2;
      const w = Math.max(1, Math.floor((generated.width || 800) * scale));
      const h = Math.max(1, Math.floor((generated.height || 600) * scale));

      const svgBlob = new Blob([generated.svg], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(svgUrl);
        return { success: false, error: "Unable to create canvas context for rasterization." };
      }

      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
        img.src = svgUrl;
      });

      ctx.clearRect(0, 0, w, h);
      try {
        (ctx as any).filter = "contrast(1.06) saturate(1.06)";
      } catch {}
      ctx.drawImage(img, 0, 0, w, h);

      const vignette = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.08,
        w / 2, h / 2, Math.max(w, h) * 0.9
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.18)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      const grain = ctx.createImageData(w, h);
      for (let i = 0; i < grain.data.length; i += 4) {
        const v = (Math.random() - 0.5) * 24;
        grain.data[i] = v + 128;
        grain.data[i + 1] = v + 128;
        grain.data[i + 2] = v + 128;
        grain.data[i + 3] = 8;
      }
      ctx.putImageData(grain, 0, 0);

      const dataUrl = canvas.toDataURL("image/png");
      URL.revokeObjectURL(svgUrl);

      return {
        success: true,
        svg: generated.svg,
        url: dataUrl,
        width: generated.width,
        height: generated.height,
        seed: generated.seed,
      };
    }

    return {
      success: true,
      svg: generated.svg,
      width: generated.width,
      height: generated.height,
      seed: generated.seed,
    };
  } catch (err) {
    console.error("ReuNexus image generation failed", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}