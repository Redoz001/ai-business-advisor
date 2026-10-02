import React, { useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type {
  AvatarProfile,
  AvatarState,
  EmotionState,
  Gesture,
} from "./types";
import { AvatarLife } from "./AvatarLife";

/** Stable per-avatar seed so each character gets its own motion signature. */
function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Real humanoid GLB assets stored locally in the app bundle.
// - realistic-male.glb / realistic-female.glb: photoreal-skinned humans with
//   embedded PBR skin/hair/outfit textures, real eyeball meshes, eye bones,
//   and a full ARKit face rig (60 blendshapes: eyelids, brows, jaw, 15
//   visemes) — these are the characters the studio actually shows.
// - Xbot.glb / Michelle.glb: older Mixamo samples kept as fallbacks.
const MODEL_URLS: Record<string, string> = {
  // Human avatars use the photoreal rigged characters.
  "male-human-1": "/models/realistic-male.glb",
  "female-human-1": "/models/realistic-female.glb",
  "futuristic-1": "/models/realistic-female.glb",
  "robotic-1": "/models/realistic-male.glb",
};

type Avatar3DProps = {
  profile: AvatarProfile;
  isMicActive: boolean;
  isSpeaking?: boolean;
  isThinking?: boolean;
  gesture?: Gesture;
  onAvatarClick?: () => void;
  onAvatarLoad?: () => void;
  onAvatarError?: (error: Error) => void;
  onStateChange?: (state: AvatarState) => void;
  onEmotionChange?: (emotion: EmotionState) => void;
  onGestureChange?: (gesture: Gesture) => void;
};

// Camera framing modes
type CameraMode = "FULL_BODY" | "PORTRAIT";

// Model lifecycle status - only transitions on actual avatar change
type ModelStatus = "idle" | "loading" | "ready" | "error";

// Fit the camera to the avatar model based on the desired framing mode.
// Accounts for portrait orientation (tall/narrow viewport).
// The model is normalized to a 1.7m standing humanoid, so the bounding box
// drives a responsive distance that keeps the COMPLETE body (head to feet)
// visible with symmetric padding, on any screen size.
function fitCameraToAvatar(
  model: THREE.Group,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  mode: CameraMode,
  aspect: number
) {
  // Compute model axis-aligned bounding box in world space
  const box = new THREE.Box3().setFromObject(model);
  const dimensions = new THREE.Vector3();
  box.getSize(dimensions);
  const center = new THREE.Vector3();
  box.getCenter(center);

  // Pick the FOV for this framing mode first, so the distance math uses it.
  camera.fov = mode === "FULL_BODY" ? 45 : 33;
  camera.updateProjectionMatrix();

  const fovRad = (camera.fov * Math.PI) / 180;
  // Horizontal FOV depends on aspect ratio (portrait = narrow horizontal FOV)
  const horizontalFovRad = 2 * Math.atan(Math.tan(fovRad / 2) * aspect);

  // Fraction of the viewport the model should occupy (~80% => 10% padding
  // above the head and below the feet, within the requested 8-12% range).
  const fitFraction = 0.80;

  let distance: number;
  let targetY: number;

  if (mode === "FULL_BODY") {
    // Must fit head-to-toe vertically AND horizontally, on a portrait viewport.
    const verticalExtent = dimensions.y; // head to feet
    const horizontalExtent = dimensions.x; // width across shoulders/hips

    // Distance so the vertical extent occupies fitFraction of the vertical FOV.
    const distanceForVertical =
      verticalExtent / (2 * Math.tan(fovRad / 2) * fitFraction);
    // Distance so the horizontal extent occupies fitFraction of the horizontal
    // FOV (narrower on portrait, so this usually wins and keeps arms/hands visible).
    const distanceForHorizontal =
      horizontalExtent / (2 * Math.tan(horizontalFovRad / 2) * fitFraction);
    // Use the larger distance to satisfy BOTH constraints with symmetric padding.
    distance = Math.max(distanceForVertical, distanceForHorizontal);
    // Small safety buffer so the head/hair and feet never touch the viewport
    // edges even if the idle animation shifts the pose slightly.
    distance *= 1.05;
    // Target the model's vertical center so head and feet get equal padding.
    targetY = center.y;
  } else {
    // PORTRAIT mode - chest up, face readable
    const modelHeight = dimensions.y;
    const portraitFactor = 1.3;
    distance = (modelHeight * portraitFactor) / (2 * Math.tan(fovRad / 2));
    // Slightly above center (chin level)
    targetY = center.y + 0.1;
  }

  // Place the camera directly in front of the model's center at the fitted
  // distance. No vertical offset -> head/feet are framed symmetrically.
  controls.target.set(center.x, targetY, center.z);
  camera.position.set(center.x, targetY, center.z + distance);

  // Debug: confirm the Box3-driven responsive framing values on each fit.
  console.log(
    `[Avatar3D] Camera fit: mode=${mode} distance=${distance.toFixed(2)}m ` +
    `modelH=${dimensions.y.toFixed(2)}m modelW=${dimensions.x.toFixed(2)}m ` +
    `aspect=${aspect.toFixed(2)}`
  );

  // Constrain orbit/zoom relative to the fitted distance so rotation and
  // zoom stay sensible for the full-body framing on any screen size.
  if (mode === "FULL_BODY") {
    controls.minDistance = distance * 0.55;
    controls.maxDistance = distance * 4.0;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI * 0.55; // allow orbiting around the body
    controls.minPolarAngle = Math.PI * 0.12;
  } else {
    controls.minDistance = 1.0;
    controls.maxDistance = 1.7;
    controls.enablePan = false;
    controls.maxPolarAngle = 1.5;
    controls.minPolarAngle = 0.4;
  }
  controls.update();
}

// Normalize a loaded humanoid GLB model
function normalizeHumanoidModel(model: THREE.Group) {
  // 1. Compute axis-aligned bounding box in model's local space
  const box = new THREE.Box3().setFromObject(model);
  const dimensions = new THREE.Vector3();
  box.getSize(dimensions);

  // 2. Compute scale factor to make the model 1.7m tall (average human height)
  const rawHeight = dimensions.y; // y-extent when model stands upright
  const scale = rawHeight > 0 ? 1.7 / rawHeight : 1;

  // 3. Apply uniform scale about the model's center (prevents drift)
  const center = new THREE.Vector3();
  box.getCenter(center);
  model.scale.set(scale, scale, scale);

  // 4. Center the feet on y = 0 after scaling
  const boxAfterScale = new THREE.Box3().setFromObject(model);
  const minY = boxAfterScale.min.y;
  model.position.y = -minY;

  // 5. Ensure the model faces +Z (glTF default: faces toward viewer)
  // No rotation needed; glTF models face +Z by default toward the viewer

  // 6. Recompute bounding box after all transforms
  const finalBox = new THREE.Box3().setFromObject(model);
  const finalCenter = new THREE.Vector3();
  finalBox.getCenter(finalCenter);

  // Return normalization data for camera fitting
  return {
    scale,
    center: finalCenter,
    height: dimensions.y * scale,
  };
}

/**
 * Builds a believable skin texture procedurally: a soft tonal gradient plus
 * mottling and fine grain, so a model shipped WITHOUT any texture (like
 * Xbot.glb, which has zero images) no longer reads as flat coloured plastic.
 */
function createProceduralSkinTexture(baseHex: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const base = new THREE.Color(baseHex);
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, base.clone().offsetHSL(0, 0.02, 0.05).getStyle());
  grad.addColorStop(0.5, base.getStyle());
  grad.addColorStop(1, base.clone().offsetHSL(0, -0.02, -0.05).getStyle());
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Mottled tone variation keeps large flat areas from looking painted.
  for (let i = 0; i < 1200; i++) {
    const c = base
      .clone()
      .offsetHSL(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.08
      );
    ctx.fillStyle = `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},0.05)`;
    ctx.beginPath();
    ctx.arc(
      Math.random() * size,
      Math.random() * size,
      6 + Math.random() * 40,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // Fine grain stands in for pores / skin texture.
  const image = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    image.data[i] = Math.max(0, Math.min(255, image.data[i] + n));
    image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1] + n));
    image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2] + n));
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Turns authored CG materials into believable ones. Both shipped models use
 * `metallic: 0.5`, which is what makes skin look like grey plastic; skin and
 * cloth are dielectric, so the metal is removed and roughness is rebalanced.
 * Authored colour/normal/roughness MAPS are always preserved.
 */
