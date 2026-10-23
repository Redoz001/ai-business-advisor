export function parseGeneratedFiles(response, projectType) {
  const trimmed = response.trim();
  const fencedJson = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedJson?.[1] ?? trimmed;
  let parsed;

  try {
    parsed = JSON.parse(candidate);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;

    const html = trimmed.match(/```(?:html)?\s*([\s\S]*?)```/i)?.[1] ?? trimmed;
    if (
      (projectType === "website" || projectType === "game") &&
      /<html[\s>]|<!doctype html/i.test(html)
    ) {
      return {
        name: projectType === "game" ? "Your game" : "Your website",
        files: { "index.html": html },
      };
    }

    throw new Error("The AI returned an invalid project. Try generating it again.");
  }

  const files = parsed?.files;
  if (
    !files ||
    typeof files !== "object" ||
    Array.isArray(files) ||
    Object.keys(files).length === 0 ||
    Object.keys(files).length > 100 ||
    Object.entries(files).some(([path, contents]) =>
      typeof contents !== "string" ||
      path.length === 0 ||
      path.length > 200 ||
      path.startsWith("/") ||
      path.includes("\\") ||
      path.includes("\0") ||
      path.split("/").some((segment) =>
        segment === "" || segment === "." || segment === ".."
      )
    )
  ) {
    throw new Error("The generated project did not contain valid files.");
  }

  const fileNames = Object.keys(files);
  const hasFile = (name) => fileNames.includes(name);
  const hasNativeEntry = fileNames.some((name) =>
    /(^|\/)App\.(jsx?|tsx?)$|^app\/(index|_layout)\.(jsx?|tsx?)$/i.test(name)
  );
  const requirements = {
    website: hasFile("index.html"),
    game: hasFile("index.html"),
    pwa: hasFile("index.html") &&
      (hasFile("manifest.webmanifest") || hasFile("manifest.json")) &&
      (hasFile("sw.js") || hasFile("service-worker.js")) &&
      hasFile("README.md"),
    android: hasFile("package.json") &&
      hasFile("app.json") &&
      hasFile("README.md") &&
      hasNativeEntry,
  };
  if (!requirements[projectType]) {
    throw new Error("The generated project is missing required platform files. Please generate it again.");
  }

  return {
    name: String(parsed.name || "Untitled project").slice(0, 80),
    files,
  };
}

export function buildStudioPrompt(projectType, userPrompt, { cameraOverlay = false } = {}) {
  const requirements = {
    website:
      "Create a polished responsive website. Use semantic accessible HTML and inline CSS/JavaScript. Include working interactions, useful sample content, and mobile layouts.",
    pwa:
      "Create a complete responsive installable PWA. Return index.html, manifest.webmanifest, sw.js, README.md, and any app assets. Include a manifest link and service-worker registration in index.html, add valid app name/theme/start URL/display metadata and installable icons, and implement an app-shell cache with an offline fallback in sw.js. In README.md explain how to serve over localhost or HTTPS and test installation and offline behavior. Use no secret keys or analytics.",
    game:
      "Create a complete playable browser game in index.html using inline CSS and JavaScript. Include instructions, keyboard and touch controls where suitable, and a reset/restart control.",
    android:
      "Create a complete cross-platform native iOS and Android app using Expo and React Native, not a website or webview wrapper. Return package.json, an Expo app entry point (App.js or app/index.js), app.json, and a README.md with install, local run, device testing, and EAS build/submission steps. Use accessible responsive native components, include all essential source/config files, and list any required permissions with justification. Do not claim it has been built, signed, or published.",
  }[projectType];
  const cameraRequirements = cameraOverlay && ["website", "pwa", "android"].includes(projectType)
    ? projectType === "android"
      ? "Add a camera-overlay mode using expo-camera CameraView and its permission API. Show the complete app as a readable floating panel over the live camera view, provide front/rear camera switching, and keep typed input reflected immediately in the panel. Request permission only after the user explicitly starts camera mode, handle denial with a usable non-camera fallback, and stop the camera when leaving the mode. This is a screen-based overlay, not a spatially anchored hologram."
      : "Add a camera-overlay mode using getUserMedia. Show the complete app as a readable floating panel over the live camera view, provide front/rear camera switching with facingMode, and keep typed input reflected immediately in the panel. Request permission only after the user explicitly starts camera mode, handle denial with a usable non-camera fallback, and stop all media tracks when leaving the mode. For PWAs, explain that camera access requires HTTPS or localhost. This is a screen-based overlay, not a spatially anchored hologram."
    : "";

  return [
    "Generate a complete software project from this user brief.",
    requirements,
    cameraRequirements,
    'Return only valid JSON in this exact shape: {"name":"short project name","files":{"relative/path":"complete file contents"}}.',
    "Do not use markdown fences. Include complete file contents, not placeholders or omissions. Keep the total output under 300 KB and use relative paths without parent-directory segments.",
    "Do not include secrets, credentials, analytics trackers, or hidden network calls. Use only dependencies required by the project.",
    `Project brief: ${userPrompt}`,
  ].join("\n\n");
}
