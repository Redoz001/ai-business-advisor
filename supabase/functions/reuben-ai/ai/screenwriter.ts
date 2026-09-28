/*
 * 🎬 REUNEXUS FILM STUDIO — Screenwriter
 *
 * Turns a user's concept into a full cinematic screenplay (MovieManifest)
 * using the existing Groq LLM provider, then deterministically expands every
 * shot into a keyframe prompt that stays visually consistent across the film.
 *
 * A fully feature-length film is *possible* because the client production
 * pipeline (MovieEngine) treats this manifest as an unbounded story: you can
 * ask for more scenes/chapters and it keeps generating — 1 hour, 2 hours,
 * beyond.
 */

import { askGroq } from "../providers/groq.ts";

/* =========================
   TYPES
========================= */

export type MovieCamera =
  | "WIDE"
  | "MEDIUM"
  | "CLOSE-UP"
  | "EXTREME-CLOSE-UP"
  | "OVER-THE-SHOULDER"
  | "AERIAL";

export type MovieShot = {
  id: string;
  camera: MovieCamera;
  action: string;
  caption: string;
  seconds: number;
  transition: "cut" | "dissolve" | "fade";
};

export type MovieScene = {
  id: string;
  heading: string;
  location: string;
  timeOfDay: string;
  narration: string;
  shots: MovieShot[];
};

export type MovieManifest = {
  title: string;
  tagline: string;
  genre: string;
  styleTokens: string;
  aspectRatio: "2.39:1" | "16:9";
  director: string;
  runtimeSeconds: number;
  scenes: MovieScene[];
  chapter: number;
};
/* =========================
   SCREENWRITER PROMPT
========================= */

function buildScreenwriterSystemPrompt(): string {
  return `
You are the head screenwriter of ReuNexus Film Studio. You direct original,
emotionally powerful feature films shot-by-shot. You respond ONLY with a
single valid JSON object — no markdown fences, no commentary, no trailing text.

The JSON you return must match EXACTLY this shape:

{
  "title": "string — a striking, original film title",
  "tagline": "string — one evocative marketing line",
  "genre": "string — e.g. 'sci-fi adventure'",
  "styleTokens": "string — comma-separated VISUAL STYLE applied to EVERY keyframe; describe lighting, lens, palette, era, art direction (e.g. 'neon-noir, teal and magenta palette, volumetric fog, anamorphic lens flares, 1980s retro-futurism')",
  "scenes": [
    {
      "heading": "string — slug line like 'INT. ORBITAL STATION - NIGHT'",
      "location": "string — e.g. 'orbital station core'",
      "timeOfDay": "string — e.g. 'night'",
      "narration": "string — 1 short voice-over sentence for the scene",
      "shots": [
        {
          "camera": "WIDE|MEDIUM|CLOSE-UP|EXTREME-CLOSE-UP|OVER-THE-SHOULDER|AERIAL",
          "action": "string — ONE vivid sentence describing EXACTLY what is visible, naming the same original characters, wardrobe, and props each time",
          "caption": "string — a short on-screen line spoken or narrated for this shot, or an empty string",
          "seconds": 4
        }
      ]
    }
  ]
}

HARD RULES:
- Create ORIGINAL characters and stories. Never use copyrighted characters.
- Continuity is sacred: the same characters, outfits, and locations persist across every scene and shot; the story advances logically beat by beat.
- Vary camera grammar within each scene (never repeat the same camera twice in a row).
- Every shot must be minimally written so a downstream artist can draw a single consistent keyframe from the text.
- Keep "action" under 24 words. Keep "narration" under 20 words. Keep "caption" under 12 words.
- "seconds": 3 to 6 for dialogue shots, 5 to 8 for WIDE/AERIAL establishing shots.
`.trim();
}

export type ScreenplayOptions = {
  scenes?: number;
  shotsPerScene?: number;
  continuation?: {
    title: string;
    tagline: string;
    summary: string;
    chapter?: number;
  };
};

