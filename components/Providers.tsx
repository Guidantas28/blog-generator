'use client'

import { ChakraProvider } from './ChakraProvider'
import { AuthProvider } from './AuthProvider'
import { ToastProvider } from '@/contexts/ToastContext'
import { ReactNode } from 'react'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </ChakraProvider>
  )
}

