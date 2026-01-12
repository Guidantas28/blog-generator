'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  Badge,
  Spinner,
  AlertRoot,
  AlertIndicator,
  AlertContent,
  SimpleGrid,
  CardRoot,
  CardBody,
} from '@chakra-ui/react'
import { useToastContext } from '@/contexts/ToastContext'

interface ScheduledPost {
  id: string
  title: string
  scheduled_date: string
  status: 'scheduled' | 'published' | 'error'
  wordpress_sites: {
    name: string
    url: string
  } | null
}

interface CalendarViewProps {
  userId: string
  siteId?: string
}

export default function CalendarView({ userId, siteId }: CalendarViewProps) {
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const toast = useToastContext()

  useEffect(() => {
    loadScheduledPosts()
  }, [siteId])

  const loadScheduledPosts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (siteId) {
        params.append('siteId', siteId)
      }
      params.append('status', 'scheduled')

      const response = await axios.get(`/api/schedule-post?${params.toString()}`)
      setPosts(response.data.posts || [])
    } catch (error: any) {
      console.error('Erro ao carregar posts agendados:', error)
      toast.error('Erro ao carregar', 'Não foi possível carregar os posts agendados')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (postId: string) => {
    if (!confirm('Tem certeza que deseja cancelar este post agendado?')) {
      return
    }

    try {
      await axios.delete('/api/schedule-post', { data: { id: postId } })
      toast.success('Post cancelado', 'O post agendado foi cancelado com sucesso')
      loadScheduledPosts()
    } catch (error: any) {
      console.error('Erro ao cancelar post:', error)
      toast.error('Erro ao cancelar', error.response?.data?.error || 'Erro ao cancelar post')
    }
  }

  const getPostsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return posts.filter((post) => {
      const postDate = new Date(post.scheduled_date).toISOString().split('T')[0]
      return postDate === dateStr
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <Spinner size="xl" color="blue.500" />
      </Box>
    )
  }

  const todayPosts = getPostsForDate(selectedDate)
  const upcomingPosts = posts
    .filter((post) => new Date(post.scheduled_date) > new Date())
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
    .slice(0, 10)

  return (
    <VStack gap={6} align="stretch">
      <Heading size="lg" color="gray.50">
        Calendário de Posts Agendados
      </Heading>

      {posts.length === 0 ? (
        <AlertRoot status="info" borderRadius="lg" bg="blue.900" color="blue.100">
          <AlertIndicator />
          <AlertContent>
            Nenhum post agendado. Use a funcionalidade de agendamento para criar posts programados.
          </AlertContent>
        </AlertRoot>
      ) : (
        <>
          <Box>
            <Heading size="md" color="gray.50" mb={4}>
              Próximos Posts
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
              {upcomingPosts.map((post) => (
                <CardRoot key={post.id} bg="gray.700" borderWidth="1px" borderColor="gray.600">
                  <CardBody>
                    <VStack align="stretch" gap={2}>
                      <Heading size="sm" color="gray.50">
                        {post.title}
                      </Heading>
                      <Text fontSize="sm" color="gray.300">
                        <Text as="span" fontWeight="medium">
                          Site:
                        </Text>{' '}
                        {post.wordpress_sites?.name || 'Desconhecido'}
                      </Text>
                      <Text fontSize="sm" color="gray.300">
                        <Text as="span" fontWeight="medium">
                          Data:
                        </Text>{' '}
                        {new Date(post.scheduled_date).toLocaleDateString('pt-BR')} às{' '}
                        {formatTime(post.scheduled_date)}
                      </Text>
                      <Badge
                        colorPalette={post.status === 'scheduled' ? 'blue' : 'gray'}
                        fontSize="xs"
                        alignSelf="flex-start"
                      >
                        {post.status === 'scheduled' ? 'Agendado' : post.status}
                      </Badge>
                      <Button
                        size="sm"
                        colorPalette="red"
                        variant="outline"
                        onClick={() => handleCancel(post.id)}
                      >
                        Cancelar
                      </Button>
                    </VStack>
                  </CardBody>
                </CardRoot>
              ))}
            </SimpleGrid>
          </Box>

          <Box>
            <Heading size="md" color="gray.50" mb={4}>
              Posts do Dia Selecionado: {formatDate(selectedDate)}
            </Heading>
            <HStack gap={2} mb={4}>
              <Button
                size="sm"
                onClick={() => {
                  const prev = new Date(selectedDate)
                  prev.setDate(prev.getDate() - 1)
                  setSelectedDate(prev)
                }}
              >
                ← Anterior
              </Button>
              <Button
                size="sm"
                onClick={() => setSelectedDate(new Date())}
              >
                Hoje
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const next = new Date(selectedDate)
                  next.setDate(next.getDate() + 1)
                  setSelectedDate(next)
                }}
              >
                Próximo →
              </Button>
            </HStack>

            {todayPosts.length === 0 ? (
              <AlertRoot status="info" borderRadius="md" bg="gray.700" color="gray.300">
                <AlertIndicator />
                <AlertContent>Nenhum post agendado para esta data.</AlertContent>
              </AlertRoot>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                {todayPosts.map((post) => (
                  <CardRoot key={post.id} bg="gray.700" borderWidth="1px" borderColor="gray.600">
                    <CardBody>
                      <VStack align="stretch" gap={2}>
                        <Heading size="sm" color="gray.50">
                          {post.title}
                        </Heading>
                        <Text fontSize="sm" color="gray.300">
                          {formatTime(post.scheduled_date)} - {post.wordpress_sites?.name}
                        </Text>
                        <Button
                          size="sm"
                          colorPalette="red"
                          variant="outline"
                          onClick={() => handleCancel(post.id)}
                        >
                          Cancelar
                        </Button>
                      </VStack>
                    </CardBody>
                  </CardRoot>
                ))}
              </SimpleGrid>
            )}
          </Box>
        </>
      )}
    </VStack>
  )
}
