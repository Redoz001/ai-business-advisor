type SceneExplorerProps = {
  prompt: string;
  selectedEntity: string;
  onSelectEntity: (entity: string) => void;
};

export default function SceneExplorer({
  prompt,
  selectedEntity,
  onSelectEntity,
}: SceneExplorerProps) {
  const entities = [
    "Scene",
    "Main Subject",
    "Background",
    "Lighting",
    "Camera",
  ];

  return (
    <aside className="border-r border-white/10 bg-black/30 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">
        Scene Explorer
      </h3>

      <div className="mt-4 space-y-2">
        {entities.map((entity) => (
          <button
            key={entity}
            type="button"
            onClick={() => onSelectEntity(entity)}
            className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
              selectedEntity === entity
                ? "bg-violet-500/15 text-violet-200"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {entity}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-3">
        <p className="text-xs uppercase tracking-wider text-gray-500">
          Active prompt
        </p>
        <p className="mt-2 line-clamp-6 text-sm leading-6 text-gray-300">
          {prompt || "No scene has been described yet."}
        </p>
      </div>
    </aside>
  );
}
