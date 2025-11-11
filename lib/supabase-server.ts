import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function getServerClient() {
  return createServerComponentClient({ cookies })
}

