import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Endpoint de teste para verificar configuração do endpoint semanal
 */
export async function GET(request: NextRequest) {
  try {
    const checks = {
      hasCronSecret: !!process.env.CRON_SECRET,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
      hasVercelUrl: !!process.env.VERCEL_URL,
    }

    // Tentar criar cliente Supabase
    let supabaseConnection = false
    let supabaseError = null
    try {
      const supabase = getServiceRoleClient()
      supabaseConnection = true
      
      // Testar query simples
      const { error: testError } = await supabase
        .from('automation_settings')
        .select('id')
        .limit(1)
      
      if (testError) {
        supabaseError = testError.message
      }
    } catch (error: any) {
      supabaseError = error.message
    }

    return NextResponse.json({
      status: 'ok',
      checks,
      supabaseConnection,
      supabaseError,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error('Erro no endpoint de teste', error, {
      endpoint: '/api/test-weekly-endpoint',
    })
    
    return NextResponse.json(
      {
        status: 'error',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
