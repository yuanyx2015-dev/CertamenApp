/**
 * Generates Apple's OAuth client secret (JWT, ES256) for Supabase / Apple provider.
 * Env: APPLE_TEAM_ID (10 chars), APPLE_CLIENT_ID (Services ID), APPLE_KEY_ID (optional, default from key name)
 * Arg: path to AuthKey_XXXXXXXXXX.p8
 *
 * @see https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
 */
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const p8Path = process.argv[2];
const teamId = process.env.APPLE_TEAM_ID?.trim();
const clientId = process.env.APPLE_CLIENT_ID?.trim();
const keyId =
  process.env.APPLE_KEY_ID?.trim() ||
  (p8Path ? path.basename(p8Path, ".p8").replace(/^AuthKey_/, "") : "");

if (!p8Path || !fs.existsSync(p8Path)) {
  console.error("Usage: APPLE_TEAM_ID=... APPLE_CLIENT_ID=... node scripts/generate-apple-client-secret.cjs /path/to/AuthKey_XXX.p8");
  process.exit(1);
}
if (!teamId || !clientId) {
  console.error("Set APPLE_TEAM_ID and APPLE_CLIENT_ID (your Services ID).");
  process.exit(1);
}
if (!keyId) {
  console.error("Could not derive Key ID; set APPLE_KEY_ID.");
  process.exit(1);
}

const privateKey = fs.readFileSync(p8Path, "utf8");
const now = Math.floor(Date.now() / 1000);
// Apple allows max 6 months for this JWT
const exp = now + 86400 * 180;

const payload = {
  iss: teamId,
  iat: now,
  exp,
  aud: "https://appleid.apple.com",
  sub: clientId,
};

const token = jwt.sign(payload, privateKey, {
  algorithm: "ES256",
  keyid: keyId,
});

console.log(token);
