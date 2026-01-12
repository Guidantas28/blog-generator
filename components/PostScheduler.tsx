'use client'

import { useState, useEffect } from 'react'
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
  AlertRoot,
  AlertIndicator,
  AlertContent,
  Spinner,
} from '@chakra-ui/react'
import { useToastContext } from '@/contexts/ToastContext'

interface Site {
  id: string
  name: string
  url: string
}

interface PostSchedulerProps {
  sites: Site[]
  onScheduled?: () => void
}

export default function PostScheduler({ sites, onScheduled }: PostSchedulerProps) {
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToastContext()

  const handleSchedule = async () => {
    if (!selectedSiteId || !title || !content || !scheduledDate || !scheduledTime) {
      toast.warning('Campos obrigatórios', 'Preencha todos os campos necessários')
      return
    }

    // Combinar data e hora
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`)
    
    if (scheduledDateTime <= new Date()) {
      toast.warning('Data inválida', 'A data e hora devem ser no futuro')
      return
    }

    setLoading(true)
    try {
      await axios.post('/api/schedule-post', {
        siteId: selectedSiteId,
        topic: title,
        title,
        content,
        excerpt,
        scheduledDate: scheduledDateTime.toISOString(),
      })

      toast.success('Post agendado!', 'O post será publicado na data e hora especificadas')
      
      // Limpar formulário
      setTitle('')
      setContent('')
      setExcerpt('')
      setScheduledDate('')
      setScheduledTime('')
      setSelectedSiteId('')
      
      if (onScheduled) {
        onScheduled()
      }
    } catch (error: any) {
      console.error('Erro ao agendar post:', error)
      toast.error('Erro ao agendar', error.response?.data?.error || error.message || 'Erro ao agendar post')
    } finally {
      setLoading(false)
    }
  }

  // Definir data mínima como hoje
  const today = new Date().toISOString().split('T')[0]
  // Definir hora padrão como 1 hora a partir de agora
  const defaultTime = new Date(Date.now() + 60 * 60 * 1000).toTimeString().slice(0, 5)

  return (
    <Box bg="gray.800" borderRadius="lg" shadow="md" p={8} borderWidth="1px" borderColor="gray.700">
      <Heading size="lg" color="gray.50" mb={6}>
        Agendar Post
      </Heading>

      <VStack gap={6} align="stretch">
        <FieldRoot>
          <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
            Site WordPress
          </FieldLabel>
          <Box
            {...({
              as: 'select',
              value: selectedSiteId,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                setSelectedSiteId(e.target.value)
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
            <option value="" style={{ background: '#374151' }}>Selecione um site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id} style={{ background: '#374151' }}>
                {site.name} - {site.url}
              </option>
            ))}
          </Box>
        </FieldRoot>

        <FieldRoot>
          <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
            Título do Post
          </FieldLabel>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Digite o título do post"
            bg="gray.700"
            borderColor="gray.600"
            color="gray.50"
            size="lg"
            _placeholder={{ color: 'gray.400' }}
            _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
          />
        </FieldRoot>

        <FieldRoot>
          <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
            Conteúdo (HTML)
          </FieldLabel>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Digite o conteúdo do post em HTML"
            rows={10}
            bg="gray.700"
            borderColor="gray.600"
            color="gray.50"
            fontFamily="mono"
            fontSize="sm"
            _placeholder={{ color: 'gray.400' }}
            _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
          />
        </FieldRoot>

        <FieldRoot>
          <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
            Resumo/Excerpt (opcional)
          </FieldLabel>
          <Textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Digite um resumo do post"
            rows={3}
            bg="gray.700"
            borderColor="gray.600"
            color="gray.50"
            _placeholder={{ color: 'gray.400' }}
            _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
          />
        </FieldRoot>

        <HStack gap={4}>
          <FieldRoot flex={1}>
            <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
              Data de Publicação
            </FieldLabel>
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={today}
              bg="gray.700"
              borderColor="gray.600"
              color="gray.50"
              size="lg"
              _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
            />
          </FieldRoot>

          <FieldRoot flex={1}>
            <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
              Hora de Publicação
            </FieldLabel>
            <Input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              bg="gray.700"
              borderColor="gray.600"
              color="gray.50"
              size="lg"
              _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
            />
          </FieldRoot>
        </HStack>

        <Button
          onClick={handleSchedule}
          disabled={!selectedSiteId || !title || !content || !scheduledDate || !scheduledTime || loading}
          colorPalette="blue"
          size="lg"
          width="full"
          loading={loading}
          loadingText="Agendando..."
        >
          Agendar Post
        </Button>
      </VStack>
    </Box>
  )
}
