import { useState } from "react";
import { saveFeedback } from "../lib/feedback.js";

export default function FeedbackForm({
  userId,
  chatId = null,
  messageId = null,
  reply = false,
  initialOpen = false,
}) {
  const [rating, setRating] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackId, setFeedbackId] = useState(null);
  const [open, setOpen] = useState(initialOpen);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const recordRating = async (nextRating) => {
    setRating(nextRating);
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const id = await saveFeedback({
        id: feedbackId,
        userId,
        chatId,
        messageId,
        source: "assistant_reply",
        rating: nextRating,
      });
      setFeedbackId(id);
      setNotice("Thanks for rating this reply.");
    } catch (saveError) {
      if (saveError.feedbackId) setFeedbackId(saveError.feedbackId);
      console.error("Could not save reply rating:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Could not save your rating.");
    } finally {
      setSaving(false);
    }
  };

  const submitFeedback = async (event) => {
    event.preventDefault();
    if (!feedback.trim() || saving) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const id = await saveFeedback({
        id: feedbackId,
        userId,
        chatId,
        messageId,
        source: reply ? "assistant_reply" : "sidebar",
        rating,
        feedback,
      });
      setFeedbackId(id);
      setFeedback("");
      setOpen(false);
      setNotice("Thanks for your feedback.");
    } catch (saveError) {
      if (saveError.feedbackId) setFeedbackId(saveError.feedbackId);
      console.error("Could not send feedback:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Could not send your feedback.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={reply ? "mt-3 border-t border-zinc-700/70 pt-2" : "p-3"}>
      {reply ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500">Was this helpful?</span>
          <button
            type="button"
            aria-label="This reply was helpful"
            aria-pressed={rating === "up"}
            disabled={saving}
            onClick={() => recordRating("up")}
            className={`rounded px-2 py-1 hover:bg-zinc-800 disabled:opacity-50 ${rating === "up" ? "text-emerald-300" : "text-zinc-400"}`}
          >
            👍
          </button>
          <button
            type="button"
            aria-label="This reply was not helpful"
            aria-pressed={rating === "down"}
            disabled={saving}
            onClick={() => recordRating("down")}
            className={`rounded px-2 py-1 hover:bg-zinc-800 disabled:opacity-50 ${rating === "down" ? "text-amber-300" : "text-zinc-400"}`}
          >
            👎
          </button>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            {open ? "Close feedback" : "Send feedback"}
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-left text-sm text-zinc-300 hover:border-emerald-500 hover:bg-zinc-900"
          >
            {open ? "Close feedback" : "💬 Send feedback"}
          </button>
        </>
      )}

      {open && (
        <form onSubmit={submitFeedback} className={reply ? "mt-2 space-y-2" : "mt-3 space-y-2"}>
          <label className="sr-only" htmlFor={reply ? `reply-feedback-${messageId}` : "sidebar-feedback"}>
            {reply ? "Feedback on this reply" : "Your feedback"}
          </label>
          <textarea
            id={reply ? `reply-feedback-${messageId}` : "sidebar-feedback"}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            maxLength={4000}
            rows={reply ? 2 : 3}
            placeholder={reply ? "Tell us how this reply could be better (optional)." : "Tell us what is working or what we could improve."}
            className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">{feedback.length}/4000</span>
            <button
              type="submit"
              disabled={!feedback.trim() || saving}
              className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      )}

      {(notice || error) && (
        <p role={error ? "alert" : "status"} className={`mt-2 text-xs ${error ? "text-red-300" : "text-emerald-300"}`}>
          {error || notice}
        </p>
      )}
    </div>
  );
}
