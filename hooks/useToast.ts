import { useState, useCallback } from 'react'

export interface Toast {
  id: string
  title: string
  description?: string
  status: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9)
      const newToast: Toast = {
        ...toast,
        id,
        duration: toast.duration || 5000,
      }

      setToasts((prev) => [...prev, newToast])

      // Auto remove after duration
      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id))
        }, newToast.duration)
      }

      return id
    },
    []
  )

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const success = useCallback(
    (title: string, description?: string) => {
      return showToast({ title, description, status: 'success' })
    },
    [showToast]
  )

  const error = useCallback(
    (title: string, description?: string) => {
      return showToast({ title, description, status: 'error', duration: 7000 })
    },
    [showToast]
  )

  const info = useCallback(
    (title: string, description?: string) => {
      return showToast({ title, description, status: 'info' })
    },
    [showToast]
  )

  const warning = useCallback(
    (title: string, description?: string) => {
      return showToast({ title, description, status: 'warning' })
    },
    [showToast]
  )

  return {
    toasts,
    showToast,
    removeToast,
    success,
    error,
    info,
    warning,
  }
}