function applyRealisticMaterials(model: THREE.Group): void {
  const skinCache = new Map<number, THREE.CanvasTexture>();

  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    for (const mat of materials) {
      const std = mat as THREE.MeshStandardMaterial;
      if (!std || typeof std.roughness !== "number") continue;

      std.metalness = Math.min(std.metalness ?? 0, 0.06);
      std.roughness = Math.min(Math.max(std.roughness ?? 0.6, 0.45), 0.82);
      std.envMapIntensity = 0.8;
      if (std.normalScale) std.normalScale.set(0.7, 0.7);

      // A model with no colour map gets a generated skin texture instead.
      if (!std.map) {
        const key = std.color?.getHex() ?? 0xffffff;
        let skin = skinCache.get(key);
        if (!skin) {
          skin = createProceduralSkinTexture(key);
          skinCache.set(key, skin);
        }
        std.map = skin;
        std.color = new THREE.Color(0xffffff);
        std.needsUpdate = true;
      }
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

/**
 * Adds eyes (and a hair cap) that read as a face. The shipped models have no
 * eyeball geometry, so they are built at real human proportions and PARENTED
 * TO THE HEAD BONE, so they follow every head movement instead of floating in
 * world space. Returns the eye group so the render loop can drive gaze/blink.
 */
function addFacialDetails(
  model: THREE.Group,
  profile: AvatarProfile
): THREE.Group | null {
  const head =
    model.getObjectByName("mixamorig:Head") ??
    model.getObjectByName("Head") ??
    model.getObjectByName("head");
  if (!head) return null;

  const headPosition = new THREE.Vector3();
  head.getWorldPosition(headPosition);

  const details = new THREE.Group();
  details.name = "avatar-facial-details";
  head.add(details);
  details.updateWorldMatrix(true, false);

  // World-space anchors converted into the head bone's local space.
  const toLocal = (x: number, y: number, z: number) =>
    details.worldToLocal(new THREE.Vector3(x, y, z));

  // Realistic rigs already ship eyeballs (exposed as LeftEye/RightEye bones)
  // and their own hair mesh. Adding ours on top would produce double eyes and
  // a bald cap over real hair, so detect those cases and skip.
  const hasEyeBones =
    !!model.getObjectByName("LeftEye") || !!model.getObjectByName("RightEye");
  let hasHair = false;
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if ((mesh.name ?? "").toLowerCase().includes("hair")) {
      hasHair = true;
      return;
    }
    if (mats.some((m) => (m?.name ?? "").toLowerCase().includes("hair"))) {
      hasHair = true;
    }
  });

  let eyes: THREE.Group | null = null;

  if (!hasEyeBones) {
    const scleraMat = new THREE.MeshPhysicalMaterial({
      color: 0xf1ebe2,
      roughness: 0.3,
      metalness: 0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.1,
    });
    const irisMat = new THREE.MeshPhysicalMaterial({
      color: profile.eyeColor,
      roughness: 0.2,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.4,
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0b0b0d });

    // Real human proportions: ~12.5mm eyeball radius, ~63mm interpupillary.
    const scleraGeo = new THREE.SphereGeometry(0.0125, 24, 16);
    const irisGeo = new THREE.SphereGeometry(0.0062, 20, 14);
    const pupilGeo = new THREE.SphereGeometry(0.0026, 16, 12);

    eyes = new THREE.Group();
    eyes.name = "avatar-eyes";
    details.add(eyes);

    for (const side of [-1, 1]) {
      const socket = toLocal(
        headPosition.x + side * 0.0315,
        headPosition.y + 0.012,
        headPosition.z + 0.097
      );

      const eye = new THREE.Mesh(scleraGeo, scleraMat);
      eye.position.copy(socket);
      eyes.add(eye);

      // Iris/pupil are flattened lenses sitting on the eyeball surface.
      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.scale.set(1, 1, 0.4);
      iris.position.copy(socket).add(new THREE.Vector3(0, 0, 0.0113));
      eyes.add(iris);

      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.scale.set(1, 1, 0.4);
      pupil.position.copy(socket).add(new THREE.Vector3(0, 0, 0.0126));
      eyes.add(pupil);
    }
  }

  if (!hasHair) {
    const hairMat = new THREE.MeshStandardMaterial({
      color: profile.hairColor,
      roughness: 0.72,
      metalness: 0,
      envMapIntensity: 0.7,
    });

    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), hairMat);
    hairCap.scale.set(0.17, 0.16, 0.15);
    hairCap.position.copy(
      toLocal(headPosition.x, headPosition.y + 0.07, headPosition.z - 0.015)
    );
    details.add(hairCap);

    if (profile.hairStyle === "long") {
      const hairBack = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), hairMat);
      hairBack.scale.set(0.19, 0.25, 0.13);
      hairBack.position.copy(
        toLocal(headPosition.x, headPosition.y - 0.05, headPosition.z - 0.07)
      );
      details.add(hairBack);
    }
  }

  return eyes;
}

