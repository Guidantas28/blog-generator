'use client'

import { useState } from 'react'
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

interface Site {
  id: string
  name: string
  url: string
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

  const handleGenerate = async () => {
    if (!selectedSiteId) {
      setError('Por favor, selecione um site')
      return
    }

    setLoading(true)
    setLoadingMessage('Carregando configurações...')
    setError(null)
    setGeneratedContent(null)
    setPostLink(null)

    try {
      // 1. Buscar configurações de automação para o site selecionado
      setLoadingMessage('Buscando configurações de automação...')
      const settingsResponse = await axios.get(
        `/api/get-automation-settings?siteId=${selectedSiteId}`
      )
      
      if (!settingsResponse.data || !settingsResponse.data.business_category) {
        setError(
          `Por favor, configure a automação para este site primeiro na aba "Automação".`
        )
        return
      }

      const businessCategory = settingsResponse.data.business_category

      // 2. Gerar conteúdo automático
      setLoadingMessage('Pesquisando tendências do mercado...')
      const contentResponse = await axios.post('/api/generate-automated-content', {
        siteId: selectedSiteId,
        businessCategory,
      })

      if (!contentResponse.data) {
        throw new Error('Erro ao gerar conteúdo')
      }

      setGeneratedContent(contentResponse.data)
    } catch (error: any) {
      console.error('Erro ao gerar conteúdo automático:', error)
      setError(
        error.response?.data?.error ||
          error.message ||
          'Erro ao gerar conteúdo automático'
      )
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  const handlePublish = async () => {
    if (!selectedSiteId || !generatedContent) return

    setPublishing(true)
    setError(null)

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
      })

      setPostLink(response.data.link)
      setGeneratedContent(null)
    } catch (error: any) {
      console.error('Erro ao publicar:', error)
      setError('Erro ao publicar post: ' + (error.response?.data?.error || error.message))
    } finally {
      setPublishing(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!selectedSiteId || !generatedContent) return

    setSaving(true)
    setError(null)

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
    } catch (error: any) {
      console.error('Erro ao salvar rascunho:', error)
      setError('Erro ao salvar rascunho: ' + (error.response?.data?.error || error.message))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setGeneratedContent(null)
    setPostLink(null)
    setError(null)
    setSelectedSiteId('')
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

            <Button
              onClick={handleGenerate}
              disabled={!selectedSiteId || loading}
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
              Gerar Conteúdo Automático
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
              >
                Gerar Novo
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
                  src={generatedContent.imageUrl}
                  alt={generatedContent.title}
                  borderRadius="lg"
                  maxH="400px"
                  w="full"
                  objectFit="cover"
                />
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
                disabled={publishing || saving}
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
                disabled={publishing || saving}
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
