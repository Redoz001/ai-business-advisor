// src/reucore/movie/CharacterStage.ts
// Renders REAL animated characters into the film.
//
// Why this exists: the upstream image provider only produces stills, so
// "video" built purely from keyframes is a slideshow no matter how clever the
// camera work is. But this app already owns rigged, textured characters with
// skeletons and ARKit face blendshapes. Driving those with the existing
// (unit-tested) AvatarLife brain produces genuine continuous motion — real bone
// animation, blinks, saccades and viseme lip-sync — at zero API cost, in the
// browser, at whatever resolution we record.
//
// The stage renders offscreen with an alpha background and is composited over
// the painted keyframe, so the character sits inside the AI-generated scene.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { AvatarLife, type AvatarPose } from "../../features/avatar/AvatarLife";
import { getAvatarProfile } from "../../features/avatar/catalog";
import type { MovieCamera } from "./types";

/** Realistic characters, mapped by the gender the screenplay calls for. */
const MODEL_URLS: Record<string, string> = {
  male: "/models/realistic-male.glb",
  female: "/models/realistic-female.glb",
};

const VISEMES = [
  "viseme_aa",
  "viseme_E",
  "viseme_I",
  "viseme_O",
  "viseme_U",
  "viseme_FF",
  "viseme_TH",
  "viseme_kk",
  "viseme_SS",
  "viseme_nn",
  "viseme_RR",
  "viseme_PP",
];

export type CharacterGender = "male" | "female";

export type StageFrameOptions = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  camera: MovieCamera;
  gender: CharacterGender;
  /** True while the caption is being spoken (drives lip-sync). */
  speaking: boolean;
  /** Delta in seconds since the previous rendered frame. */
  delta: number;
  /** Horizontal framing, -1 (left) .. 1 (right). */
  offsetX?: number;
};

type LoadedRig = {
  root: THREE.Group;
  bones: Map<string, THREE.Bone>;
  morphs: Map<string, { mesh: THREE.Mesh; index: number }>;
  restRotation: Map<string, THREE.Euler>;
  eyeGroup: THREE.Group | null;
};

/**
 * Normalizes a humanoid GLB to 1.7m tall with feet at y=0 (mirrors the
 * normalization used by the live Avatar3D view so both look identical).
 */
function normalizeHumanoidModel(model: THREE.Group): void {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = size.y > 0 ? 1.7 / size.y : 1;
  model.scale.setScalar(scale);
  const afterScale = new THREE.Box3().setFromObject(model);
  model.position.y = -afterScale.min.y;
}

