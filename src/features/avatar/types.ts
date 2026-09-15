export type AvatarGender = "male" | "female";

export type AvatarCategory =
  | "human"
  | "futuristic"
  | "robotic"
  | "stylized";

export type AvatarState =
  | "INITIALIZING"
  | "ENTERING"
  | "IDLE"
  | "USER_SPEAKING"
  | "LISTENING"
  | "PROCESSING"
  | "THINKING"
  | "AI_SPEAKING"
  | "INTERRUPTED"
  | "ERROR"
  | "RECOVERING"
  | "EXITING";

export type Emotion =
  | "neutral"
  | "friendly"
  | "happy"
  | "amused"
  | "excited"
  | "confident"
  | "serious"
  | "concerned"
  | "empathetic"
  | "thoughtful"
  | "surprised"
  | "confused"
  | "sad"
  | "calm";

export type Gesture =
  | "none"
  | "dance"
  | "small_nod"
  | "strong_nod"
  | "head_shake"
  | "greeting_wave"
  | "acknowledgement"
  | "explanatory_hand"
  | "open_palm"
  | "subtle_point"
  | "shrug"
  | "thinking"
  | "posture_adjust";

export interface EmotionState {
  emotion: Emotion;
  intensity: number; // 0-1
}

export interface BehaviorCommand {
  emotion?: Emotion;
  intensity?: number;
  gesture?: Gesture;
  gazeIntent?: "user" | "away" | "thinking" | "scanning";
  speakingStyle?: "calm" | "excited" | "serious" | "friendly";
  animationIntensity?: number;
}

export interface AvatarProfile {
  id: string;
  name: string;
  category: AvatarCategory;
  gender: AvatarGender;
  skinTone: number;
  hairColor: number;
  hairStyle: "short" | "long" | "bun" | "spiky" | "bald";
  outfitColor: number;
  accentColor: number;
  eyeColor: number;
  voiceId: string;
  voiceName: string;
  voicePitch: number;
  voiceRate: number;
  description: string;
  capabilities: {
    supportsBlink: boolean;
    supportsLipSync: boolean;
    supportsFacialExpressions: boolean;
    supportsHumanBreathing: boolean;
    supportsGestures: boolean;
    supportsFullBody: boolean;
  };
  animationProfile: {
    breathingRate: number;
    blinkFrequency: number;
    gazeFrequency: number;
    gestureFrequency: number;
    headMovementAmount: number;
  };
}

export interface LipSyncFrame {
  time: number;
  mouthOpen: number; // 0-1
  jawOpen: number; // 0-1
  smile: number; // -1 to 1
}

export interface AvatarSession {
  profile: AvatarProfile;
  state: AvatarState;
  emotion: EmotionState;
  activeGesture: Gesture;
  isMicActive: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
}

export interface GraphicsQuality {
  level: "LOW" | "MEDIUM" | "HIGH" | "ULTRA";
  shadows: boolean;
  antialias: boolean;
  pixelRatio: number;
  hairDetail: number;
}

export interface AvatarCatalogEntry {
  profile: AvatarProfile;
  thumbnailColor: string;
  previewEmoji: string;
}