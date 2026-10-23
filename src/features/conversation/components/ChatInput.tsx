import React from "react";
import RobotAvatar from "./RobotAvatar";

type ChatInputProps = {
  input: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onImageUpload?: (file: File) => void;
  onCameraCapture?: (file: File) => void;
  onQuickSend?: (message: string) => void;
  aiResponseText?: string;
  plan?: string;
  usageUsed?: number;
  usageLimit?: number;
  requestResetAt?: string | null;
  onUpgradeToIntelligence?: () => void | Promise<void>;
};

export default function ChatInput({
  input,
  loading,
  onInputChange,
  onSend,
  onStop,
  onImageUpload,
  onCameraCapture,
  onQuickSend,
  aiResponseText,
  plan = "normal",
  usageUsed = 0,
  usageLimit = 20,
  requestResetAt,
  onUpgradeToIntelligence,
}: ChatInputProps) {
  const [isRecording, setIsRecording] = React.useState(false);
  const [recognitionRef, setRecognitionRef] = React.useState<any>(null);
  // Avatar is hidden by default; it only loads when the user presses the robot icon.
  const [showRobot, setShowRobot] = React.useState(false);
  const [robotGender, setRobotGender] = React.useState<"male" | "female" | "neutral">("male");

  const handleVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    // Stop if already recording
    if (isRecording && recognitionRef) {
      recognitionRef.stop();
      setIsRecording(false);
      setShowRobot(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      onInputChange(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    setRecognitionRef(recognition);

    // Show the full avatar when voice recording starts
    setShowRobot(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImageUpload) {
      onImageUpload(file);
    }
    event.target.value = "";
  };

  const handleCameraCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onCameraCapture) {
      onCameraCapture(file);
    }
    event.target.value = "";
  };

  const handleAvatarSendMessage = (message: string) => {
    // Send message through the conversation engine
    if (onQuickSend) {
      onQuickSend(message);
    } else {
      onInputChange(message);
      setTimeout(() => onSend(), 100);
    }
  };

  const resetLabel = requestResetAt
    ? new Date(requestResetAt).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "No reset scheduled";

  const usageRatio = plan === "intelligence" ? 1 : Math.min(usageLimit ? usageUsed / usageLimit : 0, 1);
  const isNearLimit = plan !== "intelligence" && usageRatio >= 0.8;
  const remaining = plan === "intelligence" ? "∞" : Math.max(usageLimit - usageUsed, 0);

  const upgradeToIntelligence = () => {
    if (onUpgradeToIntelligence) {
      void onUpgradeToIntelligence();
      return;
    }

    if (typeof window !== "undefined") {
      window.location.href = "#profile";
    }
  };

  return (
    <div className="chat-input-container flex flex-col border-t border-zinc-800 p-2 sm:p-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 shadow-[0_0_18px_rgba(168,85,247,0.2)] backdrop-blur-sm ${
            plan === "intelligence"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : isNearLimit
                ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                : "border-violet-500/30 bg-violet-500/10 text-violet-200"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          <span className="text-[10px] sm:text-xs font-medium">
            {plan === "intelligence" ? "Intelligence • Unlimited" : `Free tier • ${usageUsed}/${usageLimit}`}
          </span>
        </div>
        {plan !== "intelligence" && (
          <div className="text-[10px] sm:text-xs text-zinc-400">
            {isNearLimit ? `${remaining} left` : `Resets ${resetLabel}`}
          </div>
        )}
      </div>

      {plan !== "intelligence" && (
        <div className="mb-2 flex items-center gap-2 px-1">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.2),transparent_70%)]" />
            <div
              className={`relative h-full rounded-full transition-all duration-300 ${
                isNearLimit ? "bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500"
              }`}
              style={{ width: `${Math.max(usageRatio * 100, 4)}%` }}
            />
          </div>
          <span className="min-w-[42px] text-right text-[10px] sm:text-xs text-zinc-300">
            {remaining} left
          </span>
        </div>
      )}

      {plan !== "intelligence" && (
        <div className="mb-2 flex items-center justify-end px-1">
          <button
            type="button"
            onClick={upgradeToIntelligence}
            className="rounded-full border border-violet-400/50 bg-gradient-to-r from-violet-600/80 to-fuchsia-600/80 px-2.5 py-1 text-[10px] sm:text-xs font-semibold text-white shadow-[0_0_22px_rgba(168,85,247,0.25)] transition hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(168,85,247,0.4)]"
          >
            Upgrade to Intelligence
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 sm:gap-2">
        {/* Avatar / Live AI Talk Button */}
        <button
          type="button"
          disabled={loading}
          className="chat-input-btn relative rounded-lg px-2 sm:px-3 py-2 text-base sm:text-sm text-yellow-400 transition hover:bg-yellow-500/10 disabled:opacity-50"
          title="Talk to AI live"
          onClick={() => {
            if (showRobot) {
              setShowRobot(false);
              return;
            }
            setShowRobot(true);
          }}
        >
          🤖
          {isRecording && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
            </span>
          )}
        </button>

        <input
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="Ask anything, create an image, or create a video..."
          className="chat-input-text flex-1 rounded-xl bg-zinc-900 p-2 sm:p-3 text-sm sm:text-base text-white outline-none transition placeholder:text-zinc-500 focus:ring-1 focus:ring-violet-500 min-w-0"
        />

        <button
          type="button"
          onClick={handleVoiceInput}
          disabled={loading}
          className={`chat-input-btn relative rounded-lg px-2 sm:px-3 py-2 text-base sm:text-sm transition disabled:opacity-50 ${
            isRecording
              ? "text-red-400 bg-red-500/20 animate-pulse"
              : "text-blue-400 hover:bg-blue-500/10"
          }`}
          title="Voice input"
        >
          {isRecording ? "🛑" : "🎤"}
          {isRecording && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
          )}
        </button>

        {isRecording && (
          <div className="robot-face flex items-center gap-1.5 rounded-lg bg-yellow-500/10 px-2 sm:px-3 py-1.5 sm:py-2">
            <div className="flex items-center gap-1">
              <div className="robot-eye w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full"></div>
              <div className="robot-eye w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full"></div>
            </div>
            <div className="robot-lips"></div>
            <span className="text-[10px] sm:text-xs text-yellow-400 ml-0.5 sm:ml-1 whitespace-nowrap">AI is listening...</span>
          </div>
        )}

        {isRecording && (
          <div className="flex items-center gap-0.5 sm:gap-1 rounded-lg bg-red-500/10 px-2 sm:px-3 py-1.5 sm:py-2">
            <div className="flex items-center gap-0.5">
              <div className="voice-wave w-0.5 sm:w-1 bg-red-400 rounded-full" style={{ height: "8px" }}></div>
              <div className="voice-wave w-0.5 sm:w-1 bg-red-400 rounded-full" style={{ height: "12px" }}></div>
              <div className="voice-wave w-0.5 sm:w-1 bg-red-400 rounded-full" style={{ height: "16px" }}></div>
              <div className="voice-wave w-0.5 sm:w-1 bg-red-400 rounded-full" style={{ height: "10px" }}></div>
            </div>
            <span className="text-[10px] sm:text-xs text-red-400 ml-0.5 sm:ml-1 whitespace-nowrap">Listening...</span>
          </div>
        )}

        <RobotAvatar
          isActive={showRobot}
          gender={robotGender}
          onClose={() => setShowRobot(false)}
          onGenderChange={setRobotGender}
          onSendMessage={handleAvatarSendMessage}
          aiResponseText={aiResponseText}
        />

        <label className="chat-input-btn cursor-pointer rounded-lg px-2 sm:px-3 py-2 text-base sm:text-sm text-green-400 transition hover:bg-green-500/10 disabled:opacity-50" title="Take photo">
          <span className="sm:hidden">📷</span>
          <span className="hidden sm:inline">📷</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCameraCapture}
            disabled={loading}
            className="hidden"
          />
        </label>

        <label className="chat-input-btn cursor-pointer rounded-lg px-2 sm:px-3 py-2 text-base sm:text-sm text-purple-400 transition hover:bg-purple-500/10 disabled:opacity-50" title="Upload files">
          📎
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileUpload}
            disabled={loading}
            className="hidden"
          />
        </label>

        <style>{`
          @media (max-width: 640px) {
            .chat-input-container {
              gap: 0.25rem;
              padding: 0.5rem;
              flex-wrap: nowrap;
            }
            .chat-input-container button,
            .chat-input-container label {
              padding: 0.4rem 0.5rem;
              font-size: 0.875rem;
              min-width: 2rem;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .chat-input-container input[type="text"] {
              font-size: 0.875rem;
              padding: 0.5rem;
            }
          }
          @keyframes voice-wave {
            0%, 100% { height: 8px; }
            50% { height: 20px; }
          }
          .voice-wave {
            animation: voice-wave 0.6s ease-in-out infinite;
          }
          .voice-wave:nth-child(2) {
            animation-delay: 0.1s;
          }
          .voice-wave:nth-child(3) {
            animation-delay: 0.2s;
          }
          .voice-wave:nth-child(4) {
            animation-delay: 0.3s;
          }

          @keyframes robot-eye-blink {
            0%, 44%, 100% { transform: scaleY(1); }
            45%, 55% { transform: scaleY(0.1); }
            56% { transform: scaleY(1); }
          }
          .robot-eye {
            animation: robot-eye-blink 3.5s ease-in-out infinite;
          }
          .robot-eye:nth-child(2) {
            animation-delay: 0.08s;
          }
          @keyframes robot-lips {
            0%, 100% { width: 8px; height: 2px; border-radius: 2px; }
            25% { width: 12px; height: 4px; border-radius: 4px; }
            50% { width: 10px; height: 3px; border-radius: 3px; }
            75% { width: 14px; height: 5px; border-radius: 5px; }
          }
          .robot-lips {
            width: 10px;
            height: 3px;
            background: #facc15;
            border-radius: 3px;
            animation: robot-lips 1.2s ease-in-out infinite;
          }
        `}</style>

        {loading && (
          <button
            type="button"
            onClick={onStop}
            className="rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm text-red-400 transition hover:bg-red-500/10 whitespace-nowrap"
          >
            Stop
          </button>
        )}

        <button
          type="button"
          onClick={onSend}
          disabled={loading || !input.trim()}
          className="rounded-xl bg-zinc-800 px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}