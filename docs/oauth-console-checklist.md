# OAuth redirect checklist (Supabase + Google)

Do these in the **dashboards** (not in this repo). Required so Google sign-in can return to the app after authorization.

## Supabase (project: matches `lib/supabase.ts`)

1. **Authentication → URL configuration**
   - **Redirect URLs**: add  
     `certamenapp://auth/callback`  
     (and keep any existing `https://…` entries your project already uses.)
2. **Authentication → Providers → Google**  
   - Ensure Google is enabled and Client ID / secret match **Google Cloud Console** (same OAuth client you use for web/mobile as configured in Supabase).

## Google Cloud Console

1. Open the **OAuth 2.0 Client** used with Supabase (often “Web application” for the Supabase callback).
2. **Authorized redirect URIs** must include Supabase’s callback, typically:  
   `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`  
   (exact value is shown in Supabase → Authentication → Providers → Google, or in the OAuth URL flow.)

If the Google client’s redirect URIs do not include Supabase’s `/auth/v1/callback`, Google login will fail after account selection.

## After changes

Rebuild or reinstall the app if you change native URL schemes; no native scheme change is required for the steps above if you already use `certamenapp`.
