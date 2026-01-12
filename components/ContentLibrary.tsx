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
  Input,
  CardRoot,
  CardBody,
  FieldRoot,
  FieldLabel,
  AlertRoot,
  AlertIndicator,
  AlertContent,
} from '@chakra-ui/react'
import { useToastContext } from '@/contexts/ToastContext'
import ContentSnippet from './ContentSnippet'

interface LibraryItem {
  id: string
  title: string
  content: string
  content_type: 'snippet' | 'cta' | 'template' | 'section'
  tags: string[]
  category: string | null
  is_favorite: boolean
  usage_count: number
  created_at: string
}

export default function ContentLibrary() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterType, setFilterType] = useState<string>('')
  const [filterTag, setFilterTag] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const toast = useToastContext()

  useEffect(() => {
    loadItems()
  }, [filterType, filterTag])

  const loadItems = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterType) params.append('contentType', filterType)
      if (filterTag) params.append('tag', filterTag)

      const response = await axios.get(`/api/content-library?${params.toString()}`)
      setItems(response.data.items || [])
    } catch (error: any) {
      console.error('Erro ao carregar biblioteca:', error)
      toast.error('Erro ao carregar', 'Não foi possível carregar a biblioteca de conteúdo')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este item da biblioteca?')) {
      return
    }

    try {
      await axios.delete('/api/content-library', { data: { id } })
      toast.success('Removido', 'Item removido da biblioteca com sucesso')
      loadItems()
    } catch (error: any) {
      console.error('Erro ao remover:', error)
      toast.error('Erro ao remover', error.response?.data?.error || 'Erro ao remover item')
    }
  }

  const handleToggleFavorite = async (item: LibraryItem) => {
    try {
      await axios.put('/api/content-library', {
        id: item.id,
        isFavorite: !item.is_favorite,
      })
      toast.success('Atualizado', 'Favorito atualizado')
      loadItems()
    } catch (error: any) {
      console.error('Erro ao atualizar favorito:', error)
      toast.error('Erro', 'Não foi possível atualizar o favorito')
    }
  }

  const filteredItems = items.filter((item) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        item.title.toLowerCase().includes(search) ||
        item.content.toLowerCase().includes(search) ||
        item.tags.some((tag) => tag.toLowerCase().includes(search))
      )
    }
    return true
  })

  const allTags = Array.from(new Set(items.flatMap((item) => item.tags)))

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <Spinner size="xl" color="blue.500" />
      </Box>
    )
  }

  return (
    <VStack gap={6} align="stretch">
      <HStack justify="space-between" align="center">
        <Heading size="lg" color="gray.50">
          Biblioteca de Conteúdo
        </Heading>
        <Button
          colorPalette="blue"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : '+ Novo Item'}
        </Button>
      </HStack>

      {showForm && (
        <ContentSnippet
          onSave={() => {
            setShowForm(false)
            loadItems()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <HStack gap={4}>
        <Input
          placeholder="Buscar por título, conteúdo ou tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          bg="gray.700"
          borderColor="gray.600"
          color="gray.50"
          flex={1}
          _placeholder={{ color: 'gray.400' }}
        />
        <Box
          {...({
            as: 'select',
            value: filterType,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
              setFilterType(e.target.value)
            },
            w: '200px',
            px: 3,
            py: 2,
            bg: 'gray.700',
            borderWidth: '1px',
            borderColor: 'gray.600',
            borderRadius: 'lg',
            color: 'gray.50',
            fontSize: 'sm',
            _focus: { borderColor: 'blue.500', outline: 'none' },
          } as any)}
        >
          <option value="" style={{ background: '#374151' }}>Todos os tipos</option>
          <option value="snippet" style={{ background: '#374151' }}>Snippet</option>
          <option value="cta" style={{ background: '#374151' }}>CTA</option>
          <option value="template" style={{ background: '#374151' }}>Template</option>
          <option value="section" style={{ background: '#374151' }}>Seção</option>
        </Box>
        <Box
          {...({
            as: 'select',
            value: filterTag,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
              setFilterTag(e.target.value)
            },
            w: '200px',
            px: 3,
            py: 2,
            bg: 'gray.700',
            borderWidth: '1px',
            borderColor: 'gray.600',
            borderRadius: 'lg',
            color: 'gray.50',
            fontSize: 'sm',
            _focus: { borderColor: 'blue.500', outline: 'none' },
          } as any)}
        >
          <option value="" style={{ background: '#374151' }}>Todas as tags</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag} style={{ background: '#374151' }}>
              {tag}
            </option>
          ))}
        </Box>
      </HStack>

      {filteredItems.length === 0 ? (
        <AlertRoot status="info" borderRadius="lg" bg="blue.900" color="blue.100">
          <AlertIndicator />
          <AlertContent>
            {items.length === 0
              ? 'Nenhum item na biblioteca ainda. Crie seu primeiro item!'
              : 'Nenhum item encontrado com os filtros selecionados.'}
          </AlertContent>
        </AlertRoot>
      ) : (
        <VStack gap={4} align="stretch">
          {filteredItems.map((item) => (
            <CardRoot key={item.id} bg="gray.700" borderWidth="1px" borderColor="gray.600">
              <CardBody>
                <VStack align="stretch" gap={3}>
                  <HStack justify="space-between" align="start">
                    <VStack align="start" gap={1} flex={1}>
                      <HStack gap={2}>
                        <Heading size="sm" color="gray.50">
                          {item.title}
                        </Heading>
                        {item.is_favorite && (
                          <Badge colorPalette="yellow" fontSize="xs">
                            ⭐ Favorito
                          </Badge>
                        )}
                        <Badge colorPalette="blue" fontSize="xs">
                          {item.content_type}
                        </Badge>
                      </HStack>
                      {item.category && (
                        <Text fontSize="xs" color="gray.400">
                          Categoria: {item.category}
                        </Text>
                      )}
                    </VStack>
                    <HStack gap={2}>
                      <Text fontSize="xs" color="gray.400">
                        Usado {item.usage_count}x
                      </Text>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleFavorite(item)}
                      >
                        {item.is_favorite ? '⭐' : '☆'}
                      </Button>
                      <Button
                        size="sm"
                        colorPalette="red"
                        variant="outline"
                        onClick={() => handleDelete(item.id)}
                      >
                        Remover
                      </Button>
                    </HStack>
                  </HStack>

                  <Box
                    p={3}
                    bg="gray.800"
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="gray.600"
                  >
                    <Text fontSize="sm" color="gray.300" whiteSpace="pre-wrap">
                      {item.content.substring(0, 200)}
                      {item.content.length > 200 && '...'}
                    </Text>
                  </Box>

                  {item.tags.length > 0 && (
                    <HStack gap={2} flexWrap="wrap">
                      {item.tags.map((tag, idx) => (
                        <Badge key={idx} colorPalette="gray" fontSize="xs">
                          {tag}
                        </Badge>
                      ))}
                    </HStack>
                  )}
                </VStack>
              </CardBody>
            </CardRoot>
          ))}
        </VStack>
      )}
    </VStack>
  )
}
