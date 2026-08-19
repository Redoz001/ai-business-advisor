import fs from "fs";

const filePath = "test_outputs/generated_video.webm";

try {
  const buffer = fs.readFileSync(filePath);
  const header = buffer.slice(0, 4).toString("ascii");
  const size = buffer.length;

  console.log("=== VIDEO FILE VERIFICATION ===");
  console.log(`File: ${filePath}`);
  console.log(`Size: ${size} bytes`);
  console.log(`Header: "${header}"`);

  // WebM files start with 0x1A45DFA3 (EBML magic)
  const isEBML = buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  console.log(`Valid EBML/WebM magic: ${isEBML ? "YES ✅" : "NO ❌"}`);

  // Check for WebM/VP8/VP9 codec markers
  const str = buffer.toString("latin1");
  const hasVP8 = str.includes("VP8");
  const hasVP9 = str.includes("VP9");
  const hasVP80 = str.includes("VP80");
  const hasVP90 = str.includes("VP90");
  console.log(`VP8 codec: ${hasVP8 || hasVP80 ? "YES" : "NO"}`);
  console.log(`VP9 codec: ${hasVP9 || hasVP90 ? "YES" : "NO"}`);

  if (isEBML) {
    console.log("\n✅ VALID WEBM VIDEO FILE");
  } else {
    console.log("\n❌ NOT A VALID WEBM FILE");
  }
} catch (err) {
  console.log(`❌ ERROR: ${err.message}`);
}