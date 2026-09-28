// src/reucore/movie/MovieEngine.ts
// ReuNexus Film Studio production house. Turns a MovieManifest into a real,
// growing video: generates keyframes (Pollinations, keyless, IndexedDB-cached),
// renders each scene into a WebM segment via MovieRenderer, and streams it
// into a MediaSource-backed <video> so runtime is unbounded — films of 1 hour
// or more are just "keep adding scenes/chapters".

import {
  MovieRenderer,
  type RenderedShot,
} from "./MovieRenderer";
import {
  getCachedKeyframe,
  cacheKeyframe,
} from "./KeyframeCache";
import { brandImageUrl } from "../branding/reunexusBrand";
import type {
  MovieManifest,
  MovieProgress,
  MovieScene,
  MovieShot,
} from "./types";

export type MovieProductionOptions = {
  video: HTMLVideoElement;
  manifest: MovieManifest;
  onProgress?: (progress: MovieProgress) => void;
  onSegment?: (blob: Blob, sceneIndex: number) => void;
  signal?: AbortSignal;
};

export type MovieProductionResult = {
  renderedSeconds: number;
  sceneCount: number;
  keyframeCount: number;
};

const KEYFRAME_W = 1024;
const KEYFRAME_H = 432; // 2.39:1

/** Replicates the edge function's keyframe prompt (kept in sync). */
function buildKeyframePrompt(
  manifest: MovieManifest,
  scene: MovieScene,
  shot: MovieShot
): string {
  const context = [scene.location, scene.timeOfDay]
    .filter(Boolean)
    .join(", ");
  return [
    `${shot.camera} shot of ${shot.action}`,
    context ? `location: ${context}` : "",
    `film: "${manifest.title}"`,
    manifest.styleTokens,
    "cinematic film still, anamorphic widescreen, dramatic volumetric lighting, highly detailed, consistent character design, no text overlay, no watermark",
  ]
    .filter(Boolean)
    .join(", ");
}

