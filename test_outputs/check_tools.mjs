import { execSync } from "child_process";

function check(tool) {
  try {
    const result = execSync(`where ${tool} 2>nul || where "${tool}" 2>nul`, { encoding: "utf8" });
    console.log(`${tool}: FOUND -> ${result.trim().split("\n")[0]}`);
    return true;
  } catch {
    console.log(`${tool}: NOT FOUND`);
    return false;
  }
}

console.log("=== Deploy Tool Check ===");
check("git");
check("supabase");
check("vercel");
check("npx");

// Also check for git in common install locations
const fs = await import("fs");
const paths = [
  "C:/Program Files/Git/bin/git.exe",
  "C:/Program Files (x86)/Git/bin/git.exe",
  "C:/Program Files/Git/cmd/git.exe",
  "C:/Users/redoz/AppData/Local/Programs/Git/bin/git.exe",
];

for (const p of paths) {
  if (fs.existsSync(p)) {
    console.log(`git FOUND at: ${p}`);
    break;
  }
}

// Check npx available
try {
  const npxCheck = execSync("npx --version", { encoding: "utf8" });
  console.log(`npx version: ${npxCheck.trim()}`);
} catch {
  console.log("npx NOT FOUND");
}