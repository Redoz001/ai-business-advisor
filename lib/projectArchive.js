/**
 * Project Archive - Creates downloadable ZIP-like archives for Build Studio projects
 * Since browsers can't create real ZIP files without a library, we create a .tar.gz
 * compatible tarball or a simple JSON project file that can be imported
 */

export const createProjectArchive = (project) => {
  const { name, kind, files, prompt, created_at, updated_at } = project;

  const archive = {
    name,
    kind,
    prompt,
    created_at,
    updated_at,
    exported_at: new Date().toISOString(),
    version: "1.0.0",
    files,
  };

  const dataStr = JSON.stringify(archive, null, 2);
  const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

  return {
    dataUri,
    filename: `${name.toLowerCase().replace(/\s+/g, "-")}-project.json`,
    content: dataStr,
  };
};

export const downloadProject = (project) => {
  const archive = createProjectArchive(project);
  const blob = new Blob([archive.content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = archive.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const getDeployInstructions = (kind) => {
  const instructions = {
    website: {
      title: "Deploy your Website",
      steps: [
        "1. Download the project JSON file using the Export button below.",
        "2. Extract the files (index.html, style.css, script.js, README.md).",
        "3. Upload to any static host: Netlify Drop, Vercel, GitHub Pages, or Surge.sh.",
        "4. For Netlify: Drag the folder to netlify.com/drop.",
        "5. For Vercel: Connect your GitHub repo or use vercel CLI.",
      ],
      freeHosts: ["Netlify", "Vercel", "GitHub Pages", "Surge.sh", "Cloudflare Pages"],
    },
    pwa: {
      title: "Deploy your PWA",
      steps: [
        "1. Download the project JSON file using the Export button below.",
        "2. Extract files including manifest.json and sw.js (service worker).",
        "3. Serve over HTTPS (required for PWAs): Netlify, Vercel, or Firebase Hosting.",
        "4. Install on mobile: Chrome 'Add to Home Screen' or Safari 'Add to Home Screen'.",
        "5. Test offline functionality after first visit.",
      ],
      freeHosts: ["Netlify", "Vercel", "Firebase Hosting", "GitHub Pages"],
    },
    game: {
      title: "Deploy your Browser Game",
      steps: [
        "1. Download the project JSON file using the Export button below.",
        "2. Extract HTML, CSS, and JavaScript game files.",
        "3. Upload to itch.io, Netlify, Vercel, or GitHub Pages.",
        "4. For itch.io: Create a new project, upload HTML files, set 'This file will be played in the browser'.",
        "5. Share the link with players.",
      ],
      freeHosts: ["itch.io", "Netlify", "Vercel", "GitHub Pages"],
    },
    android: {
      title: "Deploy your React Native App",
      steps: [
        "1. Download the project JSON file using the Export button below.",
        "2. Extract files: App.js, package.json, app.json, babel.config.js, metro.config.js.",
        "3. Install Node.js (https://nodejs.org).",
        "4. Run: npm install (in the project folder).",
        "5. Run: npx expo install expo-status-bar react-native-safe-area-context.",
        "6. Start: npx expo start.",
        "7. Install Expo Go app on your iOS/Android device and scan the QR code.",
        "8. For production: npx expo build:android or npx expo build:ios.",
        "9. Submit to Google Play Store or Apple App Store.",
      ],
      freeHosts: ["Expo (development)", "Google Play Store", "Apple App Store"],
    },
  };

  return instructions[kind] || instructions.website;
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const getTotalProjectSize = (files) => {
  let total = 0;
  for (const content of Object.values(files)) {
    total += new Blob([content]).size;
  }
  return formatFileSize(total);
};