function shotSeed(shot: MovieShot): number {
  let h = 0;
  for (let i = 0; i < shot.id.length; i++) {
    h = (h * 31 + shot.id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 100000;
}

async function fetchKeyframe(
  prompt: string,
  seed: number,
  signal?: AbortSignal
): Promise<string> {
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    // `nologo` was removed from the Pollinations API schema; the lockup is
    // erased locally by brandImageUrl() before the frame is rendered.
    `?width=${KEYFRAME_W}&height=${KEYFRAME_H}&seed=${seed}`;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Keyframe fetch failed (${res.status})`);
  }
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Keyframe read failed."));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Keyframe image failed to load."));
    img.decoding = "sync";
    if (signal) {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }
    img.src = src;
  });
}

function emit(
  onProgress: ((p: MovieProgress) => void) | undefined,
  patch: Partial<MovieProgress>
): void {
  if (!onProgress) return;
  onProgress({
    phase: "idle",
    sceneIndex: 0,
    sceneTotal: 0,
    shotIndex: 0,
    shotTotal: 0,
    elapsedSeconds: 0,
    renderedSeconds: 0,
    detail: "",
    ...patch,
  });
}

export class MovieEngine {
  private renderer: MovieRenderer;
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  /** Every scene segment produced so far — replayed when a stream restarts. */
  private appendedBlobs: Blob[] = [];

  constructor(renderer?: MovieRenderer) {
    this.renderer = renderer ?? new MovieRenderer();
  }

  /**
   * Produces a film: generates every keyframe, renders each scene, and
   * streams the result into the given <video> so playback grows over time.
   */
  async produce(
    opts: MovieProductionOptions
  ): Promise<MovieProductionResult> {
    const { video, manifest, onProgress, onSegment, signal } = opts;

    const allShots = manifest.scenes.flatMap((s) => s.shots);
    const totalShots = allShots.length;

    emit(onProgress, {
      phase: "fetching-keyframes",
      sceneTotal: manifest.scenes.length,
      shotTotal: totalShots,
      detail: `Writing art direction for "${manifest.title}"…`,
    });

    // Set up MediaSource for progressive playback. After endOfStream() the
    // previous stream is terminal ("ended"), so a continuation chapter starts
    // a fresh stream and replays every segment produced so far — the player
    // still shows the whole film while runtime stays unbounded.
    const needsFreshStream =
      !this.mediaSource || this.mediaSource.readyState !== "open";
    const replayBlobs: Blob[] = needsFreshStream ? this.appendedBlobs : [];

    if (needsFreshStream) {
      this.mediaSource = new MediaSource();
      this.sourceBuffer = null;
      video.src = URL.createObjectURL(this.mediaSource);
      await new Promise<void>((resolve) => {
        this.mediaSource!.addEventListener("sourceopen", () => resolve(), {
          once: true,
        });
      });
    }

    // The SourceBuffer codec string must match what MediaRecorder actually
    // recorded (vp9 / vp8 / plain webm), so the buffer is created lazily from
    // the first blob's type instead of assuming "vp9,opus" — a mismatch makes
    // appendBuffer fail and leaves the player with nothing to display.
    const ensureSourceBuffer = (type?: string): void => {
      if (this.sourceBuffer || !this.mediaSource) return;
      const candidates = [
        type,
        'video/webm;codecs="vp9,opus"',
        "video/webm;codecs=vp9",
        "video/webm",
      ];
      for (const mime of candidates) {
        if (!mime) continue;
        try {
          const sb = this.mediaSource.addSourceBuffer(mime);
          sb.mode = "segments";
          this.sourceBuffer = sb;
          return;
        } catch {
          // try the next codec string
        }
      }
      this.sourceBuffer = null;
    };

    const appendBlob = async (blob: Blob): Promise<void> => {
      ensureSourceBuffer(blob.type);
      const sb = this.sourceBuffer;
      if (!sb) throw new Error("No MediaSource buffer available.");
      const buf = await blob.arrayBuffer();
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          sb.removeEventListener("updateend", onOk);
          sb.removeEventListener("error", onErr);
        };
        const onOk = () => {
          cleanup();
          resolve();
        };
        // A SourceBuffer failure fires "error" (never "updateend"); without
        // this listener the append promise hangs forever.
        const onErr = () => {
          cleanup();
          reject(new Error("SourceBuffer failed to append the scene."));
        };
        sb.addEventListener("updateend", onOk);
        sb.addEventListener("error", onErr);
        try {
          sb.appendBuffer(buf);
        } catch (err) {
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    };

    // Replay earlier chapters when the stream was restarted (see above).
    for (const oldBlob of replayBlobs) {
      if (signal?.aborted) break;
      await appendBlob(oldBlob);
    }

    let renderedSeconds = 0;
    let keyframeCount = 0;

    for (let sIdx = 0; sIdx < manifest.scenes.length; sIdx++) {
      const scene = manifest.scenes[sIdx];
      if (signal?.aborted) break;

      emit(onProgress, {
        phase: "fetching-keyframes",
        sceneIndex: sIdx,
        sceneTotal: manifest.scenes.length,
        shotTotal: totalShots,
        shotIndex: keyframeCount,
        renderedSeconds,
        detail: `Painting: ${scene.heading}`,
      });

      const rendered: RenderedShot[] = [];
      for (const shot of scene.shots) {
        if (signal?.aborted) break;
        const prompt = buildKeyframePrompt(manifest, scene, shot);
        const seed = shotSeed(shot);
        const cacheKey = `${manifest.title}:${shot.id}:${seed}`;

        let dataUrl = await getCachedKeyframe(cacheKey);
        if (!dataUrl) {
          dataUrl = await fetchKeyframe(prompt, seed, signal);
          try {
            await cacheKeyframe(cacheKey, dataUrl);
          } catch (cacheErr) {
            // A quota/private-mode cache failure must not kill production.
            console.warn("Keyframe cache skipped:", cacheErr);
          }
        }

        // Erase the Pollinations lockup and stamp ReuNexus branding before the
        // frame ever reaches the screen. Falls back to the raw frame on error.
        let img = await loadImage(dataUrl, signal);
        try {
          const brandedUrl = await brandImageUrl(dataUrl);
          if (brandedUrl) {
            img = await loadImage(brandedUrl, signal);
            URL.revokeObjectURL(brandedUrl);
          }
        } catch {
          /* keep the unbranded frame rather than failing the shot */
        }

        rendered.push({
          shot,
          image: img,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        keyframeCount += 1;

        emit(onProgress, {
          phase: "fetching-keyframes",
          sceneIndex: sIdx,
          sceneTotal: manifest.scenes.length,
          shotIndex: keyframeCount,
          shotTotal: totalShots,
          renderedSeconds,
          detail: `Painted shot ${keyframeCount}/${totalShots}`,
        });
      }

      if (signal?.aborted || rendered.length === 0) break;
      // eslint-disable-next-line no-await-in-loop
      await this.renderAndAppend(scene, {
        shots: rendered,
        manifest,
        video,
        appendBlob,
        sIdx,
        keyframeCount,
        totalShots,
        renderedSeconds,
        onProgress,
        onSegment,
      });

      renderedSeconds += scene.shots.reduce((sum, s) => sum + s.seconds, 0);
    }

    // Close the stream so the player gets a real duration and a clean end of
    // playback instead of an open-ended MediaSource that stalls at the end.
    // Aborted productions stay open so "Continue story" can keep appending.
    if (
      !signal?.aborted &&
      this.mediaSource &&
      this.mediaSource.readyState === "open"
    ) {
      try {
        this.mediaSource.endOfStream();
      } catch {
        // A mid-append race is harmless here.
      }
    }

    emit(onProgress, {
      phase: signal?.aborted ? "idle" : "done",
      sceneIndex: manifest.scenes.length,
      sceneTotal: manifest.scenes.length,
      shotIndex: keyframeCount,
      shotTotal: totalShots,
      renderedSeconds,
      detail: signal?.aborted
        ? "Production paused."
        : `Cut complete — ${Math.round(renderedSeconds)}s.`,
    });

    return {
      renderedSeconds,
      sceneCount: manifest.scenes.length,
      keyframeCount,
    };
  }

  private async renderAndAppend(
    scene: MovieScene,
    ctx: {
      shots: RenderedShot[];
      manifest: MovieManifest;
      video: HTMLVideoElement;
      appendBlob: (blob: Blob) => Promise<void>;
      sIdx: number;
      keyframeCount: number;
      totalShots: number;
      renderedSeconds: number;
      onProgress?: (p: MovieProgress) => void;
      onSegment?: (blob: Blob, sceneIndex: number) => void;
    }
  ): Promise<void> {
    emit(ctx.onProgress, {
      phase: "rendering",
      sceneIndex: ctx.sIdx,
      sceneTotal: ctx.manifest.scenes.length,
      shotIndex: ctx.keyframeCount,
      shotTotal: ctx.totalShots,
      renderedSeconds: ctx.renderedSeconds,
      detail: `Filming: ${scene.heading}`,
    });

    const blob = await this.renderer.renderScene(
      { scene, shots: ctx.shots },
      (done, sceneSeconds) => {
        emit(ctx.onProgress, {
          phase: "rendering",
          sceneIndex: ctx.sIdx,
          sceneTotal: ctx.manifest.scenes.length,
          shotIndex: ctx.keyframeCount,
          shotTotal: ctx.totalShots,
          renderedSeconds: ctx.renderedSeconds + done,
          detail: `Filming: ${scene.heading} (${Math.round(done)}/${Math.round(sceneSeconds)}s)`,
        });
      }
    );

    // Stream the segment into the player. If MediaSource appending fails,
    // fall back to playing this single segment directly.
    ctx.onSegment?.(blob, ctx.sIdx);
    this.appendedBlobs.push(blob);
    try {
      await ctx.appendBlob(blob);
    } catch (appendError) {
      console.warn("MediaSource append failed; playing last scene only:", appendError);
      ctx.video.src = URL.createObjectURL(blob);
      this.sourceBuffer = null;
      this.mediaSource = null;
    }
  }

  /**
   * Asks the edge function for the NEXT chapter of an existing film and
   * returns a continuation manifest that produce() can append to the same
   * video — the mechanism that makes 1-hour+ movies possible.
   */
  async expandManifest(
    current: MovieManifest,
    concept: string,
    signal?: AbortSignal
  ): Promise<MovieManifest> {
    const summary = current.scenes
      .map((s) => s.narration || s.heading)
      .join(" ")
      .slice(0, 600);

    const continuationPrompt =
      `Continue the movie "${current.title}" (${current.tagline}). ` +
      `Summary so far: ${summary}. ` +
      `Original concept: ${concept}. ` +
      `Write the NEXT chapter with the SAME characters, wardrobe, and visual style.`;

    const { supabase } = await import("../../lib/supabase");
    const { data, error } = await supabase.functions.invoke("reuben-ai", {
      body: { message: continuationPrompt },
    });
    if (error) throw new Error(error.message);
    void signal;

    if (data?.type !== "movie" || !data?.movie?.manifest) {
      throw new Error("Studio did not return a continuation manifest.");
    }
    return data.movie.manifest as MovieManifest;
  }
}