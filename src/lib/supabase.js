/**
 * supabase.js — Supabase singleton client
 *
 * IMPORTANT — keep this config minimal.
 *
 * Things we deliberately do NOT set:
 *  - flowType: 'pkce'     → PKCE delays Realtime JWT acquisition → 401 on
 *                           /realtime/v1/websocket. Default implicit flow is
 *                           correct for email + password auth on this stack.
 *  - storageKey           → Custom key breaks the Realtime client's session
 *                           lookup (it reads from the storage key to get the
 *                           access_token for channel auth). Use the default.
 *  - timeout / heartbeatIntervalMs at realtime: top level → these are channel-
 *                           level options in supabase-js v2, not client-level.
 *                           Passing them here malforms the RealtimeClientOptions
 *                           object and produces a misconfigured socket.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,   // survive page reloads
      autoRefreshToken: true,   // SDK refreshes JWT before expiry
      detectSessionInUrl: true,   // pick up #access_token from email links
    },
  })
  : null
