'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { validateWordPressSite } from '@/lib/wordpress'
import {
  Box,
  Heading,
  Button,
  FieldRoot,
  FieldLabel,
  Input,
  AlertRoot,
  AlertIndicator,
  AlertContent,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  CardRoot,
  CardBody,
} from '@chakra-ui/react'

interface WordPressSite {
  id?: string
  name: string
  url: string
  username: string
  password: string
}

interface SiteManagerProps {
  sites: Array<{ id: string; name: string; url: string; username: string }>
  onSitesChange: () => void
  userId: string
}

export default function SiteManager({ sites, onSitesChange, userId }: SiteManagerProps) {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<WordPressSite>({
    name: '',
    url: '',
    username: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const canAddSite = sites.length < 3

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!validateWordPressSite(formData.url)) {
      setError('URL inválida. Use http:// ou https://')
      setLoading(false)
      return
    }

    try {
      const passwordEncrypted = btoa(formData.password)

      const { error } = await supabase.from('wordpress_sites').insert({
        user_id: userId,
        name: formData.name,
        url: formData.url.replace(/\/$/, ''),
        username: formData.username,
        password_encrypted: passwordEncrypted,
      })

      if (error) throw error

      setFormData({ name: '', url: '', username: '', password: '' })
      setShowForm(false)
      onSitesChange()
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar site')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este site?')) return

    try {
      const { error } = await supabase
        .from('wordpress_sites')
        .delete()
        .eq('id', id)

      if (error) throw error
      onSitesChange()
    } catch (err: any) {
      alert('Erro ao remover site: ' + err.message)
    }
  }

  return (
    <Box px={4} py={6}>
      <Box
        borderWidth="2px"
        borderStyle="dashed"
        borderColor="gray.700"
        borderRadius="lg"
        p={8}
        bg="gray.800"
      >
        <HStack justify="space-between" align="center" mb={6}>
          <Heading size="lg" color="gray.50">
            Meus Sites WordPress
          </Heading>
          {canAddSite && (
            <Button
              onClick={() => setShowForm(!showForm)}
              colorPalette="blue"
              size="md"
            >
              {showForm ? 'Cancelar' : '+ Adicionar Site'}
            </Button>
          )}
        </HStack>

        {!canAddSite && (
          <AlertRoot status="warning" borderRadius="md" mb={4} bg="yellow.900" color="yellow.100">
            <AlertIndicator />
            <AlertContent>Você atingiu o limite de 3 sites cadastrados.</AlertContent>
          </AlertRoot>
        )}

        {showForm && (
          <Box bg="gray.700" p={6} borderRadius="lg" shadow="md" mb={6}>
            <form onSubmit={handleSubmit}>
              <VStack gap={4} align="stretch">
                <FieldRoot required>
                  <FieldLabel color="gray.300" fontWeight="medium">
                    Nome do Site
                  </FieldLabel>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Meu Blog"
                    bg="gray.600"
                    borderColor="gray.500"
                    color="gray.50"
                    _placeholder={{ color: 'gray.400' }}
                    _focus={{ borderColor: 'blue.500', bg: 'gray.600' }}
                  />
                </FieldRoot>

                <FieldRoot required>
                  <FieldLabel color="gray.300" fontWeight="medium">
                    URL do WordPress
                  </FieldLabel>
                  <Input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://meusite.com"
                    bg="gray.600"
                    borderColor="gray.500"
                    color="gray.50"
                    _placeholder={{ color: 'gray.400' }}
                    _focus={{ borderColor: 'blue.500', bg: 'gray.600' }}
                  />
                </FieldRoot>

                <FieldRoot required>
                  <FieldLabel color="gray.300" fontWeight="medium">
                    Usuário WordPress
                  </FieldLabel>
                  <Input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="admin"
                    bg="gray.600"
                    borderColor="gray.500"
                    color="gray.50"
                    _placeholder={{ color: 'gray.400' }}
                    _focus={{ borderColor: 'blue.500', bg: 'gray.600' }}
                  />
                </FieldRoot>

                <FieldRoot required>
                  <FieldLabel color="gray.300" fontWeight="medium">
                    Senha (Application Password)
                  </FieldLabel>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Use Application Password do WordPress"
                    bg="gray.600"
                    borderColor="gray.500"
                    color="gray.50"
                    _placeholder={{ color: 'gray.400' }}
                    _focus={{ borderColor: 'blue.500', bg: 'gray.600' }}
                  />
                  <Text fontSize="xs" color="gray.400" mt={1}>
                    Crie uma Application Password em: Usuários → Seu Perfil → Application Passwords
                  </Text>
                </FieldRoot>

                {error && (
                  <AlertRoot status="error" borderRadius="md" bg="red.900" color="red.100">
                    <AlertIndicator />
                    <AlertContent>{error}</AlertContent>
                  </AlertRoot>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  colorPalette="blue"
                  width="full"
                  size="lg"
                  loading={loading}
                  loadingText="Salvando..."
                >
                  Salvar Site
                </Button>
              </VStack>
            </form>
          </Box>
        )}

        {sites.length === 0 ? (
          <Box textAlign="center" py={12}>
            <Text color="gray.400">Nenhum site cadastrado ainda.</Text>
            {canAddSite && (
              <Button
                onClick={() => setShowForm(true)}
                variant="ghost"
                colorPalette="blue"
                mt={4}
              >
                Adicionar seu primeiro site
              </Button>
            )}
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            {sites.map((site) => (
              <CardRoot key={site.id} bg="gray.700" borderWidth="1px" borderColor="gray.600">
                <CardBody>
                  <Heading size="md" color="gray.50" mb={2}>
                    {site.name}
                  </Heading>
                  <Text fontSize="sm" color="gray.400" mb={1}>
                    <Text as="span" fontWeight="medium" color="gray.300">
                      URL:
                    </Text>{' '}
                    {site.url}
                  </Text>
                  <Text fontSize="sm" color="gray.400" mb={4}>
                    <Text as="span" fontWeight="medium" color="gray.300">
                      Usuário:
                    </Text>{' '}
                    {site.username}
                  </Text>
                  <Button
                    onClick={() => handleDelete(site.id)}
                    variant="ghost"
                    colorPalette="red"
                    size="sm"
                  >
                    Remover
                  </Button>
                </CardBody>
              </CardRoot>
            ))}
          </SimpleGrid>
        )}
      </Box>
    </Box>
  )
}
