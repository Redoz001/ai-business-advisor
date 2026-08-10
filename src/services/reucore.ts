import { ProceduralImageGenerator } from "../reucore/image/ProceduralImageGenerator";

export type ReuCoreOutputType = "image" | "video";

export type GenerateVisualRequest = {
  prompt: string;
  outputType?: ReuCoreOutputType;
  quality?: "standard" | "high"; // high will rasterize and apply post-processing
};

export type GenerateVisualResult = {
  success: boolean;
  svg?: string;
  url?: string; // data URL or blob URL for rasterized PNG or video
  width?: number;
  height?: number;
  seed?: number;
  video?: { url: string; mimeType?: string; duration?: number };
  error?: string;
};

const imageGenerator = new ProceduralImageGenerator();

export async function generateVisual(
  request: GenerateVisualRequest
): Promise<GenerateVisualResult> {
  const prompt = String(request?.prompt || "").trim();

  if (!prompt) {
    return { success: false, error: "Enter a prompt before generating." };
  }

  // Video path
  if (request.outputType === "video") {
    try {
      const generated = imageGenerator.generate(prompt);

      const baseWidth = generated.width || 800;
      const baseHeight = generated.height || 600;
      const quality = request.quality || "standard";
      const scale = quality === "high" ? 1 : 1;
      const width = Math.max(1, Math.floor(baseWidth * scale));
      const height = Math.max(1, Math.floor(baseHeight * scale));

      const svgBlob = new Blob([generated.svg], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(svgUrl);
        return { success: false, error: "Unable to create canvas context for video generation." };
      }

      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
        img.src = svgUrl;
      });

      const fps = quality === "high" ? 30 : 24;
      const duration = quality === "high" ? 3 : 2; // seconds
      const totalFrames = Math.max(1, Math.floor(fps * duration));

      const stream = (canvas as HTMLCanvasElement).captureStream(fps);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
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

        // motion parameters
        const angle = (t - 0.5) * 0.12; // small rotation
        const scaleAnim = 1 + Math.sin(t * Math.PI * 2) * 0.01;
        const offsetX = Math.sin(t * Math.PI * 2) * (width * 0.008);
        const offsetY = Math.cos(t * Math.PI * 2) * (height * 0.006);

        ctx.save();
        ctx.clearRect(0, 0, width, height);

        // simple motion blur by drawing a few sub-frames with decreasing alpha
        const subSteps = quality === "high" ? 3 : 1;
        for (let s = 0; s < subSteps; s++) {
          const subAlpha = 1 / (s + 1) * (0.9 / subSteps);
          ctx.globalAlpha = subAlpha;
          ctx.save();
          const subT = t - (s / subSteps) * (1 / fps);
          const subAngle = (subT - 0.5) * 0.12;
          const subScale = scaleAnim * (1 - s * 0.002);
          const subOffsetX = offsetX * (1 - s / subSteps);
          const subOffsetY = offsetY * (1 - s / subSteps);

          ctx.translate(width / 2 + subOffsetX, height / 2 + subOffsetY);
          ctx.rotate(subAngle);
          ctx.scale(subScale, subScale);
          ctx.drawImage(img, -width / 2, -height / 2, width, height);
          ctx.restore();
        }

        ctx.restore();

        // wait for next frame
        await new Promise((r) => setTimeout(r, 1000 / fps));
      }

      recorder.stop();
      const videoBlob = await stoppedPromise;
      const videoUrl = URL.createObjectURL(videoBlob);
      URL.revokeObjectURL(svgUrl);

      return {
        success: true,
        video: { url: videoUrl, mimeType, duration },
        width: baseWidth,
        height: baseHeight,
        seed: generated.seed,
      };
    } catch (err) {
      console.error("Video generation failed:", err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // Image path
  try {
    const generated = imageGenerator.generate(prompt);
    const quality = request.quality || "standard";

    if (quality === "high") {
      // rasterize SVG at 2x and apply simple post-processing
      const scale = 2;
      const width = Math.max(1, Math.floor((generated.width || 800) * scale));
      const height = Math.max(1, Math.floor((generated.height || 600) * scale));

      const svgBlob = new Blob([generated.svg], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
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

      // draw base
      ctx.clearRect(0, 0, width, height);
      try {
        (ctx as any).filter = "contrast(1.06) saturate(1.06)";
      } catch {}
      ctx.drawImage(img, 0, 0, width, height);

      // vignette
      const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.08, width / 2, height / 2, Math.max(width, height) * 0.9);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.18)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      // film grain
      const grain = ctx.createImageData(width, height);
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

    // standard: return SVG
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
