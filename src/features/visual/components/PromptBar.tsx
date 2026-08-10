type PromptBarProps = {
  prompt: string;
  loading: boolean;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
};

export default function PromptBar({
  prompt,
  loading,
  onPromptChange,
  onGenerate,
}: PromptBarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/10 bg-black/40 p-4 md:flex-row">
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
        placeholder="Describe the visual you want ReuCore to construct..."
        className="min-h-16 flex-1 resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-violet-500"
      />

      <button
        type="button"
        disabled={loading || !prompt.trim()}
        onClick={onGenerate}
        className="rounded-2xl bg-violet-600 px-7 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Constructing..." : "Generate Visual"}
      </button>
    </div>
  );
}
