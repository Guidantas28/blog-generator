'use client'

import { useState } from 'react'
import axios from 'axios'
import {
  Box,
  Heading,
  FieldRoot,
  FieldLabel,
  Input,
  Textarea,
  Button,
  Text,
  VStack,
  HStack,
  Badge,
  SimpleGrid,
  AlertRoot,
  AlertIndicator,
  AlertContent,
} from '@chakra-ui/react'

interface Site {
  id: string
  name: string
  url: string
  username: string
}

export default function PostCreator({ sites }: { sites: Site[] }) {
  const [topic, setTopic] = useState('')
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [customKeywords, setCustomKeywords] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [ctaLink, setCtaLink] = useState('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [step, setStep] = useState<'topic' | 'keywords' | 'images' | 'review' | 'success'>('topic')
  const [isEditing, setIsEditing] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<{
    title: string
    content: string
    excerpt: string
  } | null>(null)
  const [editedContent, setEditedContent] = useState<{
    title: string
    content: string
    excerpt: string
  } | null>(null)
  const [postLink, setPostLink] = useState<string | null>(null)

  const handleGenerateKeywords = async () => {
    if (!topic.trim()) {
      alert('Por favor, preencha o tópico do post')
      return
    }

    if (!selectedSiteId) {
      alert('Por favor, selecione um site WordPress')
      return
    }

    setLoading(true)
    setLoadingMessage('Gerando palavras-chave...')
    try {
      console.log('Gerando palavras-chave para:', topic)
      
      setLoadingMessage('Gerando palavras-chave e conteúdo...')
      const response = await axios.post('/api/generate-keywords-and-content', {
        topic,
        ctaText: ctaText || undefined,
        ctaLink: ctaLink || undefined,
      })
      
      console.log('Resposta recebida:', response.data)
      
      if (!response.data) {
        throw new Error('Resposta vazia da API')
      }
      
      const keywordsData = response.data.keywords || []
      const keywordsArray = Array.isArray(keywordsData) ? keywordsData : []
      console.log('Palavras-chave processadas:', keywordsArray)
      setKeywords(keywordsArray)
      
      if (response.data.title && response.data.content) {
        const content = {
          title: response.data.title,
          content: response.data.content,
          excerpt: response.data.excerpt || '',
        }
        setGeneratedContent(content)
        setEditedContent(content)
      }
      
      // Mudar para o step de keywords após sucesso
      console.log('Mudando para step keywords')
      setStep('keywords')
    } catch (error: any) {
      console.error('Erro ao gerar palavras-chave e conteúdo:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Erro ao gerar palavras-chave e conteúdo'
      alert(errorMessage)
      setKeywords([])
      // Não mudar o step em caso de erro
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  const handleRegenerateContent = async () => {
    if (!topic.trim() || keywords.length === 0) return

    setLoading(true)
    setLoadingMessage('Regenerando conteúdo...')
    try {
      const response = await axios.post('/api/generate-content', {
        topic,
        keywords,
        ctaText: ctaText || undefined,
        ctaLink: ctaLink || undefined,
      })
      
      if (response.data) {
        const content = {
          title: response.data.title,
          content: response.data.content,
          excerpt: response.data.excerpt || '',
        }
        setGeneratedContent(content)
        setEditedContent(content)
        setIsEditing(false)
      }
    } catch (error: any) {
      console.error('Erro ao regenerar conteúdo:', error)
      alert('Erro ao regenerar conteúdo: ' + (error.response?.data?.error || error.message))
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  const handleAddCustomKeywords = () => {
    const newKeywords = customKeywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
    setKeywords([...keywords, ...newKeywords])
    setCustomKeywords('')
  }

  const handleSearchImages = async () => {
    if (!topic.trim()) return

    setLoading(true)
    try {
      const response = await axios.post('/api/search-images', { query: topic })
      setImages(response.data.images || [])
      if (response.data.images?.length > 0) {
        setSelectedImage(response.data.images[0])
      }
      setStep('images')
    } catch (error) {
      console.error('Erro ao buscar imagens:', error)
      alert('Erro ao buscar imagens')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateContent = async () => {
    if (!selectedSiteId || !topic || keywords.length === 0) return

    setLoading(true)
    setLoadingMessage('Gerando conteúdo do post...')
    try {
      const response = await axios.post('/api/generate-content', {
        topic,
        keywords,
        ctaText: ctaText || undefined,
        ctaLink: ctaLink || undefined,
      })
      
      if (response.data) {
        const content = {
          title: response.data.title,
          content: response.data.content,
          excerpt: response.data.excerpt || '',
        }
        setGeneratedContent(content)
        setEditedContent(content)
        setIsEditing(false)
      }
      setStep('review')
    } catch (error) {
      console.error('Erro ao gerar conteúdo:', error)
      alert('Erro ao gerar conteúdo')
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  const handlePublish = async () => {
    if (!selectedSiteId || !generatedContent) return

    // Usar conteúdo editado se estiver editando, senão usar o gerado
    const contentToPublish = editedContent || generatedContent

    setLoading(true)
    setLoadingMessage('Publicando no WordPress...')
    try {
      const response = await axios.post('/api/publish-post', {
        siteId: selectedSiteId,
        topic: topic,
        title: contentToPublish.title,
        content: contentToPublish.content,
        excerpt: contentToPublish.excerpt,
        imageUrl: selectedImage,
        keywords: keywords,
        seoTitle: contentToPublish.title,
        seoDescription: contentToPublish.excerpt,
        focusKeyword: keywords[0] || '',
        ctaText: ctaText || undefined,
        ctaLink: ctaLink || undefined,
      })
      setPostLink(response.data.link)
      setStep('success')
    } catch (error: any) {
      console.error('Erro ao publicar:', error)
      alert('Erro ao publicar post: ' + (error.response?.data?.error || error.message))
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  if (sites.length === 0) {
    return (
      <Box px={4} py={6}>
        <AlertRoot status="warning" borderRadius="lg" bg="yellow.900" color="yellow.100">
          <AlertIndicator />
          <AlertContent>
            Você precisa cadastrar pelo menos um site WordPress antes de criar posts.
            Vá para a aba "Meus Sites" para adicionar um site.
          </AlertContent>
        </AlertRoot>
      </Box>
    )
  }

  return (
    <Box px={4} py={6}>
      <Box bg="gray.800" borderRadius="lg" shadow="md" p={8} borderWidth="1px" borderColor="gray.700">
        <Heading size="lg" color="gray.50" mb={6}>
          Criar Novo Post
        </Heading>

        {step === 'topic' && (
          <VStack gap={6} align="stretch">
            <FieldRoot mb={4}>
              <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
                Selecione o Site WordPress
              </FieldLabel>
              <Box
                as="select"
                defaultValue={selectedSiteId}
                onChange={(e: any) => setSelectedSiteId(e.target.value)}
                w="full"
                px={4}
                py={3}
                bg="gray.700"
                borderWidth="1px"
                borderColor="gray.600"
                borderRadius="lg"
                color="gray.50"
                fontSize="md"
                _focus={{ borderColor: 'blue.500', outline: 'none', boxShadow: '0 0 0 1px blue.500' }}
                _hover={{ borderColor: 'gray.500' }}
              >
                <option value="" style={{ background: '#374151' }}>Selecione um site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id} style={{ background: '#374151' }}>
                    {site.name} - {site.url}
                  </option>
                ))}
              </Box>
            </FieldRoot>

            <FieldRoot mb={4}>
              <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
                Tema/Tópico do Post
              </FieldLabel>
              <Input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ex: Como criar um blog profissional"
                bg="gray.700"
                borderColor="gray.600"
                color="gray.50"
                size="lg"
                px={4}
                py={3}
                _placeholder={{ color: 'gray.400' }}
                _focus={{ borderColor: 'blue.500', bg: 'gray.700', boxShadow: '0 0 0 1px blue.500' }}
              />
            </FieldRoot>

            <FieldRoot mb={4}>
              <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
                CTA - Texto (opcional)
              </FieldLabel>
              <Input
                type="text"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="Ex: Quer saber mais? Entre em contato!"
                bg="gray.700"
                borderColor="gray.600"
                color="gray.50"
                size="lg"
                px={4}
                py={3}
                _placeholder={{ color: 'gray.400' }}
                _focus={{ borderColor: 'blue.500', bg: 'gray.700', boxShadow: '0 0 0 1px blue.500' }}
              />
            </FieldRoot>

            <FieldRoot mb={6}>
              <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
                CTA - Link do WhatsApp (opcional)
              </FieldLabel>
              <Input
                type="url"
                value={ctaLink}
                onChange={(e) => setCtaLink(e.target.value)}
                placeholder="https://wa.me/5511999999999"
                bg="gray.700"
                borderColor="gray.600"
                color="gray.50"
                size="lg"
                px={4}
                py={3}
                _placeholder={{ color: 'gray.400' }}
                _focus={{ borderColor: 'blue.500', bg: 'gray.700', boxShadow: '0 0 0 1px blue.500' }}
              />
            </FieldRoot>

            <Button
              onClick={handleGenerateKeywords}
              disabled={!topic.trim() || !selectedSiteId || loading}
              colorPalette="blue"
              size="lg"
              width="full"
              height="50px"
              fontSize="md"
              fontWeight="semibold"
              loading={loading}
              loadingText={loadingMessage || 'Gerando...'}
              boxShadow="md"
              _hover={{ transform: 'translateY(-1px)', boxShadow: 'lg' }}
              _active={{ transform: 'translateY(0)' }}
              transition="all 0.2s"
            >
              Gerar Palavras-chave
            </Button>
          </VStack>
        )}

        {step === 'keywords' && (
          <VStack gap={6} align="stretch">
            <Box>
              <Heading size="md" color="gray.50" mb={4}>
                Palavras-chave Geradas
              </Heading>
              <HStack gap={2} flexWrap="wrap" mb={4}>
                {Array.isArray(keywords) && keywords.length > 0 ? (
                  keywords.map((keyword, index) => (
                    <Badge key={index} colorPalette="blue" fontSize="sm" px={3} py={1}>
                      {keyword}
                    </Badge>
                  ))
                ) : (
                  <Text color="gray.400" fontSize="sm">
                    Nenhuma palavra-chave gerada ainda.
                  </Text>
                )}
              </HStack>
              <HStack gap={2}>
                <Input
                  type="text"
                  value={customKeywords}
                  onChange={(e) => setCustomKeywords(e.target.value)}
                  placeholder="Adicionar palavras-chave (separadas por vírgula)"
                  flex={1}
                  bg="gray.700"
                  borderColor="gray.600"
                  color="gray.50"
                  _placeholder={{ color: 'gray.400' }}
                  _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCustomKeywords()}
                />
                <Button onClick={handleAddCustomKeywords} colorPalette="gray">
                  Adicionar
                </Button>
              </HStack>
            </Box>

            <HStack gap={4}>
              <Button
                onClick={() => setStep('topic')}
                variant="outline"
                colorPalette="gray"
                flex={1}
              >
                Voltar
              </Button>
              <Button
                onClick={handleSearchImages}
                disabled={keywords.length === 0 || loading}
                colorPalette="blue"
                flex={1}
                loading={loading}
                loadingText="Buscando..."
              >
                Buscar Imagens
              </Button>
            </HStack>
          </VStack>
        )}

        {step === 'images' && (
          <VStack gap={6} align="stretch">
            <Heading size="md" color="gray.50">
              Selecione uma Imagem
            </Heading>
            <SimpleGrid columns={{ base: 2, md: 3 }} gap={4}>
              {images.map((image, index) => (
                <Box
                  key={index}
                  onClick={() => setSelectedImage(image)}
                  cursor="pointer"
                  borderWidth="2px"
                  borderRadius="lg"
                  overflow="hidden"
                  borderColor={selectedImage === image ? 'blue.500' : 'gray.600'}
                  _hover={{ borderColor: 'blue.400' }}
                >
                  <img
                    src={image}
                    alt={`Imagem ${index + 1}`}
                    style={{ width: '100%', height: '8rem', objectFit: 'cover', borderRadius: '0.5rem' }}
                  />
                </Box>
              ))}
            </SimpleGrid>
            <HStack gap={4}>
              <Button
                onClick={() => setStep('keywords')}
                variant="outline"
                colorPalette="gray"
                flex={1}
              >
                Voltar
              </Button>
              <Button
                onClick={handleGenerateContent}
                disabled={!selectedImage || loading}
                colorPalette="blue"
                flex={1}
                loading={loading}
                loadingText="Gerando Conteúdo..."
              >
                Gerar Conteúdo do Post
              </Button>
            </HStack>
          </VStack>
        )}

        {step === 'review' && generatedContent && (
          <VStack gap={6} align="stretch">
            <HStack justify="space-between" align="center">
              <Heading size="md" color="gray.50">
                Revisar Post
              </Heading>
              <HStack gap={2}>
                <Button
                  onClick={() => setIsEditing(!isEditing)}
                  variant="outline"
                  colorPalette="blue"
                  size="sm"
                >
                  {isEditing ? 'Cancelar Edição' : 'Editar'}
                </Button>
                <Button
                  onClick={handleRegenerateContent}
                  variant="outline"
                  colorPalette="purple"
                  size="sm"
                  loading={loading && loadingMessage.includes('Regenerando')}
                  loadingText="Regenerando..."
                >
                  Regenerar
                </Button>
              </HStack>
            </HStack>

            {isEditing ? (
              <VStack gap={4} align="stretch">
                <FieldRoot>
                  <FieldLabel color="gray.300" fontWeight="medium">
                    Título
                  </FieldLabel>
                  <Input
                    value={editedContent?.title || ''}
                    onChange={(e) =>
                      setEditedContent({
                        ...(editedContent || generatedContent),
                        title: e.target.value,
                      })
                    }
                    bg="gray.700"
                    borderColor="gray.600"
                    color="gray.50"
                    _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
                  />
                </FieldRoot>

                <FieldRoot>
                  <FieldLabel color="gray.300" fontWeight="medium">
                    Conteúdo (HTML)
                  </FieldLabel>
                  <Textarea
                    value={editedContent?.content || ''}
                    onChange={(e) =>
                      setEditedContent({
                        ...(editedContent || generatedContent),
                        content: e.target.value,
                      })
                    }
                    rows={15}
                    bg="gray.700"
                    borderColor="gray.600"
                    color="gray.50"
                    fontFamily="mono"
                    fontSize="sm"
                    _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
                  />
                </FieldRoot>

                <FieldRoot>
                  <FieldLabel color="gray.300" fontWeight="medium">
                    Resumo/Excerpt
                  </FieldLabel>
                  <Textarea
                    value={editedContent?.excerpt || ''}
                    onChange={(e) =>
                      setEditedContent({
                        ...(editedContent || generatedContent),
                        excerpt: e.target.value,
                      })
                    }
                    rows={3}
                    bg="gray.700"
                    borderColor="gray.600"
                    color="gray.50"
                    _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
                  />
                </FieldRoot>

                <HStack gap={4}>
                  <Button
                    onClick={() => {
                      setIsEditing(false)
                      setEditedContent(generatedContent)
                    }}
                    variant="outline"
                    colorPalette="gray"
                    flex={1}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => {
                      if (editedContent) {
                        setGeneratedContent(editedContent)
                      }
                      setIsEditing(false)
                    }}
                    colorPalette="blue"
                    flex={1}
                  >
                    Salvar Edições
                  </Button>
                </HStack>
              </VStack>
            ) : (
              <>
                <Box
                  borderWidth="1px"
                  borderColor="gray.600"
                  borderRadius="lg"
                  p={6}
                  bg="gray.700"
                >
                  <Heading size="lg" color="gray.50" mb={4}>
                    {generatedContent.title}
                  </Heading>
                  <Box
                    color="gray.300"
                    dangerouslySetInnerHTML={{ __html: generatedContent.content }}
                    className="blog-content"
                  />
                </Box>
                <HStack gap={4}>
                  <Button
                    onClick={() => setStep('images')}
                    variant="outline"
                    colorPalette="gray"
                    flex={1}
                  >
                    Voltar
                  </Button>
                  <Button
                    onClick={handlePublish}
                    disabled={loading}
                    colorPalette="green"
                    flex={1}
                    loading={loading}
                    loadingText="Publicando..."
                  >
                    Publicar no WordPress
                  </Button>
                </HStack>
              </>
            )}
          </VStack>
        )}

        {step === 'success' && postLink && (
          <Box textAlign="center" py={8}>
            <AlertRoot status="success" borderRadius="lg" bg="green.900" color="green.100" mb={4}>
              <AlertIndicator />
              <AlertContent>
                <Heading size="md" mb={2}>
                  Post Publicado com Sucesso!
                </Heading>
                <Text mb={4}>Seu post foi publicado no WordPress.</Text>
                <Button
                  asChild
                  colorPalette="green"
                  size="lg"
                >
                  <a href={postLink} target="_blank" rel="noopener noreferrer">
                    Ver Post
                  </a>
                </Button>
              </AlertContent>
            </AlertRoot>
            <Button
              onClick={() => {
                setStep('topic')
                setTopic('')
                setKeywords([])
                setSelectedImage(null)
                setGeneratedContent(null)
                setEditedContent(null)
                setIsEditing(false)
                setPostLink(null)
                setCtaText('')
                setCtaLink('')
              }}
              variant="ghost"
              colorPalette="blue"
            >
              Criar Novo Post
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}
