import React, { useCallback, useEffect, useRef, useState } from "react";
import Avatar3D from "./Avatar3D";
import { AVATAR_CATALOG, getDefaultAvatar } from "./catalog";
import { supabase } from "../../lib/supabase.js";
import type {
  AvatarProfile,
  AvatarState,
  EmotionState,
  Gesture,
} from "./types";

const SKIN_TONES = [
  { name: "Porcelain", value: 0xf2d5c4 },
  { name: "Light", value: 0xe8b896 },
  { name: "Warm", value: 0xc98f68 },
  { name: "Olive", value: 0xa96f4c },
  { name: "Brown", value: 0x805239 },
  { name: "Deep", value: 0x503328 },
];

const BACKGROUNDS = [
  { name: "Midnight", value: "#15182d" },
  { name: "Indigo", value: "#312e81" },
  { name: "Forest", value: "#064e3b" },
  { name: "Burgundy", value: "#701a35" },
  { name: "Slate", value: "#334155" },
];

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

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
  const [backgroundColor, setBackgroundColor] = useState("#15182d");
  const [showCustomization, setShowCustomization] = useState(false);
  const [loadingCustomization, setLoadingCustomization] = useState(true);
  const [savingCustomization, setSavingCustomization] = useState(false);
  const [customizationMessage, setCustomizationMessage] = useState("");
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
  const greetedProfileIdRef = useRef<string | null>(null);
  const danceTimeoutRef = useRef<number | null>(null);
  const danceCommandHandledRef = useRef(false);
  // Track the last text spoken so we never repeat the same utterance and so
  // the greeting can't stomp on a pending AI response.
  const lastSpokenRef = useRef<string | null>(null);
  // Set while an AI response is queued to speak; blocks the greeting effect.
  const aiResponsePendingRef = useRef(false);

  useEffect(() => {
    let active = true;

    const loadCustomization = async () => {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError) throw authError;

        const saved = data.user?.user_metadata?.avatar_customization;
        if (!saved || typeof saved !== "object") {
          if (initialProfile) setProfile(initialProfile);
          return;
        }

        const savedProfile = AVATAR_CATALOG.find(
          (entry) => entry.profile.id === saved.id
        )?.profile;
        const baseProfile = savedProfile || initialProfile || getDefaultAvatar();
        const savedName =
          typeof saved.name === "string" ? saved.name.trim().slice(0, 40) : "";
        const savedSkinTone =
          typeof saved.skinTone === "number" &&
          Number.isInteger(saved.skinTone) &&
          saved.skinTone >= 0 &&
          saved.skinTone <= 0xffffff
            ? saved.skinTone
            : baseProfile.skinTone;

        setProfile({
          ...baseProfile,
          name: savedName || baseProfile.name,
          skinTone: savedSkinTone,
        });
        if (isHexColor(saved.backgroundColor)) {
          setBackgroundColor(saved.backgroundColor);
        }
      } catch (authError) {
        if (!active) return;
        console.error("Unable to load saved avatar settings:", authError);
        setCustomizationMessage("Could not load saved avatar settings.");
      } finally {
        if (active) setLoadingCustomization(false);
      }
    };

    void loadCustomization();
    return () => {
      active = false;
    };
  }, [initialProfile]);

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
    danceCommandHandledRef.current = false;

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
      const latestResult = event.results[event.results.length - 1];
      if (
        latestResult?.isFinal &&
        !danceCommandHandledRef.current &&
        /\b(dance|dancing|do a dance)\b/i.test(text)
      ) {
        danceCommandHandledRef.current = true;
        setGesture("dance");
        if (danceTimeoutRef.current !== null) {
          window.clearTimeout(danceTimeoutRef.current);
        }
        danceTimeoutRef.current = window.setTimeout(() => {
          setGesture("none");
          danceTimeoutRef.current = null;
        }, 7000);
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
    setGesture("none");
    danceCommandHandledRef.current = false;
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
        aiResponsePendingRef.current = false;
        setState("IDLE");
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        aiResponsePendingRef.current = false;
        setState("IDLE");
      };

      lastSpokenRef.current = text;
      speechSynthRef.current.speak(utterance);
    },
    [profile]
  );

  // Greeting when avatar loads
  useEffect(() => {
    // Never let the greeting stomp on a queued AI response.
    if (aiResponsePendingRef.current) return;
    if (
      state === "IDLE" &&
      !isSpeaking &&
      !isMicActive &&
      greetedProfileIdRef.current !== profile.id
    ) {
      greetedProfileIdRef.current = profile.id;
      const timer = setTimeout(() => {
        // Don't greet if we already spoke something (e.g. an AI response arrived).
        if (lastSpokenRef.current !== null) return;
        speakText(
          `Hello! I'm ${profile.name}. How can I help you today?`
        );
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [state, profile, isSpeaking, isMicActive, speakText]);

  // Speak AI response when it arrives
  useEffect(() => {
    if (!aiResponseText || !aiResponseText.trim()) return;

    // Don't re-speak the same text.
    if (lastSpokenRef.current === aiResponseText.trim()) return;

    aiResponsePendingRef.current = true;
    setState("THINKING");
    setIsThinking(true);
    const timer = setTimeout(() => {
      setIsThinking(false);
      aiResponsePendingRef.current = false;
      speakText(aiResponseText);
    }, 500);
    return () => {
      aiResponsePendingRef.current = false;
      clearTimeout(timer);
    };
  }, [aiResponseText, speakText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      speechSynthRef.current?.cancel();
      audioContextRef.current?.close();
      if (danceTimeoutRef.current !== null) {
        window.clearTimeout(danceTimeoutRef.current);
      }
    };
  }, []);

  const handleSelectAvatar = (newProfile: AvatarProfile) => {
    setProfile(newProfile);
    setCustomizationMessage("");
    greetedProfileIdRef.current = null;
    setShowCatalog(false);
    speechSynthRef.current?.cancel();
    setIsSpeaking(false);
    setState("IDLE");
  };

  const saveCustomization = async () => {
    const name = profile.name.trim();
    if (!name) {
      setCustomizationMessage("Enter a name for your avatar before saving.");
      return;
    }

    setSavingCustomization(true);
    setCustomizationMessage("");
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!data.user) {
        setCustomizationMessage("Sign in to save avatar settings to your profile.");
        return;
      }

      const { error: saveError } = await supabase.auth.updateUser({
        data: {
          avatar_customization: {
            id: profile.id,
            name,
            skinTone: profile.skinTone,
            backgroundColor,
          },
        },
      });
      if (saveError) throw saveError;

      setProfile((current) => ({ ...current, name }));
      setCustomizationMessage("Avatar settings saved to your profile.");
    } catch (saveError) {
      console.error("Unable to save avatar settings:", saveError);
      setCustomizationMessage("Could not save avatar settings. Please try again.");
    } finally {
      setSavingCustomization(false);
    }
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
          <button
            onClick={() => setShowCustomization((visible) => !visible)}
            className="rounded-full bg-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/20"
            aria-expanded={showCustomization}
          >
            Customize
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

      {showCustomization && (
        <section className="mx-4 mb-3 max-h-[28vh] overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/90 p-3 text-white">
          <label className="block text-xs text-zinc-300" htmlFor="avatar-name">
            Avatar name
          </label>
          <input
            id="avatar-name"
            value={profile.name}
            maxLength={40}
            disabled={loadingCustomization}
            onChange={(event) => {
              setProfile((current) => ({ ...current, name: event.target.value }));
              setCustomizationMessage("");
            }}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-violet-400"
          />

          <div className="mt-3">
            <p className="mb-2 text-xs text-zinc-300">Skin tone</p>
            <div className="flex flex-wrap gap-2">
              {SKIN_TONES.map((tone) => (
                <button
                  key={tone.value}
                  type="button"
                  title={tone.name}
                  aria-label={`${tone.name} skin tone`}
                  aria-pressed={profile.skinTone === tone.value}
                  disabled={loadingCustomization}
                  onClick={() => {
                    setProfile((current) => ({
                      ...current,
                      skinTone: tone.value,
                    }));
                    setCustomizationMessage("");
                  }}
                  className={`h-8 w-8 rounded-full border-2 ${
                    profile.skinTone === tone.value
                      ? "border-white"
                      : "border-white/20"
                  }`}
                  style={{ backgroundColor: `#${tone.value.toString(16).padStart(6, "0")}` }}
                />
              ))}
              <label className="flex h-8 items-center gap-2 rounded-full border border-white/20 px-2 text-xs text-zinc-300">
                Custom
                <input
                  type="color"
                  aria-label="Choose custom skin tone"
                  disabled={loadingCustomization}
                  value={`#${profile.skinTone.toString(16).padStart(6, "0")}`}
                  onChange={(event) => {
                    setProfile((current) => ({
                      ...current,
                      skinTone: Number.parseInt(event.target.value.slice(1), 16),
                    }));
                    setCustomizationMessage("");
                  }}
                  className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
                />
              </label>
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-2 text-xs text-zinc-300">Background</p>
            <div className="flex flex-wrap gap-2">
              {BACKGROUNDS.map((background) => (
                <button
                  key={background.value}
                  type="button"
                  title={background.name}
                  aria-label={`${background.name} background`}
                  aria-pressed={backgroundColor === background.value}
                  disabled={loadingCustomization}
                  onClick={() => {
                    setBackgroundColor(background.value);
                    setCustomizationMessage("");
                  }}
                  className={`h-8 w-8 rounded-full border-2 ${
                    backgroundColor === background.value
                      ? "border-white"
                      : "border-white/20"
                  }`}
                  style={{ backgroundColor: background.value }}
                />
              ))}
              <label className="flex h-8 items-center gap-2 rounded-full border border-white/20 px-2 text-xs text-zinc-300">
                Custom
                <input
                  type="color"
                  aria-label="Choose custom background"
                  disabled={loadingCustomization}
                  value={backgroundColor}
                  onChange={(event) => {
                    setBackgroundColor(event.target.value);
                    setCustomizationMessage("");
                  }}
                  className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
                />
              </label>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={saveCustomization}
              disabled={loadingCustomization || savingCustomization}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {loadingCustomization
                ? "Loading..."
                : savingCustomization
                ? "Saving..."
                : "Save avatar to profile"}
            </button>
            {loadingCustomization ? (
              <span className="text-xs text-zinc-300" role="status">
                Loading saved avatar settings...
              </span>
            ) : customizationMessage ? (
              <span className="text-xs text-zinc-300" role="status">
                {customizationMessage}
              </span>
            ) : null}
          </div>
        </section>
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
            backgroundColor={backgroundColor}
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