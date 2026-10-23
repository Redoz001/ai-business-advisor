import type { VisualHistoryItem } from "../types";

type BottomPanelProps = {
  history: VisualHistoryItem[];
  onRestore: (item: VisualHistoryItem) => void;
};

export default function BottomPanel({
  history,
  onRestore,
}: BottomPanelProps) {
  return (
    <div className="border-t border-white/10 bg-black/40">
      <div className="flex gap-6 border-b border-white/10 px-4 py-3 text-sm">
        <button className="font-medium text-violet-300">
          History
        </button>
        <button className="text-gray-500">Layers</button>
        <button className="text-gray-500">Assets</button>
        <button className="text-gray-500">Timeline</button>
      </div>

      <div className="flex min-h-24 gap-3 overflow-x-auto p-4">
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">
            Your saved media will appear here.
          </p>
        ) : (
          history.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onRestore(item)}
              className="w-44 shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 text-left transition hover:border-emerald-300/50"
            >
              {item.mediaType === "image" ? (
                <img src={item.outputUrl} alt="" className="mb-2 aspect-video w-full rounded bg-black object-contain" />
              ) : (
                <div className="mb-2 flex aspect-video items-center justify-center rounded bg-black text-xs uppercase text-gray-400">Video</div>
              )}
              <p className="line-clamp-2 text-xs text-gray-200">{item.prompt}</p>
              <p className="mt-1 text-[10px] text-gray-500">
                {item.mediaType} · {new Date(item.createdAt).toLocaleString()}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
