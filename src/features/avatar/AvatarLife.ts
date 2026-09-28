// src/features/avatar/AvatarLife.ts
// The avatar's "brain". Pure logic (no Three.js) so it can be unit tested.
//
// The previous implementation animated the rig with independent sine waves,
// which reads as robotic. This module produces the behavior a game NPC has:
// an attention system (fixations + ballistic saccades between interest
// targets), natural blinking, breathing, a scheduler of idle actions that
// happen every few seconds, and reactions to the conversation state
// (eye contact and nods while listening, looking away while thinking,
// gesture rhythm while speaking).
//
// Everything is deterministic for a given seed, and all randomness is local
// so behavior is reproducible.

import type { Gesture } from "./types";

export type GazeIntent = "user" | "away" | "thinking" | "scanning";

/** Per-avatar personality, sourced from AvatarProfile.animationProfile. */
export type LifePersonality = {
  breathingRate: number;
  blinkFrequency: number;
  gazeFrequency: number;
  gestureFrequency: number;
  headMovementAmount?: number;
};

export type LifeContext = {
  /** Seconds since the previous update (clamped internally). */
  delta: number;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  /** Gesture requested by the app (speech commands, conversation events). */
  gesture: Gesture;
  /** Optional high-level attention override (BehaviorCommand.gazeIntent). */
  gazeIntent?: GazeIntent;
  personality: LifePersonality;
};

/** Everything the renderer needs for one frame. */
export type AvatarPose = {
  headYaw: number;
  headPitch: number;
  headRoll: number;
  gazeX: number;
  gazeY: number;
  /** 0 = eyes open, 1 = fully closed. */
  blink: number;
  /** 0..1 lip-sync envelope. */
  mouth: number;
  /** -1..1 breathing signal (chest in/out). */
  breath: number;
  /** Body-level motion, applied to the model group as a fallback. */
  bodyLean: number;
  bodySway: number;
  bodyLift: number;
  bodyTwist: number;
  /** Extra arm rotation (z = raise/lower, x = swing). */
  armLeft: { z: number; x: number };
  armRight: { z: number; x: number };
  /** How engaged the avatar is (drives eye contact and posture). 0..1 */
  attention: number;
  /** Name of the current idle action, for debugging/UI. */
  activity: string;
};

/* ============================================================
   DETERMINISTIC RANDOM + SMOOTH NOISE
   ============================================================ */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Frame-rate independent exponential approach. */
