import type {
  ConversationMessage,
} from "../types/Message";

type VideoMessageProps = {
  content: string;
  video?: ConversationMessage["video"];
  onDownload?: (url: string, filename: string) => void;
};

export default function VideoMessage({
  content,
  video,
  onDownload,
}: VideoMessageProps) {
  return (
    <div className="space-y-3">
      {content && (
        <p className="text-sm text-zinc-300">
          {content}
        </p>
      )}

      {video?.url ? (
        <div className="flex justify-center rounded-xl border border-zinc-800 bg-black overflow-hidden">
          <video
            controls
            poster={video.thumbnailUrl}
            style={{
              maxWidth: "100%",
              maxHeight: "500px",
              width: "auto",
              height: "auto",
              objectFit: "contain",
            }}
            className="rounded-xl"
          >
            <source
              src={video.url}
              type={video.mimeType || "video/webm"}
            />

            Your browser does not support video playback.
          </video>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="font-medium text-amber-200">
            Video generation recognized
          </p>

          <p className="mt-2 text-sm text-amber-100/70">
            The conversation engine is ready to display videos,
            but the video-rendering engine still needs to be connected.
          </p>
        </div>
      )}

      {onDownload && video?.url && (
        <button
          onClick={() => {
            const url = video.url;
            if (url) onDownload(url, "reunexus-video.webm");
          }}
          className="mt-2 rounded-lg bg-zinc-800 px-3 py-1 text-xs text-white transition hover:bg-zinc-700"
        >
          Download Video
        </button>
      )}
    </div>
  );
}
