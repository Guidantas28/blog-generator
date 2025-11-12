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
  cta_text?: string
  cta_link?: string
  phone_number?: string
}

interface SiteManagerProps {
  sites: Array<{ id: string; name: string; url: string; username: string; cta_text?: string; cta_link?: string; phone_number?: string }>
  onSitesChange: () => void
  userId: string
}

export default function SiteManager({ sites, onSitesChange, userId }: SiteManagerProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<WordPressSite>({
    name: '',
    url: '',
    username: '',
    password: '',
    cta_text: '',
    cta_link: '',
    phone_number: '',
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
      const siteData: any = {
        name: formData.name,
        url: formData.url.replace(/\/$/, ''),
        username: formData.username,
        cta_text: formData.cta_text?.trim() || null,
        cta_link: formData.cta_link?.trim() || null,
        phone_number: formData.phone_number?.trim() || null,
      }

      // Só atualizar senha se foi fornecida (ou se for criação)
      if (!editingId || formData.password.trim()) {
        siteData.password_encrypted = btoa(formData.password)
      }

      if (editingId) {
        // Atualizar site existente
        const { error } = await supabase
          .from('wordpress_sites')
          .update(siteData)
          .eq('id', editingId)
          .eq('user_id', userId)

        if (error) throw error
      } else {
        // Criar novo site
        const { error } = await supabase.from('wordpress_sites').insert({
          user_id: userId,
          ...siteData,
        })

        if (error) throw error
      }

      setFormData({ name: '', url: '', username: '', password: '', cta_text: '', cta_link: '', phone_number: '' })
      setShowForm(false)
      setEditingId(null)
      onSitesChange()
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar site')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (site: { id: string; name: string; url: string; username: string; cta_text?: string; cta_link?: string; phone_number?: string }) => {
    // Buscar a senha não é possível (está encriptada), então deixamos vazio
    setFormData({
      name: site.name,
      url: site.url,
      username: site.username,
      password: '', // Senha não será exibida por segurança
      cta_text: site.cta_text || '',
      cta_link: site.cta_link || '',
      phone_number: site.phone_number || '',
    })
    setEditingId(site.id)
    setShowForm(true)
    setError(null)
  }

  const handleCancel = () => {
    setFormData({ name: '', url: '', username: '', password: '', cta_text: '', cta_link: '', phone_number: '' })
    setShowForm(false)
    setEditingId(null)
    setError(null)
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
          {canAddSite && !editingId && (
            <Button
              onClick={() => {
                setShowForm(!showForm)
                if (showForm) handleCancel()
              }}
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
            <Heading size="md" color="gray.50" mb={4}>
              {editingId ? 'Editar Site' : 'Adicionar Novo Site'}
            </Heading>
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
                    size="lg"
                    px={4}
                    py={3}
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
                    size="lg"
                    px={4}
                    py={3}
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
                    size="lg"
                    px={4}
                    py={3}
                    _placeholder={{ color: 'gray.400' }}
                    _focus={{ borderColor: 'blue.500', bg: 'gray.600' }}
                  />
                </FieldRoot>

                <FieldRoot required={!editingId}>
                  <FieldLabel color="gray.300" fontWeight="medium">
                    Senha (Application Password)
                  </FieldLabel>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingId ? "Deixe em branco para manter a senha atual" : "Use Application Password do WordPress"}
                    bg="gray.600"
                    borderColor="gray.500"
                    color="gray.50"
                    size="lg"
                    px={4}
                    py={3}
                    _placeholder={{ color: 'gray.400' }}
                    _focus={{ borderColor: 'blue.500', bg: 'gray.600' }}
                  />
                  <Text fontSize="xs" color="gray.400" mt={1}>
                    {editingId 
                      ? "Deixe em branco para manter a senha atual. Preencha apenas se desejar alterar."
                      : "Crie uma Application Password em: Usuários → Seu Perfil → Application Passwords"
                    }
                  </Text>
                </FieldRoot>

                <FieldRoot>
                  <FieldLabel color="gray.300" fontWeight="medium">
                    CTA - Texto (opcional)
                  </FieldLabel>
                  <Input
                    type="text"
                    value={formData.cta_text || ''}
                    onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })}
                    placeholder="Ex: Quer saber mais? Entre em contato conosco!"
                    bg="gray.600"
                    borderColor="gray.500"
                    color="gray.50"
                    size="lg"
                    px={4}
                    py={3}
                    _placeholder={{ color: 'gray.400' }}
                    _focus={{ borderColor: 'blue.500', bg: 'gray.600' }}
                  />
                  <Text fontSize="xs" color="gray.400" mt={1}>
                    Texto do Call to Action que será usado nos posts deste site
                  </Text>
                </FieldRoot>

                <FieldRoot>
                  <FieldLabel color="gray.300" fontWeight="medium">
                    CTA - Link do WhatsApp (opcional)
                  </FieldLabel>
                  <Input
                    type="url"
                    value={formData.cta_link || ''}
                    onChange={(e) => setFormData({ ...formData, cta_link: e.target.value })}
                    placeholder="https://wa.me/5511999999999"
                    bg="gray.600"
                    borderColor="gray.500"
                    color="gray.50"
                    size="lg"
                    px={4}
                    py={3}
                    _placeholder={{ color: 'gray.400' }}
                    _focus={{ borderColor: 'blue.500', bg: 'gray.600' }}
                  />
                  <Text fontSize="xs" color="gray.400" mt={1}>
                    Link do WhatsApp que será usado nos posts deste site
                  </Text>
                </FieldRoot>

                <FieldRoot>
                  <FieldLabel color="gray.300" fontWeight="medium">
                    Número de Telefone (opcional)
                  </FieldLabel>
                  <Input
                    type="tel"
                    value={formData.phone_number || ''}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    placeholder="5511999999999"
                    bg="gray.600"
                    borderColor="gray.500"
                    color="gray.50"
                    size="lg"
                    px={4}
                    py={3}
                    _placeholder={{ color: 'gray.400' }}
                    _focus={{ borderColor: 'blue.500', bg: 'gray.600' }}
                  />
                  <Text fontSize="xs" color="gray.400" mt={1}>
                    Número de telefone do WhatsApp (apenas números, com código do país)
                  </Text>
                </FieldRoot>

                {error && (
                  <AlertRoot status="error" borderRadius="md" bg="red.900" color="red.100">
                    <AlertIndicator />
                    <AlertContent>{error}</AlertContent>
                  </AlertRoot>
                )}

                <HStack gap={4}>
                  <Button
                    type="button"
                    onClick={handleCancel}
                    variant="outline"
                    colorPalette="gray"
                    flex={1}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    colorPalette="blue"
                    flex={1}
                    size="lg"
                    loading={loading}
                    loadingText="Salvando..."
                  >
                    {editingId ? 'Atualizar Site' : 'Salvar Site'}
                  </Button>
                </HStack>
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
                  <HStack gap={2}>
                    <Button
                      onClick={() => handleEdit(site)}
                      variant="solid"
                      colorPalette="blue"
                      size="sm"
                      flex={1}
                      bg="blue.600"
                      color="blue.50"
                      _hover={{ bg: 'blue.500' }}
                    >
                      Editar
                    </Button>
                    <Button
                      onClick={() => handleDelete(site.id)}
                      variant="solid"
                      colorPalette="red"
                      size="sm"
                      flex={1}
                      bg="red.600"
                      color="red.50"
                      _hover={{ bg: 'red.500' }}
                    >
                      Remover
                    </Button>
                  </HStack>
                </CardBody>
              </CardRoot>
            ))}
          </SimpleGrid>
        )}
      </Box>
    </Box>
  )
}
