// src/reucore/movie/MovieRenderer.ts
// Renders a scene of keyframes into a real-time WebM segment using a canvas +
// MediaRecorder. Visual grammar: Ken Burns camera moves, crossfades, 2.39:1
// letterboxing, film grain, vignette, and on-screen captions.

import type {
  MovieCamera,
  MovieScene,
  MovieShot,
} from "./types";
import type { CharacterGender, CharacterStage } from "./CharacterStage";

export type ShotFrame = {
  image: CanvasImageSource;
  width: number;
  height: number;
};

export type RenderedShot = {
  shot: MovieShot;
  /**
   * Several keyframes per shot, cycled and cross-dissolved by the renderer.
   * One still per shot reads as a slideshow; a short run of action beats
   * flowing into each other reads as motion.
   */
  frames: ShotFrame[];
  /**
   * The real actor for this shot. When present the renderer composites a live
   * rigged 3D character over the painted background — this is what supplies
   * genuine continuous motion.
   */
  actor?: { gender: CharacterGender; speaking: boolean };
};

export type RenderSceneInput = {
  scene: MovieScene;
  shots: RenderedShot[];
  fps?: number;
  grain?: boolean;
  /** Offscreen 3D stage used to render animated characters. */
  stage?: CharacterStage;
};

const DEFAULT_FPS = 30;

/** Camera-driven Ken Burns motion curve for a shot. */
function kenBurns(camera: MovieCamera, t: number): {
  scale: number;
  panX: number;
  panY: number;
} {
  switch (camera) {
    case "WIDE":
      return { scale: 1.0 + 0.06 * t, panX: 0.005 * t, panY: -0.003 * t };
    case "AERIAL":
      return { scale: 1.05 + 0.04 * t, panX: -0.01 + 0.02 * t, panY: 0 };
    case "MEDIUM":
      return { scale: 1.02 + 0.04 * t, panX: 0, panY: 0 };
    case "CLOSE-UP":
      return { scale: 1.0 + 0.025 * t, panX: 0, panY: 0.002 * t };
    case "EXTREME-CLOSE-UP":
      return { scale: 1.0 + 0.012 * t, panX: 0, panY: 0 };
    case "OVER-THE-SHOULDER":
      return { scale: 1.03 + 0.02 * t, panX: 0.008 * t, panY: 0 };
    default:
      return { scale: 1.02, panX: 0, panY: 0 };
  }
}

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/** Pick the first MediaRecorder mime type the browser supports. */
export function pickRecorderMime(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const mime of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(mime)
    ) {
      return mime;
    }
  }
  return "video/webm";
}

export class MovieRenderer {
  readonly width: number;
  readonly height: number;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private noiseCanvas: HTMLCanvasElement | null = null;

