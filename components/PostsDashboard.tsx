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
  Button,
  Badge,
  Link,
  Spinner,
  Text,
  VStack,
  HStack,
} from '@chakra-ui/react'

interface PublishedPost {
  id: string
  topic: string
  title: string
  wordpress_post_url: string | null
  wordpress_post_id: number | null
  site_id: string
  site_name?: string
  keywords: string[]
  created_at: string
  status: string
}

export default function PostsDashboard({ userId }: { userId: string }) {
  const [posts, setPosts] = useState<PublishedPost[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadPosts()
  }, [userId])

  const loadPosts = async () => {
    try {
      // Buscar posts
      const { data: postsData, error: postsError } = await supabase
        .from('published_posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (postsError) throw postsError

      // Buscar sites para fazer o join
      const { data: sitesData } = await supabase
        .from('wordpress_sites')
        .select('id, name')
        .eq('user_id', userId)

      const sitesMap = new Map((sitesData || []).map((site: any) => [site.id, site.name]))

      const postsWithSiteName = (postsData || []).map((post: any) => ({
        ...post,
        site_name: sitesMap.get(post.site_id) || 'Site desconhecido',
      }))

      setPosts(postsWithSiteName)
    } catch (error) {
      console.error('Erro ao carregar posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este post do histórico?')) return

    try {
      const { error } = await supabase
        .from('published_posts')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadPosts()
    } catch (error: any) {
      alert('Erro ao excluir post: ' + error.message)
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
      <Heading size="lg" color="gray.50">Posts Publicados</Heading>

      {posts.length === 0 ? (
        <Box p={8} textAlign="center" bg="gray.800" borderRadius="lg" shadow="sm" borderWidth="1px" borderColor="gray.700">
          <Text color="gray.300">Nenhum post publicado ainda.</Text>
        </Box>
      ) : (
        <Box overflowX="auto" bg="gray.800" borderRadius="lg" shadow="sm" borderWidth="1px" borderColor="gray.700">
          <TableRoot>
            <TableHeader>
              <TableRow bg="gray.700" borderBottomWidth="2px" borderColor="gray.600">
                <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>Título</TableColumnHeader>
                <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>Site</TableColumnHeader>
                <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>Palavras-chave</TableColumnHeader>
                <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>Data</TableColumnHeader>
                <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>Status</TableColumnHeader>
                <TableColumnHeader color="gray.100" fontWeight="semibold" py={4} px={4}>Ações</TableColumnHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post, index) => (
                <TableRow 
                  key={post.id}
                  borderBottomWidth="1px"
                  borderColor="gray.700"
                  _hover={{ bg: 'gray.700' }}
                  bg={index % 2 === 0 ? 'gray.800' : 'gray.700'}
                >
                  <TableCell py={4} px={4}>
                    <Text fontWeight="medium" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} color="gray.50" fontSize="sm">
                      {post.title}
                    </Text>
                  </TableCell>
                  <TableCell py={4} px={4}>
                    <Text fontSize="sm" color="gray.200">
                      {post.site_name}
                    </Text>
                  </TableCell>
                  <TableCell py={4} px={4}>
                    <HStack gap={1} flexWrap="wrap">
                      {post.keywords?.slice(0, 3).map((keyword, idx) => (
                        <Badge key={idx} colorPalette="blue" fontSize="xs" color="blue.100" bg="blue.800">
                          {keyword}
                        </Badge>
                      ))}
                      {post.keywords?.length > 3 && (
                        <Badge colorPalette="gray" fontSize="xs" color="gray.200" bg="gray.600">
                          +{post.keywords.length - 3}
                        </Badge>
                      )}
                    </HStack>
                  </TableCell>
                  <TableCell py={4} px={4}>
                    <Text fontSize="sm" color="gray.200">
                      {new Date(post.created_at).toLocaleDateString('pt-BR')}
                    </Text>
                  </TableCell>
                  <TableCell py={4} px={4}>
                    <Badge 
                      colorPalette={post.status === 'published' ? 'green' : 'gray'}
                      color={post.status === 'published' ? 'green.100' : 'gray.200'}
                      bg={post.status === 'published' ? 'green.800' : 'gray.600'}
                    >
                      {post.status}
                    </Badge>
                  </TableCell>
                  <TableCell py={4} px={4}>
                    <HStack gap={2}>
                      {post.wordpress_post_url && (
                        <Button
                          asChild
                          size="sm"
                          colorPalette="blue"
                          variant="outline"
                          borderColor="blue.500"
                          color="blue.200"
                          _hover={{ bg: 'blue.800', borderColor: 'blue.400' }}
                        >
                          <a href={post.wordpress_post_url} target="_blank" rel="noopener noreferrer">
                            Ver Post
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        colorPalette="red"
                        variant="ghost"
                        color="red.200"
                        _hover={{ bg: 'red.800' }}
                        onClick={() => handleDelete(post.id)}
                      >
                        Excluir
                      </Button>
                    </HStack>
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

