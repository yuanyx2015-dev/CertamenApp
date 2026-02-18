# Supabase Google Authentication Setup

## Prerequisites
1. A Supabase account (sign up at https://supabase.com)
2. A Google Cloud Console project for OAuth credentials

## Step 1: Set up Supabase Project
1. Go to https://supabase.com and create a new project
2. Once created, go to your project settings
3. Navigate to **API** section
4. Copy your:
   - **Project URL** (looks like: `https://xxxx.supabase.co`)
   - **Anon/Public Key** (starts with `eyJ...`)

## Step 2: Configure Supabase Credentials
1. Open `lib/supabase.ts`
2. Replace the empty strings with your credentials:
   ```typescript
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key-here';
   ```

## Step 3: Enable Google OAuth in Supabase
1. In your Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Google** in the list and click to configure
3. Enable Google provider
4. Add the following redirect URLs in Supabase:
   - For development with Expo Go: `exp://192.168.x.x:8081/--/auth/callback` (replace x.x with your local IP)
   - For standalone app: `certamenapp://auth/callback`
   - **Important:** Get your exact redirect URL by running the app and checking the console log
5. You'll need Google OAuth credentials (see Step 4)

## Step 4: Set up Google OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client IDs**
5. Configure the OAuth consent screen if prompted
6. For application type, select **Web application**
7. Add authorized redirect URIs:
   - `https://your-project.supabase.co/auth/v1/callback`
   - For development: `exp://192.168.x.x:8081/--/auth/callback` (optional, for testing)
   - For standalone: `certamenapp://auth/callback` (optional, for production)
8. Copy the **Client ID** and **Client Secret**
9. Add these to your Supabase Google provider settings

## Step 5: Configure Deep Linking (for mobile)
1. In `components/LoginScreen.tsx`, update the `redirectTo` URL:
   ```typescript
   redirectTo: 'certatio://auth/callback', // Replace 'certatio' with your app scheme
   ```
2. Configure your app's deep linking in `app.json` or platform-specific files

## Step 6: Install Required Packages
Make sure you have the Supabase client installed:
```bash
npm install @supabase/supabase-js
# or
yarn add @supabase/supabase-js
```

## Testing
After setup:
1. Run your app
2. Click the Gmail login button
3. You'll be redirected to Google sign-in
4. After successful login, you'll be redirected back to your app

## Notes
- Keep your Supabase credentials secure and never commit them to public repositories
- Consider using environment variables for production apps
- The anon key is safe to use in client-side code as Supabase has Row Level Security (RLS)
