/**
 * Runs `expo run:ios` against an iPhone Simulator so local builds do not require
 * physical-device code signing.
 *
 * Before handing off to Expo we make sure a simulator is actually booted and in
 * the foreground. Otherwise the final launch step (`xcrun simctl openurl ...`)
 * races SpringBoard and times out with "code: 60 Operation timed out", even
 * though the app built and installed fine.
 *
 * Prefers an already-booted iPhone sim, else the first available one.
 * Extra CLI args are forwarded, e.g. npm run ios -- --no-bundler
 */
const { execSync, spawnSync } = require("child_process");

function pickIPhoneSimulator() {
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
  const iphones = [];
  let booted = null;

  for (const line of lines) {
    const m = line.match(
      /^\s*(.+?)\s+\(([0-9A-F-]+)\)\s+\((Booted|Shutdown|Shutting Down)\)/i,
    );
    if (!m) continue;
    const name = m[1].trim();
    const udid = m[2];
    const state = m[3].toLowerCase();
    if (!name.includes("iPhone")) continue;
    const device = { name, udid, state };
    if (state === "booted") booted = device;
    iphones.push(device);
  }

  return booted || iphones[0] || null;
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "inherit", env: process.env, ...opts });
}

const sim = pickIPhoneSimulator();
if (!sim) {
  console.error(
    "No iPhone simulator found. Open Xcode → Window → Devices and Simulators → Simulators and add an iOS runtime.",
  );
  process.exit(1);
}

console.error(`\n› Using iOS Simulator: ${sim.name} (${sim.udid})\n`);

// Bring the Simulator app to the foreground so it can service openurl.
run("open", ["-a", "Simulator"]);

// Boot the device if it isn't already (ignore "already booted" errors).
if (sim.state !== "booted") {
  console.error("› Booting simulator...");
  spawnSync("xcrun", ["simctl", "boot", sim.udid], { env: process.env });
}

// Wait until the device is fully booted before Expo tries to launch the app.
console.error("› Waiting for simulator to finish booting...");
run("xcrun", ["simctl", "bootstatus", sim.udid, "-b"]);

const extra = process.argv.slice(2);
const result = run("npx", ["expo", "run:ios", "-d", sim.udid, ...extra]);

process.exit(result.status === null ? 1 : result.status);
