'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Container,
  CardRoot,
  CardBody,
  Badge,
  TableRoot,
  TableBody,
  TableRow,
  TableCell,
  TableHeader,
  TableColumnHeader,
} from '@chakra-ui/react'
import { CheckCircle, XCircle, RefreshCw, Edit, Eye } from 'lucide-react'

interface ApprovalAction {
  id: string
  action: 'approve' | 'reject' | 'regenerate' | 'edit' | 'view'
  action_data?: Record<string, any>
  ip_address?: string
  user_agent?: string
  created_at: string
  pending_posts: {
    id: string
    title: string
    site_id: string
    wordpress_sites: {
      id: string
      name: string
      url: string
    }
  }
}

interface ApprovalTrackingProps {
  siteId?: string
  pendingPostId?: string
}

export default function ApprovalTracking({ siteId, pendingPostId }: ApprovalTrackingProps) {
  const [actions, setActions] = useState<ApprovalAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTrackingData()
  }, [siteId, pendingPostId])

  const loadTrackingData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (siteId) params.append('siteId', siteId)
      if (pendingPostId) params.append('pendingPostId', pendingPostId)

      const response = await axios.get(`/api/approval-tracking?${params.toString()}`)
      setActions(response.data.actions || [])
    } catch (error: any) {
      console.error('Erro ao carregar tracking:', error)
      setError(error.response?.data?.error || 'Erro ao carregar histórico')
    } finally {
      setLoading(false)
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'approve':
        return <CheckCircle size={16} color="#10b981" />
      case 'reject':
        return <XCircle size={16} color="#ef4444" />
      case 'regenerate':
        return <RefreshCw size={16} color="#8b5cf6" />
      case 'edit':
        return <Edit size={16} color="#3b82f6" />
      case 'view':
        return <Eye size={16} color="#6b7280" />
      default:
        return null
    }
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      approve: 'Aprovado',
      reject: 'Rejeitado',
      regenerate: 'Regenerado',
      edit: 'Editado',
      view: 'Visualizado',
    }
    return labels[action] || action
  }

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      approve: 'green',
      reject: 'red',
      regenerate: 'purple',
      edit: 'blue',
      view: 'gray',
    }
    return colors[action] || 'gray'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <Container maxW="container.xl" py={8}>
        <Text color="gray.400">Carregando histórico...</Text>
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxW="container.xl" py={8}>
        <Text color="red.400">{error}</Text>
      </Container>
    )
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack gap={6} align="stretch">
        <Box>
          <Heading size="lg" color="gray.50" mb={2}>
            Histórico de Aprovações
          </Heading>
          <Text color="gray.400">
            Acompanhe todas as ações realizadas nos posts pendentes de aprovação
          </Text>
        </Box>

        {actions.length === 0 ? (
          <CardRoot bg="gray.800" borderWidth="1px" borderColor="gray.700">
            <CardBody>
              <Text color="gray.400" textAlign="center" py={8}>
                Nenhuma ação registrada ainda
              </Text>
            </CardBody>
          </CardRoot>
        ) : (
          <CardRoot bg="gray.800" borderWidth="1px" borderColor="gray.700">
            <CardBody>
              <TableRoot>
                <TableHeader>
                  <TableRow bg="gray.700" borderBottomWidth="2px" borderColor="gray.600">
                    <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>Ação</TableColumnHeader>
                    <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>Post</TableColumnHeader>
                    <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>Site</TableColumnHeader>
                    <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>Data/Hora</TableColumnHeader>
                    <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>IP</TableColumnHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actions.map((action) => (
                    <TableRow key={action.id} _hover={{ bg: 'gray.750' }}>
                      <TableCell py={4} px={4}>
                        <HStack gap={2}>
                          {getActionIcon(action.action)}
                          <Badge colorPalette={getActionColor(action.action)}>
                            {getActionLabel(action.action)}
                          </Badge>
                        </HStack>
                      </TableCell>
                      <TableCell py={4} px={4}>
                        <Box maxW="300px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                          <Text color="gray.300" fontSize="sm">
                            {action.pending_posts?.title || 'N/A'}
                          </Text>
                        </Box>
                      </TableCell>
                      <TableCell py={4} px={4}>
                        <Text color="gray.400" fontSize="sm">
                          {action.pending_posts?.wordpress_sites?.name || 'N/A'}
                        </Text>
                      </TableCell>
                      <TableCell py={4} px={4}>
                        <Text color="gray.400" fontSize="sm">
                          {formatDate(action.created_at)}
                        </Text>
                      </TableCell>
                      <TableCell py={4} px={4}>
                        <Text color="gray.500" fontSize="xs" fontFamily="mono">
                          {action.ip_address || 'N/A'}
                        </Text>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </TableRoot>
            </CardBody>
          </CardRoot>
        )}
      </VStack>
    </Container>
  )
}
