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
  CardRoot,
  CardBody,
  AlertRoot,
  AlertIndicator,
  AlertContent,
} from '@chakra-ui/react'
import { useToastContext } from '@/contexts/ToastContext'

interface PostVersion {
  id: string
  version_number: number
  title: string
  content: string
  excerpt: string | null
  created_at: string
  created_by: string
  notes: string | null
}

interface VersionHistoryProps {
  postId: string
  onRestore?: (version: PostVersion) => void
}

export default function VersionHistory({ postId, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<PostVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<PostVersion | null>(null)
  const toast = useToastContext()

  useEffect(() => {
    loadVersions()
  }, [postId])

  const loadVersions = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/post-versions?postId=${postId}`)
      setVersions(response.data.versions || [])
    } catch (error: any) {
      console.error('Erro ao carregar versões:', error)
      toast.error('Erro ao carregar', 'Não foi possível carregar o histórico de versões')
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = (version: PostVersion) => {
    if (confirm(`Deseja restaurar a versão ${version.version_number}?`)) {
      if (onRestore) {
        onRestore(version)
      }
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <Spinner size="xl" color="blue.500" />
      </Box>
    )
  }

  if (versions.length === 0) {
    return (
      <AlertRoot status="info" borderRadius="lg" bg="blue.900" color="blue.100">
        <AlertIndicator />
        <AlertContent>
          Nenhuma versão salva ainda. As versões são criadas automaticamente quando você edita um post.
        </AlertContent>
      </AlertRoot>
    )
  }

  return (
    <VStack gap={6} align="stretch">
      <Heading size="lg" color="gray.50">
        Histórico de Versões
      </Heading>

      <VStack gap={4} align="stretch">
        {versions.map((version) => (
          <CardRoot
            key={version.id}
            bg={selectedVersion?.id === version.id ? 'gray.700' : 'gray.800'}
            borderWidth="1px"
            borderColor={selectedVersion?.id === version.id ? 'blue.500' : 'gray.600'}
            cursor="pointer"
            onClick={() => setSelectedVersion(version)}
            _hover={{ borderColor: 'blue.400' }}
          >
            <CardBody>
              <VStack align="stretch" gap={3}>
                <HStack justify="space-between" align="center">
                  <HStack gap={2}>
                    <Badge colorPalette="blue" fontSize="sm">
                      Versão {version.version_number}
                    </Badge>
                    <Text fontSize="sm" color="gray.400">
                      {new Date(version.created_at).toLocaleString('pt-BR')}
                    </Text>
                  </HStack>
                  <Button
                    size="sm"
                    colorPalette="blue"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRestore(version)
                    }}
                  >
                    Restaurar
                  </Button>
                </HStack>

                <Heading size="sm" color="gray.50">
                  {version.title}
                </Heading>

                {version.excerpt && (
                  <Text fontSize="sm" color="gray.300" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {version.excerpt}
                  </Text>
                )}

                {version.notes && (
                  <Box
                    bg="gray.700"
                    p={2}
                    borderRadius="md"
                    borderLeftWidth="3px"
                    borderLeftColor="blue.500"
                  >
                    <Text fontSize="xs" color="gray.300" fontStyle="italic">
                      {version.notes}
                    </Text>
                  </Box>
                )}

                {selectedVersion?.id === version.id && (
                  <Box
                    mt={2}
                    p={4}
                    bg="gray.700"
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="gray.600"
                  >
                    <Text fontSize="sm" color="gray.300" whiteSpace="pre-wrap">
                      {version.content.substring(0, 500)}
                      {version.content.length > 500 && '...'}
                    </Text>
                  </Box>
                )}
              </VStack>
            </CardBody>
          </CardRoot>
        ))}
      </VStack>
    </VStack>
  )
}
