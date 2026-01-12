'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  AlertRoot,
  AlertIndicator,
  AlertContent,
} from '@chakra-ui/react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to monitoring service
    console.error('ErrorBoundary capturou um erro:', error, errorInfo)
    
    // Aqui você pode enviar para Sentry, LogRocket, etc.
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      ;(window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      })
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Box p={8} maxW="2xl" mx="auto">
          <AlertRoot status="error" borderRadius="lg">
            <AlertIndicator />
            <AlertContent>
              <VStack align="start" gap={4}>
                <Heading size="lg" color="red.50">
                  Algo deu errado
                </Heading>
                <Text color="red.100">
                  Ocorreu um erro inesperado. Por favor, tente novamente.
                </Text>
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <Box
                    mt={4}
                    p={4}
                    bg="red.900"
                    borderRadius="md"
                    fontSize="sm"
                    fontFamily="mono"
                    color="red.100"
                    maxH="200px"
                    overflow="auto"
                  >
                    <Text fontWeight="bold" mb={2}>
                      {this.state.error.name}: {this.state.error.message}
                    </Text>
                    <Text fontSize="xs" whiteSpace="pre-wrap">
                      {this.state.error.stack}
                    </Text>
                  </Box>
                )}
                <Button
                  onClick={this.handleReset}
                  colorPalette="red"
                  mt={4}
                >
                  Tentar Novamente
                </Button>
              </VStack>
            </AlertContent>
          </AlertRoot>
        </Box>
      )
    }

    return this.props.children
  }
}
