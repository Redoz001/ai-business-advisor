import test from "node:test";
import assert from "node:assert/strict";

import {
  enhanceVisualPrompt,
  buildMotionPromptVariants,
} from "../src/services/visualPrompting.js";

test("enhanceVisualPrompt adds cinematic, high-quality detail for image requests", () => {
  const result = enhanceVisualPrompt("futuristic city skyline", "image");

  assert.match(result, /futuristic city skyline/i);
  assert.match(result, /cinematic|ultra[- ]?detailed|high[- ]?quality|photorealistic/i);
});

test("enhanceVisualPrompt handles empty or non-string input safely", () => {
  assert.match(enhanceVisualPrompt("", "VIDEO"), /video-quality/i);
  assert.match(enhanceVisualPrompt(null, "video"), /video-quality/i);
  assert.match(enhanceVisualPrompt(12345, "image"), /12345/i);
});

test("buildMotionPromptVariants creates multiple motion-aware prompts for video", () => {
  const variants = buildMotionPromptVariants("sunset over the ocean", 4);

  assert.equal(variants.length, 4);
  assert.ok(variants.every((variant) => /sunset|ocean|cinematic|motion|dynamic|ambient/i.test(variant)));
});

test("buildMotionPromptVariants rounds invalid and fractional counts safely", () => {
  const variants = buildMotionPromptVariants("sunset over the ocean", 3.9);

  assert.equal(variants.length, 3);
  assert.ok(variants.every((variant) => /sunset|ocean/i.test(variant)));
});
