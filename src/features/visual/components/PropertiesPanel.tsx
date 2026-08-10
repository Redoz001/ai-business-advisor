import type { VisualStyle } from "../types";

type PropertiesPanelProps = {
  selectedEntity: string;
  style: VisualStyle;
  onStyleChange: (style: VisualStyle) => void;
};

const styles: VisualStyle[] = [
  "futuristic",
  "cinematic",
  "minimal",
  "corporate",
  "poster",
];

export default function PropertiesPanel({
  selectedEntity,
  style,
  onStyleChange,
}: PropertiesPanelProps) {
  return (
    <aside className="border-l border-white/10 bg-black/30 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">
        Properties
      </h3>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-gray-500">Selected</p>
        <p className="mt-1 font-semibold text-white">
          {selectedEntity}
        </p>
      </div>

      <label className="mt-6 block text-sm font-medium text-gray-300">
        Visual style
      </label>

      <select
        value={style}
        onChange={(event) =>
          onStyleChange(event.target.value as VisualStyle)
        }
        className="mt-2 w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none focus:border-violet-500"
      >
        {styles.map((option) => (
          <option key={option} value={option}>
            {option.charAt(0).toUpperCase() + option.slice(1)}
          </option>
        ))}
      </select>

      <div className="mt-6 space-y-3">
        {["Material", "Lighting", "Camera", "Position", "Scale"].map(
          (property) => (
            <button
              key={property}
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
            >
              <span>{property}</span>
              <span>›</span>
            </button>
          )
        )}
      </div>
    </aside>
  );
}
