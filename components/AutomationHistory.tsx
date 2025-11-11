'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Box,
  Heading,
  TableRoot,
  TableHeader,
  TableBody,
  TableRow,
  TableColumnHeader,
  TableCell,
  Badge,
  Text,
  VStack,
  HStack,
  Spinner,
  Button,
  AlertRoot,
  AlertIndicator,
  AlertContent,
} from '@chakra-ui/react'

interface AutomationExecution {
  id: string
  automation_id: string
  site_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  post_id: string | null
  error_message: string | null
  started_at: string
  completed_at: string | null
  site_name?: string
  business_category?: string
}

export default function AutomationHistory({ userId }: { userId: string }) {
  const [executions, setExecutions] = useState<AutomationExecution[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadExecutions()
  }, [userId])

  const loadExecutions = async () => {
    setLoading(true)
    try {
      // Buscar execuções
      const { data: executionsData, error: executionsError } = await supabase
        .from('automation_executions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(50)

      if (executionsError) throw executionsError

      // Buscar informações das automações e sites
      const { data: automationsData } = await supabase
        .from('automation_settings')
        .select('id, business_category, site_id')
        .eq('user_id', userId)

      const { data: sitesData } = await supabase
        .from('wordpress_sites')
        .select('id, name')
        .eq('user_id', userId)

      const automationsMap = new Map(
        (automationsData || []).map((a: any) => [a.id, a])
      )
      const sitesMap = new Map((sitesData || []).map((s: any) => [s.id, s.name]))

      const executionsWithDetails = (executionsData || []).map((exec: any) => {
        const automation = automationsMap.get(exec.automation_id)
        return {
          ...exec,
          site_name: sitesMap.get(exec.site_id) || 'Site desconhecido',
          business_category: automation?.business_category || 'N/A',
        }
      })

      setExecutions(executionsWithDetails)
    } catch (error) {
      console.error('Erro ao carregar execuções:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge colorPalette="green" color="green.100" bg="green.900">
            Concluído
          </Badge>
        )
      case 'running':
        return (
          <Badge colorPalette="blue" color="blue.100" bg="blue.900">
            Executando
          </Badge>
        )
      case 'failed':
        return (
          <Badge colorPalette="red" color="red.100" bg="red.900">
            Falhou
          </Badge>
        )
      case 'pending':
        return (
          <Badge colorPalette="yellow" color="yellow.100" bg="yellow.900">
            Pendente
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <Spinner size="xl" color="blue.500" />
      </Box>
    )
  }

  return (
    <VStack gap={6} align="stretch" px={4} py={6}>
      <HStack justify="space-between" align="center">
        <Heading size="lg" color="gray.50">
          Histórico de Execuções
        </Heading>
        <Button onClick={loadExecutions} variant="ghost" colorPalette="blue" size="sm">
          Atualizar
        </Button>
      </HStack>

      {executions.length === 0 ? (
        <AlertRoot status="info" borderRadius="lg" bg="blue.900" color="blue.100">
          <AlertIndicator />
          <AlertContent>
            Nenhuma execução encontrada. As execuções aparecerão aqui quando a automação for
            executada pelo cron job.
          </AlertContent>
        </AlertRoot>
      ) : (
        <Box overflowX="auto" bg="gray.800" borderRadius="lg" shadow="sm" borderWidth="1px" borderColor="gray.700">
          <TableRoot>
            <TableHeader>
              <TableRow bg="gray.700" borderBottomWidth="2px" borderColor="gray.600">
                <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>
                  Data/Hora
                </TableColumnHeader>
                <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>
                  Site
                </TableColumnHeader>
                <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>
                  Categoria
                </TableColumnHeader>
                <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>
                  Status
                </TableColumnHeader>
                <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>
                  Erro
                </TableColumnHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((execution) => (
                <TableRow
                  key={execution.id}
                  borderBottomWidth="1px"
                  borderColor="gray.700"
                  _hover={{ bg: 'gray.700' }}
                  bg="gray.800"
                >
                  <TableCell py={4} px={4}>
                    <Text fontSize="sm" color="gray.200">
                      {new Date(execution.started_at).toLocaleString('pt-BR')}
                    </Text>
                    {execution.completed_at && (
                      <Text fontSize="xs" color="gray.400">
                        Concluído: {new Date(execution.completed_at).toLocaleString('pt-BR')}
                      </Text>
                    )}
                  </TableCell>
                  <TableCell py={4} px={4}>
                    <Text fontSize="sm" color="gray.200">
                      {execution.site_name}
                    </Text>
                  </TableCell>
                  <TableCell py={4} px={4}>
                    <Text fontSize="sm" color="gray.200">
                      {execution.business_category}
                    </Text>
                  </TableCell>
                  <TableCell py={4} px={4}>
                    {getStatusBadge(execution.status)}
                  </TableCell>
                  <TableCell py={4} px={4}>
                    {execution.error_message ? (
                      <Text fontSize="xs" color="red.300" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {execution.error_message}
                      </Text>
                    ) : (
                      <Text fontSize="xs" color="gray.400">
                        -
                      </Text>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableRoot>
        </Box>
      )}
    </VStack>
  )
}

