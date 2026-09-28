// src/features/conversation/components/MovieMessage.tsx
// ReuNexus Film Studio player message. Receives a screenplay manifest from the
// edge function, then runs the client production house (keyframes → render →
// stream) into a <video>. Also supports continuing the story with new chapters
// and exporting the accumulated WebM segments.

import { useEffect, useRef, useState } from "react";
import { MovieEngine } from "../../../reucore/movie/MovieEngine";
import type {
  MovieManifest,
  MovieProgress,
} from "../../../reucore/movie/types";
import type { ConversationMessage } from "../types/Message";

type MovieMessageProps = {
  content: string;
  movie?: ConversationMessage["movie"];
};

const PHASE_LABELS: Record<MovieProgress["phase"], string> = {
  idle: "Ready",
  writing: "Screenwriter at work…",
  "fetching-keyframes": "Painting keyframes…",
  rendering: "Filming…",
  continuing: "Writing next chapter…",
  done: "Ready to watch",
  error: "Production error",
};

function formatSeconds(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function MovieMessage({ content, movie }: MovieMessageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<MovieEngine>(null);
  const manifestRef = useRef<MovieManifest | null>(movie?.manifest ?? null);
  const segmentsRef = useRef<Blob[]>([]);
  const abortRef = useRef<AbortController>(null);

  const [progress, setProgress] = useState<MovieProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chapterStarts, setChapterStarts] = useState<number[]>([]);

  if (!engineRef.current) {
    engineRef.current = new MovieEngine();
  }

  const runProduction = async (manifest: MovieManifest, signal?: AbortSignal) => {
    const video = videoRef.current;
    if (!video) throw new Error("Player not mounted.");
    setBusy(true);
    setError(null);
    try {
      await engineRef.current.produce({
        video,
        manifest,
        onProgress: (p) => {
          setProgress({ ...p });
          if (p.phase === "done") {
            setBusy(false);
            setChapterStarts((prev) => [...prev, p.renderedSeconds]);
          }
        },
        onSegment: (blob) => {
          segmentsRef.current.push(blob);
        },
        signal,
      });
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    if (!manifestRef.current) {
      setError("The studio sent a movie message without a screenplay manifest.");
      return;
    }
    abortRef.current = new AbortController();
    void runProduction(manifestRef.current, abortRef.current.signal);

    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continueStory = async () => {
    if (continuing || busy) return;
    if (!manifestRef.current) return;
    setContinuing(true);
    try {
      const next = await engineRef.current.expandManifest(
        manifestRef.current,
        content
      );
      manifestRef.current = next;
      await runProduction(next, abortRef.current?.signal);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setContinuing(false);
    }
  };

  const exportWebM = () => {
    const segments = segmentsRef.current;
    if (segments.length === 0) return;
    const blob = new Blob(segments, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reunexus-film.webm";
    a.click();
    // Revoke after a beat so the browser can begin the download.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const manifest = manifestRef.current;
  const phase = progress?.phase ?? (continuing ? "continuing" : "idle");

  return (
    <div className="space-y-3">
      {manifest && (
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-zinc-100">
              🎬 {manifest.title || "ReuNexus Original"}
            </p>
            {manifest.tagline && (
              <p className="mt-0.5 text-xs text-zinc-400">{manifest.tagline}</p>
            )}
          </div>

          <p className="shrink-0 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
            Chapter {manifest.chapter}
          </p>
        </div>
      )}

      {content && (
        <p className="text-sm text-zinc-300">{content}</p>
      )}

      <div className="rounded-xl border border-zinc-800 bg-black overflow-hidden">
        <video
          ref={videoRef}
          controls
          playsInline
          onError={() => {
            // Surface playback failures inline instead of leaving the
            // browser's silent black/broken player.
            const code = videoRef.current?.error?.code;
            setError(
              code
                ? `The player could not display the film (media error ${code}). Reload the page to render it again.`
                : "The player could not display the film. Reload the page to render it again."
            );
          }}
          style={{ maxWidth: "100%", maxHeight: "480px" }}
          className="w-full aspect-video bg-black"
        >
          Your browser does not support video playback.
        </video>

        {(busy || continuing) && (
          <div className="flex flex-col gap-1.5 border-t border-zinc-800 bg-zinc-950 px-3 py-2">
            <p className="text-[11px] text-amber-100/90">
              {progress?.detail || PHASE_LABELS[continuing ? "continuing" : phase]}
            </p>

            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full bg-amber-400"
                  style={{
                    width: `${Math.min(100, (progress?.renderedSeconds ?? 0) / Math.max(1, (((progress?.sceneTotal ?? 1) * 15))) * 100)}%`,
                  }}
                />
              </div>

              <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">
                {formatSeconds(progress?.renderedSeconds ?? 0)}
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
          <p className="font-medium text-red-300">Studio error</p>
          <p className="mt-1 text-sm text-red-200/80">{error}</p>
        </div>
      )}

      {chapterStarts.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {chapterStarts.map((start, i) => (
            <button
              key={`ch-${i}`}
              onClick={() => {
                const v = videoRef.current;
                if (v) v.currentTime = start;
              }}
              className="rounded-md bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-zinc-700"
            >
              Ch {i + 1} · {formatSeconds(start)}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {manifest && !busy && (
          <button
            onClick={continueStory}
            disabled={continuing}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-amber-500 disabled:opacity-50"
          >
            {continuing ? "Writing next chapter…" : "Continue story ▶"}
          </button>
        )}

        {segmentsRef.current.length > 0 && !busy && (
          <button
            onClick={exportWebM}
            className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-white transition hover:bg-zinc-700"
          >
            Export WebM
          </button>
        )}
      </div>
    </div>
  );
}