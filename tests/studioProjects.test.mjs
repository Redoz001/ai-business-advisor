import test from "node:test";
import assert from "node:assert/strict";

import {
  buildStudioPrompt,
  parseGeneratedFiles,
} from "../src/lib/studioProjects.js";

function response(files, name = "Starter project") {
  return JSON.stringify({ name, files });
}

test("accepts website and game projects with an HTML entry point", () => {
  for (const kind of ["website", "game"]) {
    const project = parseGeneratedFiles(response({ "index.html": "<h1>Ready</h1>" }), kind);
    assert.equal(project.files["index.html"], "<h1>Ready</h1>");
  }
});

test("requires PWA manifest, service worker, and local testing instructions", () => {
  const pwa = {
    "index.html": "<h1>Ready</h1>",
    "manifest.webmanifest": '{"name":"Ready"}',
    "sw.js": "self.addEventListener('fetch', () => {});",
    "README.md": "Serve with localhost to test.",
  };

  assert.deepEqual(parseGeneratedFiles(response(pwa), "pwa").files, pwa);
  delete pwa["README.md"];
  assert.throws(() => parseGeneratedFiles(response(pwa), "pwa"), /missing required platform files/);
});

test("requires Expo package, app config, entry point, and README for native apps", () => {
  const app = {
    "package.json": '{"dependencies":{"expo":"latest"}}',
    "app.json": '{"expo":{"name":"Ready"}}',
    "App.js": "export default function App() {}",
    "README.md": "Run with Expo.",
  };

  assert.deepEqual(parseGeneratedFiles(response(app), "android").files, app);
  delete app["app.json"];
  assert.throws(() => parseGeneratedFiles(response(app), "android"), /missing required platform files/);
});

test("retains fenced HTML fallback for standalone web output", () => {
  assert.deepEqual(
    parseGeneratedFiles("```html\n<!doctype html><h1>Hello</h1>\n```", "website"),
    { name: "Your website", files: { "index.html": "<!doctype html><h1>Hello</h1>\n" } },
  );
});

test("rejects unsafe generated file paths", () => {
  assert.throws(
    () => parseGeneratedFiles(response({ "../outside.txt": "no" }), "website"),
    /valid files/,
  );
});

test("prompts for platform-specific setup instructions", () => {
  assert.match(buildStudioPrompt("pwa", "A planner"), /offline behavior/);
  assert.match(buildStudioPrompt("android", "A planner"), /React Native/);
  assert.match(buildStudioPrompt("android", "A planner"), /app\.json/);
});

test("prompts for camera-overlay behavior across web, PWA, and native apps", () => {
  const websitePrompt = buildStudioPrompt("website", "A notes app", { cameraOverlay: true });
  const pwaPrompt = buildStudioPrompt("pwa", "A notes app", { cameraOverlay: true });
  const nativePrompt = buildStudioPrompt("android", "A notes app", { cameraOverlay: true });

  assert.match(websitePrompt, /getUserMedia/);
  assert.match(websitePrompt, /facingMode/);
  assert.match(pwaPrompt, /HTTPS or localhost/);
  assert.match(nativePrompt, /expo-camera CameraView/);
  assert.match(nativePrompt, /front\/rear camera switching/);
  assert.doesNotMatch(buildStudioPrompt("website", "A notes app"), /getUserMedia/);
});
