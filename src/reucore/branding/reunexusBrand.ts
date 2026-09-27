// src/reucore/branding/reunexusBrand.ts
//
// 🏷️ ReuNexus branding utilities.
//
// Pollinations.ai composites its own "pollinations.ai" lockup into the
// BOTTOM-RIGHT corner of every image it returns. That happens server-side,
// unconditionally — their old `nologo=true` flag was removed from the API
// schema, so no query parameter can disable it.
//
// These helpers erase that lockup from the pixels (by mirror-patching the
// corner with neighbouring image content) and stamp ReuNexus branding in its
// place, so every visual our users see or download is branded ReuNexus.
//
// The placement math below mirrors Pollinations' own getLogoPlacement() so the
// erased region lines up exactly with the lockup.

const LOGO_ASPECT_RATIO = 1024 / 126;
const FEATHER = 2;

export const REUNEXUS_WORDMARK = "REUNEXUS";

export type LogoRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  outline: number;
};

/** Mirrors Pollinations' getLogoPlacement() so we can erase precisely. */
export function getPollinationsLogoRect(
  width: number,
  height: number
): LogoRect {
  const shortSide = Math.min(width, height);
  const margin = Math.max(
    1,
    Math.min(
      Math.max(10, Math.min(20, Math.round(shortSide * 0.015))),
      Math.floor(width / 8),
      Math.floor(height / 8)
    )
  );
  const availableWidth = Math.max(1, width - margin * 2);
  const availableHeight = Math.max(1, height - margin * 2);
  const desiredHeight = Math.max(
    16,
    Math.min(28, Math.round(shortSide * 0.025))
  );
  const logoHeight = Math.max(
    1,
    Math.min(
      desiredHeight,
      availableHeight,
      Math.max(1, Math.floor(availableWidth / LOGO_ASPECT_RATIO))
    )
  );
  const logoWidth = Math.min(
    availableWidth,
    Math.max(1, Math.round(logoHeight * LOGO_ASPECT_RATIO))
  );

  return {
    left: width - logoWidth - margin,
    top: height - logoHeight - margin,
    width: logoWidth,
    height: logoHeight,
    outline: logoHeight >= 24 ? 2 : 1,
  };
}

/**
 * Erases the Pollinations lockup by mirror-patching its region with image
 * content taken from the left (or above), feathered so the seam is invisible.
 */
export function erasePollinationsLockup(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const rect = getPollinationsLogoRect(width, height);
  const pad = rect.outline + 2;

  const x0 = Math.max(0, Math.floor(rect.left - pad));
  const y0 = Math.max(0, Math.floor(rect.top - pad));
  const x1 = Math.min(width, Math.ceil(rect.left + rect.width + pad));
  const y1 = Math.min(height, Math.ceil(rect.top + rect.height + pad));

  const pw = x1 - x0;
  const ph = y1 - y0;
  if (pw < 4 || ph < 4) return;

  const fromLeft = x0 - pw >= 0;
  const fromAbove = y0 - ph >= 0;
  if (!fromLeft && !fromAbove) return;

  const srcX = fromLeft ? x0 - pw : x0;
  const srcY = fromLeft ? y0 : y0 - ph;

  const target = ctx.getImageData(x0, y0, pw, ph);
  const source = ctx.getImageData(srcX, srcY, pw, ph);

  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      // Mirror around the seam so the edge pixel maps onto itself.
      const mx = fromLeft ? pw - 1 - x : x;
      const my = fromLeft ? y : ph - 1 - y;

      const si = (my * pw + mx) * 4;
      const di = (y * pw + x) * 4;

      const edge = Math.min(x, pw - 1 - x, y, ph - 1 - y);
      const blend = Math.min(1, edge / FEATHER);

      for (let c = 0; c < 3; c++) {
        target.data[di + c] = Math.round(
          source.data[si + c] * blend +
            target.data[di + c] * (1 - blend)
        );
      }
    }
  }

  ctx.putImageData(target, x0, y0);
}

/** Stamps a crisp REUNEXUS wordmark where the lockup used to sit. */
export function drawReunexusWordmark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const rect = getPollinationsLogoRect(width, height);
  const fontSize = Math.max(10, Math.round(rect.height * 1.2));
  const right = Math.min(width - 2, rect.left + rect.width + 2);
  const baseline = Math.min(height - 2, rect.top + rect.height + 1);

  ctx.save();
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  try {
    (ctx as unknown as { letterSpacing: string }).letterSpacing =
      `${Math.max(0.5, fontSize * 0.1).toFixed(1)}px`;
  } catch {
    /* letterSpacing unsupported — fine */
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = Math.max(3, fontSize * 0.4);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText(REUNEXUS_WORDMARK, right, baseline);
  ctx.restore();
}

