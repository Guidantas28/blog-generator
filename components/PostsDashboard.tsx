'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import axios from 'axios'
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
  AlertRoot,
  AlertIndicator,
  AlertContent,
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
  const [refazendoId, setRefazendoId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
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

  const handleRefazer = async (post: PublishedPost) => {
    if (!confirm('Deseja regenerar e republicar este post? O post antigo será excluído e um novo será criado.')) return

    setRefazendoId(post.id)
    setMessage(null)

    try {
      // 1. Buscar dados do site para obter CTA
      const { data: siteData, error: siteError } = await supabase
        .from('wordpress_sites')
        .select('cta_text, cta_link')
        .eq('id', post.site_id)
        .single()

      if (siteError) {
        throw new Error('Erro ao buscar dados do site')
      }

      const ctaText = siteData?.cta_text || undefined
      const ctaLink = siteData?.cta_link || undefined

      // 2. Gerar novo conteúdo com CTA
      const contentResponse = await axios.post('/api/generate-keywords-and-content', {
        topic: post.topic || post.title,
        ctaText,
        ctaLink,
      })

      if (!contentResponse.data || !contentResponse.data.content) {
        throw new Error('Erro ao gerar novo conteúdo')
      }

      const { title, content, excerpt, keywords } = contentResponse.data

      // 3. Buscar nova imagem (garantir que seja buscada)
      let imageUrl = null
      try {
        const imageResponse = await axios.post('/api/search-images', {
          query: post.topic || post.title,
        })
        if (imageResponse.data.images && imageResponse.data.images.length > 0) {
          imageUrl = imageResponse.data.images[0].url
        } else {
          throw new Error('Nenhuma imagem encontrada')
        }
      } catch (error: any) {
        // Tentar novamente com o título como query
        try {
          const imageResponse = await axios.post('/api/search-images', {
            query: title,
          })
          if (imageResponse.data.images && imageResponse.data.images.length > 0) {
            imageUrl = imageResponse.data.images[0].url
          } else {
            throw new Error('Nenhuma imagem encontrada')
          }
        } catch (retryError) {
          throw new Error('Erro ao buscar imagem. Por favor, tente novamente.')
        }
      }

      // 4. Excluir post antigo do WordPress (se tiver wordpress_post_id)
      if (post.wordpress_post_id) {
        try {
          await axios.post('/api/delete-wordpress-post', {
            siteId: post.site_id,
            postId: post.wordpress_post_id,
          })
        } catch (error: any) {
          console.warn('Aviso: Não foi possível excluir o post antigo do WordPress:', error)
          // Continuar mesmo se não conseguir excluir
        }
      }

      // 5. Publicar novo post
      const publishResponse = await axios.post('/api/publish-post', {
        siteId: post.site_id,
        topic: post.topic || title,
        title,
        content,
        excerpt: excerpt || '',
        imageUrl,
        keywords: Array.isArray(keywords) ? keywords : [],
        seoTitle: title,
        seoDescription: excerpt || '',
        focusKeyword: Array.isArray(keywords) && keywords.length > 0 ? keywords[0] : '',
        ctaText,
        ctaLink,
      })

      // 6. Excluir registro antigo do Supabase após criar o novo
      if (post.id) {
        try {
          const { error: deleteError } = await supabase
            .from('published_posts')
            .delete()
            .eq('id', post.id)

          if (deleteError) {
            console.warn('Aviso: Não foi possível excluir o registro antigo do Supabase:', deleteError)
          }
        } catch (error) {
          console.warn('Aviso: Erro ao excluir registro antigo:', error)
        }
      }

      setMessage({
        type: 'success',
        text: `Post refeito e publicado com sucesso! ${publishResponse.data.link ? `Link: ${publishResponse.data.link}` : ''}`,
      })
      loadPosts()
    } catch (error: any) {
      console.error('Erro ao refazer post:', error)
      setMessage({
        type: 'error',
        text: 'Erro ao refazer post: ' + (error.response?.data?.error || error.message),
      })
    } finally {
      setRefazendoId(null)
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

      {message && (
        <AlertRoot
          status={message.type}
          borderRadius="md"
          bg={message.type === 'success' ? 'green.900' : 'red.900'}
          color={message.type === 'success' ? 'green.100' : 'red.100'}
        >
          <AlertIndicator />
          <AlertContent>{message.text}</AlertContent>
        </AlertRoot>
      )}

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
                      {post.keywords?.map((keyword, idx) => (
                        <Badge key={idx} colorPalette="blue" fontSize="xs" color="blue.100" bg="blue.800">
                          {keyword}
                        </Badge>
                      ))}
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
                    <HStack gap={2} flexWrap="wrap">
                      {post.wordpress_post_url && (
                        <Button
                          asChild
                          size="sm"
                          colorPalette="blue"
                          variant="outline"
                          borderColor="blue.500"
                          color="blue.200"
                          px={4}
                          py={2}
                          _hover={{ bg: 'blue.800', borderColor: 'blue.400', transform: 'translateY(-1px)' }}
                          transition="all 0.2s"
                        >
                          <a href={post.wordpress_post_url} target="_blank" rel="noopener noreferrer">
                            Ver Post
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        colorPalette="purple"
                        variant="outline"
                        borderColor="purple.500"
                        color="purple.200"
                        px={4}
                        py={2}
                        _hover={{ bg: 'purple.800', borderColor: 'purple.400', transform: 'translateY(-1px)' }}
                        transition="all 0.2s"
                        onClick={() => handleRefazer(post)}
                        loading={refazendoId === post.id}
                        loadingText="Refazendo..."
                        disabled={refazendoId !== null}
                      >
                        Refazer
                      </Button>
                      <Button
                        size="sm"
                        colorPalette="red"
                        variant="solid"
                        bg="red.600"
                        color="red.50"
                        px={4}
                        py={2}
                        _hover={{ bg: 'red.500', transform: 'translateY(-1px)' }}
                        transition="all 0.2s"
                        onClick={() => handleDelete(post.id)}
                        disabled={refazendoId !== null}
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

