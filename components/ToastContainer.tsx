'use client'

import { useToast } from '@/hooks/useToast'
import {
  Box,
  AlertRoot,
  AlertIndicator,
  AlertContent,
  Text,
  HStack,
  Button,
} from '@chakra-ui/react'

interface ToastContainerProps {
  toasts: ReturnType<typeof useToast>['toasts']
  onRemove: (id: string) => void
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <Box
      position="fixed"
      top={4}
      right={4}
      zIndex={9999}
      display="flex"
      flexDirection="column"
      gap={2}
      maxW="400px"
      w="full"
    >
      {toasts.map((toast) => {
        const bgColor =
          toast.status === 'success'
            ? 'green.900'
            : toast.status === 'error'
            ? 'red.900'
            : toast.status === 'warning'
            ? 'yellow.900'
            : 'blue.900'

        const textColor =
          toast.status === 'success'
            ? 'green.100'
            : toast.status === 'error'
            ? 'red.100'
            : toast.status === 'warning'
            ? 'yellow.100'
            : 'blue.100'

        return (
          <AlertRoot
            key={toast.id}
            status={toast.status}
            borderRadius="md"
            bg={bgColor}
            color={textColor}
            boxShadow="lg"
            borderWidth="1px"
            borderColor={
              toast.status === 'success'
                ? 'green.700'
                : toast.status === 'error'
                ? 'red.700'
                : toast.status === 'warning'
                ? 'yellow.700'
                : 'blue.700'
            }
            p={4}
            style={{
              animation: 'slideIn 0.3s ease-out',
            }}
          >
            <AlertIndicator />
            <AlertContent flex={1}>
              <HStack justify="space-between" align="flex-start" gap={4}>
                <Box flex={1}>
                  <Text fontWeight="semibold" fontSize="sm" mb={toast.description ? 1 : 0}>
                    {toast.title}
                  </Text>
                  {toast.description && (
                    <Text fontSize="xs" opacity={0.9}>
                      {toast.description}
                    </Text>
                  )}
                </Box>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onRemove(toast.id)}
                  color={textColor}
                  _hover={{ bg: 'transparent', opacity: 0.7 }}
                  minW="auto"
                  h="auto"
                  p={1}
                >
                  ×
                </Button>
              </HStack>
            </AlertContent>
          </AlertRoot>
        )
      })}
    </Box>
  )
}

