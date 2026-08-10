type ToolbarProps = {
  hasVisual: boolean;
  onReset: () => void;
  onDownload: () => void;
};

export default function Toolbar({
  hasVisual,
  onReset,
  onDownload,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-white">
          ReuNexus Visual Workspace
        </p>
        <p className="text-xs text-gray-500">
          Powered by ReuCore
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onReset}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
        >
          New Project
        </button>

        <button
          type="button"
          disabled={!hasVisual}
          onClick={onDownload}
          className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Export SVG
        </button>
      </div>
    </div>
  );
}
