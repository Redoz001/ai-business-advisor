import { ProceduralImageGenerator } from "../reucore/image/ProceduralImageGenerator";

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

// Runway API for real video generation
const RUNWAY_API_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_API_VERSION = "2024-11-06";

function getRunwayApiKey(): string | null {
  const key = (import.meta as any).env?.VITE_RUNWAY_API_KEY;
  return key || null;
}

async function generateRealImage(prompt: string, width = 1024, height = 1024, seed?: number): Promise<string | null> {
  try {
    const encodedPrompt = encodeURIComponent(prompt);
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

// Real video generation using Runway API
async function generateRunwayVideo(prompt: string, imageUrl: string): Promise<string | null> {
  const apiKey = getRunwayApiKey();
  if (!apiKey) {
    console.warn("No Runway API key available");
    return null;
  }

  try {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": RUNWAY_API_VERSION,
    };

    // Use gen4_image_turbo for image-to-video generation
    const payload = {
      model: "gen4_image_turbo",
      promptText: prompt,
      image: imageUrl,
      ratio: "1024:1024",
      duration: 4,
    };

    console.log("Starting Runway video generation...");

    // Initialize task
    const initResponse = await fetch(`${RUNWAY_API_BASE}/image_to_video`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const initBody = await initResponse.text();
    if (!initResponse.ok) {
      console.error("Runway initialization failed:", initBody);
      return null;
    }

    const initData = JSON.parse(initBody);
    const taskId = initData.id;

    if (!taskId) {
      console.error("Runway did not return a task ID:", initBody);
      return null;
    }

    console.log("Runway task created:", taskId);

    // Poll for completion
    const maxAttempts = 30; // 2.5 minutes max
    const pollInterval = 5000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, pollInterval));

      const statusResponse = await fetch(`${RUNWAY_API_BASE}/tasks/${taskId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Runway-Version": RUNWAY_API_VERSION,
        },
      });

      const statusBody = await statusResponse.text();
      if (!statusResponse.ok) {
        console.error("Runway status check failed:", statusBody);
        return null;
      }

      const task = JSON.parse(statusBody);
      const status = String(task.status || "UNKNOWN").toUpperCase();

      console.log(`Runway task ${taskId}: attempt ${attempt}/${maxAttempts}, status: ${status}`);

      if (status === "SUCCEEDED") {
        const outputUrl = task.output_url || task.output;
        if (outputUrl) {
          console.log("Runway video generation completed:", outputUrl);
          return outputUrl;
        }
        console.error("Runway succeeded but no output URL:", statusBody);
        return null;
      }

      if (status === "FAILED" || status === "CANCELED" || status === "CANCELLED") {
        console.error("Runway task failed:", task.failure || task.error || statusBody);
        return null;
      }
    }

    console.error("Runway video generation timed out");
    return null;
  } catch (err) {
    console.error("Runway video generation error:", err);
    return null;
  }
}

// Fallback: simple animated video from single image
async function generateFallbackVideo(prompt: string, imageUrl: string): Promise<string | null> {
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

    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = imageUrl;
    });

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
      const t = i / (totalFrames - 1);
      const scale = 1 + Math.sin(t * Math.PI) * 0.05;
      const offsetX = Math.sin(t * Math.PI * 2) * 20;
      const offsetY = Math.cos(t * Math.PI * 2.3) * 15;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2 + offsetX, height / 2 + offsetY);
      ctx.rotate(Math.sin(t * Math.PI * 1.7) * 0.01);
      ctx.scale(scale, scale);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
      ctx.restore();

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
      const baseImageUrl = await generateRealImage(prompt, 1024, 1024);

      if (!baseImageUrl) {
        return { success: false, error: "Unable to generate base image for video." };
      }

      // Try Runway API for real video generation
      const runwayVideoUrl = await generateRunwayVideo(prompt, baseImageUrl);

      let videoUrl = runwayVideoUrl;

      // Fallback to local animation if Runway fails
      if (!videoUrl) {
        console.log("Falling back to local video generation...");
        videoUrl = await generateFallbackVideo(prompt, baseImageUrl);
      }

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
    const realImageUrl = await generateRealImage(prompt, 1024, 1024);

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
    const generated = imageGenerator.generate(prompt);
    const quality = request.quality || "standard";

    if (quality === "high") {
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