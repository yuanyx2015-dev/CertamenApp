# Supabase OAuth Authentication Setup (Google & Apple)

## Prerequisites
1. A Supabase account (sign up at https://supabase.com)
2. A Google Cloud Console project for OAuth credentials (for Google login)
3. An Apple Developer account with configured Sign in with Apple service (for Apple login)

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
   redirectTo: 'certamenapp://auth/callback', // Your app scheme from app.json
   ```
2. Configure your app's deep linking in `app.json` or platform-specific files

## Step 6: Enable Apple OAuth in Supabase
1. In your Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Apple** in the list and click to configure
3. Enable Apple provider
4. You'll need to provide:
   - **Services ID** (your Client ID from Apple)
   - **Team ID** (from your Apple Developer account)
   - **Key ID** (from the private key you created)
   - **Private Key** (the .p8 file content you downloaded from Apple)
5. Add the same redirect URLs as Google:
   - For development with Expo Go: `exp://192.168.x.x:8081/--/auth/callback`
   - For standalone app: `certamenapp://auth/callback`

## Step 7: Set up Apple Sign In with Apple
1. Go to [Apple Developer Console](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles**
3. **Create an App ID:**
   - Click **Identifiers** → **+** button
   - Select **App IDs** and click **Continue**
   - Fill in the Description and Bundle ID (e.g., `com.yourcompany.certamenapp`)
   - Check **Sign in with Apple** capability
   - Click **Continue** and **Register**
4. **Create a Services ID:**
   - Click **Identifiers** → **+** button
   - Select **Services IDs** and click **Continue**
   - Fill in Description and Identifier (e.g., `com.yourcompany.certamenapp.client`)
   - Check **Sign in with Apple** and click **Configure**
   - Add your primary domain and return URLs:
     - Domain: `your-project.supabase.co` (your Supabase project URL without https://)
     - Return URLs: `https://your-project.supabase.co/auth/v1/callback`
   - Click **Save**, then **Continue**, then **Register**
   - **Note:** This Services ID is your **Client ID** for Supabase
5. **Create a Private Key:**
   - Click **Keys** → **+** button
   - Enter a name (e.g., "Sign in with Apple Key")
   - Check **Sign in with Apple** and click **Configure**
   - Select your App ID created in step 3
   - Click **Save**, then **Continue**, then **Register**
   - Download the `.p8` file (you can only download this once!)
   - Note the **Key ID** shown on the download page
6. **Get your Team ID:**
   - In the Apple Developer Console, your Team ID is shown in the top right corner
7. **Add credentials to Supabase:**
   - Go back to Supabase dashboard → **Authentication** → **Providers** → **Apple**
   - Enter the **Services ID** (Client ID) from step 4
   - Enter your **Team ID** from step 6
   - Enter the **Key ID** from step 5
   - Open the `.p8` file in a text editor and copy the entire content (including BEGIN/END lines)
   - Paste it into the **Private Key** field
   - Click **Save**

## Step 8: Install Required Packages
Make sure you have the Supabase client installed:
```bash
npm install @supabase/supabase-js
# or
yarn add @supabase/supabase-js
```

## Testing
After setup:
1. Run your app
2. Click the Gmail or Apple login button
3. You'll be redirected to Google/Apple sign-in
4. After successful login, you'll be redirected back to your app

## Notes
- Keep your Supabase credentials secure and never commit them to public repositories
- Keep your Apple private key (.p8 file) secure and never share it
- Consider using environment variables for production apps
- The anon key is safe to use in client-side code as Supabase has Row Level Security (RLS)
- Apple Sign In requires testing on a real device or simulator with iOS 13+
- For development, you may need to add your local development URLs to Apple's return URLs