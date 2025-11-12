'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Box,
  Heading,
  FieldRoot,
  FieldLabel,
  Button,
  AlertRoot,
  AlertIndicator,
  AlertContent,
  Text,
  VStack,
  HStack,
  Spinner,
  Badge,
  Image,
  SimpleGrid,
} from '@chakra-ui/react'
import { useToastContext } from '@/contexts/ToastContext'

interface Site {
  id: string
  name: string
  url: string
  cta_text?: string
  cta_link?: string
  phone_number?: string
}

interface GeneratedContent {
  topic: string
  title: string
  content: string
  excerpt: string
  keywords: string[]
  imageUrl: string | null
  trendSource: string
}

interface AutoContentGeneratorProps {
  sites: Site[]
  userId: string
}

export default function AutoContentGenerator({
  sites,
  userId,
}: AutoContentGeneratorProps) {
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null)
  const [postLink, setPostLink] = useState<string | null>(null)
  const [ctaText, setCtaText] = useState<string>('')
  const [ctaLink, setCtaLink] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSearchingImage, setIsSearchingImage] = useState(false)
  const [imageKey, setImageKey] = useState(0)
  const toast = useToastContext()

  // Atualizar CTA quando o site selecionado mudar
  useEffect(() => {
    if (selectedSiteId) {
      const selectedSite = sites.find((s) => s.id === selectedSiteId)
      if (selectedSite) {
        setCtaText(selectedSite.cta_text || '')
        setCtaLink(selectedSite.cta_link || '')
      }
    } else {
      setCtaText('')
      setCtaLink('')
    }
  }, [selectedSiteId, sites])

  const handleGenerate = async () => {
    if (!selectedSiteId) {
      toast.warning('Site não selecionado', 'Por favor, selecione um site')
      return
    }

    if (isGenerating) {
      toast.info('Aguarde', 'Já existe uma geração em andamento')
      return
    }

    setIsGenerating(true)
    setLoading(true)
    setLoadingMessage('Carregando configurações...')
    setError(null)
    setGeneratedContent(null)
    setPostLink(null)
    toast.info('Iniciando geração automática', 'Aguarde enquanto processamos...')

    try {
      // 1. Buscar configurações de automação para o site selecionado
      setLoadingMessage('Buscando configurações de automação...')
      const settingsResponse = await axios.get(
        `/api/get-automation-settings?siteId=${selectedSiteId}`
      )
      
      if (!settingsResponse.data || !settingsResponse.data.business_category) {
        const errorMsg = 'Por favor, configure a automação para este site primeiro na aba "Automação".'
        setError(errorMsg)
        toast.error('Configuração necessária', errorMsg)
        return
      }

      const businessCategory = settingsResponse.data.business_category

      // 2. Gerar conteúdo automático
      setLoadingMessage('Pesquisando tendências do mercado...')
      toast.info('Pesquisando tendências', 'Analisando o mercado...')
      
      setLoadingMessage('Gerando conteúdo...')
      const contentResponse = await axios.post('/api/generate-automated-content', {
        siteId: selectedSiteId,
        businessCategory,
      })

      if (!contentResponse.data) {
        throw new Error('Erro ao gerar conteúdo')
      }

      setGeneratedContent(contentResponse.data)
      toast.success('Conteúdo gerado!', 'Conteúdo automático gerado com sucesso')
    } catch (error: any) {
      console.error('Erro ao gerar conteúdo automático:', error)
      const errorMsg = error.response?.data?.error || error.message || 'Erro ao gerar conteúdo automático'
      setError(errorMsg)
      toast.error('Erro ao gerar conteúdo', errorMsg)
    } finally {
      setIsGenerating(false)
      setLoading(false)
      setLoadingMessage('')
    }
  }

  const handlePublish = async () => {
    if (!selectedSiteId || !generatedContent) {
      toast.warning('Dados incompletos', 'Conteúdo ou site não selecionado')
      return
    }

    if (publishing) {
      toast.info('Aguarde', 'Já existe uma publicação em andamento')
      return
    }

    setPublishing(true)
    setError(null)
    toast.info('Publicando', 'Enviando post para o WordPress...')

    try {
      const response = await axios.post('/api/publish-post', {
        siteId: selectedSiteId,
        topic: generatedContent.topic,
        title: generatedContent.title,
        content: generatedContent.content,
        excerpt: generatedContent.excerpt,
        imageUrl: generatedContent.imageUrl,
        keywords: generatedContent.keywords,
        seoTitle: generatedContent.title,
        seoDescription: generatedContent.excerpt,
        focusKeyword: generatedContent.keywords[0] || '',
        ctaText: ctaText || undefined,
        ctaLink: ctaLink || undefined,
      })

      setPostLink(response.data.link)
      setGeneratedContent(null)
      toast.success('Post publicado!', 'Post publicado com sucesso no WordPress')
    } catch (error: any) {
      console.error('Erro ao publicar:', error)
      const errorMsg = 'Erro ao publicar post: ' + (error.response?.data?.error || error.message)
      setError(errorMsg)
      toast.error('Erro ao publicar', errorMsg)
    } finally {
      setPublishing(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!selectedSiteId || !generatedContent) {
      toast.warning('Dados incompletos', 'Conteúdo ou site não selecionado')
      return
    }

    if (saving) {
      toast.info('Aguarde', 'Já existe um salvamento em andamento')
      return
    }

    setSaving(true)
    setError(null)
    toast.info('Salvando rascunho', 'Salvando post como rascunho no WordPress...')

    try {
      const response = await axios.post('/api/save-draft', {
        siteId: selectedSiteId,
        topic: generatedContent.topic,
        title: generatedContent.title,
        content: generatedContent.content,
        excerpt: generatedContent.excerpt,
        imageUrl: generatedContent.imageUrl,
        keywords: generatedContent.keywords,
        trendSource: generatedContent.trendSource,
      })

      setPostLink(response.data.link)
      setGeneratedContent(null)
      toast.success('Rascunho salvo!', 'Post salvo como rascunho no WordPress')
    } catch (error: any) {
      console.error('Erro ao salvar rascunho:', error)
      const errorMsg = 'Erro ao salvar rascunho: ' + (error.response?.data?.error || error.message)
      setError(errorMsg)
      toast.error('Erro ao salvar rascunho', errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleSearchNewImage = async () => {
    if (!generatedContent) {
      toast.warning('Sem conteúdo', 'Nenhum conteúdo gerado para buscar imagem')
      return
    }

    if (isSearchingImage) {
      toast.info('Aguarde', 'Já existe uma busca de imagem em andamento')
      return
    }

    setIsSearchingImage(true)
    toast.info('Buscando imagem', 'Procurando uma nova imagem...')

    try {
      const response = await axios.post('/api/search-images', {
        query: generatedContent.topic || generatedContent.title,
      })

      console.log('Resposta da API de imagens:', response.data)

      // Verificar diferentes formatos de resposta
      let newImageUrl: string | null = null
      
      if (response.data.images && Array.isArray(response.data.images) && response.data.images.length > 0) {
        // Se for array de objetos com propriedade url
        if (typeof response.data.images[0] === 'object' && response.data.images[0].url) {
          newImageUrl = response.data.images[0].url
        } 
        // Se for array de strings (URLs diretas)
        else if (typeof response.data.images[0] === 'string') {
          newImageUrl = response.data.images[0]
        }
      } 
      // Se a resposta for uma string direta
      else if (typeof response.data === 'string') {
        newImageUrl = response.data
      }
      // Se a resposta tiver uma propriedade imageUrl
      else if (response.data.imageUrl) {
        newImageUrl = response.data.imageUrl
      }

      if (newImageUrl) {
        // Forçar atualização do estado criando um novo objeto
        setGeneratedContent((prev) => {
          if (!prev) return null
          return {
            ...prev,
            imageUrl: newImageUrl,
          }
        })
        // Atualizar a key para forçar re-renderização da imagem
        setImageKey((prev) => prev + 1)
        toast.success('Nova imagem encontrada!', 'Imagem atualizada com sucesso')
      } else {
        toast.warning('Nenhuma imagem encontrada', 'Tente novamente ou continue com a imagem atual')
      }
    } catch (error: any) {
      console.error('Erro ao buscar nova imagem:', error)
      toast.error('Erro ao buscar imagem', error.response?.data?.error || error.message || 'Erro ao buscar nova imagem')
    } finally {
      setIsSearchingImage(false)
    }
  }

  const handleReset = () => {
    if (isGenerating || publishing || saving) {
      toast.info('Aguarde', 'Operação em andamento, aguarde a conclusão')
      return
    }
    setGeneratedContent(null)
    setPostLink(null)
    setError(null)
    setSelectedSiteId('')
    toast.info('Resetado', 'Pronto para gerar novo conteúdo')
  }

  if (sites.length === 0) {
    return (
      <Box px={4} py={6}>
        <AlertRoot status="warning" borderRadius="lg" bg="yellow.900" color="yellow.100">
          <AlertIndicator />
          <AlertContent>
            Você precisa cadastrar pelo menos um site WordPress antes de gerar conteúdo automático.
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
          Gerar Conteúdo Automático
        </Heading>

        {!generatedContent && !postLink && (
          <VStack gap={6} align="stretch">
            <Text color="gray.300" fontSize="sm">
              O sistema irá pesquisar tendências do mercado baseado na categoria do seu negócio,
              gerar conteúdo completo e selecionar uma imagem automaticamente. Você poderá revisar
              o conteúdo antes de publicar ou salvar como rascunho.
            </Text>

            <FieldRoot>
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
                style={{
                  appearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23ffffff\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  paddingRight: '2.5rem',
                }}
              >
                <option value="" style={{ background: '#374151' }}>
                  Selecione um site
                </option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id} style={{ background: '#374151' }}>
                    {site.name} - {site.url}
                  </option>
                ))}
              </Box>
            </FieldRoot>

            {error && (
              <AlertRoot status="error" borderRadius="md" bg="red.900" color="red.100">
                <AlertIndicator />
                <AlertContent>{error}</AlertContent>
              </AlertRoot>
            )}

            {isGenerating && (
              <Box mb={4} p={4} bg="gray.700" borderRadius="md" borderWidth="1px" borderColor="gray.600">
                <HStack gap={3} align="center">
                  <Spinner size="sm" color="blue.500" />
                  <Text fontSize="sm" color="gray.300" fontWeight="medium">
                    {loadingMessage || 'Processando...'}
                  </Text>
                </HStack>
              </Box>
            )}
            <Button
              onClick={handleGenerate}
              disabled={!selectedSiteId || isGenerating}
              colorPalette="blue"
              size="lg"
              width="full"
              height="50px"
              fontSize="md"
              fontWeight="semibold"
              loading={isGenerating}
              loadingText={loadingMessage || 'Gerando...'}
              boxShadow="md"
              _hover={isGenerating ? {} : { transform: 'translateY(-1px)', boxShadow: 'lg' }}
              _active={isGenerating ? {} : { transform: 'translateY(0)' }}
              transition="all 0.2s"
            >
              {isGenerating ? 'Gerando...' : 'Gerar Conteúdo Automático'}
            </Button>
          </VStack>
        )}

        {generatedContent && (
          <VStack gap={6} align="stretch">
            <HStack justify="space-between" align="center">
              <Heading size="md" color="gray.50">
                Conteúdo Gerado
              </Heading>
              <Button
                onClick={handleReset}
                variant="ghost"
                colorPalette="gray"
                size="sm"
                disabled={isGenerating || publishing || saving}
              >
                {isGenerating ? 'Gerando...' : 'Gerar Novo'}
              </Button>
            </HStack>

            {error && (
              <AlertRoot status="error" borderRadius="md" bg="red.900" color="red.100">
                <AlertIndicator />
                <AlertContent>{error}</AlertContent>
              </AlertRoot>
            )}

            {generatedContent.imageUrl && (
              <Box>
                <Image
                  key={`${generatedContent.imageUrl}-${imageKey}`}
                  src={generatedContent.imageUrl}
                  alt={generatedContent.title}
                  borderRadius="lg"
                  maxH="400px"
                  w="full"
                  objectFit="cover"
                  mb={3}
                  onError={(e) => {
                    console.error('Erro ao carregar imagem:', generatedContent.imageUrl)
                    toast.error('Erro ao carregar imagem', 'A imagem não pôde ser carregada')
                  }}
                />
                <Button
                  onClick={handleSearchNewImage}
                  disabled={isSearchingImage || publishing || saving}
                  variant="outline"
                  colorPalette="blue"
                  size="sm"
                  w="full"
                  loading={isSearchingImage}
                  loadingText="Buscando..."
                >
                  Selecionar Outra Imagem
                </Button>
              </Box>
            )}

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
              
              {generatedContent.excerpt && (
                <Text color="gray.300" fontSize="md" mb={4} fontStyle="italic">
                  {generatedContent.excerpt}
                </Text>
              )}

              <Box
                color="gray.300"
                dangerouslySetInnerHTML={{ __html: generatedContent.content }}
                className="blog-content"
              />
            </Box>

            {generatedContent.keywords && generatedContent.keywords.length > 0 && (
              <Box>
                <Text color="gray.300" fontWeight="medium" mb={2}>
                  Palavras-chave:
                </Text>
                <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} gap={2}>
                  {generatedContent.keywords.map((keyword, idx) => (
                    <Badge key={idx} colorPalette="blue" fontSize="xs" color="blue.200" bg="blue.900">
                      {keyword}
                    </Badge>
                  ))}
                </SimpleGrid>
              </Box>
            )}

            <HStack gap={4}>
              <Button
                onClick={handleSaveDraft}
                disabled={publishing || saving || isSearchingImage}
                variant="outline"
                colorPalette="gray"
                flex={1}
                loading={saving}
                loadingText="Salvando..."
              >
                Salvar como Rascunho
              </Button>
              <Button
                onClick={handlePublish}
                disabled={publishing || saving || isSearchingImage}
                colorPalette="green"
                flex={1}
                loading={publishing}
                loadingText="Publicando..."
              >
                Publicar
              </Button>
            </HStack>
          </VStack>
        )}

        {postLink && (
          <VStack gap={4} align="stretch" mt={6}>
            <AlertRoot status="success" borderRadius="md" bg="green.900" color="green.100">
              <AlertIndicator />
              <AlertContent>
                <Heading size="md" mb={2}>
                  {publishing ? 'Post Publicado com Sucesso!' : 'Rascunho Salvo com Sucesso!'}
                </Heading>
                <Text mb={4}>
                  {publishing
                    ? 'Seu post foi publicado no WordPress.'
                    : 'Seu post foi salvo como rascunho no WordPress.'}
                </Text>
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
              onClick={handleReset}
              variant="ghost"
              colorPalette="blue"
            >
              Gerar Novo Conteúdo
            </Button>
          </VStack>
        )}
      </Box>
    </Box>
  )
}