/* =========================
   HIGH-LEVEL HELPERS
========================= */

/** Draws any image source onto a fresh canvas, then erases + rebrands it. */
export function brandCanvasFrom(
  source: CanvasImageSource,
  width: number,
  height: number
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (!width || !height) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(source, 0, 0, width, height);
  try {
    erasePollinationsLockup(ctx, width, height);
    drawReunexusWordmark(ctx, width, height);
  } catch {
    // Pixel access failed (e.g. tainted canvas) — return unbranded image.
  }
  return canvas;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("branding image load failed"));
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Cleans a fetched image blob: erases the Pollinations lockup and stamps
 * ReuNexus branding. Returns the original blob if anything goes wrong.
 */
export async function brandBlob(blob: Blob): Promise<Blob> {
  if (!blob || typeof document === "undefined") return blob;
  const type = (blob.type || "").toLowerCase();
  // SVG has no bitmap to patch; GIF must be rebranded per-frame (canvas
  // would flatten the animation) — the edge function handles GIF frames.
  if (type.includes("svg") || type.includes("gif")) return blob;

  const tempUrl = URL.createObjectURL(blob);
  try {
    const img = await loadImageElement(tempUrl);
    const canvas = brandCanvasFrom(img, img.naturalWidth, img.naturalHeight);
    if (!canvas) return blob;

    const outType = type.includes("png") ? "image/png" : "image/jpeg";
    const out = await canvasToBlob(canvas, outType, 0.92);
    return out ?? blob;
  } catch {
    return blob;
  } finally {
    URL.revokeObjectURL(tempUrl);
  }
}

/**
 * Best-effort display-time safety net: loads an image URL, erases the
 * Pollinations lockup and stamps ReuNexus branding. Returns a blob URL of the
 * cleaned image, or null when the image cannot be processed (skewering the
 * caller to the original).
 */
export async function brandImageUrl(url: string): Promise<string | null> {
  if (!url || typeof document === "undefined") return null;
  if (url.startsWith("data:image/svg")) return null;

  try {
    const img = await loadImageElement(url);
    const canvas = brandCanvasFrom(img, img.naturalWidth, img.naturalHeight);
    if (!canvas) return null;

    const type =
      url.startsWith("data:image/png") || url.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/jpeg";
    const out = await canvasToBlob(canvas, type, 0.92);
    if (!out) return null;
    return URL.createObjectURL(out);
  } catch {
    return null;
  }
}

/* =========================
   HOOK-FRIENDLY CLEANER
========================= */

/**
 * Cleans an image URL for display: handles blob:, data:, and remote URLs.
 * Skips SVG (no lockup in vectors) and GIF data URLs (canvas would flatten
 * the animation — the edge function rebrands GIF frames server-side instead).
 * Returns the original URL unchanged when branding cannot be applied.
 */
export function isBrandingCandidate(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.slice(0, 64).toLowerCase();
  if (lower.startsWith("data:image/svg")) return false;
  // Never flatten animation — GIFs are rebranded per-frame server-side.
  if (lower.startsWith("data:image/gif")) return false;
  if (lower.startsWith("blob:")) return true;
  if (lower.startsWith("data:image/")) return true;
  return /^https?:/i.test(url);
}

/** Module-level memo so re-renders never recompute the same image. */
const cleanedUrlCache = new Map<string, string>();

/**
 * Returns a cleaned blob URL for the given image source. The returned URL is
 * cached for the lifetime of the page; callers don't need to revoke it, but
 * app teardown will release it when the document unloads.
 */
export async function cleanedDisplayUrl(sourceUrl: string): Promise<string> {
  if (!isBrandingCandidate(sourceUrl)) return sourceUrl;

  const cached = cleanedUrlCache.get(sourceUrl);
  if (cached) return cached;

  const cleaned = await brandImageUrl(sourceUrl);
  const finalUrl = cleaned ?? sourceUrl;
  if (cleaned) cleanedUrlCache.set(sourceUrl, cleaned);
  return finalUrl;
}