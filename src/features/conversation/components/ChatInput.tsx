type ChatInputProps = {
  input: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
};

export default function ChatInput({
  input,
  loading,
  onInputChange,
  onSend,
  onStop,
}: ChatInputProps) {
  return (
    <div className="flex items-center gap-2 border-t border-zinc-800 p-3">
      <input
        value={input}
        onChange={(event) =>
          onInputChange(event.target.value)
        }
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey
          ) {
            event.preventDefault();
            onSend();
          }
        }}
        placeholder="Ask anything, create an image, or create a video..."
        className="flex-1 rounded-xl bg-zinc-900 p-3 text-white outline-none transition placeholder:text-zinc-500 focus:ring-1 focus:ring-violet-500"
      />

      {loading && (
        <button
          type="button"
          onClick={onStop}
          className="rounded-lg px-3 py-2 text-sm text-red-400 transition hover:bg-red-500/10"
        >
          Stop
        </button>
      )}

      <button
        type="button"
        onClick={onSend}
        disabled={
          loading || !input.trim()
        }
        className="rounded-xl bg-zinc-800 px-4 py-3 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "..." : "Send"}
      </button>
    </div>
  );
}
