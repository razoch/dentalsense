import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { supabaseUrl } from './env'

// Login is bypassed for the demo, so the server acts on behalf of the clinic's first active staff member.
// The service key must come from the same variable set as `supabaseUrl`, or every query is rejected.
const serviceRoleKey =
  (process.env.NEXT_PUBLIC_storage_SUPABASE_URL
    ? process.env.storage_SUPABASE_SERVICE_ROLE_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY) ?? ''

export function createAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function getDemoStaff() {
  const supabase = createAdminClient()
  const { data: staff, error } = await supabase
    .from('staff')
    .select('id, full_name, role, is_active')
    .eq('is_active', true)
    .order('full_name')
    .limit(1)
    .maybeSingle()
  if (error) console.error('Demo staff lookup failed:', error.message)
  return { supabase, staff }
}
