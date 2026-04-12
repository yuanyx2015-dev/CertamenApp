/**
 * Runs `expo run:ios` against an iPhone Simulator so local builds do not require
 * physical-device code signing. Prefers a booted iPhone sim, else the first listed.
 *
 * Extra CLI args are forwarded, e.g. npm run ios -- --no-bundler
 */
const { execSync, spawnSync } = require("child_process");

function pickIPhoneSimulatorName() {
  let out;
  try {
    out = execSync("xcrun simctl list devices available", {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (e) {
    console.error(e.message);
    return null;
  }

  const lines = out.split("\n");
  const iphoneNames = [];
  let booted = null;

  for (const line of lines) {
    const m = line.match(
      /^\s*(.+?)\s+\(([0-9A-F-]+)\)\s+\((Booted|Shutdown|Shutting Down)\)/i,
    );
    if (!m) continue;
    const name = m[1].trim();
    const state = m[3].toLowerCase();
    if (!name.includes("iPhone")) continue;
    if (state === "booted") booted = name;
    iphoneNames.push(name);
  }

  return booted || iphoneNames[0] || null;
}

const sim = pickIPhoneSimulatorName();
if (!sim) {
  console.error(
    "No iPhone simulator found. Open Xcode → Window → Devices and Simulators → Simulators and add an iOS runtime.",
  );
  process.exit(1);
}

console.error(`\n› Using iOS Simulator: ${sim}\n`);

const extra = process.argv.slice(2);
const result = spawnSync(
  "npx",
  ["expo", "run:ios", "-d", sim, ...extra],
  { stdio: "inherit", env: process.env },
);

process.exit(result.status === null ? 1 : result.status);
