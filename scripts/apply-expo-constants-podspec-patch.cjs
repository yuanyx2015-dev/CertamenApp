/**
 * Applies patches/expo-constants+18.0.13.patch to the nested expo-constants
 * package (expo/node_modules/expo-constants). patch-package does not apply
 * there by default because the package is not hoisted to node_modules root.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const pkg = path.join(root, "node_modules", "expo", "node_modules", "expo-constants");
const podspec = path.join(pkg, "ios", "EXConstants.podspec");
const patchFile = path.join(root, "patches", "expo-constants+18.0.13.patch");

if (!fs.existsSync(podspec) || !fs.existsSync(patchFile)) {
  process.exit(0);
}

const src = fs.readFileSync(podspec, "utf8");
if (src.includes("Quote PROJECT_ROOT")) {
  process.exit(0);
}

try {
  execFileSync("patch", ["-p1", "-i", patchFile], {
    cwd: pkg,
    stdio: "inherit",
  });
} catch (e) {
  console.warn(
    "[apply-expo-constants-podspec-patch] patch failed — iOS builds may fail if the project path contains spaces.",
  );
  process.exit(0);
}