function approach(current: number, target: number, rate: number, dt: number) {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

/**
 * Smooth 1D value noise. Used wherever organic motion is needed so the
 * avatar never repeats a perfect cycle (which is what reads as "robotic").
 */
class ValueNoise {
  private readonly table: number[];

  constructor(rand: () => number, size = 256) {
    this.table = new Array(size);
    for (let i = 0; i < size; i++) this.table[i] = rand() * 2 - 1;
  }

  /** @param t position in "noise units" (1 unit ~ one full cycle). */
  at(t: number): number {
    const n = this.table.length;
    const i = Math.floor(t);
    const f = t - i;
    const a = this.table[((i % n) + n) % n];
    const b = this.table[(((i + 1) % n) + n) % n];
    // Smoothstep keeps the derivative continuous (no visible kinks).
    const s = f * f * (3 - 2 * f);
    return lerp(a, b, s);
  }

  /** Two octaves: a slow drift plus a finer tremor. */
  fractal(t: number): number {
    return this.at(t) * 0.68 + this.at(t * 2.7 + 13.37) * 0.32;
  }
}

/* ============================================================
   IDLE ACTIONS
   ============================================================ */

/** Offsets produced by an idle action, blended over the base pose. */
type IdleOffsets = {
  bodyLean: number;
  bodySway: number;
  bodyLift: number;
  bodyTwist: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  armLeftZ: number;
  armRightZ: number;
  armLeftX: number;
  armRightX: number;
};

const zeroOffsets = (): IdleOffsets => ({
  bodyLean: 0,
  bodySway: 0,
  bodyLift: 0,
  bodyTwist: 0,
  headYaw: 0,
  headPitch: 0,
  headRoll: 0,
  armLeftZ: 0,
  armRightZ: 0,
  armLeftX: 0,
  armRightX: 0,
});

type IdleAction = {
  name: string;
  /** Seconds. */
  duration: number;
  /** Relative chance of being picked. */
  weight: number;
  /** @param t normalized time 0..1 */
  apply: (t: number, out: IdleOffsets) => void;
};

/** Ease in and out so actions start and end without snapping. */
const envelope = (t: number) => Math.sin(clamp(t, 0, 1) * Math.PI);

const IDLE_ACTIONS: IdleAction[] = [
  {
    name: "weight-shift",
    duration: 2.2,
    weight: 3,
    apply: (t, o) => {
      const e = envelope(t);
      o.bodySway = Math.sin(t * Math.PI) * 0.035 * e;
      o.bodyLean = Math.sin(t * Math.PI * 2) * 0.012 * e;
      o.armRightZ = -0.02 * e;
      o.armLeftZ = 0.02 * e;
    },
  },
  {
    name: "look-around",
    duration: 3.1,
    weight: 2.5,
    apply: (t, o) => {
      const e = envelope(t);
      o.headYaw = Math.sin(t * Math.PI * 2) * 0.22 * e;
      o.headPitch = Math.sin(t * Math.PI * 2 + 1) * 0.07 * e;
      o.bodyTwist = Math.sin(t * Math.PI * 2) * 0.03 * e;
    },
  },
  {
    name: "posture-adjust",
    duration: 2.6,
    weight: 2,
    apply: (t, o) => {
      const e = envelope(t);
      o.bodyLift = -0.012 * e;
      o.bodyLean = 0.02 * e;
      o.headPitch = 0.05 * e;
      o.armLeftZ = -0.05 * e;
    },
  },
  {
    name: "hand-fidget",
    duration: 2.4,
    weight: 2,
    apply: (t, o) => {
      const e = envelope(t);
      const w = Math.sin(t * Math.PI * 6);
      o.armRightZ = -0.045 * e;
      o.armRightX = 0.03 * e + w * 0.02 * e;
      o.headPitch = 0.03 * e;
    },
  },
  {
    name: "shoulder-roll",
    duration: 2.8,
    weight: 1.5,
    apply: (t, o) => {
      const e = envelope(t);
      o.armLeftZ = -0.05 * e;
      o.armRightZ = -0.05 * e;
      o.bodyLift = 0.008 * e;
      o.headRoll = Math.sin(t * Math.PI * 2) * 0.015 * e;
    },
  },
  {
    name: "chest-stretch",
    duration: 3.4,
    weight: 1,
    apply: (t, o) => {
      const e = envelope(t);
      o.armLeftZ = -0.12 * e;
      o.armRightZ = -0.12 * e;
      o.bodyLean = -0.03 * e;
      o.headPitch = -0.04 * e;
    },
  },
];

/* ============================================================
   GESTURES
   ============================================================ */

/**
 * App-requested gestures. Each is a short timed pose blended on top of the
 * life layer. Durations are deliberately human (not metronomic).
 */
const GESTURE_DURATION: Partial<Record<Gesture, number>> = {
  small_nod: 1.1,
  strong_nod: 1.3,
  head_shake: 1.4,
  greeting_wave: 2.6,
  acknowledgement: 1.2,
  explanatory_hand: 2.4,
  open_palm: 1.8,
  subtle_point: 1.5,
  shrug: 1.7,
  thinking: 2.2,
  posture_adjust: 2.0,
  dance: 7.0,
};

function applyGesture(
  gesture: Gesture,
  t: number,
  time: number,
  o: IdleOffsets,
  noise: ValueNoise
) {
  const e = envelope(t);
  switch (gesture) {
    case "small_nod":
      o.headPitch = Math.sin(t * Math.PI * 2) * 0.06 * e;
      break;
    case "strong_nod":
      o.headPitch = Math.sin(t * Math.PI * 2) * 0.14 * e;
      o.bodyLean = 0.02 * e;
      break;
    case "head_shake":
      o.headYaw = Math.sin(t * Math.PI * 4) * 0.16 * e;
      break;
    case "greeting_wave": {
      const wave = Math.sin(t * Math.PI * 7);
      o.armRightZ = -1.15 * e;
      o.armRightX = 0.35 * e + wave * 0.32 * e;
      o.headRoll = -0.05 * e;
      o.bodyTwist = -0.05 * e;
      break;
    }
    case "acknowledgement":
      o.headPitch = Math.sin(t * Math.PI * 2) * 0.07 * e;
      o.armRightZ = -0.04 * e;
      break;
    case "explanatory_hand": {
      const push = Math.sin(t * Math.PI);
      o.armRightZ = -0.42 * push;
      o.armRightX = 0.24 * push;
      o.headYaw = -0.05 * e;
      o.bodyTwist = -0.04 * push;
      break;
    }
    case "open_palm":
      o.armRightZ = -0.55 * e;
      o.armRightX = 0.45 * e;
      o.headRoll = -0.03 * e;
      break;
    case "subtle_point":
      o.armRightZ = -0.75 * e;
      o.armRightX = 0.12 * e;
      o.bodyLean = 0.015 * e;
      break;
    case "shrug":
      o.armLeftZ = -0.16 * e;
      o.armRightZ = -0.16 * e;
      o.headPitch = 0.07 * e;
      o.headRoll = Math.sin(t * Math.PI) * 0.05 * e;
      break;
    case "thinking":
      o.armRightZ = -0.62 * e;
      o.armRightX = 0.85 * e;
      o.headRoll = 0.09 * e;
      o.headPitch = -0.05 * e;
      o.bodyLean = -0.02 * e;
      break;
    case "posture_adjust":
      o.bodyLift = -0.018 * e;
      o.armLeftZ = -0.08 * e;
      o.armRightZ = -0.08 * e;
      o.headPitch = 0.06 * e;
      break;
    case "dance": {
      const d = time * 3.2;
      o.bodyLift = Math.abs(Math.sin(d)) * 0.03;
      o.bodyTwist = Math.sin(d * 0.5) * 0.16;
      o.bodyLean = Math.sin(d) * 0.03;
      o.armLeftZ = -(0.22 + Math.sin(d + 1) * 0.18);
      o.armRightZ = -(0.22 + Math.sin(d) * 0.18);
      o.armLeftX = Math.sin(d * 0.7) * 0.12;
      o.armRightX = Math.sin(d * 0.7 + 1) * 0.12;
      o.headRoll = Math.sin(d) * 0.04;
      break;
    }
    default:
      break;
  }
  // A whisper of noise keeps even deliberate gestures from looking mechanical.
  if (gesture !== "dance") {
    o.headYaw += noise.fractal(time * 1.7) * 0.01 * e;
    o.headPitch += noise.fractal(time * 1.7 + 40) * 0.008 * e;
  }
}

/* ============================================================
   AVATAR LIFE
   ============================================================ */

type GazeTarget = { yaw: number; pitch: number };

export class AvatarLife {
  private readonly rand: () => number;
  private readonly noise: ValueNoise;
  private readonly fineNoise: ValueNoise;

  private time = 0;

  // Gaze / attention
  private gazeTarget: GazeTarget = { yaw: 0, pitch: 0 };
  private gazeCurrent: GazeTarget = { yaw: 0, pitch: 0 };
  private nextSaccadeAt = 1.2;
  private attention = 0.6;
  private userFixationUntil = 0;

  // Blinking
  private blinkPhase = 0;
  private nextBlinkAt = 2;
  private blinkQueued = 0;

  // Breathing
  private breathPhase = 0;

  // Idle actions
  private currentAction: IdleAction | null = null;
  private actionStart = 0;
  private nextIdleAt = 3;

  // App-requested gesture
  private gestureStart = 0;
  private activeGesture: Gesture = "none";

  // Conversation reactions
  private nextNodAt = 3;
  private nodAmount = 0;
  private lipPhase = 0;
  private nextEmphasisAt = 4;

  constructor(seed = 20260927) {
    this.rand = mulberry32(seed);
    this.noise = new ValueNoise(this.rand);
    this.fineNoise = new ValueNoise(this.rand);
    this.nextBlinkAt = 1.5 + this.rand() * 2;
    this.nextIdleAt = 2.5 + this.rand() * 3;
  }

  /** Human-like blink interval: mostly 2-6s, occasionally a longer stare. */
  private scheduleBlink() {
    const r = this.rand();
    let interval: number;
    if (r < 0.12) interval = 6 + this.rand() * 3; // a longer "stare"
    else if (r < 0.22) interval = 0.35; // follow-up blink (double blink)
    else interval = 1.8 + this.rand() * 3.2;
    this.nextBlinkAt = this.time + interval;
  }

  private pickIdleAction(): IdleAction {
    const total = IDLE_ACTIONS.reduce((s, a) => s + a.weight, 0);
    let roll = this.rand() * total;
    for (const action of IDLE_ACTIONS) {
      roll -= action.weight;
      if (roll <= 0) return action;
    }
    return IDLE_ACTIONS[0];
  }

  /** Attention target for the current conversational state. */
  private desiredGaze(ctx: LifeContext): GazeTarget | null {
    const intent: GazeIntent =
      ctx.gazeIntent ??
      (ctx.isThinking
        ? "thinking"
        : ctx.isListening || ctx.isSpeaking
        ? "user"
        : "scanning");

    switch (intent) {
      case "user":
        return { yaw: 0, pitch: -0.02 };
      case "away":
        return { yaw: 0.28, pitch: 0.02 };
      case "thinking":
        return { yaw: -0.22, pitch: 0.16 }; // up and to the side
      case "scanning":
      default:
        return null; // keep wandering toward whatever the scheduler picked
    }
  }

  /**
   * Advance the brain and return the pose for this frame.
   * @param ctx per-frame state from the renderer
   */
  update(ctx: LifeContext): AvatarPose {
    const dt = clamp(ctx.delta, 0, 0.1);
    this.time += dt;
    const time = this.time;
    const p = ctx.personality;

    /* ---------- Engagement / attention ---------- */
    const engaged = ctx.isListening || ctx.isSpeaking ? 1 : ctx.isThinking ? 0.25 : 0.55;
    this.attention = approach(this.attention, engaged, 1.6, dt);

    /* ---------- Breathing ---------- */
    // Faster and deeper while speaking; calm and slow while thinking.
    const breathRate =
      p.breathingRate * (ctx.isSpeaking ? 1.35 : 1) * (ctx.isThinking ? 0.85 : 1);
    this.breathPhase += dt * breathRate * 1.1;
    const breath =
      Math.sin(this.breathPhase) *
      (ctx.isSpeaking ? 0.085 : 0.06) *
      (p.breathingRate > 0 ? 1 : 0);

    /* ---------- Blinking ---------- */
    if (time >= this.nextBlinkAt) {
      this.blinkPhase = 1;
      this.scheduleBlink();
      if (this.rand() < 0.12) this.blinkQueued = 2; // occasional double blink
    }
    // Asymmetric: eyes close faster than they open.
    this.blinkPhase = Math.max(0, this.blinkPhase - dt * (this.blinkPhase > 0.6 ? 11 : 6.5));
    let blink = this.blinkPhase > 0 ? Math.sin((1 - this.blinkPhase) * Math.PI) : 0;
    if (this.blinkQueued > 0 && blink < 0.05) this.blinkQueued -= 1;
    if (this.blinkQueued > 0) blink = Math.max(blink, 0.15);
    if (ctx.isThinking) blink = clamp(blink * 1.15, 0, 1); // eyes linger closed
    if (!p.blinkFrequency) blink = 0;

    /* ---------- Gaze: fixations + ballistic saccades ---------- */
    const statefulGaze = this.desiredGaze(ctx);
    if (time >= this.nextSaccadeAt) {
      if (statefulGaze) {
        this.gazeTarget = statefulGaze;
        this.userFixationUntil =
          ctx.isListening || ctx.isSpeaking ? time + 2 + this.rand() * 3 : 0;
      } else {
        // Scanning: pick a new point of interest in the room.
        this.gazeTarget = {
          yaw: this.gazeTarget.yaw + (this.rand() - 0.5) * 0.5,
          pitch: this.gazeTarget.pitch + (this.rand() - 0.5) * 0.22,
        };
        // Sometimes decide to look back at the user and hold eye contact.
        if (this.rand() < 0.35 * this.attention + 0.15) {
          this.gazeTarget = { yaw: 0, pitch: -0.02 };
          this.userFixationUntil = time + 1.5 + this.rand() * 3.5;
        }
      }
      // Cadence scales with the profile's gazeFrequency and engagement.
      const cadence = lerp(3.2, 1.1, p.gazeFrequency) / lerp(0.7, 1.6, this.attention);
      this.nextSaccadeAt = time + Math.max(0.35, cadence * (0.6 + this.rand() * 0.8));
    }
    if (time < this.userFixationUntil) this.gazeTarget = { yaw: 0, pitch: -0.02 };

    // Saccades are ballistic: very fast, then hold (with a micro-tremor).
    this.gazeCurrent.yaw = approach(this.gazeCurrent.yaw, this.gazeTarget.yaw, 22, dt);
    this.gazeCurrent.pitch = approach(this.gazeCurrent.pitch, this.gazeTarget.pitch, 22, dt);
    const gazeX = clamp(
      this.gazeCurrent.yaw + this.fineNoise.at(time * 9) * 0.004,
      -0.35,
      0.35
    );
    const gazeY = clamp(
      this.gazeCurrent.pitch + this.fineNoise.at(time * 8 + 7) * 0.003,
      -0.2,
      0.2
    );

    /* ---------- Head: follows gaze, with its own slower drift ---------- */
    const headAmount = p.headMovementAmount ?? 1;
    // The head only partially follows the eyes (as a real person does) and
    // keeps drifting slightly after the eyes settle.
    let headYaw = this.gazeCurrent.yaw * 0.35 * headAmount;
    let headPitch = this.gazeCurrent.pitch * 0.3 * headAmount;
    headYaw += this.noise.fractal(time * 0.35) * 0.05 * headAmount;
    headPitch += this.noise.fractal(time * 0.28 + 21) * 0.03 * headAmount;
    let headRoll = this.noise.fractal(time * 0.21 + 55) * 0.02 * headAmount;

    /* ---------- Conversation reactions ---------- */
    // Listening: periodic small nods, plus a slight lean in.
    if (ctx.isListening && time >= this.nextNodAt) {
      this.nodAmount = 1;
      this.nextNodAt = time + 2.2 + this.rand() * 3.4;
    }
    this.nodAmount = Math.max(0, this.nodAmount - dt * 2.2);
    const nod = Math.sin((1 - this.nodAmount) * Math.PI) * this.nodAmount;
    headPitch += nod * 0.09;
    let bodyLean = ctx.isListening ? 0.018 * this.attention : 0;

    // Thinking: head tilt and a glance up (the gaze target handles the rest).
    if (ctx.isThinking) {
      headRoll += 0.075;
      headPitch -= 0.04;
    }

    /* ---------- Lip sync ---------- */
    let mouth = 0;
    if (ctx.isSpeaking) {
      // Syllable-like envelope: noise bursts rather than a sine wave, with
      // short closed gaps between "words".
      this.lipPhase += dt * 7.5;
      const syllable = Math.abs(this.fineNoise.at(this.lipPhase));
      const phraseGate = this.fineNoise.at(time * 0.7) > -0.45 ? 1 : 0.15;
      mouth = clamp(syllable * phraseGate, 0, 1) * 0.85 + 0.1;
    }

    /* ---------- Idle action scheduler ---------- */
    const offsets = zeroOffsets();
    if (time >= this.nextIdleAt && !ctx.isSpeaking) {
      this.currentAction = this.pickIdleAction();
      this.actionStart = time;
      this.nextIdleAt =
        time +
        this.currentAction.duration +
        lerp(6, 2.5, p.gestureFrequency) * (0.5 + this.rand());
    }
    if (this.currentAction) {
      const t = (time - this.actionStart) / this.currentAction.duration;
      if (t >= 1) this.currentAction = null;
      else this.currentAction.apply(t, offsets);
    }
    const activity = this.currentAction?.name ?? "rest";

    /* ---------- App-requested gesture ---------- */
    if (ctx.gesture !== "none" && ctx.gesture !== this.activeGesture) {
      this.activeGesture = ctx.gesture;
      this.gestureStart = time;
    } else if (ctx.gesture === "none" && this.activeGesture !== "none") {
      this.activeGesture = "none";
    }
    if (this.activeGesture !== "none") {
      const dur = GESTURE_DURATION[this.activeGesture] ?? 1.5;
      const t = (time - this.gestureStart) / dur;
      if (t >= 1) this.activeGesture = "none";
      else applyGesture(this.activeGesture, t, time, offsets, this.fineNoise);
    }

    /* ---------- Idle drift (always present, never a visible loop) ---------- */
    const drift = this.noise.fractal(time * 0.6 + 90);
    const bodySway = drift * 0.02 + offsets.bodySway;
    const bodyLift = Math.sin(this.breathPhase * 2) * 0.006 + offsets.bodyLift;
    const bodyTwist = drift * 0.02 + offsets.bodyTwist;
    bodyLean += offsets.bodyLean;
    headYaw += offsets.headYaw;
    headPitch += offsets.headPitch;
    headRoll += offsets.headRoll;

    /* ---------- Speaking emphasis rhythm ---------- */
    let armLeftZ = offsets.armLeftZ;
    let armRightZ = offsets.armRightZ;
    let armLeftX = offsets.armLeftX;
    let armRightX = offsets.armRightX;
    if (ctx.isSpeaking) {
      // Emphasise a phrase every few seconds with a small hand gesture.
      if (time >= this.nextEmphasisAt) this.nextEmphasisAt = time + 2.5 + this.rand() * 3.5;
      const since = time - (this.nextEmphasisAt - 3.5);
      const emphasis = clamp(since, 0, 1.5) * (1 - this.attention * 0.35);
      armRightZ -= emphasis * 0.12;
      armLeftZ -= emphasis * 0.05;
      armRightX += this.fineNoise.fractal(time * 1.1) * 0.03;
    }

    return {
      headYaw,
      headPitch,
      headRoll,
      gazeX,
      gazeY,
      blink,
      mouth,
      breath,
      bodyLean,
      bodySway,
      bodyLift,
      bodyTwist,
      armLeft: { z: armLeftZ, x: armLeftX },
      armRight: { z: armRightZ, x: armRightX },
      attention: this.attention,
      activity,
    };
  }
}
