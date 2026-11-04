// The project has two Supabase variable sets. The `storage_`-prefixed set points to the clinic's
// database, so it takes priority; the unprefixed set is only a fallback. Each must be a literal
// `process.env.NEXT_PUBLIC_*` reference to be inlined for the browser.
export const supabaseUrl =
  process.env.NEXT_PUBLIC_storage_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''

export const supabaseKey =
  (process.env.NEXT_PUBLIC_storage_SUPABASE_URL
    ? process.env.NEXT_PUBLIC_storage_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_storage_SUPABASE_PUBLISHABLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) || ''

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)
