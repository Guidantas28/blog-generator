'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let subscription: { unsubscribe: () => void } | null = null
    let refreshInterval: NodeJS.Timeout | null = null

    const initializeAuth = async () => {
      try {
        const supabase = createClient()
        
        // Verificar se já existe uma sessão antes de fazer requisição
        const { data: { session } } = await supabase.auth.getSession()
        
        if (mounted) {
          setUser(session?.user ?? null)
          setLoading(false)
        }

        // Configurar refresh automático do token a cada 30 minutos
        // Isso garante que a sessão seja renovada antes de expirar
        refreshInterval = setInterval(async () => {
          try {
            const { data: { session: currentSession } } = await supabase.auth.getSession()
            if (currentSession && currentSession.refresh_token) {
              // Renovar a sessão automaticamente usando o refresh token
              await supabase.auth.refreshSession({
                refresh_token: currentSession.refresh_token,
              })
            }
          } catch (error) {
            console.error('Erro ao renovar sessão:', error)
          }
        }, 30 * 60 * 1000) // A cada 30 minutos

        // Configurar listener de mudanças de autenticação
        const {
          data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (mounted) {
            setUser(session?.user ?? null)
            setLoading(false)
          }
        })

        subscription = authSubscription
      } catch (error) {
        console.error('Erro ao inicializar autenticação:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    return () => {
      mounted = false
      if (subscription) {
        subscription.unsubscribe()
      }
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, []) // Array vazio - executa apenas uma vez na montagem

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

