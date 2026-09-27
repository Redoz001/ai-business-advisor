/*
 * 🏷️ ReuNexus rebranding for images returned by Pollinations.
 *
 * Pollinations composites its own "pollinations.ai" lockup into the
 * bottom-right corner of every image SERVER-SIDE and offers no parameter to
 * disable it (their old `nologo` flag was removed from the API schema). So we
 * erase that lockup from the raw RGBA pixels and stamp REUNEXUS in its place.
 *
 * These are pure typed-array operations — no canvas is available in Deno, so
 * the wordmark is drawn with a compact 5x7 bitmap font (only the glyphs used
 * by "REUNEXUS" are embedded).
 *
 * The placement math mirrors Pollinations' own getLogoPlacement() so the
 * erased region lines up exactly with their lockup.
 */

const LOGO_ASPECT_RATIO = 1024 / 126;
const FEATHER = 2;

export const WORDMARK = "REUNEXUS";

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
 * Erases the Pollinations lockup by mirror-patching its region with pixels
 * taken from the left (or above), feathered so the seam is invisible.
 */
export function eraseLockupRgba(
  data: Uint8Array,
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

  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      // Mirror around the seam so the edge pixel maps onto itself.
      const mx = fromLeft ? pw - 1 - x : x;
      const my = fromLeft ? y : ph - 1 - y;

      const si = ((srcY + my) * width + (srcX + mx)) * 4;
      const di = ((y0 + y) * width + (x0 + x)) * 4;

      const edge = Math.min(x, pw - 1 - x, y, ph - 1 - y);
      const blend = Math.min(1, edge / FEATHER);

      for (let c = 0; c < 3; c++) {
        data[di + c] = Math.round(
          data[si + c] * blend + data[di + c] * (1 - blend)
        );
      }
    }
  }
}
/* =========================
   5x7 BITMAP FONT ("REUNEXUS")
========================= */

const GLYPHS: Record<string, number[]> = {
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
};

const GLYPH_W = 5;
const GLYPH_H = 7;
const GLYPH_GAP = 1;

/**
 * Stamps a white REUNEXUS wordmark (with a dark shadow) into the same
 * bottom-right box the Pollinations lockup occupied.
 */
export function stampWordmarkRgba(
  data: Uint8Array,
  width: number,
  height: number
): void {
  const rect = getPollinationsLogoRect(width, height);
  const chars = WORDMARK.split("");
  const unitsWide = chars.length * (GLYPH_W + GLYPH_GAP) - GLYPH_GAP;

  const fitByHeight = Math.floor(rect.height / GLYPH_H) || 1;
  const fitByWidth = Math.floor(rect.width / unitsWide) || 1;
  const scale = Math.max(1, Math.min(fitByHeight, fitByWidth));

  const textW = unitsWide * scale;
  const textH = GLYPH_H * scale;

  const x0 = Math.round(rect.left + rect.width - textW);
  const y0 = Math.round(rect.top + rect.height - textH);

  const plot = (x: number, y: number, r: number, g: number, b: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  };

  const drawPass = (
    ox: number,
    oy: number,
    color: [number, number, number]
  ) => {
    let cursor = 0;
    for (const ch of chars) {
      const glyph = GLYPHS[ch];
      if (glyph) {
        for (let gy = 0; gy < GLYPH_H; gy++) {
          const row = glyph[gy];
          for (let gx = 0; gx < GLYPH_W; gx++) {
            // Test bits left-to-right.
            if ((row >> (GLYPH_W - 1 - gx)) & 1) {
              const px = x0 + (cursor + gx) * scale + ox;
              const py = y0 + gy * scale + oy;
              for (let sy = 0; sy < scale; sy++) {
                for (let sx = 0; sx < scale; sx++) {
                  plot(px + sx, py + sy, color[0], color[1], color[2]);
                }
              }
            }
          }
        }
      }
      cursor += GLYPH_W + GLYPH_GAP;
    }
  };

  // Shadow first so the white pass paints on top of it.
  drawPass(scale, scale, [0, 0, 0]);
  drawPass(0, 0, [255, 255, 255]);
}

/** Erase the Pollinations lockup, then stamp ReuNexus branding. */
export function rebrandRgba(
  data: Uint8Array,
  width: number,
  height: number
): void {
  eraseLockupRgba(data, width, height);
  stampWordmarkRgba(data, width, height);
}