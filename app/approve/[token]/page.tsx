'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import { ChakraProvider } from '@/components/ChakraProvider'
import {
  Box,
  Heading,
  Button,
  FieldRoot,
  FieldLabel,
  Textarea,
  Input,
  AlertRoot,
  AlertIndicator,
  AlertContent,
  Text,
  VStack,
  HStack,
  Container,
  CardRoot,
  CardBody,
} from '@chakra-ui/react'

interface PendingPost {
  id: string
  title: string
  content: string
  excerpt: string
  image_url?: string
  youtube_embed_url?: string
  scheduled_date: string
  status: string
  wordpress_sites: {
    name: string
    url: string
  }
}

export default function ApprovePostPage() {
  const params = useParams()
  const token = params?.token as string
  const [post, setPost] = useState<PendingPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [editedTitle, setEditedTitle] = useState('')
  const [editedExcerpt, setEditedExcerpt] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')

  useEffect(() => {
    if (token) {
      loadPost()
    }
  }, [token])

  const loadPost = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await axios.get(`/api/pending-post/${token}`)
      setPost(response.data)
      setEditedContent(response.data.content)
      setEditedTitle(response.data.title)
      setEditedExcerpt(response.data.excerpt || '')
      setYoutubeUrl(response.data.youtube_embed_url || '')
    } catch (error: any) {
      console.error('Erro ao carregar post:', error)
      setError(error.response?.data?.error || 'Erro ao carregar post')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const updateData: any = {
        action: 'approve',
      }

      // Se houve edições, incluir no update
      if (editedContent !== post?.content || editedTitle !== post?.title || editedExcerpt !== post?.excerpt || youtubeUrl !== (post?.youtube_embed_url || '')) {
        updateData.title = editedTitle
        updateData.content = editedContent
        updateData.excerpt = editedExcerpt
        updateData.youtube_embed_url = youtubeUrl || null
        
        // Inserir embed do YouTube no conteúdo se fornecido
        if (youtubeUrl) {
          const embedHtml = generateYouTubeEmbed(youtubeUrl)
          // Adicionar embed antes do CTA ou no final
          let finalContent = editedContent
          if (!finalContent.includes(embedHtml)) {
            // Inserir após o primeiro parágrafo ou no meio do conteúdo
            const paragraphs = finalContent.split('</p>')
            if (paragraphs.length > 2) {
              finalContent = paragraphs.slice(0, 2).join('</p>') + '</p>' + embedHtml + paragraphs.slice(2).join('</p>')
            } else {
              finalContent = editedContent + embedHtml
            }
          }
          updateData.content = finalContent
        }
      }

      await axios.put(`/api/pending-post/${token}`, updateData)
      setSuccess('Post aprovado com sucesso!')
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error: any) {
      console.error('Erro ao aprovar post:', error)
      setError(error.response?.data?.error || 'Erro ao aprovar post')
    } finally {
      setSaving(false)
    }
  }

  const handleReject = async () => {
    if (!confirm('Tem certeza que deseja rejeitar este post?')) return

    try {
      setSaving(true)
      setError(null)
      await axios.put(`/api/pending-post/${token}`, { action: 'reject' })
      setSuccess('Post rejeitado')
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error: any) {
      console.error('Erro ao rejeitar post:', error)
      setError(error.response?.data?.error || 'Erro ao rejeitar post')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEdit = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      let finalContent = editedContent

      // Inserir embed do YouTube no conteúdo se fornecido
      if (youtubeUrl) {
        const embedHtml = generateYouTubeEmbed(youtubeUrl)
        if (!finalContent.includes(embedHtml)) {
          const paragraphs = finalContent.split('</p>')
          if (paragraphs.length > 2) {
            finalContent = paragraphs.slice(0, 2).join('</p>') + '</p>' + embedHtml + paragraphs.slice(2).join('</p>')
          } else {
            finalContent = editedContent + embedHtml
          }
        }
      }

      await axios.put(`/api/pending-post/${token}`, {
        action: 'edit',
        title: editedTitle,
        content: finalContent,
        excerpt: editedExcerpt,
        youtube_embed_url: youtubeUrl || null,
      })
      setSuccess('Alterações salvas com sucesso!')
      setTimeout(() => {
        loadPost()
      }, 1000)
    } catch (error: any) {
      console.error('Erro ao salvar edição:', error)
      setError(error.response?.data?.error || 'Erro ao salvar edição')
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = async () => {
    if (!confirm('Deseja regenerar o conteúdo deste post? O conteúdo atual será substituído.')) return

    try {
      setRegenerating(true)
      setError(null)
      setSuccess(null)

      const response = await axios.post('/api/regenerate-pending-post', {
        pendingPostId: post?.id,
        token,
      })

      if (response.data.post) {
        setPost(response.data.post)
        setEditedContent(response.data.post.content)
        setEditedTitle(response.data.post.title)
        setEditedExcerpt(response.data.post.excerpt || '')
        setSuccess('Conteúdo regenerado com sucesso!')
      }
    } catch (error: any) {
      console.error('Erro ao regenerar post:', error)
      setError(error.response?.data?.error || 'Erro ao regenerar post')
    } finally {
      setRegenerating(false)
    }
  }

  const generateYouTubeEmbed = (url: string): string => {
    // Extrair ID do vídeo do YouTube
    let videoId = ''
    
    // Padrões de URL do YouTube
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {
        videoId = match[1]
        break
      }
    }

    if (!videoId) {
      return ''
    }

    return `<div style="margin: 30px 0; text-align: center;">
      <iframe 
        width="100%" 
        height="500" 
        src="https://www.youtube.com/embed/${videoId}" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen
        style="max-width: 800px; border-radius: 8px;">
      </iframe>
    </div>`
  }

  if (loading) {
    return (
      <Container maxW="container.xl" py={8}>
        <Box textAlign="center">
          <Text color="gray.400">Carregando post...</Text>
        </Box>
      </Container>
    )
  }

  if (error && !post) {
    return (
      <Container maxW="container.xl" py={8}>
        <AlertRoot status="error">
          <AlertIndicator />
          <AlertContent>{error}</AlertContent>
        </AlertRoot>
      </Container>
    )
  }

  if (!post) {
    return (
      <Container maxW="container.xl" py={8}>
        <AlertRoot status="warning">
          <AlertIndicator />
          <AlertContent>Post não encontrado</AlertContent>
        </AlertRoot>
      </Container>
    )
  }

  const scheduledDate = new Date(post.scheduled_date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <ChakraProvider>
      <Box minH="100vh" bg="gray.900" py={8}>
        <Container maxW="container.xl">
          <VStack gap={6} align="stretch">
        <Box>
          <Heading size="lg" color="gray.50" mb={2}>
            Aprovação de Post
          </Heading>
          <Text color="gray.400">
            Site: {post.wordpress_sites.name} | Publicação agendada: {scheduledDate}
          </Text>
        </Box>

        {success && (
          <AlertRoot status="success">
            <AlertIndicator />
            <AlertContent>{success}</AlertContent>
          </AlertRoot>
        )}

        {error && (
          <AlertRoot status="error">
            <AlertIndicator />
            <AlertContent>{error}</AlertContent>
          </AlertRoot>
        )}

        <CardRoot bg="gray.800" borderWidth="1px" borderColor="gray.700">
          <CardBody>
            <VStack gap={4} align="stretch">
              <FieldRoot>
                <FieldLabel color="gray.300" fontWeight="medium">
                  Título
                </FieldLabel>
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  bg="gray.700"
                  borderColor="gray.600"
                  color="gray.50"
                  size="lg"
                />
              </FieldRoot>

              <FieldRoot>
                <FieldLabel color="gray.300" fontWeight="medium">
                  Resumo (Excerpt)
                </FieldLabel>
                <Textarea
                  rows={3}
                  value={editedExcerpt}
                  onChange={(e) => setEditedExcerpt(e.target.value)}
                  bg="gray.700"
                  borderColor="gray.600"
                  color="gray.50"
                  size="lg"
                />
              </FieldRoot>

              <FieldRoot>
                <FieldLabel color="gray.300" fontWeight="medium">
                  URL do YouTube (opcional)
                </FieldLabel>
                <Input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  bg="gray.700"
                  borderColor="gray.600"
                  color="gray.50"
                  size="lg"
                />
                <Text fontSize="xs" color="gray.400" mt={1}>
                  O vídeo será inserido automaticamente no conteúdo do post
                </Text>
              </FieldRoot>

              <FieldRoot>
                <FieldLabel color="gray.300" fontWeight="medium">
                  Conteúdo
                </FieldLabel>
                <Textarea
                  rows={20}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  bg="gray.700"
                  borderColor="gray.600"
                  color="gray.50"
                  size="lg"
                  fontFamily="mono"
                  fontSize="sm"
                />
              </FieldRoot>

              {post.image_url && (
                <Box>
                  <Text color="gray.300" fontWeight="medium" mb={2}>
                    Imagem:
                  </Text>
                  <img
                    src={post.image_url}
                    alt={post.title}
                    style={{ maxWidth: '100%', borderRadius: '8px' }}
                  />
                </Box>
              )}

              <HStack gap={4} mt={4}>
                <Button
                  onClick={handleSaveEdit}
                  disabled={saving || regenerating}
                  colorPalette="blue"
                  flex={1}
                  loading={saving}
                  loadingText="Salvando..."
                >
                  Salvar Edições
                </Button>
                <Button
                  onClick={handleRegenerate}
                  disabled={saving || regenerating}
                  colorPalette="purple"
                  flex={1}
                  loading={regenerating}
                  loadingText="Regenerando..."
                >
                  Regenerar Conteúdo
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={saving || regenerating}
                  colorPalette="red"
                  variant="outline"
                >
                  Rejeitar
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={saving || regenerating}
                  colorPalette="green"
                  flex={1}
                  loading={saving}
                  loadingText="Aprovando..."
                >
                  Aprovar e Publicar
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </CardRoot>
          </VStack>
        </Container>
      </Box>
    </ChakraProvider>
  )
}
