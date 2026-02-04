'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  CardRoot,
  CardBody,
  Badge,
  Spinner,
} from '@chakra-ui/react'
import { BarChart3, TrendingUp, FileText, Globe, Calendar, Zap } from 'lucide-react'

interface AnalyticsData {
  totalPosts: number
  postsThisMonth: number
  postsThisWeek: number
  totalSites: number
  successRate: number
  mostActiveSite: string
  topKeywords: { keyword: string; count: number }[]
  postsByMonth: { month: string; count: number }[]
  automationStats: {
    total: number
    successful: number
    failed: number
  }
}

export default function AnalyticsDashboard({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')
  const supabase = createClient()

  useEffect(() => {
    loadAnalytics()
  }, [userId, period])

  const loadAnalytics = async () => {
    try {
      setLoading(true)

      // Calcular datas baseado no período
      const now = new Date()
      const periodStart = new Date()
      if (period === 'week') {
        periodStart.setDate(now.getDate() - 7)
      } else if (period === 'month') {
        periodStart.setMonth(now.getMonth() - 1)
      } else {
        periodStart.setFullYear(now.getFullYear() - 1)
      }

      // Buscar posts - selecionar apenas campos necessários (NÃO incluir 'content' que é muito grande)
      // Adicionar limite para evitar timeout em grandes volumes de dados
      const maxPosts = period === 'year' ? 1000 : period === 'month' ? 500 : 200
      
      const { data: postsData, error: postsError } = await supabase
        .from('published_posts')
        .select(`
          id,
          site_id,
          keywords,
          created_at,
          wordpress_sites!inner(name)
        `)
        .eq('user_id', userId)
        .gte('created_at', periodStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(maxPosts)

      if (postsError) {
        console.error('Erro ao buscar posts:', postsError)
        throw postsError
      }

      // Buscar sites (query separada e mais simples)
      const { data: sitesData, error: sitesError } = await supabase
        .from('wordpress_sites')
        .select('id, name')
        .eq('user_id', userId)
        .limit(100) // Limitar sites também

      if (sitesError) {
        console.error('Erro ao buscar sites:', sitesError)
        // Não falhar completamente, continuar sem sites
      }

      // Buscar automações - selecionar apenas campos necessários
      const { data: automationsData, error: automationsError } = await supabase
        .from('automation_executions')
        .select('id, status, created_at')
        .eq('user_id', userId)
        .gte('created_at', periodStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(500) // Limitar automações também

      if (automationsError) {
        console.error('Erro ao buscar automações:', automationsError)
        // Não falhar completamente, continuar sem automações
      }

      // Calcular estatísticas
      const nowDate = new Date()
      const thisMonthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1)
      const thisWeekStart = new Date(nowDate)
      thisWeekStart.setDate(nowDate.getDate() - 7)

      // Contar posts (usar dados já filtrados por período)
      const totalPosts = postsData?.length || 0
      
      // Filtrar posts deste mês e semana (já temos dados do período)
      const postsThisMonth = postsData?.filter(
        (p: any) => {
          const postDate = new Date(p.created_at)
          return postDate >= thisMonthStart && postDate <= nowDate
        }
      ).length || 0

      const postsThisWeek = postsData?.filter(
        (p: any) => {
          const postDate = new Date(p.created_at)
          return postDate >= thisWeekStart && postDate <= nowDate
        }
      ).length || 0

      // Calcular site mais ativo
      const siteCounts = new Map<string, { name: string; count: number }>()
      postsData?.forEach((post: any) => {
        const siteId = post.site_id
        // Usar nome do site do join ou buscar do sitesData
        const siteName = post.wordpress_sites?.name || 
                        sitesData?.find((s: any) => s.id === siteId)?.name || 
                        'Desconhecido'
        const current = siteCounts.get(siteId) || { name: siteName, count: 0 }
        siteCounts.set(siteId, { ...current, count: current.count + 1 })
      })

      const mostActiveSite = Array.from(siteCounts.values())
        .sort((a, b) => b.count - a.count)[0]?.name || 'Nenhum'

      // Calcular palavras-chave mais usadas
      const keywordCounts = new Map<string, number>()
      postsData?.forEach((post: any) => {
        if (Array.isArray(post.keywords)) {
          post.keywords.forEach((kw: string) => {
            keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1)
          })
        }
      })

      const topKeywords = Array.from(keywordCounts.entries())
        .map(([keyword, count]) => ({ keyword, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      // Calcular posts por mês
      const postsByMonthMap = new Map<string, number>()
      postsData?.forEach((post: any) => {
        const date = new Date(post.created_at)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        postsByMonthMap.set(monthKey, (postsByMonthMap.get(monthKey) || 0) + 1)
      })

      const postsByMonth = Array.from(postsByMonthMap.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-6) // Últimos 6 meses

      // Calcular estatísticas de automação
      const totalAutomations = automationsData?.length || 0
      const successfulAutomations = automationsData?.filter(
        (a: any) => a.status === 'completed'
      ).length || 0
      const failedAutomations = automationsData?.filter(
        (a: any) => a.status === 'failed'
      ).length || 0

      const successRate = totalAutomations > 0
        ? Math.round((successfulAutomations / totalAutomations) * 100)
        : 0

      setAnalytics({
        totalPosts,
        postsThisMonth,
        postsThisWeek,
        totalSites: sitesData?.length || 0,
        successRate,
        mostActiveSite,
        topKeywords,
        postsByMonth,
        automationStats: {
          total: totalAutomations,
          successful: successfulAutomations,
          failed: failedAutomations,
        },
      })
    } catch (error: any) {
      console.error('Erro ao carregar analytics:', error)
      // Se houver erro, definir analytics como null para mostrar mensagem
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <Spinner size="xl" color="blue.500" />
      </Box>
    )
  }

  if (!analytics) {
    return (
      <Box p={8} textAlign="center" bg="gray.800" borderRadius="lg">
        <Text color="gray.300">Nenhum dado disponível</Text>
      </Box>
    )
  }

  return (
    <VStack gap={6} align="stretch" px={4} py={6}>
      <HStack justify="space-between" align="center">
        <Heading size="lg" color="gray.50">
          Dashboard de Analytics
        </Heading>
        <Box 
          {...({
            as: 'select',
            value: period,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
              setPeriod(e.target.value as 'week' | 'month' | 'year')
            },
            p: 2,
            bg: 'gray.700',
            borderWidth: '1px',
            borderColor: 'gray.600',
            borderRadius: 'md',
            color: 'gray.50',
            fontSize: 'sm',
            _focus: { borderColor: 'blue.500', outline: 'none', boxShadow: '0 0 0 1px blue.500' },
            _hover: { borderColor: 'gray.500' },
          } as any)}
        >
          <option value="week" style={{ background: '#374151' }}>Última Semana</option>
          <option value="month" style={{ background: '#374151' }}>Último Mês</option>
          <option value="year" style={{ background: '#374151' }}>Último Ano</option>
        </Box>
      </HStack>

      {/* Cards de Métricas Principais */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={4}>
        <CardRoot bg="gray.800" borderWidth="1px" borderColor="gray.700">
          <CardBody>
            <VStack align="start" gap={2}>
              <HStack gap={2}>
                <FileText size={20} color="#60A5FA" />
                <Text fontSize="sm" color="gray.400">Total de Posts</Text>
              </HStack>
              <Heading size="xl" color="gray.50">
                {analytics.totalPosts}
              </Heading>
              <Text fontSize="xs" color="gray.500">
                {analytics.postsThisMonth} este mês
              </Text>
            </VStack>
          </CardBody>
        </CardRoot>

        <CardRoot bg="gray.800" borderWidth="1px" borderColor="gray.700">
          <CardBody>
            <VStack align="start" gap={2}>
              <HStack gap={2}>
                <TrendingUp size={20} color="#34D399" />
                <Text fontSize="sm" color="gray.400">Posts Esta Semana</Text>
              </HStack>
              <Heading size="xl" color="gray.50">
                {analytics.postsThisWeek}
              </Heading>
              <Text fontSize="xs" color="gray.500">
                {analytics.postsThisMonth} este mês
              </Text>
            </VStack>
          </CardBody>
        </CardRoot>

        <CardRoot bg="gray.800" borderWidth="1px" borderColor="gray.700">
          <CardBody>
            <VStack align="start" gap={2}>
              <HStack gap={2}>
                <Globe size={20} color="#A78BFA" />
                <Text fontSize="sm" color="gray.400">Sites Ativos</Text>
              </HStack>
              <Heading size="xl" color="gray.50">
                {analytics.totalSites}
              </Heading>
              <Text fontSize="xs" color="gray.500">
                {analytics.mostActiveSite}
              </Text>
            </VStack>
          </CardBody>
        </CardRoot>

        <CardRoot bg="gray.800" borderWidth="1px" borderColor="gray.700">
          <CardBody>
            <VStack align="start" gap={2}>
              <HStack gap={2}>
                <Zap size={20} color="#FBBF24" />
                <Text fontSize="sm" color="gray.400">Taxa de Sucesso</Text>
              </HStack>
              <Heading size="xl" color="gray.50">
                {analytics.successRate}%
              </Heading>
              <Text fontSize="xs" color="gray.500">
                {analytics.automationStats.successful}/{analytics.automationStats.total} automações
              </Text>
            </VStack>
          </CardBody>
        </CardRoot>
      </SimpleGrid>

      {/* Palavras-chave mais usadas */}
      <CardRoot bg="gray.800" borderWidth="1px" borderColor="gray.700">
        <CardBody>
          <VStack align="stretch" gap={4}>
            <Heading size="md" color="gray.50">
              Palavras-chave Mais Usadas
            </Heading>
            {analytics.topKeywords.length > 0 ? (
              <HStack gap={2} flexWrap="wrap">
                {analytics.topKeywords.map((item, idx) => (
                  <Badge
                    key={idx}
                    colorPalette="blue"
                    fontSize="sm"
                    px={3}
                    py={1}
                    color="blue.100"
                    bg="blue.800"
                  >
                    {item.keyword} ({item.count})
                  </Badge>
                ))}
              </HStack>
            ) : (
              <Text color="gray.400">Nenhuma palavra-chave ainda</Text>
            )}
          </VStack>
        </CardBody>
      </CardRoot>

      {/* Estatísticas de Automação */}
      <CardRoot bg="gray.800" borderWidth="1px" borderColor="gray.700">
        <CardBody>
          <VStack align="stretch" gap={4}>
            <Heading size="md" color="gray.50">
              Estatísticas de Automação
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
              <Box p={4} bg="gray.700" borderRadius="md">
                <Text fontSize="sm" color="gray.400" mb={2}>Total</Text>
                <Heading size="lg" color="gray.50">
                  {analytics.automationStats.total}
                </Heading>
              </Box>
              <Box p={4} bg="green.900" borderRadius="md">
                <Text fontSize="sm" color="green.300" mb={2}>Bem-sucedidas</Text>
                <Heading size="lg" color="green.100">
                  {analytics.automationStats.successful}
                </Heading>
              </Box>
              <Box p={4} bg="red.900" borderRadius="md">
                <Text fontSize="sm" color="red.300" mb={2}>Falhas</Text>
                <Heading size="lg" color="red.100">
                  {analytics.automationStats.failed}
                </Heading>
              </Box>
            </SimpleGrid>
          </VStack>
        </CardBody>
      </CardRoot>

      {/* Posts por Mês (Gráfico Simples) */}
      <CardRoot bg="gray.800" borderWidth="1px" borderColor="gray.700">
        <CardBody>
          <VStack align="stretch" gap={4}>
            <Heading size="md" color="gray.50">
              Posts por Mês
            </Heading>
            {analytics.postsByMonth.length > 0 ? (
              <VStack align="stretch" gap={2}>
                {analytics.postsByMonth.map((item, idx) => {
                  const maxCount = Math.max(...analytics.postsByMonth.map(p => p.count))
                  const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0
                  
                  return (
                    <Box key={idx}>
                      <HStack justify="space-between" mb={1}>
                        <Text fontSize="sm" color="gray.300">
                          {new Date(item.month + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </Text>
                        <Text fontSize="sm" color="gray.50" fontWeight="semibold">
                          {item.count}
                        </Text>
                      </HStack>
                      <Box
                        h={6}
                        bg="gray.700"
                        borderRadius="md"
                        overflow="hidden"
                        position="relative"
                      >
                        <Box
                          h="100%"
                          bg="blue.500"
                          width={`${percentage}%`}
                          transition="width 0.3s"
                        />
                      </Box>
                    </Box>
                  )
                })}
              </VStack>
            ) : (
              <Text color="gray.400">Nenhum dado disponível</Text>
            )}
          </VStack>
        </CardBody>
      </CardRoot>
    </VStack>
  )
}
