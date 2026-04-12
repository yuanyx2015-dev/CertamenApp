/**
 * Expo's CLI treats Sign in with Apple like a capability that still requires
 * development certificates even for iOS Simulator (see simulatorCodeSigning).
 * That blocks `expo run:ios` without an Apple Development cert. For local
 * simulator work, we drop SIWA from that check only. Xcode still signs the
 * simulator app; use a real Team in Xcode before device / TestFlight builds.
 *
 * Idempotent; safe to run after every npm install.
 */
const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo",
  "node_modules",
  "@expo",
  "cli",
  "build",
  "src",
  "run",
  "ios",
  "codeSigning",
  "simulatorCodeSigning.js",
);

if (!fs.existsSync(target)) {
  process.exit(0);
}

let src = fs.readFileSync(target, "utf8");
if (src.includes("CERTAMEN_PATCH_SIWA_SIMULATOR")) {
  process.exit(0);
}

const before = `const ENTITLEMENTS_THAT_REQUIRE_CODE_SIGNING = [
    'com.apple.developer.associated-domains',
    'com.apple.developer.applesignin'
];`;

const after = `// CERTAMEN_PATCH_SIWA_SIMULATOR: do not require dev certs for simulator solely because of SIWA (Expo default).
const ENTITLEMENTS_THAT_REQUIRE_CODE_SIGNING = [
    'com.apple.developer.associated-domains'
];`;

if (!src.includes(before)) {
  console.warn(
    "[patch-expo-cli-simulator-code-signing] Expected pattern not found; @expo/cli may have changed. Skip.",
  );
  process.exit(0);
}

fs.writeFileSync(target, src.replace(before, after));