export default function Avatar3D({
  profile,
  isMicActive,
  isSpeaking = false,
  isThinking = false,
  gesture = "none",
  onAvatarClick,
  onAvatarLoad,
  onAvatarError,
  onStateChange,
  onEmotionChange,
  onGestureChange,
}: Avatar3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const animIdRef = useRef<number>(0);
  const bonesRef = useRef<Map<string, THREE.Bone>>(new Map());
  const boneRestRotationRef = useRef<Map<string, THREE.Euler>>(new Map());
  const facialDetailsRef = useRef<THREE.Group | null>(null);
  // Eyeballs built for models that ship without any (they follow the head bone).
  const eyeGroupRef = useRef<THREE.Group | null>(null);
  const morphRef = useRef<Map<string, number>>(new Map());
  const loadedProfileIdRef = useRef<string | null>(null);
  const hasActiveAnimationRef = useRef(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("FULL_BODY");
  // Ref mirror of cameraMode so the mount-once resize/refit handler always
  // reads the current framing mode without re-running the effect.
  const cameraModeRef = useRef<CameraMode>("FULL_BODY");
  const speakingRef = useRef(isSpeaking);
  const thinkingRef = useRef(isThinking);
  const gestureRef = useRef(gesture);
  speakingRef.current = isSpeaking;
  thinkingRef.current = isThinking;
  gestureRef.current = gesture;
  // Life brain + personality from the avatar profile. A fresh brain per
  // avatar gives each character its own motion signature and restarts the
  // idle timeline when the user switches characters.
  const isMicRef = useRef(isMicActive);
  const personalityRef = useRef(profile.animationProfile);
  const lifeRef = useRef<AvatarLife>(new AvatarLife(20260927));
  isMicRef.current = isMicActive;
  personalityRef.current = profile.animationProfile;

  // Apply morph targets by name across all meshes
  const applyMorphTarget = useCallback((name: string, value: number) => {
    if (!modelRef.current) return;
    // Realistic models use ARKit-style camelCase names (eyeBlinkLeft), while
    // others use lowercase (jawopen), so match case-insensitively.
    const wanted = name.toLowerCase();
    const amount = THREE.MathUtils.clamp(value, 0, 1);
    modelRef.current.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        let idx = mesh.morphTargetDictionary[name];
        if (idx === undefined) idx = mesh.morphTargetDictionary[wanted];
        if (idx === undefined) {
          for (const key of Object.keys(mesh.morphTargetDictionary)) {
            if (key.toLowerCase() === wanted) {
              idx = mesh.morphTargetDictionary[key];
              break;
            }
          }
        }
        if (idx !== undefined) {
          mesh.morphTargetInfluences[idx] = amount;
        }
      }
    });
  }, []);

  // ============================================================
  // SCENE SETUP - runs ONCE when component mounts.
  // Creates renderer, camera, controls, lighting, ground.
  // NEVER re-runs on state changes (speaking, thinking, mic, etc).
  // ============================================================
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x15182d);

    // Camera - start with portrait mode
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 100);
    camera.position.set(0, 1.28, 1.35);
    camera.lookAt(0, 1.05, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ===== PORTRAIT STUDIO LIGHTING =====
    // Key light - warm, soft, from camera-right
    const keyLight = new THREE.DirectionalLight(0xffeedd, 2.0);
    keyLight.position.set(1.5, 2.0, 2.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 512;
    keyLight.shadow.mapSize.height = 512;
    scene.add(keyLight);

    // Fill light - cooler, softer, from camera-left
    const fillLight = new THREE.DirectionalLight(0xddddff, 1.0);
    fillLight.position.set(-1.5, 0.5, 1.5);
    scene.add(fillLight);

    // Rim light - from behind
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
    rimLight.position.set(0, 1.5, -2.0);
    scene.add(rimLight);

    // Ambient fill
    const ambient = new THREE.AmbientLight(0x68739c, 0.85);
    scene.add(ambient);

    // Hemisphere for sky/ground color
    const hemi = new THREE.HemisphereLight(0xb8c8ff, 0x667080, 0.65);
    scene.add(hemi);

    const faceLight = new THREE.PointLight(0xfff4e8, 0.7, 4.5);
    faceLight.position.set(0, 1.65, 1.8);
    scene.add(faceLight);

    // Ground shadow disc
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.0, 32),
      new THREE.ShadowMaterial({ opacity: 0.25, color: 0x000000 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // ===== REALISM: image-based studio environment =====
    // A small procedural room (soft key panel, cool bounce, warm rim) is
    // pre-filtered into an environment map, so PBR materials pick up soft
    // reflections and ambient falloff instead of looking flat and CG.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x0a0c18);
    const addPanel = (
      color: number,
      intensity: number,
      pos: [number, number, number],
      size: [number, number]
    ) => {
      const material = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
      });
      material.color.multiplyScalar(intensity);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(size[0], size[1]),
        material
      );
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.lookAt(0, 1.1, 0);
      envScene.add(mesh);
    };
    addPanel(0xfff1dd, 3.2, [1.6, 2.4, 2.2], [3, 3]); // key softbox
    addPanel(0x8fa6ff, 1.1, [-2.2, 1.2, 1.2], [3, 3]); // cool bounce
    addPanel(0xffffff, 1.6, [0, 1.8, -2.6], [2.5, 2.5]); // rim
    const envRT = pmrem.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();
    envScene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });

    // Soft, high-quality shadows read as studio light, not hard CG edges.
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.radius = 4;
    keyLight.shadow.blurSamples = 16;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 7;
    keyLight.shadow.camera.left = -1.6;
    keyLight.shadow.camera.right = 1.6;
    keyLight.shadow.camera.top = 2.2;
    keyLight.shadow.camera.bottom = -0.4;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.camera.updateProjectionMatrix();
    renderer.toneMappingExposure = 1.15;

    // Contact shadow: a radial gradient darkens the floor right under the
    // feet, which is what visually "grounds" a character.
    const contactCanvas = document.createElement("canvas");
    contactCanvas.width = 128;
    contactCanvas.height = 128;
    const contact2d = contactCanvas.getContext("2d");
    if (contact2d) {
      const grad = contact2d.createRadialGradient(64, 64, 4, 64, 64, 62);
      grad.addColorStop(0, "rgba(0,0,0,0.55)");
      grad.addColorStop(0.55, "rgba(0,0,0,0.22)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      contact2d.fillStyle = grad;
      contact2d.fillRect(0, 0, 128, 128);
      const contactTex = new THREE.CanvasTexture(contactCanvas);
      contactTex.colorSpace = THREE.SRGBColorSpace;
      const contact = new THREE.Mesh(
        new THREE.PlaneGeometry(0.85, 0.85),
        new THREE.MeshBasicMaterial({
          map: contactTex,
          transparent: true,
          depthWrite: false,
          opacity: 0.9,
        })
      );
      contact.rotation.x = -Math.PI / 2;
      contact.position.y = 0.002;
      contact.renderOrder = -1;
      scene.add(contact);
    }

    // Controls (constrained orbit) - start portrait mode
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.0;
    controls.maxDistance = 1.7;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI / 2.0;
    controls.minPolarAngle = 0.05;
    controls.update();
    controlsRef.current = controls;

    // ============================================================
    // ANIMATION LOOP - runs continuously, reads refs for state.
    // AvatarLife decides WHAT happens (where to look, when to blink,
    // which idle action, how to react to the conversation); this loop
    // only applies the resulting pose to the rig, so the same behavior
    // works with any model that exposes a humanoid bone set.
    // ============================================================
    const life = lifeRef.current;
    let lastMouth = 0;
    // Viseme set for real lip-sync on ARKit-rigged faces.
    const VISEMES = [
      "viseme_aa", "viseme_E", "viseme_I", "viseme_O", "viseme_U",
      "viseme_FF", "viseme_TH", "viseme_kk", "viseme_SS", "viseme_nn",
      "viseme_RR", "viseme_PP",
    ];

    const animate = () => {
      const delta = clockRef.current.getDelta();
      const time = clockRef.current.getElapsedTime();

      // Update animation mixer
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      // ---- THE BRAIN: one call produces every channel for this frame ----
      const pose = life.update({
        delta,
        isSpeaking: speakingRef.current,
        isListening: isMicRef.current,
        isThinking: thinkingRef.current,
        gesture: gestureRef.current,
        personality: personalityRef.current,
      });

      const model = modelRef.current;
      const bones = bonesRef.current;
      const restOf = (bone: THREE.Bone) =>
        boneRestRotationRef.current.get(bone.name.toLowerCase());

      // ---- Body (always applied, so the rig stays alive even without bones) ----
      if (model) {
        model.position.x = pose.bodySway;
        model.position.y = pose.bodyLift;
        model.position.z = pose.bodyLean;
        model.rotation.y = pose.bodyTwist;
        model.rotation.z = pose.bodySway * 0.35;
      }

      // ---- Spine / hips: breathing and weight shift ----
      const spineBone =
        bones.get("mixamorig:spine") ||
        bones.get("mixamorigspine") ||
        bones.get("spine") ||
        bones.get("spine_01") ||
        bones.get("mixamorig:spine1") ||
        bones.get("spine1") ||
        bones.get("chest");
      if (spineBone) {
        const rest = restOf(spineBone);
        if (rest) {
          spineBone.rotation.x = rest.x + pose.breath * 0.7;
          spineBone.rotation.z = rest.z + pose.bodySway * 0.4;
        }
        spineBone.position.y = pose.breath * 0.5;
      }

      const hipsBone =
        bones.get("mixamorig:hips") ||
        bones.get("mixamorighips") ||
        bones.get("hips");
      if (hipsBone) {
        const rest = restOf(hipsBone);
        if (rest) {
          hipsBone.rotation.y = rest.y + pose.bodyTwist * 0.8;
          hipsBone.rotation.z = rest.z + pose.bodySway * 0.6;
        }
      }

      // ---- Arms: idle fidget, idle actions, gestures, speaking emphasis ----
      const leftArm =
        bones.get("mixamorig:leftarm") || bones.get("mixamorigleftarm");
      const rightArm =
        bones.get("mixamorig:rightarm") || bones.get("mixamorigrightarm");
      for (const [bone, target] of [
        [leftArm, pose.armLeft],
        [rightArm, pose.armRight],
      ] as const) {
        if (!bone) continue;
        const rest = restOf(bone);
        if (rest) {
          bone.rotation.z = rest.z + target.z;
          bone.rotation.x = rest.x + target.x;
        }
      }
      const leftShoulder =
        bones.get("mixamorig:leftshoulder") ||
        bones.get("mixamorigleftshoulder");
      const rightShoulder =
        bones.get("mixamorig:rightshoulder") ||
        bones.get("mixamorigrightshoulder");
      for (const [bone, target] of [
        [leftShoulder, pose.armLeft],
        [rightShoulder, pose.armRight],
      ] as const) {
        if (!bone) continue;
        const rest = restOf(bone);
        if (rest) bone.rotation.z = rest.z + target.z * 0.6;
      }

      // ---- Head: gaze-following plus drift, nods and the thinking tilt ----
      const headBone =
        bones.get("head") ||
        bones.get("mixamorig:head") ||
        bones.get("mixamorighead") ||
        bones.get("head_01") ||
        bones.get("neck");
      if (headBone) {
        headBone.rotation.y = pose.headYaw;
        headBone.rotation.x = pose.headPitch;
        headBone.rotation.z = pose.headRoll;
      }

      // ---- Eyes: ballistic saccades toward the current attention target ----
      const eyeL =
        bones.get("eye_l") ||
        bones.get("left_eye") ||
        bones.get("eye_left");
      const eyeR =
        bones.get("eye_r") ||
        bones.get("right_eye") ||
        bones.get("eye_right");
      if (eyeL) {
        eyeL.rotation.y = pose.gazeX;
        eyeL.rotation.x = pose.gazeY;
      }
      if (eyeR) {
        eyeR.rotation.y = pose.gazeX;
        eyeR.rotation.x = pose.gazeY;
      }

      // ---- Blinking (morph targets when present, else eyelid bones) ----
      const morph = morphRef.current;
      if (
        morph?.has("blink") ||
        morph?.has("eye_blink") ||
        morph?.has("blink_left")
      ) {
        applyMorphTarget("blink", pose.blink);
      } else {
        const eyelidL =
          bones.get("eyelid_l") ||
          bones.get("eye_lid_l") ||
          bones.get("lid_l");
        const eyelidR =
          bones.get("eyelid_r") ||
          bones.get("eye_lid_r") ||
          bones.get("lid_r");
        if (eyelidL) eyelidL.rotation.x = -pose.blink * 0.5;
        if (eyelidR) eyelidR.rotation.x = -pose.blink * 0.5;
      }

      // ---- ARKit face rig: real eyelids, brows and expression ----
      // This is what stops the character reading as a mannequin: real skin
      // deformation for blinks, plus brows that react with the conversation.
      const arkFace = !!morph?.has("eyeblinkleft");
      if (arkFace) {
        applyMorphTarget("eyeBlinkLeft", pose.blink);
        applyMorphTarget("eyeBlinkRight", pose.blink);

        // Brows rise with engagement and lower into a frown while thinking.
        const raise = Math.min(1, 0.1 + pose.attention * 0.22);
        if (morph?.has("browinnerup")) applyMorphTarget("browInnerUp", raise);
        if (morph?.has("browouterupleft")) {
          applyMorphTarget("browOuterUpLeft", pose.attention * 0.14);
        }
        if (morph?.has("browouterupright")) {
          applyMorphTarget("browOuterUpRight", pose.attention * 0.14);
        }
        const frown = thinkingRef.current ? 0.2 : 0;
        if (morph?.has("browdownleft")) applyMorphTarget("browDownLeft", frown);
        if (morph?.has("browdownright")) {
          applyMorphTarget("browDownRight", frown);
        }
        const squint = thinkingRef.current ? 0.16 : 0;
        if (morph?.has("eyesquintleft")) applyMorphTarget("eyeSquintLeft", squint);
        if (morph?.has("eyesquintright")) {
          applyMorphTarget("eyeSquintRight", squint);
        }
      }

      // ---- Eyeballs ----
      // The generated eyes are parented to the head bone, so they already
      // inherit head motion. Rotate them for gaze when the rig has no eye
      // bones, and squash them for blinking when there are no lids/morphs.
      const eyes = eyeGroupRef.current;
      if (eyes) {
        if (!eyeL && !eyeR) {
          eyes.rotation.y = pose.gazeX * 0.55;
          eyes.rotation.x = pose.gazeY * 0.45;
        }
        const hasBlinkPath =
          morph?.has("blink") ||
          morph?.has("eye_blink") ||
          morph?.has("blink_left") ||
          bones.get("eyelid_l") ||
          bones.get("eye_lid_l") ||
          bones.get("lid_l") ||
          bones.get("eyelid_r") ||
          bones.get("eye_lid_r") ||
          bones.get("lid_r");
        if (!hasBlinkPath) {
          eyes.scale.set(1, 1 - pose.blink * 0.88, 1);
        }
      }

      // ---- Hair: secondary motion that lags behind the body ----
      if (model) {
        model.traverse((child) => {
          const name = child.name.toLowerCase();
          if (
            !name.includes("hair") &&
            !name.includes("ponytail") &&
            !name.includes("bang")
          )
            return;
          const hair = child as THREE.Object3D;
          hair.rotation.z =
            Math.sin(time * 1.2) * 0.018 + pose.bodyTwist * 0.4;
          hair.rotation.y = Math.cos(time * 0.8) * 0.012;
        });
      }

      // ---- Lip sync ----
      // Smooth the syllable envelope so the mouth never snaps between bursts.
      lastMouth += (pose.mouth - lastMouth) * Math.min(delta * 16, 0.6);

      if (arkFace) {
        // Real rig: step through visemes per syllable, which is how real
        // lip-sync works, instead of one permanently open mouth.
        if (speakingRef.current) {
          const idx = Math.floor(time * 11) % VISEMES.length;
          const active = VISEMES[idx];
          const prev = VISEMES[(idx + VISEMES.length - 1) % VISEMES.length];
          if (morph?.has(active.toLowerCase())) {
            applyMorphTarget(active, lastMouth);
          }
          // The previous viseme decays a little for smoother transitions.
          if (prev !== active && morph?.has(prev.toLowerCase())) {
            applyMorphTarget(prev, lastMouth * 0.3);
          }
          if (morph?.has("jawopen")) {
            applyMorphTarget("jawOpen", lastMouth * 0.45);
          }
        } else {
          for (const v of VISEMES) {
            if (morph?.has(v.toLowerCase())) applyMorphTarget(v, 0);
          }
          if (morph?.has("jawopen")) applyMorphTarget("jawOpen", 0);
          if (morph?.has("mouthsmile")) {
            applyMorphTarget("mouthSmile", 0.1 + pose.attention * 0.12);
          }
        }
      } else if (morph) {
        // Legacy lowercase morph names (older Mixamo-style rigs).
        const jawMorphName = morph.has("jawopen") ? "jawopen" : "jaw_open";
        const mouthMorphName = morph.has("mouthopen")
          ? "mouthopen"
          : "mouth_open";
        if (morph.has(jawMorphName)) {
          applyMorphTarget(jawMorphName, lastMouth * 0.6);
        }
        if (morph.has(mouthMorphName)) {
          applyMorphTarget(mouthMorphName, lastMouth * 0.8);
        }
        if (morph.has("aa")) applyMorphTarget("aa", lastMouth * 0.4);
        if (morph.has("ee")) applyMorphTarget("ee", lastMouth * 0.25);
        if (morph.has("oo")) applyMorphTarget("oo", lastMouth * 0.2);
        if (morph.has("smi")) {
          applyMorphTarget("smi", lastMouth > 0.15 ? 0.12 : 0.05);
        }
        if (morph.has("smile")) {
          applyMorphTarget("smile", lastMouth > 0.15 ? 0.12 : 0.05);
        }
      }

      // Render
      controls.update();
      renderer.render(scene, camera);
      animIdRef.current = requestAnimationFrame(animate);
    };

    animIdRef.current = requestAnimationFrame(animate);

    // âœ… Resize handler - update camera/renderer AND refit framing when the
    // aspect changes significantly (e.g. orientation change on a phone) so the
    // full body stays framed responsively without disrupting in-place rotation.
    let lastAspect = container.clientWidth / container.clientHeight;
    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      renderer.setSize(w, h);
      const newAspect = w / h;
      camera.aspect = newAspect;
      camera.updateProjectionMatrix();

      if (
        modelRef.current &&
        Math.abs(newAspect - lastAspect) / lastAspect > 0.15
      ) {
        fitCameraToAvatar(
          modelRef.current,
          camera,
          controls,
          cameraModeRef.current,
          newAspect
        );
      }
      lastAspect = newAspect;
    };
    window.addEventListener("resize", onResize);

    // âœ… Click handler
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        onAvatarClick?.();
      }
    };
    container.addEventListener("click", onClick);

    // âœ… Cleanup - ONLY on component unmount
    return () => {
      window.removeEventListener("resize", onResize);
      container.removeEventListener("click", onClick);
      cancelAnimationFrame(animIdRef.current);
      controls.dispose();
      scene.clear();
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      modelRef.current = null;
      mixerRef.current = null;
      bonesRef.current.clear();
      morphRef.current.clear();
      boneRestRotationRef.current.clear();
      facialDetailsRef.current = null;
      loadedProfileIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // âœ… EMPTY DEPS - scene setup runs ONCE, never on state changes

  // ============================================================
  // MODEL LOADING - runs ONLY when profile.id changes.
  // Conversation state (speaking, thinking, mic) does NOT trigger this.
  // ============================================================
  useEffect(() => {
    // Skip if this profile is already loaded
    if (loadedProfileIdRef.current === profile.id) return;
    loadedProfileIdRef.current = profile.id;

    setModelStatus("loading");
    setLoadError(null);

    // Remove any existing model from the scene
    if (modelRef.current) {
      sceneRef.current?.remove(modelRef.current);
      modelRef.current = null;
    }
    if (mixerRef.current) {
      mixerRef.current = null;
    }
    hasActiveAnimationRef.current = false;
    bonesRef.current.clear();
    morphRef.current.clear();

    const modelUrl = MODEL_URLS[profile.id] || MODEL_URLS["male-human-1"];
    const loader = new GLTFLoader();

    // The realistic characters ship EXT_meshopt_compression. GLTFLoader refuses
    // to parse such files unless a decoder is registered first ("setMeshoptDecoder
    // must be called before loading compressed files"), so wire it up here.
    // (KHR_mesh_quantization and WebP textures are handled natively by three.)
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;

        // âœ… Normalize the humanoid model (scale to 1.7m, center feet on ground)
        const norm = normalizeHumanoidModel(model);
        // Realistic skin/cloth response. Authored maps are preserved; only the
        // CG `metallic: 0.5` and flat colours are corrected.
        applyRealisticMaterials(model);
        eyeGroupRef.current = addFacialDetails(model, profile);

        // âœ… IMPORTANT: Preserve authored materials - DO NOT overwrite PBR maps
        // The previous code traversed all meshes and replaced roughness/metalness/envMapIntensity,
        // which discards the model's original PBR maps and texture maps.
        // We only ensure shadows and basic properties if needed, but skip the full overwrite.

        sceneRef.current?.add(model);
        modelRef.current = model;

        // âœ… Map skeleton bones (after normalization so bone names are consistent)
        const boneMap = new Map<string, THREE.Bone>();
        model.traverse((child) => {
          const bone = child as THREE.Bone;
          if (bone.isBone) {
            boneMap.set(bone.name.toLowerCase(), bone);
          }
        });
        bonesRef.current = boneMap;
        boneRestRotationRef.current = new Map(
          Array.from(boneMap.entries()).map(([name, bone]) => [name, bone.rotation.clone()])
        );
        facialDetailsRef.current = model.getObjectByName("avatar-facial-details") as THREE.Group | null;

        // âœ… Map morph targets
        const morphMap = new Map<string, number>();
        model.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
            for (const [name, idx] of Object.entries(mesh.morphTargetDictionary)) {
              morphMap.set(name.toLowerCase(), idx);
              // Initialize influences to 0
              if (mesh.morphTargetInfluences) {
                mesh.morphTargetInfluences[idx] = 0;
              }
            }
          }
        });
        morphRef.current = morphMap;

        // Fresh life brain for the new character: its own motion signature
        // and a fresh idle timeline.
        lifeRef.current = new AvatarLife(hashString(profile.id));

        // âœ… Setup animation mixer
        if (gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;
          const idleAnim = gltf.animations.find(
            (a) =>
              a.name.toLowerCase().includes("idle") ||
              a.name.toLowerCase().includes("breath")
          );
          if (idleAnim) {
            const action = mixer.clipAction(idleAnim);
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.play();
            hasActiveAnimationRef.current = true;
          } else {
            mixerRef.current = null;
            hasActiveAnimationRef.current = false;
          }
        } else {
          hasActiveAnimationRef.current = false;
        }

        // âœ… Fit camera to avatar based on current cameraMode
        if (cameraRef.current && controlsRef.current && containerRef.current) {
          const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
          fitCameraToAvatar(model, cameraRef.current, controlsRef.current, cameraModeRef.current, aspect);
        }

        setModelStatus("ready");
        onAvatarLoad?.();
        onStateChange?.("IDLE");

        console.log(
          `[Avatar3D] Loaded ${profile.id}. Bones: ${boneMap.size}. Morphs: ${morphMap.size}. Height: ${norm.height.toFixed(2)}m`
        );
      },
      undefined,
      (error) => {
        console.error("[Avatar3D] Load error:", error);
        const errMsg = error instanceof Error ? error.message : String(error);
        setLoadError(errMsg);
        setModelStatus("error");
        onAvatarError?.(error instanceof Error ? error : new Error(errMsg));
        onStateChange?.("ERROR");
      }
    );
    // âœ… ONLY depends on profile.id - conversation state does NOT trigger reload
  }, [profile.id]);

  // âœ… Toggle between PORTRAIT and FULL_BODY camera framing modes
  const toggleCameraMode = () => {
    const next = cameraMode === "PORTRAIT" ? "FULL_BODY" : "PORTRAIT";
    cameraModeRef.current = next;
    setCameraMode(next);
    // Re-fit camera without reloading model
    if (modelRef.current && cameraRef.current && controlsRef.current && containerRef.current) {
      const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      fitCameraToAvatar(modelRef.current, cameraRef.current, controlsRef.current, next, aspect);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative cursor-pointer select-none"
      style={{
        width: "100%",
        height: "min(500px, 85vh)",
        borderRadius: "20px",
        background: "linear-gradient(160deg, #0a0a1a 0%, #12122a 100%)",
        boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
        overflow: "hidden",
        position: "relative",
        touchAction: "none",
      }}
    >
      {/* Loading overlay - ONLY shows when a NEW model is actually loading */}
      {modelStatus === "loading" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0d0d20]/90">
          <div className="text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent"></div>
            <p className="text-sm text-zinc-300">Loading character...</p>
          </div>
        </div>
      )}
      {/* Error overlay - shows when model fails to load */}
      {modelStatus === "error" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0d0d20]/90 p-6">
          <div className="text-center">
            <p className="mb-2 text-2xl">âš ï¸</p>
            <p className="mb-1 text-sm font-medium text-white">
              Couldn't load the avatar model.
            </p>
            <p className="mb-4 text-xs text-zinc-400">
              {loadError}
            </p>
            <button
              onClick={() => {
                loadedProfileIdRef.current = null;
                setModelStatus("idle");
              }}
              className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label={`Toggle camera framing: ${cameraMode === "FULL_BODY" ? "portrait" : "full body"}`}
        onClick={(event) => {
          event.stopPropagation();
          toggleCameraMode();
        }}
        className="absolute bottom-3 right-3 z-20 rounded-full border border-white/15 bg-slate-900/70 px-3 py-1.5 text-[11px] font-medium tracking-wide text-zinc-200 shadow-lg backdrop-blur-sm transition hover:border-violet-400 hover:bg-slate-900"
      >
        {cameraMode === "FULL_BODY" ? "Portrait" : "Full body"}
      </button>
    </div>
  );
}
