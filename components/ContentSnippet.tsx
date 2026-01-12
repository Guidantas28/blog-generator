'use client'

import { useState } from 'react'
import axios from 'axios'
import {
  Box,
  Heading,
  FieldRoot,
  FieldLabel,
  Input,
  Button,
  VStack,
  HStack,
} from '@chakra-ui/react'
import { useToastContext } from '@/contexts/ToastContext'

interface ContentSnippetProps {
  onSave?: () => void
  onCancel?: () => void
  initialData?: {
    title: string
    content: string
    contentType: string
    tags: string[]
    category: string
  }
}

export default function ContentSnippet({ onSave, onCancel, initialData }: ContentSnippetProps) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [content, setContent] = useState(initialData?.content || '')
  const [contentType, setContentType] = useState(initialData?.contentType || 'snippet')
  const [tags, setTags] = useState(initialData?.tags?.join(', ') || '')
  const [category, setCategory] = useState(initialData?.category || '')
  const [isFavorite, setIsFavorite] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useToastContext()

  const handleSave = async () => {
    if (!title || !content) {
      toast.warning('Campos obrigatórios', 'Título e conteúdo são obrigatórios')
      return
    }

    setLoading(true)
    try {
      const tagsArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      await axios.post('/api/content-library', {
        title,
        content,
        contentType,
        tags: tagsArray,
        category: category || null,
        isFavorite,
      })

      toast.success('Salvo!', 'Item salvo na biblioteca com sucesso')
      
      // Limpar formulário
      setTitle('')
      setContent('')
      setTags('')
      setCategory('')
      setIsFavorite(false)
      
      if (onSave) {
        onSave()
      }
    } catch (error: any) {
      console.error('Erro ao salvar:', error)
      toast.error('Erro ao salvar', error.response?.data?.error || 'Erro ao salvar item')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box bg="gray.800" borderRadius="lg" shadow="md" p={6} borderWidth="1px" borderColor="gray.700">
      <Heading size="md" color="gray.50" mb={4}>
        Novo Item na Biblioteca
      </Heading>

      <VStack gap={4} align="stretch">
        <FieldRoot>
          <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
            Título
          </FieldLabel>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: CTA para WhatsApp"
            bg="gray.700"
            borderColor="gray.600"
            color="gray.50"
            _placeholder={{ color: 'gray.400' }}
            _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
          />
        </FieldRoot>

        <FieldRoot>
          <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
            Tipo de Conteúdo
          </FieldLabel>
          <Box
            {...({
              as: 'select',
              value: contentType,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                setContentType(e.target.value)
              },
              w: 'full',
              px: 4,
              py: 3,
              bg: 'gray.700',
              borderWidth: '1px',
              borderColor: 'gray.600',
              borderRadius: 'lg',
              color: 'gray.50',
              fontSize: 'md',
              _focus: { borderColor: 'blue.500', outline: 'none', boxShadow: '0 0 0 1px blue.500' },
              _hover: { borderColor: 'gray.500' },
            } as any)}
          >
            <option value="snippet" style={{ background: '#374151' }}>Snippet</option>
            <option value="cta" style={{ background: '#374151' }}>CTA</option>
            <option value="template" style={{ background: '#374151' }}>Template</option>
            <option value="section" style={{ background: '#374151' }}>Seção</option>
          </Box>
        </FieldRoot>

        <FieldRoot>
          <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
            Conteúdo
          </FieldLabel>
          <Box
            {...({
              as: 'textarea',
              value: content,
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setContent(e.target.value)
              },
              placeholder: 'Digite o conteúdo (pode ser HTML)',
              rows: 8,
              bg: 'gray.700',
              borderWidth: '1px',
              borderColor: 'gray.600',
              borderRadius: 'md',
              color: 'gray.50',
              p: 3,
              fontFamily: 'mono',
              fontSize: 'sm',
              _placeholder: { color: 'gray.400' },
              _focus: { borderColor: 'blue.500', bg: 'gray.700', outline: 'none' },
            } as any)}
          />
        </FieldRoot>

        <HStack gap={4}>
          <FieldRoot flex={1}>
            <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
              Tags (separadas por vírgula)
            </FieldLabel>
            <Input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Ex: cta, whatsapp, contato"
              bg="gray.700"
              borderColor="gray.600"
              color="gray.50"
              _placeholder={{ color: 'gray.400' }}
              _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
            />
          </FieldRoot>

          <FieldRoot flex={1}>
            <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
              Categoria (opcional)
            </FieldLabel>
            <Input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex: Marketing"
              bg="gray.700"
              borderColor="gray.600"
              color="gray.50"
              _placeholder={{ color: 'gray.400' }}
              _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
            />
          </FieldRoot>
        </HStack>

        <HStack gap={4}>
          <Button
            onClick={handleSave}
            disabled={!title || !content || loading}
            colorPalette="blue"
            flex={1}
            loading={loading}
            loadingText="Salvando..."
          >
            Salvar na Biblioteca
          </Button>
          {onCancel && (
            <Button
              onClick={onCancel}
              variant="outline"
              colorPalette="gray"
              flex={1}
            >
              Cancelar
            </Button>
          )}
        </HStack>
      </VStack>
    </Box>
  )
}
