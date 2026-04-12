/**
 * Extends app.json so local iOS signing can use APPLE_TEAM_ID (10-character Team ID).
 * Set in `.env.local` (gitignored), e.g. APPLE_TEAM_ID=ABCD123456
 * Find it: Xcode → Settings → Accounts → your team → Team ID, or developer.apple.com → Membership.
 */
const appJson = require("./app.json");

module.exports = () => {
  const team = process.env.APPLE_TEAM_ID?.trim();
  return {
    ...appJson,
    expo: {
      ...appJson.expo,
      ios: {
        ...appJson.expo.ios,
        ...(team ? { appleTeamId: team } : {}),
      },
    },
  };
};