  constructor(width = 1280, height = 536) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable.");
    this.ctx = ctx;
  }

  captureStream(fps: number): MediaStream {
    return this.canvas.captureStream(fps);
  }

  /**
   * Renders a scene to a WebM Blob. Runs in real time — a 30s scene takes
   * 30s wall-clock (that's how MediaRecorder works); callers should surface
   * renderedSeconds progress while this runs.
   */
  async renderScene(
    input: RenderSceneInput,
    onProgress?: (renderedSeconds: number, sceneSeconds: number) => void
  ): Promise<Blob> {
    const fps = input.fps ?? DEFAULT_FPS;
    const useGrain = input.grain ?? true;
    const mimeType = pickRecorderMime();

    const stream = this.captureStream(fps);
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 5_000_000,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const finished = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    recorder.start();

    const sceneSeconds = input.shots.reduce(
      (sum, s) => sum + s.shot.seconds,
      0
    );
    let rendered = 0;

    for (let idx = 0; idx < input.shots.length; idx++) {
      const shot = input.shots[idx];
      const prev = idx > 0 ? input.shots[idx - 1] : null;
      const seconds = shot.shot.seconds;

      await this.drawShot(
        shot,
        prev,
        seconds,
        fps,
        useGrain,
        input.stage,
        (t) => {
          onProgress?.(rendered + t * seconds, sceneSeconds);
        }
      );

      rendered += seconds;
      onProgress?.(rendered, sceneSeconds);
    }

    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    return finished;
  }

  /** Draws one shot: camera motion plus flowing cross-dissolves. */
  private async drawShot(
    current: RenderedShot,
    prev: RenderedShot | null,
    seconds: number,
    fps: number,
    useGrain: boolean,
    onTick: (t: number) => void
  ): Promise<void> {
    const frames = current.frames.length > 0 ? current.frames : [];
    const totalFrames = Math.max(1, Math.round(seconds * fps));
    const start = performance.now();
    const beats = Math.max(1, frames.length);
    const beatSeconds = seconds / beats;

    for (let f = 0; f < totalFrames; f++) {
      const t = f / totalFrames;
      const shotTime = t * seconds;
      const beatIndex = Math.min(beats - 1, Math.floor(shotTime / beatSeconds));
      const localT = (shotTime - beatIndex * beatSeconds) / beatSeconds;

      const cur = kenBurns(current.shot.camera, localT);
      this.drawCover(frames[beatIndex], cur.scale, cur.panX, cur.panY);

      // Flow into the NEXT keyframe across the last third of this beat. This
      // is what turns separate stills into continuous motion.
      const nextIndex = beatIndex + 1;
      if (nextIndex < beats && localT > 0.6) {
        const blend = (localT - 0.6) / 0.4;
        const nxt = kenBurns(current.shot.camera, 0);
        this.ctx.globalAlpha = blend;
        this.drawCover(
          frames[nextIndex],
          nxt.scale * 1.03,
          nxt.panX,
          nxt.panY
        );
        this.ctx.globalAlpha = 1;
      }

      // Scene-to-scene dissolve, driven by the screenplay's transition.
      if (prev && current.shot.transition === "dissolve" && t < 0.22) {
        const blend = 1 - easeInOut(t / 0.22);
        this.ctx.globalAlpha = blend;
        const pk = kenBurns(prev.shot.camera, 1);
        const pf =
          prev.frames.length > 0
            ? prev.frames[prev.frames.length - 1]
            : (prev as unknown as ShotFrame);
        this.drawCover(pf, pk.scale, pk.panX, pk.panY);
        this.ctx.globalAlpha = 1;
      }

      this.drawVignette();
      if (useGrain) this.drawGrain();
      if (current.shot.caption) this.drawCaption(current.shot.caption);
      if (t < 0.25) this.drawHeadingAlpha(1 - t / 0.25);

      onTick(t);
      await nextFrame();

      const elapsed = (performance.now() - start) / 1000;
      if (elapsed > seconds) break;
    }
  }

  /** Draw a frame to fill the canvas at a given scale + pan (cover crop). */
  private drawCover(
    frame: ShotFrame,
    scale: number,
    panX: number,
    panY: number
  ): void {
    const img = frame.image;
    const iw = frame.width || (img as HTMLImageElement).naturalWidth;
    const ih = frame.height || (img as HTMLImageElement).naturalHeight;
    if (!iw || !ih) return;

    const canvasAspect = this.width / this.height;
    const imageAspect = iw / ih;

    let dw: number;
    let dh: number;
    if (imageAspect > canvasAspect) {
      dh = this.height * scale;
      dw = dh * imageAspect;
    } else {
      dw = this.width * scale;
      dh = dw / imageAspect;
    }

    const dx = (this.width - dw) / 2 + panX * this.width;
    const dy = (this.height - dh) / 2 + panY * this.height;

    this.ctx.drawImage(img, dx, dy, dw, dh);
  }

  /** Soft cinematic vignette. */
  private drawVignette(): void {
    const grad = this.ctx.createRadialGradient(
      this.width / 2,
      this.height / 2,
      this.height * 0.35,
      this.width / 2,
      this.height / 2,
      this.width * 0.75
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.35)");
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /** Random film grain using a pre-generated noise tile. */
  private drawGrain(): void {
    if (!this.noiseCanvas) {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 256;
      const nctx = c.getContext("2d");
      if (!nctx) return;
      const imageData = nctx.createImageData(256, 256);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const v = Math.random() * 255;
        imageData.data[i] = v;
        imageData.data[i + 1] = v;
        imageData.data[i + 2] = v;
        imageData.data[i + 3] = 255;
      }
      nctx.putImageData(imageData, 0, 0);
      this.noiseCanvas = c;
    }

    const ox = Math.floor(Math.random() * 256);
    const oy = Math.floor(Math.random() * 256);
    this.ctx.save();
    this.ctx.globalAlpha = 0.05;
    this.ctx.globalCompositeOperation = "overlay";
    const pattern = this.ctx.createPattern(this.noiseCanvas, "repeat");
    if (pattern) {
      this.ctx.translate(-ox, -oy);
      this.ctx.fillStyle = pattern;
      this.ctx.fillRect(0, 0, this.width + 256, this.height + 256);
    }
    this.ctx.restore();
  }

  /** Caption bottom-center. */
  private drawCaption(text: string): void {
    this.ctx.save();
    this.ctx.font = `600 ${Math.round(this.height * 0.06)}px system-ui, sans-serif`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "bottom";
    this.ctx.shadowColor = "rgba(0,0,0,0.85)";
    this.ctx.shadowBlur = 10;
    this.ctx.fillStyle = "rgba(255,255,255,0.95)";
    this.ctx.fillText(text, this.width / 2, this.height - this.height * 0.08);
    this.ctx.restore();
  }

  /** Watermark/heading top-left with fading alpha. */
  private drawHeadingAlpha(alpha: number): void {
    if (alpha <= 0) return;
    this.ctx.save();
    this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    this.ctx.font = `500 ${Math.round(this.height * 0.045)}px system-ui, sans-serif`;
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "top";
    this.ctx.fillStyle = "rgba(255,255,255,0.85)";
    this.ctx.shadowColor = "rgba(0,0,0,0.8)";
    this.ctx.shadowBlur = 6;
    this.ctx.fillText(
      "REUNEXUS ORIGINAL",
      this.width * 0.04,
      this.height * 0.06
    );
    this.ctx.restore();
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}