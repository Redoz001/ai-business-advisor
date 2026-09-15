import React, { useCallback, useEffect, useRef, useState } from "react";
import Avatar3D from "./Avatar3D";
import { AVATAR_CATALOG, getDefaultAvatar } from "./catalog";
import type {
  AvatarProfile,
  AvatarState,
  EmotionState,
  Gesture,
} from "./types";

// Error boundary to catch WebGL/renderer failures and show a visible error
// instead of a black screen.
class AvatarErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onError?: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AvatarErrorBoundary] Caught error:", error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#0d0d20] p-6">
          <div className="text-center">
            <p className="mb-2 text-3xl">⚠️</p>
            <p className="mb-1 text-sm font-medium text-white">
              Avatar renderer failed
            </p>
            <p className="mb-4 text-xs text-zinc-400">
              {this.state.error?.message || "WebGL is not available on this device."}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type AvatarModeProps = {
  onSendMessage: (message: string) => void;
  onClose: () => void;
  initialProfile?: AvatarProfile;
  aiResponseText?: string;
};

export default function AvatarMode({
  onSendMessage,
  onClose,
  initialProfile,
  aiResponseText,
}: AvatarModeProps) {
  const [profile, setProfile] = useState<AvatarProfile>(
    initialProfile || getDefaultAvatar()
  );
  const currentEntry = AVATAR_CATALOG.find(
    (entry) => entry.profile.id === profile.id
  );
  const currentEmoji = currentEntry?.previewEmoji || "👤";
  const [state, setState] = useState<AvatarState>("INITIALIZING");
  const [emotion, setEmotion] = useState<EmotionState>({
    emotion: "neutral",
    intensity: 0,
  });
  const [gesture, setGesture] = useState<Gesture>("none");
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const speechSynthRef = useRef<SpeechSynthesis | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioDataRef = useRef<Uint8Array | null>(null);
  const isSpeakingRef = useRef(false);

  // Initialize speech synthesis
  useEffect(() => {
    speechSynthRef.current = window.speechSynthesis;
    return () => {
      speechSynthRef.current?.cancel();
    };
  }, []);

  // Handle state changes
  const handleStateChange = useCallback((nextState: AvatarState) => {
    setState(nextState);
  }, []);

  const handleEmotionChange = useCallback((nextEmotion: EmotionState) => {
    setEmotion(nextEmotion);
  }, []);

  const handleGestureChange = useCallback((nextGesture: Gesture) => {
    setGesture(nextGesture);
  }, []);

  // Voice recognition
  const startListening = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("Speech recognition is not supported in your browser.");
      return;
    }

    // Stop any current speech
    speechSynthRef.current?.cancel();
    setIsSpeaking(false);
    isSpeakingRef.current = false;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsMicActive(true);
      setState("LISTENING");
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
      if (/\b(dance|dancing|do a dance)\b/i.test(text)) {
        setGesture("dance");
        window.setTimeout(() => setGesture("none"), 7000);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setError("Microphone permission denied. Please allow microphone access.");
      }
      setIsMicActive(false);
      setState("IDLE");
    };

    recognition.onend = () => {
      setIsMicActive(false);
      setState("IDLE");
      // If we have a transcript, send it
      if (transcript.trim()) {
        handleSendTranscript(transcript);
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [transcript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsMicActive(false);
    setState("IDLE");
  }, []);

  // Send transcript to AI
  const handleSendTranscript = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      setTranscript("");
      setIsThinking(true);
      setState("THINKING");
      onSendMessage(text.trim());
    },
    [onSendMessage]
  );

  // Speak text with lip sync
  const speakText = useCallback(
    (text: string) => {
      if (!speechSynthRef.current) return;

      speechSynthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = profile.voiceRate;
      utterance.pitch = profile.voicePitch;
      utterance.volume = 1;

      // Try to find matching voice
      const voices = speechSynthRef.current.getVoices();
      const preferredVoice = voices.find((v) =>
        profile.gender === "female"
          ? v.name.toLowerCase().includes("female") ||
            v.name.toLowerCase().includes("samantha") ||
            v.name.toLowerCase().includes("zira")
          : v.name.toLowerCase().includes("male") ||
            v.name.toLowerCase().includes("david") ||
            v.name.toLowerCase().includes("mark")
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        isSpeakingRef.current = true;
        setState("AI_SPEAKING");
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setState("IDLE");
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setState("IDLE");
      };

      speechSynthRef.current.speak(utterance);
    },
    [profile]
  );

  // Greeting when avatar loads
  useEffect(() => {
    if (state === "IDLE" && !isSpeaking && !isMicActive) {
      const timer = setTimeout(() => {
        speakText(
          `Hello! I'm ${profile.name}. How can I help you today?`
        );
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [state, profile, isSpeaking, isMicActive, speakText]);

  // Speak AI response when it arrives
  useEffect(() => {
    if (aiResponseText && aiResponseText.trim()) {
      setState("THINKING");
      setIsThinking(true);
      const timer = setTimeout(() => {
        setIsThinking(false);
        speakText(aiResponseText);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [aiResponseText, speakText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      speechSynthRef.current?.cancel();
      audioContextRef.current?.close();
    };
  }, []);

  const handleSelectAvatar = (newProfile: AvatarProfile) => {
    setProfile(newProfile);
    setShowCatalog(false);
    speechSynthRef.current?.cancel();
    setIsSpeaking(false);
    setState("IDLE");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCatalog(!showCatalog)}
            className="rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
          >
            {currentEmoji} {profile.name} ▾
          </button>
          <span className="text-xs text-zinc-400">
            {state === "LISTENING"
              ? "🎤 Listening..."
              : state === "THINKING"
              ? "💭 Thinking..."
              : state === "AI_SPEAKING"
              ? "🗣️ Speaking..."
              : "● Live"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
        >
          ✕ Exit
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Avatar Catalog */}
      {showCatalog && (
        <div className="mx-4 mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {AVATAR_CATALOG.map((entry) => (
            <button
              key={entry.profile.id}
              onClick={() => handleSelectAvatar(entry.profile)}
              className={`rounded-xl border p-3 text-left transition ${
                profile.id === entry.profile.id
                  ? "border-violet-500 bg-violet-500/20"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className="text-3xl">{entry.previewEmoji}</div>
              <div className="mt-2 text-sm font-medium text-white">
                {entry.profile.name}
              </div>
              <div className="text-xs text-zinc-400">
                {entry.profile.description}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 3D Avatar */}
      <div className="flex-1 px-4">
        <AvatarErrorBoundary
          onError={(err) => {
            setError(`Avatar renderer error: ${err.message}`);
          }}
        >
          <Avatar3D
            profile={profile}
            isMicActive={isMicActive}
            isSpeaking={isSpeaking}
            isThinking={isThinking}
            gesture={gesture}
            onStateChange={handleStateChange}
            onEmotionChange={handleEmotionChange}
            onGestureChange={handleGestureChange}
          />
        </AvatarErrorBoundary>
      </div>

      {/* Transcript */}
      {transcript && (
        <div className="mx-4 mt-2 rounded-lg bg-white/5 px-4 py-2 text-sm text-white">
          <span className="text-zinc-400">You: </span>
          {transcript}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 p-4">
        <button
          onClick={isMicActive ? stopListening : startListening}
          className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl transition ${
            isMicActive
              ? "bg-red-500 text-white animate-pulse"
              : "bg-violet-600 text-white hover:bg-violet-500"
          }`}
          title={isMicActive ? "Stop listening" : "Start listening"}
        >
          {isMicActive ? "🛑" : "🎤"}
        </button>

        <button
          onClick={() => {
            if (transcript.trim()) {
              handleSendTranscript(transcript);
            }
          }}
          disabled={!transcript.trim()}
          className="rounded-full bg-white/10 px-6 py-3 text-sm text-white transition hover:bg-white/20 disabled:opacity-50"
        >
          Send
        </button>

        <button
          onClick={() => {
            speechSynthRef.current?.cancel();
            setIsSpeaking(false);
            setState("IDLE");
          }}
          className="rounded-full bg-white/10 px-4 py-3 text-sm text-white transition hover:bg-white/20"
        >
          ⏹ Stop
        </button>
      </div>
    </div>
  );
}