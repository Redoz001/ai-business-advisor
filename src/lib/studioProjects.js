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

export function buildStudioPrompt(projectType, userPrompt, { cameraOverlay = false, domainName = "" } = {}) {
const designSystem = {
    website:
      `Create a PROFESSIONAL, MODERN, and VISUALLY STUNNING website. Requirements:
- Use a complete design system: CSS custom properties for colors, spacing, typography, shadows, and border-radius.
- Include a hero section with gradient background, large heading, subheading, and CTA buttons.
- Use Google Fonts (Inter, Poppins, or similar) loaded via CDN.
- Include at least 4 sections: Hero, Features/Services, About/Team, and Contact/Footer.
- Add CSS animations: fade-in on scroll, hover transforms, smooth transitions, and micro-interactions.
- Use SVG icons inline (not emoji) for features and navigation.
- Include a responsive navigation bar with mobile hamburger menu.
- Add a footer with links, social icons, and copyright.
- Use modern CSS: flexbox/grid layouts, clamp() for responsive typography, CSS variables.
- Add subtle shadows, gradients, and glassmorphism effects.
- Include placeholder images using https://picsum.photos or SVG illustrations.
- Make it fully responsive (mobile, tablet, desktop).
- Add dark mode support via CSS variables and a toggle.
- Include real, meaningful content (not lorem ipsum) based on the user's brief.
- Add form validation with visual feedback for contact forms.
- Include a loading state and smooth page transitions.
- Use semantic HTML5 elements (header, nav, main, section, article, footer).
- Add ARIA labels and accessibility features.
- Include a back-to-top button.
- Add a cookie/consent banner if applicable.`,
    pwa:
      `Create a COMPLETE, PROFESSIONAL, installable PWA. Requirements:
- Return index.html, manifest.webmanifest, sw.js, README.md, and any app assets.
- Use a complete design system with CSS custom properties.
- Include a hero/landing section with gradient background and CTA.
- Use Google Fonts and inline SVG icons.
- Add CSS animations, transitions, and hover effects.
- Implement app-shell caching in sw.js with offline fallback.
- Add a manifest with proper name, theme_color, background_color, display: standalone, and icons (use data URIs for icons).
- Include service worker registration in index.html.
- In README.md explain how to serve over localhost or HTTPS and test installation and offline behavior.
- Add install prompt handling (beforeinstallprompt event).
- Make it fully responsive and accessible.
- Include meaningful content based on the user's brief.
- Add dark mode support.
- Use semantic HTML5 and ARIA labels.
- Include a loading spinner and smooth transitions.`,
    game:
      `Create a COMPLETE, POLISHED browser game. Requirements:
- Use a professional design with gradients, shadows, and animations.
- Include a game title screen with animated background.
- Add a game over screen with score display and restart button.
- Implement smooth game loop with requestAnimationFrame.
- Add particle effects, screen shake, or visual feedback for actions.
- Include sound effects using Web Audio API (optional but recommended).
- Add a high score system using localStorage.
- Include keyboard AND touch controls.
- Add a pause/resume feature.
- Use canvas or DOM-based rendering with smooth animations.
- Include instructions screen with visual key indicators.
- Add difficulty progression.
- Make it mobile-friendly with touch controls.
- Include a loading screen.
- Use CSS animations for UI transitions.
- Add visual polish: glows, gradients, and particle effects.`,
    android:
      `Create a COMPLETE cross-platform native iOS and Android app using Expo and React Native. Requirements:
- Return package.json, an Expo app entry point (App.js or app/index.js), app.json, and README.md.
- Use React Native Paper or NativeBase for professional UI components.
- Include a splash screen and app icon configuration.
- Add navigation using React Navigation (stack + tab navigator).
- Implement a professional design system with consistent theming.
- Include at least 3 screens: Home, Details, Settings.
- Add loading states, error states, and empty states.
- Implement data persistence with AsyncStorage.
- Add haptic feedback for interactions.
- Include pull-to-refresh and infinite scroll where applicable.
- Add dark mode support.
- Include form validation with visual feedback.
- Add animations using React Native Reanimated.
- Include a camera feature if requested.
- Use accessible components with proper labels.
- Add a README with complete setup, run, and build instructions.
- List all required permissions with justification.`,
  }[projectType];
  const cameraRequirements = cameraOverlay && ["website", "pwa", "android"].includes(projectType)
    ? projectType === "android"
      ? "Add a camera-overlay mode using expo-camera CameraView and its permission API. Show the complete app as a readable floating panel over the live camera view, provide front/rear camera switching, and keep typed input reflected immediately in the panel. Request permission only after the user explicitly starts camera mode, handle denial with a usable non-camera fallback, and stop the camera when leaving the mode. This is a screen-based overlay, not a spatially anchored hologram."
      : "Add a camera-overlay mode using getUserMedia. Show the complete app as a readable floating panel over the live camera view, provide front/rear camera switching with facingMode, and keep typed input reflected immediately in the panel. Request permission only after the user explicitly starts camera mode, handle denial with a usable non-camera fallback, and stop all media tracks when leaving the mode. For PWAs, explain that camera access requires HTTPS or localhost. This is a screen-based overlay, not a spatially anchored hologram."
    : "";

  const domainRequirements = projectType === "website" || projectType === "pwa"
    ? `Generate a unique, brandable project name${domainName ? ` targeting the domain "${domainName}"` : " that could work as a custom domain (e.g., \"myapp.com\", \"getmyapp.io\")"}. Include a vercel.json or netlify.toml configuration file for deployment. In README.md, include instructions for deploying to Vercel/Netlify with one click, setting up a custom domain${domainName ? ` ("${domainName}")` : ""}, configuring DNS records (A, CNAME, TXT), enabling HTTPS, and setting up environment variables.`
    : "";

  return [
    "Generate a COMPLETE, PROFESSIONAL, PRODUCTION-READY software project from this user brief.",
    "The output must be COMPLEX and POLISHED, not a simple template. Think like a senior frontend developer building for a real client.",
    designSystem,
    cameraRequirements,
    domainRequirements,
    'Return only valid JSON in this exact shape: {"name":"short project name","files":{"relative/path":"complete file contents"}}.',
    "Do not use markdown fences. Include complete file contents, not placeholders or omissions.",
    "Keep the total output under 300 KB and use relative paths without parent-directory segments.",
    "Do not include secrets, credentials, analytics trackers, or hidden network calls. Use only dependencies required by the project.",
    "IMPORTANT: Every file must be COMPLETE and FUNCTIONAL. No 'TODO' comments, no placeholder text, no 'add your code here' comments.",
    "Use real, meaningful content based on the user's brief - not lorem ipsum or generic placeholder text.",
    `Project brief: ${userPrompt}`,
  ].filter(Boolean).join("\n\n");
}