export class CharacterStage {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private rigs = new Map<CharacterGender, LoadedRig>();
  private loading = new Map<CharacterGender, Promise<LoadedRig | null>>();
  private life = new AvatarLife(20260927);
  private clock = 0;
  /** False when WebGL is unavailable; callers then fall back to keyframes. */
  readonly available: boolean;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 2.39, 0.05, 60);
    try {
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      this.renderer.setPixelRatio(1);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.available = true;
    } catch {
      this.renderer = null;
      this.available = false;
    }
    if (this.renderer) this.buildLights();
  }

  /**
   * Three-point cinematic rig. The characters are lit for a studio HDRI, so a
   * soft key + cool fill + warm rim keeps them readable against painted
   * backgrounds instead of looking like a cut-out pasted on top.
   */
  private buildLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    this.scene.add(new THREE.HemisphereLight(0x9fb4d8, 0x2a2018, 0.6));

    const key = new THREE.DirectionalLight(0xfff2e0, 2.1);
    key.position.set(2.2, 3.0, 2.4);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x9fc0ff, 0.7);
    fill.position.set(-3.0, 1.4, 1.6);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffd9a8, 1.6);
    rim.position.set(-1.2, 2.4, -3.0);
    this.scene.add(rim);
  }

  /** Loads (and caches) a character. Safe to call repeatedly. */
  async load(gender: CharacterGender): Promise<LoadedRig | null> {
    if (!this.renderer) return null;
    const existing = this.rigs.get(gender);
    if (existing) return existing;
    const inFlight = this.loading.get(gender);
    if (inFlight) return inFlight;

    const url = MODEL_URLS[gender];
    if (!url) return null;

    const job = (async (): Promise<LoadedRig | null> => {
      try {
        const loader = new GLTFLoader();
        // The realistic GLBs are EXT_meshopt_compression compressed; without
        // this decoder GLTFLoader refuses to parse them.
        loader.setMeshoptDecoder(MeshoptDecoder);

        const gltf = await loader.loadAsync(url);
        const root = gltf.scene;
        normalizeHumanoidModel(root);

        const bones = new Map<string, THREE.Bone>();
        const restRotation = new Map<string, THREE.Euler>();
        const morphs = new Map<string, { mesh: THREE.Mesh; index: number }>();
        let eyeGroup: THREE.Group | null = null;
        const eyeCandidates: THREE.Object3D[] = [];

        root.traverse((node) => {
          if (node instanceof THREE.Bone) {
            const bone = node;
            const key = bone.name.toLowerCase();
            bones.set(key, bone);
            restRotation.set(key, bone.rotation.clone());
          }

          const mesh = node as THREE.Mesh;
          const dict = mesh.morphTargetDictionary;
          if (dict) {
            for (const name of Object.keys(dict)) {
              const index = dict[name];
              if (typeof index === "number") {
                morphs.set(name.toLowerCase(), { mesh, index });
              }
            }
          }

          const n = node.name.toLowerCase();
          if (n.includes("eye") && n.includes("ball")) eyeCandidates.push(node);
          if (n === "eyes" || n === "eye_group" || n === "eyeballs") {
            eyeGroup = node as THREE.Group;
          }
        });

        if (!eyeGroup && eyeCandidates.length > 0) {
          const group = new THREE.Group();
          group.name = "eyes";
          eyeCandidates[0].parent?.add(group);
          for (const eye of eyeCandidates) group.attach(eye);
          eyeGroup = group;
        }

        root.visible = false;
        this.scene.add(root);

        const rig: LoadedRig = { root, bones, morphs, restRotation, eyeGroup };
        this.rigs.set(gender, rig);
        return rig;
      } catch (error) {
        console.error(`[CharacterStage] Failed to load ${gender} avatar`, error);
        return null;
      } finally {
        this.loading.delete(gender);
      }
    })();

    this.loading.set(gender, job);
    return job;
  }

  /** Loads every character up front so rendering never stalls mid-shot. */
  async preload(genders: CharacterGender[]): Promise<void> {
    await Promise.all(genders.map((g) => this.load(g)));
  }

  private setMorph(rig: LoadedRig, name: string, value: number): void {
    const target = rig.morphs.get(name.toLowerCase());
    if (!target || !target.mesh.morphTargetInfluences) return;
    const amount = THREE.MathUtils.clamp(value, 0, 1);
    target.mesh.morphTargetInfluences[target.index] = amount;
  }

  /** Applies an AvatarPose to the rig. Mirrors the live Avatar3D bindings. */
  private applyPose(rig: LoadedRig, pose: AvatarPose, speaking: boolean): void {
    const rest = (bone: THREE.Bone) =>
      rig.restRotation.get(bone.name.toLowerCase());
    const get = (...names: string[]) => {
      for (const n of names) {
        const b = rig.bones.get(n);
        if (b) return b;
      }
      return undefined;
    };
    const bodySway = THREE.MathUtils.clamp(pose.bodySway, -0.4, 0.4);
    const bodyTwist = THREE.MathUtils.clamp(pose.bodyTwist, -0.6, 0.6);

    // Body: keep the torso grounded and stable while still allowing subtle,
    // believable movement. The waist should not wobble like a loose spring.
    rig.root.position.x = bodySway * 0.65;
    rig.root.position.y = pose.bodyLift;
    rig.root.position.z = pose.bodyLean * 0.65;
    rig.root.rotation.y = THREE.MathUtils.lerp(
      rig.root.rotation.y,
      bodyTwist * 0.55,
      0.14
    );
    rig.root.rotation.z = THREE.MathUtils.lerp(
      rig.root.rotation.z,
      bodySway * 0.14,
      0.18
    );

    // Spine + hips
    const spine = get("spine", "mixamorigspine", "spine_01", "chest");
    if (spine) {
      const r = rest(spine);
      if (r) {
        spine.rotation.x = r.x + pose.breath * 0.45;
        spine.rotation.z = r.z + bodySway * 0.18;
      }
      spine.position.y = THREE.MathUtils.lerp(
        spine.position.y,
        pose.breath * 0.2,
        0.18
      );
    }
    const hips = get("hips", "mixamorighips", "pelvis");
    if (hips) {
      const r = rest(hips);
      if (r) {
        hips.rotation.y = r.y + bodyTwist * 0.35;
        hips.rotation.z = r.z + bodySway * 0.2;
      }
    }

    // Arms
    const armL = get("leftarm", "mixamorigleftarm", "shoulder_l", "arm_l");
    const armR = get("rightarm", "mixamorigrightarm", "shoulder_r", "arm_r");
    if (armL) {
      armL.rotation.z = pose.armLeft.z;
      armL.rotation.x = pose.armLeft.x;
    }
    if (armR) {
      armR.rotation.z = pose.armRight.z;
      armR.rotation.x = pose.armRight.x;
    }

    // Neck + head
    const neck = get("neck", "mixamorigneck");
    if (neck) neck.rotation.y = pose.headYaw * 0.35;
    const head = get("head", "mixamorighead");
    if (head) {
      head.rotation.y = pose.headYaw * 0.65;
      head.rotation.x = pose.headPitch;
      head.rotation.z = pose.headRoll;
    }

    // Eyes
    const eyeL = get("eye_l", "left_eye", "eye_left");
    const eyeR = get("eye_r", "right_eye", "eye_right");
    if (eyeL) {
      eyeL.rotation.y = pose.gazeX;
      eyeL.rotation.x = pose.gazeY;
    }
    if (eyeR) {
      eyeR.rotation.y = pose.gazeX;
      eyeR.rotation.x = pose.gazeY;
    }
    if (!eyeL && !eyeR && rig.eyeGroup) {
      rig.eyeGroup.rotation.y = pose.gazeX * 0.55;
      rig.eyeGroup.rotation.x = pose.gazeY * 0.45;
    }

    // Blinking: prefer real ARKit eyelids, fall back to lids, then to eyes.
    const arkFace = rig.morphs.has("eyeblinkleft");
    if (arkFace) {
      this.setMorph(rig, "eyeBlinkLeft", pose.blink);
      this.setMorph(rig, "eyeBlinkRight", pose.blink);
    } else {
      const lidL = get("eyelid_l", "eye_lid_l", "lid_l");
      const lidR = get("eyelid_r", "eye_lid_r", "lid_r");
      if (lidL) lidL.rotation.x = -pose.blink * 0.5;
      if (lidR) lidR.rotation.x = -pose.blink * 0.5;
      else if (rig.eyeGroup) rig.eyeGroup.scale.y = 1 - pose.blink * 0.9;
    }

    // Brows react to attention — stops the face reading as a mannequin.
    const raise = Math.min(1, 0.1 + pose.attention * 0.22);
    this.setMorph(rig, "browInnerUp", raise);
    this.setMorph(rig, "browOuterUpLeft", pose.attention * 0.14);
    this.setMorph(rig, "browOuterUpRight", pose.attention * 0.14);

    // Viseme lip-sync
    for (const v of VISEMES) this.setMorph(rig, v, 0);
    this.setMorph(rig, "jawOpen", 0);
    if (speaking && pose.mouth > 0.02) {
      const idx = Math.floor(this.clock * 11) % VISEMES.length;
      const active = VISEMES[idx];
      const prev = VISEMES[(idx + VISEMES.length - 1) % VISEMES.length];
      this.setMorph(rig, active, pose.mouth);
      if (prev !== active) this.setMorph(rig, prev, pose.mouth * 0.3);
      this.setMorph(rig, "jawOpen", pose.mouth * 0.45);
    } else {
      this.setMorph(rig, "mouthSmile", 0.1 + pose.attention * 0.12);
    }
  }

  /** Camera framing per shot size, plus a little handheld drift. */
  private frameCamera(
    shotCamera: MovieCamera,
    time: number,
    offsetX: number
  ): void {
    const setups: Record<MovieCamera, { dist: number; y: number }> = {
      WIDE: { dist: 3.6, y: 1.0 },
      AERIAL: { dist: 5.5, y: 3.2 },
      MEDIUM: { dist: 2.0, y: 1.15 },
      "CLOSE-UP": { dist: 1.15, y: 1.5 },
      "EXTREME-CLOSE-UP": { dist: 0.62, y: 1.62 },
      "OVER-THE-SHOULDER": { dist: 1.7, y: 1.4 },
    };
    const setup = setups[shotCamera] ?? setups.MEDIUM;

    // Subtle handheld sway so even a locked-off shot feels operated.
    const driftX = Math.sin(time * 0.7) * 0.035 + Math.sin(time * 1.9) * 0.012;
    const driftY = Math.cos(time * 0.53) * 0.028;

    this.camera.position.set(
      offsetX * 0.45 + driftX,
      setup.y + driftY,
      setup.dist
    );
    this.camera.lookAt(offsetX * 0.3, setup.y - 0.06, 0);
  }

  /**
   * Renders one frame of a character and composites it onto `ctx`.
   * Returns false if the character could not be drawn, so the caller can fall
   * back to the keyframe-only path.
   */
  drawFrame(opts: StageFrameOptions): boolean {
    const renderer = this.renderer;
    const rig = this.rigs.get(opts.gender);
    if (!renderer || !rig) return false;

    // Show only the requested character.
    for (const [gender, other] of this.rigs) {
      other.root.visible = gender === opts.gender;
    }

    this.clock += opts.delta;

    // Drive the same brain the live avatar uses, in "speaking" mode.
    const profile =
      getAvatarProfile(opts.gender === "male" ? "male-human-1" : "female-human-1")
        ?.animationProfile ?? {
        breathingRate: 1,
        blinkFrequency: 3.2,
        gazeFrequency: 0.3,
        gestureFrequency: 0.3,
      };
    const pose = this.life.update({
      delta: opts.delta,
      isSpeaking: opts.speaking,
      isListening: false,
      isThinking: false,
      gesture: "none",
      personality: { ...profile },
    });

    this.applyPose(rig, pose, opts.speaking);

    const { ctx, width, height } = opts;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.frameCamera(opts.camera, this.clock, opts.offsetX ?? 0);

    if (renderer.domElement.width !== width) {
      renderer.setSize(width, height, false);
    }
    renderer.render(this.scene, this.camera);

    // Composite immediately after render so the drawing buffer is still valid.
    ctx.drawImage(renderer.domElement, 0, 0, width, height);
    return true;
  }

  dispose(): void {
    for (const rig of this.rigs.values()) {
      this.scene.remove(rig.root);
      rig.root.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
    }
    this.rigs.clear();
    this.renderer?.dispose();
    this.renderer = null;
  }
}