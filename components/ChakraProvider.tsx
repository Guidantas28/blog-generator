'use client'

import { ChakraProvider as BaseChakraProvider, defaultSystem } from '@chakra-ui/react'
import { ReactNode } from 'react'

export function ChakraProvider({ children }: { children: ReactNode }) {
  return (
    <BaseChakraProvider value={defaultSystem}>
      {children}
    </BaseChakraProvider>
  )
}