function buildScreenplayUserPrompt(
  concept: string,
  opts: ScreenplayOptions
): string {
  const sceneCount = opts.scenes ?? 6;
  const shotsPerScene = opts.shotsPerScene ?? 5;

  const continuation = opts.continuation
    ? `\nCONTINUATION (chapter 2+): The film ALREADY started with title "${opts.continuation.title}" (tagline: "${opts.continuation.tagline}"). Summary so far: "${opts.continuation.summary}". Write the NEXT chapter that continues this same story, same characters and locations.`
    : "";

  return `
DIRECT A FILM with this concept: "${concept.trim() || "an original cinematic epic"}"

Produce exactly ${sceneCount} scenes, each with exactly ${shotsPerScene} shots,
arranged as a coherent three-act structure with a powerful ending.
${continuation}

Remember: pure JSON only.
`.trim();
}

/* =========================
   JSON PARSING + VALIDATION
========================= */

const CAMERAS = new Set<MovieCamera>([
  "WIDE",
  "MEDIUM",
  "CLOSE-UP",
  "EXTREME-CLOSE-UP",
  "OVER-THE-SHOULDER",
  "AERIAL",
]);

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? Math.round(value) : fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Robustly extract a JSON object from an LLM response (handles fences/junk). */
function extractJson(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Screenwriter returned no JSON object.");
  const raw = cleaned.slice(start, end + 1);
  return JSON.parse(raw) as Record<string, unknown>;
}

function sanitizeText(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  const t = value.trim();
  return t.length > max ? t.slice(0, max) : t;
}
/** Validate + normalize whatever JSON the LLM produced into a safe manifest. */
function normalizeManifest(
  raw: Record<string, unknown>,
  opts: ScreenplayOptions,
  fallbackConcept: string,
  chapter: number
): MovieManifest {
  const wantedShots = clampInt(opts.shotsPerScene, 5, 4, 8);

  const rawScenes = Array.isArray(raw.scenes) ? raw.scenes : [];

  const scenes: MovieScene[] = rawScenes.slice(0, 12).map((rawScene, sIdx) => {
    const scene = (rawScene ?? {}) as Record<string, unknown>;
    const rawShots = Array.isArray(scene.shots) ? scene.shots : [];

    const shots: Array<Record<string, unknown>> = [];
    for (let k = 0; k < Math.max(rawShots.length, 1); k++) {
      shots.push((rawShots[k] ?? rawShots[rawShots.length - 1] ?? {}) as Record<string, unknown>);
      if (shots.length >= wantedShots) break;
    }
    while (shots.length < wantedShots) shots.push(shots[shots.length - 1] ?? {});

    const shotObjects: MovieShot[] = shots.map((s, vIdx) => {
      const cameraRaw = String(s.camera ?? "MEDIUM").toUpperCase().trim();
      const camera = (CAMERAS.has(cameraRaw as MovieCamera)
        ? (cameraRaw as MovieCamera)
        : "MEDIUM") as MovieCamera;

      const seconds = clampInt(s.seconds, 4, 3, 12);

      const transition =
        vIdx < 1 ? ("cut" as const) : (["cut", "dissolve"] as const)[vIdx % 2];

      return {
        id: `s${sIdx + 1}-shot${vIdx + 1}-${chapter}`,
        camera,
        action: sanitizeText(s.action, "a cinematic frame of the story", 120),
        caption: sanitizeText(s.caption, "", 64),
        seconds,
        transition,
      };
    });

    return {
      id: `scene-${sIdx + 1}-${chapter}`,
      heading: sanitizeText(scene.heading, `SCENE ${sIdx + 1}`, 80),
      location: sanitizeText(scene.location, "the story world", 60),
      timeOfDay: sanitizeText(scene.timeOfDay, "indeterminate", 40),
      narration: sanitizeText(scene.narration, "", 120),
      shots: shotObjects,
    };
  });

  if (scenes.length === 0) {
    throw new Error("Screenwriter returned no scenes.");
  }
const title =
    sanitizeText(raw.title, "ReuNexus Original", 80) || "ReuNexus Original";
  const tagline =
    sanitizeText(raw.tagline, "An original cinematic epic.", 160) ||
    "An original cinematic epic.";
  const genre = sanitizeText(raw.genre, "cinematic", 40) || "cinematic";
  const styleTokens =
    sanitizeText(
      raw.styleTokens,
      "cinematic film still, anamorphic widescreen, dramatic volumetric lighting, highly detailed, rich contrast, consistent character design",
      400
    ) || "cinematic";

  const runtimeSeconds = scenes.reduce(
    (sum, scene) => sum + scene.shots.reduce((s, shot) => s + shot.seconds, 0),
    0
  );

  return {
    title,
    tagline,
    genre,
    styleTokens,
    aspectRatio: "2.39:1",
    director: "ReuNexus Reel A.I.",
    runtimeSeconds,
    scenes,
    chapter,
  };
}

