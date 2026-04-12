/**
 * Extends app.json so local iOS signing can use APPLE_TEAM_ID (10-character Team ID).
 * Set in `.env.local` (gitignored), e.g. APPLE_TEAM_ID=ABCD123456
 * Find it: Xcode → Settings → Accounts → your team → Team ID, or developer.apple.com → Membership.
 *
 * Canonical iOS bundle ID (must match app.json expo.ios.bundleIdentifier and the App ID
 * in Apple Developer → Certificates, Identifiers & Profiles): com.ziyouyuan.certamenapp
 * If you have an extra App ID registered by mistake, leave it unused; do not change this
 * string unless you intentionally ship under a new app identity.
 */
const appJson = require("./app.json");

/** Default matches `constants/appleAuth.ts` / Apple Developer Membership. Override with APPLE_TEAM_ID. */
const DEFAULT_APPLE_TEAM_ID = "YY545WKA4Y";

module.exports = () => {
  const team =
    process.env.APPLE_TEAM_ID?.trim() || DEFAULT_APPLE_TEAM_ID;
  return {
    ...appJson,
    expo: {
      ...appJson.expo,
      ios: {
        ...appJson.expo.ios,
        appleTeamId: team,
      },
    },
  };
};
