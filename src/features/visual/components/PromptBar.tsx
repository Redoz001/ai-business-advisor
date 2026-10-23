import type { VisualMediaType } from "../types";

type PromptBarProps = {
  prompt: string;
  loading: boolean;
  mediaType: VisualMediaType;
  file: File | null;
  onPromptChange: (value: string) => void;
  onMediaTypeChange: (value: VisualMediaType) => void;
  onFileChange: (file: File | null) => void;
  onGenerate: () => void;
};

export default function PromptBar({
  prompt,
  loading,
  mediaType,
  file,
  onPromptChange,
  onMediaTypeChange,
  onFileChange,
  onGenerate,
}: PromptBarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/10 bg-black/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-white/10 bg-black/40 p-1" role="group" aria-label="Media output type">
          {(["image", "video"] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={mediaType === type}
              disabled={loading}
              onClick={() => onMediaTypeChange(type)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${mediaType === type ? "bg-emerald-300 text-black" : "text-gray-400 hover:text-white"}`}
            >
              {type}
            </button>
          ))}
        </div>
        <label className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 transition hover:bg-white/5">
          {file ? `Replace: ${file.name}` : "Upload image or video"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
            disabled={loading}
            onChange={(event) => {
              onFileChange(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
            className="sr-only"
          />
        </label>
        {file && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onFileChange(null)}
            className="px-2 py-2 text-xs text-gray-500 hover:text-white"
          >
            Remove upload
          </button>
        )}
      </div>
      <textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            (event.ctrlKey || event.metaKey)
          ) {
            event.preventDefault();
            onGenerate();
          }
        }}
        rows={2}
        placeholder={file ? "Describe how you want this upload edited..." : `Describe the ${mediaType} you want to create...`}
        className="min-h-16 flex-1 resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-violet-500"
      />

      <button
        type="button"
        disabled={loading || !prompt.trim()}
        onClick={onGenerate}
        className="rounded-2xl bg-violet-600 px-7 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Rendering media..." : file ? "Apply edit" : `Generate ${mediaType}`}
      </button>
    </div>
  );
}
