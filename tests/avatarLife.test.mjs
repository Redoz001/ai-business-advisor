import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const source = await readFile(
  new URL("../src/features/avatar/AvatarLife.ts", import.meta.url),
  "utf8"
);
const { code } = await transform(source, { loader: "ts", format: "esm" });
const { AvatarLife } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);

test("rest pose keeps both arms lowered with a relaxed elbow bend", () => {
  const life = new AvatarLife();
  const pose = life.update({
    delta: 1 / 60,
    isSpeaking: false,
    isListening: false,
    isThinking: false,
    gesture: "none",
    personality: {
      breathingRate: 1,
      blinkFrequency: 3,
      gazeFrequency: 0.3,
      gestureFrequency: 0.3,
    },
  });

  assert.ok(pose.armLeft.z < 0, "left arm should rest below the model's T-pose");
  assert.ok(pose.armRight.z > 0, "right arm should rest below the model's T-pose");
  assert.equal(pose.shoulderLeft.z, 0);
  assert.equal(pose.shoulderRight.z, 0);
  assert.ok(pose.forearmLeft.x > 0);
  assert.ok(pose.forearmRight.x > 0);
});

test("idle hand fidgets flex the elbow and articulate the wrist", () => {
  const life = new AvatarLife(20260927);
  const context = {
    delta: 1 / 60,
    isSpeaking: false,
    isListening: false,
    isThinking: false,
    gesture: "none",
    personality: {
      breathingRate: 1,
      blinkFrequency: 3,
      gazeFrequency: 0.3,
      gestureFrequency: 0.3,
    },
  };
  let fidgetPose;

  for (let frame = 0; frame < 3600; frame += 1) {
    const pose = life.update(context);
    if (
      pose.activity === "hand-fidget" &&
      (!fidgetPose || pose.forearmRight.x > fidgetPose.forearmRight.x)
    ) {
      fidgetPose = pose;
    }
  }

  assert.ok(fidgetPose, "the idle scheduler should produce a hand fidget");
  assert.ok(fidgetPose.forearmRight.x > 0.25);
  assert.ok(Math.abs(fidgetPose.handRight.z) > 0.05);
});
