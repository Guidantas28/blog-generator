'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import axios from 'axios'
import DOMPurify from 'isomorphic-dompurify'
import { ChakraProvider } from '@/components/ChakraProvider'
import ContentEditor from '@/components/ContentEditor'
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
import { Code, Eye } from 'lucide-react'

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
  const [imageUrl, setImageUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showHtmlEditor, setShowHtmlEditor] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      setImageUrl(response.data.image_url || '')
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
      if (editedContent !== post?.content || editedTitle !== post?.title || editedExcerpt !== post?.excerpt || youtubeUrl !== (post?.youtube_embed_url || '') || imageUrl !== (post?.image_url || '')) {
        updateData.title = editedTitle
        updateData.content = editedContent
        updateData.excerpt = editedExcerpt
        updateData.youtube_embed_url = youtubeUrl || null
        updateData.image_url = imageUrl || null
        
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
        image_url: imageUrl || null,
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
        // Manter wordpress_sites do post original se não vier na resposta
        const updatedPost = {
          ...response.data.post,
          wordpress_sites: response.data.post.wordpress_sites || post?.wordpress_sites,
        }
        setPost(updatedPost)
        setEditedContent(response.data.post.content)
        setEditedTitle(response.data.post.title)
        setEditedExcerpt(response.data.post.excerpt || '')
        setImageUrl(response.data.post.image_url || '')
        setSuccess('Conteúdo regenerado com sucesso!')
      }
    } catch (error: any) {
      console.error('Erro ao regenerar post:', error)
      setError(error.response?.data?.error || 'Erro ao regenerar post')
    } finally {
      setRegenerating(false)
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem válido')
      return
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5MB')
      return
    }

    try {
      setUploadingImage(true)
      setError(null)

      // Converter para base64 para enviar via API
      const reader = new FileReader()
      reader.onloadend = async () => {
        try {
          const base64Image = reader.result as string
          // Atualizar apenas a imagem
          const response = await axios.put(`/api/pending-post/${token}`, {
            action: 'edit',
            image_url: base64Image,
            title: editedTitle,
            content: editedContent,
            excerpt: editedExcerpt,
            youtube_embed_url: youtubeUrl || null,
          })

          if (response.data.post) {
            setImageUrl(response.data.post.image_url || '')
            setPost({ ...post!, image_url: response.data.post.image_url })
            setSuccess('Imagem atualizada com sucesso!')
          }
        } catch (error: any) {
          console.error('Erro ao fazer upload da imagem:', error)
          setError(error.response?.data?.error || 'Erro ao fazer upload da imagem')
        } finally {
          setUploadingImage(false)
        }
      }
      reader.onerror = () => {
        setError('Erro ao ler o arquivo')
        setUploadingImage(false)
      }
      reader.readAsDataURL(file)
    } catch (error: any) {
      console.error('Erro ao processar imagem:', error)
      setError('Erro ao processar imagem')
      setUploadingImage(false)
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
            Site: {post.wordpress_sites?.name || 'N/A'} | Publicação agendada: {scheduledDate}
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
                <HStack justify="space-between" mb={2}>
                  <FieldLabel color="gray.300" fontWeight="medium" mb={0}>
                    Conteúdo
                  </FieldLabel>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowHtmlEditor(!showHtmlEditor)}
                    colorPalette="gray"
                    bg={showHtmlEditor ? 'gray.700' : 'transparent'}
                    borderColor="gray.600"
                    color="gray.300"
                    _hover={{ bg: 'gray.700', borderColor: 'gray.500' }}
                  >
                    <HStack gap={1.5}>
                      {showHtmlEditor ? <Eye size={16} /> : <Code size={16} />}
                      <Text>{showHtmlEditor ? 'Visualizar' : 'Editar HTML'}</Text>
                    </HStack>
                  </Button>
                </HStack>
                {showHtmlEditor ? (
                  <Textarea
                    rows={20}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    bg="gray.800"
                    borderColor="gray.600"
                    color="gray.50"
                    size="lg"
                    fontFamily="mono"
                    fontSize="sm"
                    placeholder="Edite o HTML aqui..."
                    _focus={{ borderColor: 'blue.500', bg: 'gray.800' }}
                  />
                ) : (
                  <ContentEditor
                    value={editedContent}
                    onChange={setEditedContent}
                    placeholder="Digite o conteúdo aqui..."
                    label=""
                  />
                )}
              </FieldRoot>

              <FieldRoot>
                <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
                  Imagem
                </FieldLabel>
                <VStack gap={3} align="stretch">
                  {(imageUrl || post.image_url) && (
                    <Box>
                      <img
                        src={imageUrl || post.image_url}
                        alt={post.title}
                        style={{
                          maxWidth: '400px',
                          maxHeight: '300px',
                          width: 'auto',
                          height: 'auto',
                          borderRadius: '8px',
                          objectFit: 'contain',
                        }}
                      />
                    </Box>
                  )}
                  <HStack gap={2}>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      display="none"
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      colorPalette="blue"
                      variant="solid"
                      size="md"
                      loading={uploadingImage}
                      loadingText="Enviando..."
                      bg="blue.600"
                      color="white"
                      _hover={{ bg: 'blue.700' }}
                      _active={{ bg: 'blue.800' }}
                      fontWeight="medium"
                    >
                      {imageUrl || post.image_url ? 'Trocar Imagem' : 'Enviar Imagem'}
                    </Button>
                    {(imageUrl || post.image_url) && (
                      <Button
                        onClick={() => {
                          setImageUrl('')
                          if (fileInputRef.current) {
                            fileInputRef.current.value = ''
                          }
                        }}
                        disabled={uploadingImage}
                        colorPalette="red"
                        variant="solid"
                        size="md"
                        bg="red.600"
                        color="white"
                        _hover={{ bg: 'red.700' }}
                        _active={{ bg: 'red.800' }}
                        fontWeight="medium"
                      >
                        Remover
                      </Button>
                    )}
                  </HStack>
                  <Text fontSize="xs" color="gray.400">
                    Formatos aceitos: JPG, PNG, GIF. Tamanho máximo: 5MB
                  </Text>
                </VStack>
              </FieldRoot>

              <HStack gap={3} mt={6} flexWrap="wrap">
                <Button
                  onClick={handleSaveEdit}
                  disabled={saving || regenerating || uploadingImage}
                  colorPalette="blue"
                  flex={{ base: '1', md: '1' }}
                  minW={{ base: '100%', md: '150px' }}
                  loading={saving}
                  loadingText="Salvando..."
                  bg="blue.600"
                  color="white"
                  size="lg"
                  fontWeight="semibold"
                  _hover={{ bg: 'blue.700', transform: 'translateY(-1px)', boxShadow: 'lg' }}
                  _active={{ bg: 'blue.800', transform: 'translateY(0)' }}
                  transition="all 0.2s"
                >
                  Salvar Edições
                </Button>
                <Button
                  onClick={handleRegenerate}
                  disabled={saving || regenerating || uploadingImage}
                  colorPalette="purple"
                  flex={{ base: '1', md: '1' }}
                  minW={{ base: '100%', md: '150px' }}
                  loading={regenerating}
                  loadingText="Regenerando..."
                  bg="purple.600"
                  color="white"
                  size="lg"
                  fontWeight="semibold"
                  _hover={{ bg: 'purple.700', transform: 'translateY(-1px)', boxShadow: 'lg' }}
                  _active={{ bg: 'purple.800', transform: 'translateY(0)' }}
                  transition="all 0.2s"
                >
                  Regenerar Conteúdo
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={saving || regenerating || uploadingImage}
                  colorPalette="red"
                  variant="solid"
                  flex={{ base: '1', md: '0' }}
                  minW={{ base: '100%', md: '120px' }}
                  bg="red.600"
                  color="white"
                  size="lg"
                  fontWeight="semibold"
                  _hover={{ bg: 'red.700', transform: 'translateY(-1px)', boxShadow: 'lg' }}
                  _active={{ bg: 'red.800', transform: 'translateY(0)' }}
                  transition="all 0.2s"
                >
                  Rejeitar
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={saving || regenerating || uploadingImage}
                  colorPalette="green"
                  flex={{ base: '1', md: '1' }}
                  minW={{ base: '100%', md: '180px' }}
                  loading={saving}
                  loadingText="Aprovando..."
                  bg="green.600"
                  color="white"
                  size="lg"
                  fontWeight="semibold"
                  _hover={{ bg: 'green.700', transform: 'translateY(-1px)', boxShadow: 'lg' }}
                  _active={{ bg: 'green.800', transform: 'translateY(0)' }}
                  transition="all 0.2s"
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
