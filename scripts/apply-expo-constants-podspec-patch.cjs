/**
 * Applies patches/expo-constants+18.0.13.patch to expo-constants wherever npm
 * placed it (hoisted root or under expo/), so pod install always sees a patched podspec.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const patchFile = path.join(root, "patches", "expo-constants+18.0.13.patch");

const candidates = [
  path.join(root, "node_modules", "expo-constants"),
  path.join(root, "node_modules", "expo", "node_modules", "expo-constants"),
].filter((p) => fs.existsSync(path.join(p, "ios", "EXConstants.podspec")));

if (!candidates.length || !fs.existsSync(patchFile)) {
  process.exit(0);
}

for (const pkg of candidates) {
  const podspec = path.join(pkg, "ios", "EXConstants.podspec");
  if (!fs.existsSync(podspec)) continue;

  const src = fs.readFileSync(podspec, "utf8");
  if (src.includes("Quote PROJECT_ROOT")) {
    continue;
  }

  try {
    execFileSync("patch", ["-p1", "-i", patchFile], {
      cwd: pkg,
      stdio: "inherit",
    });
  } catch (e) {
    console.warn(
      `[apply-expo-constants-podspec-patch] patch failed for ${pkg} — iOS builds may fail if the project path contains spaces.`,
    );
  }
}
