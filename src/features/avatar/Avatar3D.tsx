import React, { useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type {
  AvatarProfile,
  AvatarState,
  EmotionState,
  Gesture,
} from "./types";

// Verified production-ready humanoid assets.
// MIT-licensed reference models hosted by the three.js project (mrdoob/three.js),
// served via raw.githubusercontent with CORS: * so browser loading works in production.
// - Xbot.glb   : realistic rigged male humanoid with skeletal + face morphs
// - Michelle.glb: realistic rigged female humanoid with blendshapes + animations
const MODEL_URLS: Record<string, string> = {
  "male-human-1":
    "https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/models/gltf/Xbot.glb",
  "robotic-1":
    "https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/models/gltf/Xbot.glb",
  "futuristic-1":
    "https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/models/gltf/Michelle.glb",
  "female-human-1":
    "https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/models/gltf/Michelle.glb",
};

type Avatar3DProps = {
  profile: AvatarProfile;
  isMicActive: boolean;
  isSpeaking?: boolean;
  isThinking?: boolean;
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

  const fovRad = (camera.fov * Math.PI) / 180;
  // Horizontal FOV depends on aspect ratio (portrait = narrow horizontal FOV)
  const horizontalFovRad = 2 * Math.atan(Math.tan(fovRad / 2) * aspect);

  let distance: number;
  let targetY: number;

  if (mode === "FULL_BODY") {
    // Must fit head-to-toe vertically AND horizontally with padding
    const verticalExtent = dimensions.y; // head to feet
    const horizontalExtent = dimensions.x; // width across shoulders/hips

    // Distance to fit vertical extent
    const distanceForVertical = verticalExtent / (2 * Math.tan(fovRad / 2));
    // Distance to fit horizontal extent (accounting for portrait aspect)
    const distanceForHorizontal = horizontalExtent / (2 * Math.tan(horizontalFovRad / 2));
    // Use the larger distance to satisfy BOTH constraints
    distance = Math.max(distanceForVertical, distanceForHorizontal);
    // Add 12% padding
    distance *= 1.12;
    // Target y at the model's vertical center for full-body view
    targetY = center.y;
  } else {
    // PORTRAIT mode - chest up, face readable
    const modelHeight = dimensions.y;
    // Portrait camera distance should be ~1.3x the model's visible height for the given fov
    const portraitFactor = 1.3;
    distance = (modelHeight * portraitFactor) / (2 * Math.tan(fovRad / 2));
    // Slightly above center (chin level)
    targetY = center.y + 0.1;
  }

  // Apply the computed camera settings
  controls.target.set(center.x, targetY, center.z);
  camera.fov = mode === "FULL_BODY" ? 45 : 33;
  // Position camera: same x as center, y offset based on distance and fov,
  // z = distance away from the model
  camera.position.set(
    center.x,
    center.y + distance * Math.tan((camera.fov * Math.PI) / 360),
    center.z + distance
  );
  controls.minDistance = mode === "FULL_BODY" ? 2.0 : 1.0;
  controls.maxDistance = mode === "FULL_BODY" ? 8.0 : 1.7;
  controls.enablePan = mode !== "FULL_BODY"; // disable pan in portrait mode
  controls.maxPolarAngle = mode === "FULL_BODY"
    ? Math.PI / 2
    : 1.5;
  controls.minPolarAngle = mode === "FULL_BODY"
    ? 0.1
    : 0.4;
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

export default function Avatar3D({
  profile,
  isMicActive,
  isSpeaking = false,
  isThinking = false,
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
  const morphRef = useRef<Map<string, number>>(new Map());
  const loadedProfileIdRef = useRef<string | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("PORTRAIT");

  // Apply morph targets by name across all meshes
  const applyMorphTarget = useCallback((name: string, value: number) => {
    if (!modelRef.current) return;
    const lowerName = name.toLowerCase();
    modelRef.current.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        const idx = mesh.morphTargetDictionary[lowerName];
        if (idx !== undefined) {
          mesh.morphTargetInfluences[idx] = THREE.MathUtils.clamp(value, 0, 1);
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
    scene.background = new THREE.Color(0x0d0d20);

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
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ===== PORTRAIT STUDIO LIGHTING =====
    // Key light - warm, soft, from camera-right
    const keyLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    keyLight.position.set(1.5, 2.0, 2.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 512;
    keyLight.shadow.mapSize.height = 512;
    scene.add(keyLight);

    // Fill light - cooler, softer, from camera-left
    const fillLight = new THREE.DirectionalLight(0xddddff, 0.6);
    fillLight.position.set(-1.5, 0.5, 1.5);
    scene.add(fillLight);

    // Rim light - from behind
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(0, 1.5, -2.0);
    scene.add(rimLight);

    // Ambient fill
    const ambient = new THREE.AmbientLight(0x404060, 0.4);
    scene.add(ambient);

    // Hemisphere for sky/ground color
    const hemi = new THREE.HemisphereLight(0x8899cc, 0x445566, 0.3);
    scene.add(hemi);

    // Ground shadow disc
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.0, 32),
      new THREE.ShadowMaterial({ opacity: 0.25, color: 0x000000 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

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
    // ANIMATION LOOP - runs continuously, reads refs for state
    // ============================================================
    let mouthOpen = 0;
    let blinkPhase = 0;
    let gazeX = 0;
    let gazeY = 0;
    let headYaw = 0;
    let headPitch = 0;
    let breathPhase = 0;

    const animate = () => {
      const delta = clockRef.current.getDelta();
      const time = clockRef.current.getElapsedTime();

      // Update animation mixer
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      // ✅ BREATHING (spine/chest bone)
      breathPhase += delta * 1.1;
      const breathValue = Math.sin(breathPhase) * 0.02;
      const spineBone =
        bonesRef.current.get("spine") ||
        bonesRef.current.get("spine_01") ||
        bonesRef.current.get("spine1") ||
        bonesRef.current.get("chest") ||
        bonesRef.current.get("hips");
      if (spineBone) {
        spineBone.position.y = breathValue * 0.5;
      }

      // ✅ BLINKING (morph or eyelid bone)
      const blinkPeriod = 2.5 + Math.random() * 1.5;
      const blink = time % blinkPeriod < 0.1;
      if (blink) {
        blinkPhase = Math.min(blinkPhase + delta * 15, 1);
      } else {
        blinkPhase = Math.max(blinkPhase - delta * 8, 0);
      }
      const blinkRef = morphRef.current;
      const blinkMorph =
        blinkRef?.get("blink") ??
        blinkRef?.get("eye_blink") ??
        blinkRef?.get("blink_left") ??
        blinkRef?.get("eyes_closed");
      if (blinkMorph !== undefined) {
        applyMorphTarget("blink", blinkPhase);
      } else {
        const eyelidL =
          bonesRef.current.get("eyelid_l") ??
          bonesRef.current.get("eye_lid_l") ??
          bonesRef.current.get("lid_l");
        const eyelidR =
          bonesRef.current.get("eyelid_r") ??
          bonesRef.current.get("eye_lid_r") ??
          bonesRef.current.get("lid_r");
        if (eyelidL) eyelidL.rotation.x = -blinkPhase * 0.5;
        if (eyelidR) eyelidR.rotation.x = -blinkPhase * 0.5;
      }

      // ✅ GAZE (eye bones)
      const gazeTargetX = Math.sin(time * 0.3) * 0.03;
      const gazeTargetY = Math.cos(time * 0.25) * 0.02;
      gazeX += (gazeTargetX - gazeX) * delta * 8;
      gazeY += (gazeTargetY - gazeY) * delta * 8;

      const eyeL =
        bonesRef.current.get("eye_l") ??
        bonesRef.current.get("left_eye") ??
        bonesRef.current.get("eye_left");
      const eyeR =
        bonesRef.current.get("eye_r") ??
        bonesRef.current.get("right_eye") ??
        bonesRef.current.get("eye_right");
      if (eyeL) {
        eyeL.rotation.y = gazeX;
        eyeL.rotation.x = gazeY;
      }
      if (eyeR) {
        eyeR.rotation.y = gazeX;
        eyeR.rotation.x = gazeY;
      }

      // ✅ HEAD MOVEMENT
      headYaw += (Math.sin(time * 0.4) * 0.04 - headYaw) * delta * 6;
      headPitch += (Math.sin(time * 0.2) * 0.02 - headPitch) * delta * 4;
      const headBone =
        bonesRef.current.get("head") ??
        bonesRef.current.get("head_01") ??
        bonesRef.current.get("neck");
      if (headBone) {
        headBone.rotation.y = headYaw;
        headBone.rotation.x = headPitch;
      }

      // ✅ SPEECH / LIP SYNC (morph targets)
      const morph = morphRef.current;
      const jawMorphName = morph?.has("jawopen") ? "jawopen" : "jaw_open";
      const mouthMorphName = morph?.has("mouthopen") ? "mouthopen" : "mouth_open";

      if (isSpeaking) {
        const mouthTarget = 0.35 + Math.sin(time * 8.5) * 0.25;
        mouthOpen += (mouthTarget - mouthOpen) * Math.min(delta * 14, 0.2);

        const morph = morphRef.current;
        if (morph && morph.has(jawMorphName)) applyMorphTarget(jawMorphName, mouthOpen * 0.6);
        if (morph && morph.has(mouthMorphName)) applyMorphTarget(mouthMorphName, mouthOpen * 0.8);

        // Alternate vowel shapes
        const vowelCycle = Math.sin(time * 4) * 0.5 + 0.5;
        if (morph && morph.has("aa")) applyMorphTarget("aa", mouthOpen * 0.4 * (1 - vowelCycle));
        if (morph && morph.has("ee")) applyMorphTarget("ee", mouthOpen * 0.3 * vowelCycle);
        if (morph && morph.has("oo")) applyMorphTarget("oo", mouthOpen * 0.3 * (1 - vowelCycle * 0.5));
        if (morph && morph.has("smi")) applyMorphTarget("smi", 0.15);
        if (morph && morph.has("smile")) applyMorphTarget("smile", 0.15);
      } else {
        mouthOpen += (0 - mouthOpen) * Math.min(delta * 8, 0.15);
        const morph = morphRef.current;
        if (morph && morph.has(jawMorphName)) applyMorphTarget(jawMorphName, 0);
        if (morph && morph.has(mouthMorphName)) applyMorphTarget(mouthMorphName, 0);
        if (morph && morph.has("smi")) applyMorphTarget("smi", 0.05);
        if (morph && morph.has("smile")) applyMorphTarget("smile", 0.05);
      }

      // ✅ THINKING
      if (isThinking) {
        if (headBone) {
          headBone.rotation.z = Math.sin(time * 0.5) * 0.04;
          headBone.rotation.x = 0.05 + Math.sin(time * 0.3) * 0.03;
        }
      }

      // Render
      controls.update();
      renderer.render(scene, camera);
      animIdRef.current = requestAnimationFrame(animate);
    };

    animIdRef.current = requestAnimationFrame(animate);

    // ✅ Resize handler - update camera and renderer, NOT the model
    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // ✅ Click handler
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

    // ✅ Cleanup - ONLY on component unmount
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
      loadedProfileIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ✅ EMPTY DEPS - scene setup runs ONCE, never on state changes

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
    bonesRef.current.clear();
    morphRef.current.clear();

    const modelUrl = MODEL_URLS[profile.id] || MODEL_URLS["male-human-1"];
    const loader = new GLTFLoader();

    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;

        // ✅ Normalize the humanoid model (scale to 1.7m, center feet on ground)
        const norm = normalizeHumanoidModel(model);

        // ✅ IMPORTANT: Preserve authored materials - DO NOT overwrite PBR maps
        // The previous code traversed all meshes and replaced roughness/metalness/envMapIntensity,
        // which discards the model's original PBR maps and texture maps.
        // We only ensure shadows and basic properties if needed, but skip the full overwrite.

        sceneRef.current?.add(model);
        modelRef.current = model;

        // ✅ Map skeleton bones (after normalization so bone names are consistent)
        const boneMap = new Map<string, THREE.Bone>();
        model.traverse((child) => {
          const bone = child as THREE.Bone;
          if (bone.isBone) {
            boneMap.set(bone.name.toLowerCase(), bone);
          }
        });
        bonesRef.current = boneMap;

        // ✅ Map morph targets
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

        // ✅ Setup animation mixer
        if (gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;
          const idleAnim = gltf.animations.find(
            (a) =>
              a.name.toLowerCase().includes("idle") ||
              a.name.toLowerCase().includes("loop") ||
              a.name.toLowerCase().includes("stand")
          );
          if (idleAnim) {
            const action = mixer.clipAction(idleAnim);
            action.play();
          }
        }

        // ✅ Fit camera to avatar based on current cameraMode
        if (cameraRef.current && controlsRef.current && containerRef.current) {
          const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
          fitCameraToAvatar(model, cameraRef.current, controlsRef.current, cameraMode, aspect);
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
    // ✅ ONLY depends on profile.id - conversation state does NOT trigger reload
  }, [profile.id]);

  // ✅ Toggle between PORTRAIT and FULL_BODY camera framing modes
  const toggleCameraMode = () => {
    setCameraMode((mode) => {
      const next = mode === "PORTRAIT" ? "FULL_BODY" : "PORTRAIT";
      // Re-fit camera without reloading model
      if (modelRef.current && cameraRef.current && controlsRef.current && containerRef.current) {
        const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        fitCameraToAvatar(modelRef.current, cameraRef.current, controlsRef.current, next, aspect);
      }
      return next;
    });
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
            <p className="mb-2 text-2xl">⚠️</p>
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
    </div>
  );
}