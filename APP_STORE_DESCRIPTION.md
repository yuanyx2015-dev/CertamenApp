# CertamenPrep — App Store promotional text (iOS)

Draft listing copy for App Store Connect. Paste into the store listing; the app does not load this file at runtime. Keep this aligned with the live product when features change.

**Current app version (see `app.json`):** 1.1.1

**Privacy Policy URL (App Store Connect):** https://certamenprep.org/privacy/

---

## Promotional Text (170 characters max — appears at top)

Practice like it's real. Certamen-style toss-ups, 11 Roman ranks from Miles to Legatus Legionis, and review for what you miss.

*(Character count: 118)*

---

## App Store Description (Full)

**CertamenPrep — Practice like it's real.**

Helps middle and high school Certamen competitors practice with real toss-up pacing. Questions stream letter by letter. Buzz in, answer under a short timer, and build lasting knowledge by mastering what you get right.

Study six areas of Certamen content: Mythology, History, Language, Literature, Culture & Life, and Living Latin.

**CHALLENGE MODE**
Your main progression path. Play sets of 10 to 50 questions from your current rank pool. Hold the star on a correct answer to mark it mastered. Misses go to Review. Play at least one Challenge question each day to keep your streak.

**ELEVEN ROMAN RANKS**
Progress by mastering questions, not by racking up points. Climb from Miles to Legatus Legionis:

• Miles
• Cornicen
• Signifer
• Optio
• Centurio
• Aquilifer
• Primus Pilus
• Praefectus Castrorum
• Tribunus Angusticlavius
• Tribunus Laticlavius
• Legatus Legionis

**REVIEW MODE**
Work through questions you missed in Challenge. Master them here to clear them from your wrong list and count them toward your progress. Browse wrongs by category, and use Explain with AI when you want a clear walkthrough. Follow-up questions with the AI Tutor are limited to keep help focused.

**PRACTICE MODE**
Warm up in any category without filling your Review list. Choose Easy, Medium, or Hard and set how many questions you want. Practice does not advance your daily streak.

**HOME**
See your current rank, progress, mastered count, questions left to review, and streak at a glance. Jump into your Daily Challenge when you are ready.

**SIGN IN**
Sign in with Google or Apple (iOS) to save progress in the cloud, or continue as a guest to try Practice first. Delete your account anytime from Home. Privacy questions: support@certamenprep.org

Free to use. No ads. No in-app purchases.

---

## Keywords (100 characters max)

Latin,Certamen,quiz,Roman,mythology,history,language,literature,study,competition,education

*(Character count: 95 — Apple uses commas; avoid spaces after commas if you need room)*

---

## What's New (paste when shipping an update)

Version 1.1.1
• Privacy and compliance updates for AI explanations and the AI Tutor
• App Store readiness fixes (permissions, version sync, export compliance)

Version 1.1.0
• Eleven mastery ranks from Miles to Legatus Legionis
• Challenge Mode with Certamen-style streaming and buzz timing
• Review Mode for missed questions, plus AI explanations
• Practice Mode by category that does not fill your Review list
• Daily Challenge streak on Home
• Sign in with Google or Apple, or continue as a guest

---

## Promotional Screenshot Captions (30 characters each)

1. "Buzz in like real Certamen"
2. "Climb 11 Roman ranks"
3. "Master what you miss"
4. "Six Certamen categories"
5. "Track streak and progress"

---

## Short Tagline (official)

**Practice like it's real.**

Also used on the marketing site hero/footer and the in-app login screen.

Previous alternatives (retired):
1. "Certamen practice, letter by letter"
2. "From Miles to Legatus Legionis"
3. "Master the toss-up"
4. "Study Certamen with purpose"
5. "Buzz. Answer. Master. Rise."

---

## Age Rating Justification

**Recommended age rating questionnaire answers for this release:**
- Educational / historical and mythological content only (no violence, gambling, unrestricted web, etc.)
- **Unrestricted web access:** No
- **User-generated content:** Limited — users may type short free-text follow-ups to the AI Tutor (educational, rate-limited). There is no public feed, chat between users, or social posting.
- **AI-generated content:** Yes — optional Gemini explanations and tutor replies scoped to Certamen / Latin study topics.

Re-answer the age rating questionnaire in App Store Connect before submit if it still reflects a pre-AI build. Live listing is currently **4+**; keep or adjust based on ASC’s AI / free-text prompts for your region.

---

## Support URL

https://github.com/yuanyx2015-dev/CertamenApp

**Privacy Policy URL:** https://certamenprep.org/privacy/

**Support email:** support@certamenprep.org

---

## Privacy Policy Summary

CertamenPrep collects minimal user data:
- Name and email via Google or Apple Sign-In
- Quiz performance, mastery, and streak statistics
- Optional AI prompts (Explain with AI / AI Tutor follow-ups) processed via Google Gemini
- No data is sold to third parties; no advertising or cross-app tracking
- Users can delete their account and all data from Home, or email support@certamenprep.org
- Data is stored with Supabase

Full policy: https://certamenprep.org/privacy/ (source: `PRIVACY.md`)

### App Privacy Nutrition Labels (ASC checklist)

Declare what you actually collect (linked to identity / account):

| Category | Examples in this app | Notes |
|----------|----------------------|--------|
| Contact Info | Name, email | From Google / Apple Sign-In |
| User Content | AI Tutor free-text prompts; wrong-question review content | Not used for tracking |
| Usage Data / Product Interaction | Mastery, streaks, practice/challenge history, AI usage limits | App functionality |
| Identifiers | User ID | Account linkage in Supabase |

Do **not** declare tracking. Do **not** declare photos, microphone, camera, or precise location — the app does not use them.

---

## Export Compliance

Uses only standard HTTPS / OS cryptography (Supabase, Google, Apple, Gemini over TLS).  
`ITSAppUsesNonExemptEncryption` is set to `false` in `app.json` / `Info.plist` so ASC can skip the detailed encryption questionnaire for typical HTTPS-only apps.

---

## Category Selection

**Primary Category:** Education
**Secondary Category:** Games > Educational

---

## Notes for Submission

- Internet connection required for authentication, questions, progress, and AI features
- Content is family-friendly and educational
- Free app: no in-app purchases or subscriptions
- No ads
- Guest Mode allows Practice without an account; Challenge, Review, and cloud progress require sign-in
- Apple Sign-In is offered on iOS alongside Google
- Signing Team ID (canonical): `YY545WKA4Y` — matches Sign in with Apple config; override locally with `APPLE_TEAM_ID` if needed
- Refresh App Store screenshots if Practice/Home UI changed since the current listing assets
- Redeploy marketing site privacy page after updating `CertamenApp Web/privacy/index.html` so ASC URL stays current
