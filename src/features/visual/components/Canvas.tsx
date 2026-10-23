import type { VisualMediaType } from "../types";

type CanvasProps = {
  mediaUrl: string;
  mediaType: VisualMediaType | null;
  loading: boolean;
  error: string;
};

export default function Canvas({
  mediaUrl,
  mediaType,
  loading,
  error,
}: CanvasProps) {
  return (
    <section className="relative flex min-h-[520px] items-center justify-center overflow-hidden bg-[#050508] p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.12),transparent_65%)]" />

      {loading && (
        <div className="relative text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-violet-500" />
          <p className="mt-4 text-sm text-gray-400">
            ReuCore is constructing the scene...
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="relative max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-center">
          <p className="font-medium text-red-300">
            Generation failed
          </p>
          <p className="mt-2 text-sm text-red-200/70">
            {error}
          </p>
        </div>
      )}

      {!loading && !error && !mediaUrl && (
        <div className="relative max-w-lg text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-violet-500/20 bg-violet-500/10 text-3xl">
            ✦
          </div>

          <h2 className="mt-6 text-2xl font-bold text-white">
            Your visual world starts here
          </h2>

          <p className="mt-3 leading-7 text-gray-400">
            Enter a prompt above. ReuCore will reason about it,
            create a scene blueprint, and render the first visual.
          </p>
        </div>
      )}

      {!loading && !error && mediaUrl && mediaType === "video" && (
        <video
          key={mediaUrl}
          src={mediaUrl}
          controls
          playsInline
          className="relative max-h-[70vh] max-w-full rounded-2xl border border-white/10 bg-black shadow-2xl"
        />
      )}

      {!loading && !error && mediaUrl && mediaType === "image" && (
        <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-violet-950/40">
          <img
            src={mediaUrl}
            alt="Generated or edited visual"
            className="block max-h-[70vh] w-full object-contain"
          />
        </div>
      )}
    </section>
  );
}
