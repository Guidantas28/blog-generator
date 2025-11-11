import { redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase-server'

export default async function Home() {
  const supabase = await getServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    redirect('/dashboard')
  } else {
    redirect('/auth')
  }
}

