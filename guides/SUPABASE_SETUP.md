# Supabase OAuth setup (Google + Apple)

The app uses **Google OAuth** (`signInWithOAuth` + in-app browser) and **native Sign in with Apple** (`expo-apple-authentication` + `signInWithIdToken`). Public IDs live in `constants/appleAuth.ts` (must match Apple Developer + Supabase).

## Prerequisites

1. A Supabase account (https://supabase.com)
2. Google Cloud OAuth credentials (for Google)
3. Apple Developer: App ID `com.ziyouyuan.certamenapp` with **Sign In with Apple**, Services ID `com.ziyouyuan.certamenapp.siwa`, and a **Key** (.p8) for the Supabase Apple provider secret JWT

## Step 1: Supabase project

1. Create a project at https://supabase.com
2. **Settings → API**: copy **Project URL** and **anon public** key into `lib/supabase.ts`

## Step 2: Enable Google in Supabase

1. **Authentication → Providers → Google**
2. Enable the provider and add **Client ID** / **Client Secret** from Google Cloud Console
3. Add redirect URLs your app uses (see logs for `makeRedirectUri`), e.g. `certamenapp://auth/callback`

## Step 3: Google Cloud OAuth

1. [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials**
2. **OAuth client ID** → type **Web application**
3. **Authorized redirect URIs** must include:
   - `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Copy **Client ID** and **Client Secret** into Supabase Google provider settings

## Step 4: Enable Apple in Supabase

1. **Authentication → Providers → Apple** → Enable
2. **Client ID (Services ID):** `com.ziyouyuan.certamenapp.siwa`
3. **Team ID**, **Key ID**, **Private Key** (.p8) — same key you use to generate the **client secret JWT** (see `scripts/generate-apple-client-secret.cjs`)
4. **Secret key:** paste a JWT generated from the .p8 (regenerate before ~6 months expiry)

Apple **Services ID** must list your Supabase domain and **Return URL**:

- `https://wacgrqymaxoosciypebm.supabase.co/auth/v1/callback`  
  (or `${SUPABASE_URL}/auth/v1/callback` from `lib/supabase.ts`)

## Step 5: Native iOS app

- **Bundle ID** in Xcode / `app.json` must be `com.ziyouyuan.certamenapp` (same as App ID).
- Use a **development build** or **EAS/TestFlight** — **Expo Go does not include** native Apple Authentication.

## Step 6: Deep linking (Google)

The app scheme is `certamenapp`. Google redirect handling is in `services/authService.ts`.

## Testing

- **Google:** Sign in with Google from the login screen.
- **Apple:** On a **physical iPhone** with a dev or store build; Simulator support is limited.

## Notes

- Do not commit `.p8` files or generated JWT secrets to git.
- Regenerate the Apple client-secret JWT before it expires.