/** Shared art direction: build one consistent keyframe prompt per shot. */
export function buildKeyframePrompt(
  manifest: Pick<MovieManifest, "styleTokens" | "aspectRatio" | "title">,
  scene: MovieScene,
  shot: MovieShot
): string {
  const context = [scene.location, scene.timeOfDay].filter(Boolean).join(", ");
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
/* =========================
   PUBLIC API
========================= */

/** How many times the LLM gets to produce a valid screenplay before we
 *  synthesize a minimal one. Malformed JSON / empty scene lists are common
 *  LLM failure modes and a single attempt made films randomly degrade. */
const SCREENPLAY_ATTEMPTS = 3;

/**
 * Writes a full screenplay (MovieManifest) for a concept using Groq.
 * Pure text step — no images are generated here, so it returns quickly.
 */
export async function writeScreenplay(
  concept: string,
  opts: ScreenplayOptions = {}
): Promise<MovieManifest> {
  const fallbackConcept =
    concept.trim() || "an original cinematic epic";

  const systemPrompt = buildScreenwriterSystemPrompt();
  const userPrompt = buildScreenplayUserPrompt(concept, opts);
  const chapter = opts.continuation ? (opts.continuation.chapter ?? 2) : 1;

  let manifest: MovieManifest | null = null;
  let lastError = "";

  for (let attempt = 1; attempt <= SCREENPLAY_ATTEMPTS; attempt++) {
    // Later attempts nudge the model after a bad reply; temperature keeps
    // each retry a genuinely fresh sample.
    const nudge =
      attempt === 1
        ? ""
        : `\n\nYour previous reply was rejected (${lastError}). Respond with ONLY one valid JSON object matching the schema exactly — no markdown fences, no commentary.`;

    try {
      const rawText = await askGroq(
        `${systemPrompt}\n\n${userPrompt}${nudge}`,
        []
      );
      const raw = extractJson(rawText);
      // Validate through the full normalizer so empty scene lists and bad
      // shot shapes also count as failed attempts.
      manifest = normalizeManifest(raw, opts, fallbackConcept, chapter);
      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(
        `Screenplay attempt ${attempt}/${SCREENPLAY_ATTEMPTS} failed:`,
        lastError
      );
    }
  }

  if (!manifest) {
    // Last resort: synthesize a minimal-but-valid manifest so features still
    // work even if the LLM persistently drifts out of schema.
    console.error(
      "Screenplay unparseable after retries — using synthesized manifest."
    );
    const raw: Record<string, unknown> = {
      title: fallbackConcept.slice(0, 60),
      tagline: "An original cinematic epic.",
      genre: "cinematic",
      scenes: [
        {
          heading: `INT. ${fallbackConcept} - NIGHT`,
          location: fallbackConcept,
          timeOfDay: "night",
          narration: "",
          shots: [
            {
              camera: "WIDE",
              action: fallbackConcept,
              caption: fallbackConcept,
              seconds: 6,
            },
            {
              camera: "MEDIUM",
              action: fallbackConcept,
              caption: "",
              seconds: 5,
            },
            {
              camera: "CLOSE-UP",
              action: fallbackConcept,
              caption: "",
              seconds: 4,
            },
            {
              camera: "WIDE",
              action: fallbackConcept,
              caption: "",
              seconds: 6,
            },
            {
              camera: "MEDIUM",
              action: fallbackConcept,
              caption: "",
              seconds: 5,
            },
          ],
        },
      ],
    };
    manifest = normalizeManifest(raw, opts, fallbackConcept, chapter);
  }

  return manifest;
}

/** Total number of keyframes needed for a manifest. */
export function countKeyframes(manifest: MovieManifest): number {
  return manifest.scenes.reduce(
    (sum, scene) => sum + scene.shots.length,
    0
  );
}