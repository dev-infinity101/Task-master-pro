# 🛠️ Supabase AI Backend Setup Guide

Follow these steps to ensure your Edge Functions, OpenRouter API, and Authentication are correctly configured.

## 1. Set Edge Function Secrets
Supabase Edge Functions cannot read your frontend `.env` file. You must set these secrets in the Supabase Dashboard.

**Location:** `Supabase Dashboard` > `Settings` > `Edge Functions` > `Add New Secret`

| Key | Value |
| :--- | :--- |
| `OPENROUTER_API_KEY` | Your `sk-or-v1-...` key |
| `OPENROUTER_MODEL` | e.g., `arcee-ai/trinity-large-preview:free` |
| `OPENROUTER_SITE_URL` | `https://task-master-v2-three.vercel.app` |
| `OPENROUTER_APP_NAME` | `TaskMaster Pro` |

> [!IMPORTANT]
> Do NOT manually add `SUPABASE_URL` or `SUPABASE_ANON_KEY`. Supabase injects these automatically.

---

## 2. Deploy with Correct Flags
When deploying your function from the terminal, use the `--no-verify-jwt` flag. 

**Why?** Our function handles its own JWT verification internally via the `jose` library to provide more detailed error messages (like "Session Expired") instead of a generic 401.

```bash
# Run this from your project root
supabase functions deploy ai-assistant --no-verify-jwt
```

---

## 3. Configure Auth Redirects
Ensure Supabase knows which URLs are safe to redirect to after sign-up or login.

**Location:** `Authentication` > `URL Configuration`

1. **Site URL:** `https://task-master-v2-three.vercel.app`
2. **Redirect URLs:**
   - `http://localhost:5173/**`
   - `https://task-master-v2-three.vercel.app/**`

---

## 4. Database RLS Policies
For Realtime sync to work, your tables must have `SELECT` policies.

**Example for `tasks` table:**
```sql
CREATE POLICY "Users can view own tasks" 
ON public.tasks FOR SELECT 
USING (auth.uid() = user_id);
```
*Repeat this for the `projects` and `columns` tables.*

---

## 5. Verify Setup
Use the `test-backend.html` tool to verify each layer:
1. **Test 1:** Checks if your OpenRouter Key is valid.
2. **Test 2:** Checks if the Edge Function can talk to OpenRouter.
3. **Test 3:** Checks if the WebSocket connection is successful.

SUMMARY OF WORKING BACKEND AND REALTIME AI WEBSOCKETS:
1. The Core Infrastructure (
supabase.js
)
We stripped away "advanced" settings that were actually causing conflicts.

Minimal Config: We removed flowType: 'pkce', storageKey, and top-level JS realtime timeouts.
Why it worked: Supabase's Realtime client relies on a Shared WebSocket. By using the default storageKey, the Realtime client can "see" the user's JWT in localStorage automatically. If we change the key, the Auth module saves the token in one place, but the Realtime module looks in another, resulting in a 401 Unauthorized because it thinks the user is anonymous.
2. The Authentication Flow (

useAuth.js
)
We moved from a "sequential" flow to a "parallel/non-blocking" flow.

Non-Blocking Profile: Previously, the app waited for the profiles table to return data before clearing the loading screen. If the database was slow or the query failed, you got stuck on "Synchronizing Data" forever.
Fire-and-Forget: Now, 

setSession()
 clears the loader instantly as soon as the account is verified. The profile (full name, avatar) loads in the background safely. Even if the profile fails, the dashboard remains functional.
3. Realtime & WebSocket Stability (

useRealtimeSync.js
)
This was the most critical fix for the "WebSocket Storm."

Stable Channel Names: We removed Date.now() from channel names.
Why it worked: If a name is stable (e.g., tasks:pid:123), the Supabase SDK can reuse the existing WebSocket connection when you switch projects or refresh. With the timestamp, every single change forced the browser to open a brand-new, heavy WebSocket connection, which overwhelmed the browser and the server.
Handling CHANNEL_ERROR: We stopped retrying on auth errors. The Supabase SDK has its own internal listener; when the token refreshes, the SDK automatically re-authenticates its own channels. Our hook now just stays quiet and lets the SDK do its job.
4. Edge Function Auth (

ai-assistant/index.ts
)
We moved from manual "DIY" verification to the "Official" pattern.

Built-in Verification: We removed the jose library and the need for a manual JWT_SECRET.
The Pattern: The function now uses supabase.auth.getUser(). When your frontend calls the AI function, it sends the user's JWT in the header. The Edge Function then asks the Supabase Auth API: "Is this badge valid?"
Result: This is 100% reliable because it uses the exact same authentication engine as the rest of the Supabase ecosystem, eliminating any chance of a "Secret Key" mismatch.
5. UI Failsafe (

ProtectedRoute.jsx
)
The 4-Second Rule: We added a hard timeout to the global loader.
Why it worked: In production, networks are unpredictable. If the Supabase session check hangs for more than 4 seconds, the app now automatically falls back to the Login page instead of leaving the user staring at a spinning hourglass.
Summary of the "Working Flow"
User Logs In: 

useAuth
 saves the session and immediately unlocks the UI.
Socket Connects: The Realtime client reads the token from the default storage location and opens a single, stable WebSocket.
AI Request: The frontend sends the fresh JWT to the Edge Function.
Edge Verification: The Edge Function validates the JWT via the official Auth API (no manual keys needed) and streams the response.
Sync: As tasks are changed, the stable WebSocket receives tiny "Postgres Changes" packets, keeping the UI "Live" without constant refreshes.
Everything is now running on standard, production-hardened Supabase patterns.
