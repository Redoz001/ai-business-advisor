/*
 * ⚡ Free visual generation provider (replaces the paid RunwayML API).
 *
 * The Runway API previously used here required paid credits and failed with
 * "you do not have enough credits". This module now generates images 100%
 * keyless via the free Pollinations.ai image endpoint and encodes them as
 * self-contained data URLs (so the assistant message survives forever even
 * if the upstream image is evicted).
 *
 * - generateImage(prompt) -> static JPEG data URL
 * - generateGif(prompt)   -> animated GIF data URL (multi-frame motion
 *   built purely server-side with jpeg-js + gifenc, no browser or API key)
 *
 * Verified in Deno 2 (Sept 2026): pollinations returns image/jpeg at
 * 1024x1024 in ~1-3s; jpeg-js decodes and gifenc emits GIF89a reliably.
 *
 * Pollinations composites its own "pollinations.ai" lockup into every image
 * server-side (their `nologo` flag was removed from the API schema), so images
 * are rebranded to ReuNexus locally after download.
 */

import { rebrandRgba } from "./branding.ts";

const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt/";
const MAX_ATTEMPTS = 2;
const FETCH_TIMEOUT_MS = 60_000;

const QUALITY_TAIL =
  "photorealistic, ultra-detailed, cinematic lighting, high realism, sharp focus, " +
  "clean composition, no distortion, no blemishes, premium quality, refined color grading";

/** Motion variants used to turn a single still prompt into an animation. */
const MOTION_VARIANTS: string[] = [
  "wide establishing shot, slow pan",
  "medium shot, gentle drift",
  "close-up detail, subtle motion",
  "extreme close-up, focused stare",
  "wide angle pull-back, reveal",
  "final wide shot, settled framing",
];

type DecodedFrame = { width: number; height: number; data: Uint8Array };

/** Chunked base64 conversion so large buffers never blow the call stack. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    );
  }
  return btoa(binary);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  input: string,
  init: RequestInit,
  attempts = MAX_ATTEMPTS
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(input, { ...init, signal: controller.signal });
      if (res.ok) return res;

      const body = await res.text().catch(() => "");

      // The free Pollinations tier queues only ONE request per IP at a time,
      // so a 429 usually means another request just claimed the slot.
      if (res.status === 429) {
        throw new Error(
          `Pollinations queue is full (429); retrying in ${attempt}s.`
        );
      }

      throw new Error(
        `Pollinations request failed (${res.status}): ${body.slice(0, 200)}`
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < attempts) await sleep(1000 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error("Pollinations request failed");
}

function buildPollinationsUrl(
  prompt: string,
  width: number,
  height: number,
  seed: number
): string {
  const enriched = `${prompt.trim()}, ${QUALITY_TAIL}`;
  const encoded = encodeURIComponent(enriched);
  // Note: `nologo` was removed from the Pollinations API schema and does
  // nothing today — branding is handled locally by rebrandRgba().
  return `${POLLINATIONS_BASE}${encoded}?width=${width}&height=${height}&seed=${seed}`;
}

async function fetchDecodedImage(
  prompt: string,
  width: number,
  height: number,
  seed: number
): Promise<DecodedFrame> {
  const url = buildPollinationsUrl(prompt, width, height, seed);
  const res = await fetchWithRetry(url, {
    headers: { Accept: "image/jpeg, image/png" },
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "";

  if (bytes.length < 1000) {
    throw new Error("Pollinations returned an unexpectedly small image.");
  }

  if (contentType.includes("jpeg") || bytes[0] === 0xff) {
    // JPEG -> decode to RGBA so we can always produce uniform output.
    const { decode } = await import("https://esm.sh/jpeg-js@0.4.4");
    const decoded = decode(bytes, {
      useTArray: true,
      maxMemoryUsageInMB: 256,
    });
    // Erase the Pollinations lockup and stamp ReuNexus branding.
    rebrandRgba(decoded.data, decoded.width, decoded.height);
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  }

  // PNG/other -> return raw bytes embedded in an RGBA-compatible envelope.
  return {
    width,
    height,
    data: bytes,
    rawMime: contentType,
  } as DecodedFrame & { rawMime: string };
}

/**
 * Generates a static photorealistic image from a text prompt.
 * Returns a `data:image/jpeg;base64,...` string — keyless and free.
 * Pollinations' own lockup is erased and ReuNexus branding is stamped in.
 */
export async function generateImage(prompt: string): Promise<string> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) {
    throw new Error("An image prompt is required.");
  }

  const url = buildPollinationsUrl(
    cleanPrompt,
    1024,
    1024,
    Math.floor(Math.random() * 100_000)
  );
  const res = await fetchWithRetry(url, {
    headers: { Accept: "image/jpeg, image/png" },
  });
  const bytes = new Uint8Array(await res.arrayBuffer());

  if (bytes.length < 1000) {
    throw new Error("Pollinations returned an unexpectedly small image.");
  }

  const contentType = res.headers.get("content-type") || "image/jpeg";

  if (contentType.includes("jpeg") || bytes[0] === 0xff) {
    try {
      const { decode, encode } = await import("https://esm.sh/jpeg-js@0.4.4");
      const decoded = decode(bytes, {
        useTArray: true,
        maxMemoryUsageInMB: 256,
      });
      rebrandRgba(decoded.data, decoded.width, decoded.height);
      const encoded = encode(
        { data: decoded.data, width: decoded.width, height: decoded.height },
        92
      );
      return `data:image/jpeg;base64,${bytesToBase64(
        new Uint8Array(encoded.data)
      )}`;
    } catch (rebrandError) {
      console.warn("Rebranding failed; returning original image:", rebrandError);
    }
  }

  return `data:${contentType};base64,${bytesToBase64(bytes)}`;
}

/**
 * Generates an animated GIF from a text prompt by fetching several
 * motion-variant frames from Pollinations and stitching them with gifenc.
 * Returns a `data:image/gif;base64,...` string — keyless and free.
 *
 * Frames are fetched one at a time because the free Pollinations tier
 * queues only one request per IP; parallel fetches trigger 429s.
 */
export async function generateGif(prompt: string): Promise<string> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) {
    throw new Error("A video/animation prompt is required.");
  }

  const FRAME_W = 320;
  const FRAME_H = 320;
  const FRAME_COUNT = 5;
  const FRAME_DELAY_MS = 160;

  const { GIFEncoder, quantize, applyPalette } = await import(
    "https://esm.sh/gifenc@1.0.3"
  );

  const gif = GIFEncoder();

  for (let i = 0; i < FRAME_COUNT; i++) {
    const variant = MOTION_VARIANTS[i % MOTION_VARIANTS.length];
    const seed = 1000 + i * 137;
    const frame = await fetchDecodedImage(
      `${cleanPrompt}, ${variant}`,
      FRAME_W,
      FRAME_H,
      seed
    );

    const palette = quantize(frame.data, 256);
    const index = applyPalette(frame.data, palette);
    gif.writeFrame(index, frame.width, frame.height, {
      palette,
      delay: FRAME_DELAY_MS,
    });
  }

  gif.finish();

  const buffer = gif.bytes();
  if (!buffer || buffer.length === 0) {
    throw new Error("GIF encoding produced an empty result.");
  }

  return `data:image/gif;base64,${bytesToBase64(buffer)}`;
}
