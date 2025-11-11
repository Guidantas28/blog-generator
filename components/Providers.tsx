'use client'

import { ChakraProvider } from './ChakraProvider'
import { AuthProvider } from './AuthProvider'
import { ReactNode } from 'react'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider>
      <AuthProvider>{children}</AuthProvider>
    </ChakraProvider>
  )
}

