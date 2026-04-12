# Supabase OAuth setup (Google)

The app uses **Google OAuth** via `expo-auth-session` and `signInWithOAuth`. Sign in with Apple is **not** wired in the client right now.

## Prerequisites

1. A Supabase account (https://supabase.com)
2. A Google Cloud project with OAuth credentials

## Step 1: Supabase project

1. Create a project at https://supabase.com
2. **Settings → API**: copy **Project URL** and **anon public** key into `lib/supabase.ts`

## Step 2: Enable Google in Supabase

1. **Authentication → Providers → Google**
2. Enable the provider and add **Client ID** / **Client Secret** from Google Cloud Console (see below)
3. Add redirect URLs your app uses (see your app logs for the exact `makeRedirectUri` value), e.g.:
   - `certamenapp://auth/callback`
   - Development URLs as needed for Expo

## Step 3: Google Cloud OAuth

1. [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials**
2. **Create credentials → OAuth client ID** (configure consent screen if prompted)
3. Type **Web application** (Supabase callback is server-side)
4. **Authorized redirect URIs** must include:
   - `https://<your-project-ref>.supabase.co/auth/v1/callback`
5. Copy **Client ID** and **Client Secret** into Supabase’s Google provider settings

## Step 4: Deep linking

The app scheme is `certamenapp` (see `app.json`). Redirect handling is implemented in `services/authService.ts` (`makeRedirectUri` + `openAuthSessionAsync`).

## Testing

1. Run the app and use **Sign in with Google**
2. Complete Google in the browser sheet; you should return to the app with a session

## Notes

- Do not commit production secrets to public repos; prefer env-based config for production builds
- Supabase **Apple** provider can stay disabled until you add Sign in with Apple again in the app
