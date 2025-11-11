'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Box,
  Heading,
  FieldRoot,
  FieldLabel,
  Input,
  Button,
  AlertRoot,
  AlertIndicator,
  AlertContent,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  CardRoot,
  CardBody,
  Badge,
  Spinner,
} from '@chakra-ui/react'

interface AutomationSetting {
  id: string
  site_id: string
  business_category: string
  days_per_week: number
  frequency: 'weekly' | 'biweekly' | 'monthly'
  site_name?: string
  created_at: string
}

interface Site {
  id: string
  name: string
  url: string
}

export default function AutomationSettings({ userId }: { userId: string }) {
  const [automations, setAutomations] = useState<AutomationSetting[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = createClient()

  const [formData, setFormData] = useState({
    site_id: '',
    business_category: '',
    days_per_week: 1,
    frequency: 'weekly' as 'weekly' | 'biweekly' | 'monthly',
  })

  useEffect(() => {
    loadSites()
    loadAutomations()
  }, [userId])

  const loadSites = async () => {
    try {
      const { data, error } = await supabase
        .from('wordpress_sites')
        .select('id, name, url')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSites(data || [])
    } catch (error) {
      console.error('Erro ao carregar sites:', error)
    }
  }

  const loadAutomations = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Buscar nomes dos sites
      const sitesMap = new Map(sites.map((site) => [site.id, site.name]))
      const automationsWithSiteName = (data || []).map((auto: any) => ({
        ...auto,
        site_name: sitesMap.get(auto.site_id) || 'Site desconhecido',
      }))

      setAutomations(automationsWithSiteName)
    } catch (error) {
      console.error('Erro ao carregar automações:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (sites.length > 0) {
      loadAutomations()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites])

  const handleSave = async () => {
    if (!formData.site_id || !formData.business_category.trim()) {
      setMessage({ type: 'error', text: 'Site e categoria do negócio são obrigatórios' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const automationData = {
        user_id: userId,
        site_id: formData.site_id,
        business_category: formData.business_category.trim(),
        days_per_week: formData.days_per_week,
        frequency: formData.frequency,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error } = await supabase
          .from('automation_settings')
          .update(automationData)
          .eq('id', editingId)

        if (error) throw error
        setMessage({ type: 'success', text: 'Automação atualizada com sucesso!' })
      } else {
        const { error } = await supabase
          .from('automation_settings')
          .insert(automationData)

        if (error) throw error
        setMessage({ type: 'success', text: 'Automação criada com sucesso!' })
      }

      setFormData({
        site_id: '',
        business_category: '',
        days_per_week: 1,
        frequency: 'weekly',
      })
      setShowForm(false)
      setEditingId(null)
      loadAutomations()
    } catch (error: any) {
      console.error('Erro ao salvar automação:', error)
      setMessage({
        type: 'error',
        text: 'Erro ao salvar automação: ' + (error.message || 'Erro desconhecido'),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (automation: AutomationSetting) => {
    setFormData({
      site_id: automation.site_id,
      business_category: automation.business_category,
      days_per_week: automation.days_per_week,
      frequency: automation.frequency,
    })
    setEditingId(automation.id)
    setShowForm(true)
    setMessage(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta automação?')) return

    try {
      const { error } = await supabase
        .from('automation_settings')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadAutomations()
      setMessage({ type: 'success', text: 'Automação excluída com sucesso!' })
    } catch (error: any) {
      console.error('Erro ao excluir automação:', error)
      setMessage({
        type: 'error',
        text: 'Erro ao excluir automação: ' + (error.message || 'Erro desconhecido'),
      })
    }
  }

  const handleCancel = () => {
    setFormData({
      site_id: '',
      business_category: '',
      days_per_week: 1,
      frequency: 'weekly',
    })
    setShowForm(false)
    setEditingId(null)
    setMessage(null)
  }

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'weekly':
        return 'Semanalmente'
      case 'biweekly':
        return 'Quinzenal'
      case 'monthly':
        return 'Mensal'
      default:
        return frequency
    }
  }

  if (loading && automations.length === 0) {
    return (
      <Box px={4} py={6} display="flex" justifyContent="center">
        <Spinner size="xl" color="blue.500" />
      </Box>
    )
  }

  return (
    <Box px={4} py={6}>
      <Box bg="gray.800" borderRadius="lg" shadow="md" p={8} borderWidth="1px" borderColor="gray.700">
        <HStack justify="space-between" align="center" mb={6}>
          <Heading size="lg" color="gray.50">
            Configurações de Automação
          </Heading>
          {!showForm && (
            <Button
              onClick={() => {
                setShowForm(true)
                setEditingId(null)
                setFormData({
                  site_id: '',
                  business_category: '',
                  days_per_week: 1,
                  frequency: 'weekly',
                })
              }}
              colorPalette="blue"
            >
              + Nova Automação
            </Button>
          )}
        </HStack>

        {message && (
          <AlertRoot
            status={message.type}
            borderRadius="md"
            mb={4}
            bg={message.type === 'success' ? 'green.900' : 'red.900'}
            color={message.type === 'success' ? 'green.100' : 'red.100'}
          >
            <AlertIndicator />
            <AlertContent>{message.text}</AlertContent>
          </AlertRoot>
        )}

        {showForm && (
          <Box bg="gray.700" p={6} borderRadius="lg" shadow="md" mb={6}>
            <Heading size="md" color="gray.50" mb={4}>
              {editingId ? 'Editar Automação' : 'Nova Automação'}
            </Heading>

            <VStack gap={6} align="stretch">
              <FieldRoot>
                <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
                  Site WordPress
                </FieldLabel>
                <Box
                  as="select"
                  defaultValue={formData.site_id}
                  onChange={(e: any) => setFormData({ ...formData, site_id: e.target.value })}
                  w="full"
                  px={4}
                  py={3}
                  bg="gray.600"
                  borderWidth="1px"
                  borderColor="gray.500"
                  borderRadius="lg"
                  color="gray.50"
                  fontSize="md"
                  _focus={{ borderColor: 'blue.500', outline: 'none', boxShadow: '0 0 0 1px blue.500' }}
                  _hover={{ borderColor: 'gray.400' }}
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

              <FieldRoot>
                <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
                  Categoria do Negócio
                </FieldLabel>
                <Input
                  type="text"
                  value={formData.business_category}
                  onChange={(e) =>
                    setFormData({ ...formData, business_category: e.target.value })
                  }
                  placeholder="Ex: Marketing Digital, E-commerce, Tecnologia"
                  bg="gray.600"
                  borderColor="gray.500"
                  color="gray.50"
                  size="lg"
                  px={4}
                  py={3}
                  _placeholder={{ color: 'gray.400' }}
                  _focus={{ borderColor: 'blue.500', bg: 'gray.600', boxShadow: '0 0 0 1px blue.500' }}
                />
                <Text fontSize="sm" color="gray.400" mt={1}>
                  Esta categoria será usada para pesquisar tendências relevantes do mercado
                </Text>
              </FieldRoot>

              <FieldRoot>
                <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
                  Dias por Semana
                </FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={formData.days_per_week}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      days_per_week: parseInt(e.target.value) || 1,
                    })
                  }
                  bg="gray.600"
                  borderColor="gray.500"
                  color="gray.50"
                  size="lg"
                  px={4}
                  py={3}
                  _focus={{ borderColor: 'blue.500', bg: 'gray.600', boxShadow: '0 0 0 1px blue.500' }}
                />
                <Text fontSize="sm" color="gray.400" mt={1}>
                  Quantos dias por semana você deseja gerar conteúdo automaticamente
                </Text>
              </FieldRoot>

              <FieldRoot>
                <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
                  Frequência
                </FieldLabel>
                <Box
                  as="select"
                  defaultValue={formData.frequency}
                  onChange={(e: any) =>
                    setFormData({
                      ...formData,
                      frequency: e.target.value as 'weekly' | 'biweekly' | 'monthly',
                    })
                  }
                  w="full"
                  px={4}
                  py={3}
                  bg="gray.600"
                  borderWidth="1px"
                  borderColor="gray.500"
                  borderRadius="lg"
                  color="gray.50"
                  fontSize="md"
                  _focus={{ borderColor: 'blue.500', outline: 'none', boxShadow: '0 0 0 1px blue.500' }}
                  _hover={{ borderColor: 'gray.400' }}
                >
                  <option value="weekly" style={{ background: '#374151' }}>
                    Semanalmente
                  </option>
                  <option value="biweekly" style={{ background: '#374151' }}>
                    Quinzenal
                  </option>
                  <option value="monthly" style={{ background: '#374151' }}>
                    Mensal
                  </option>
                </Box>
                <Text fontSize="sm" color="gray.400" mt={1}>
                  Com que frequência você deseja gerar novos conteúdos
                </Text>
              </FieldRoot>

              <HStack gap={4}>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  colorPalette="gray"
                  flex={1}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !formData.site_id || !formData.business_category.trim()}
                  colorPalette="blue"
                  flex={1}
                  loading={saving}
                  loadingText="Salvando..."
                >
                  {editingId ? 'Atualizar' : 'Salvar'}
                </Button>
              </HStack>
            </VStack>
          </Box>
        )}

        {automations.length === 0 && !showForm ? (
          <Box textAlign="center" py={12}>
            <Text color="gray.400" mb={4}>
              Nenhuma automação configurada ainda.
            </Text>
            <Button
              onClick={() => {
                setShowForm(true)
                setEditingId(null)
              }}
              colorPalette="blue"
            >
              Criar Primeira Automação
            </Button>
          </Box>
        ) : (
          !showForm && (
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
              {automations.map((automation) => (
                <CardRoot key={automation.id} bg="gray.700" borderWidth="1px" borderColor="gray.600">
                  <CardBody>
                    <Heading size="md" color="gray.50" mb={2}>
                      {automation.site_name}
                    </Heading>
                    <Text fontSize="sm" color="gray.400" mb={1}>
                      <Text as="span" fontWeight="medium" color="gray.300">
                        Categoria:
                      </Text>{' '}
                      {automation.business_category}
                    </Text>
                    <Text fontSize="sm" color="gray.400" mb={1}>
                      <Text as="span" fontWeight="medium" color="gray.300">
                        Dias/semana:
                      </Text>{' '}
                      {automation.days_per_week}
                    </Text>
                    <Text fontSize="sm" color="gray.400" mb={4}>
                      <Text as="span" fontWeight="medium" color="gray.300">
                        Frequência:
                      </Text>{' '}
                      <Badge colorPalette="blue" fontSize="xs">
                        {getFrequencyLabel(automation.frequency)}
                      </Badge>
                    </Text>
                    <HStack gap={2}>
                      <Button
                        onClick={() => handleEdit(automation)}
                        variant="outline"
                        colorPalette="blue"
                        size="sm"
                        flex={1}
                      >
                        Editar
                      </Button>
                      <Button
                        onClick={() => handleDelete(automation.id)}
                        variant="ghost"
                        colorPalette="red"
                        size="sm"
                        flex={1}
                      >
                        Excluir
                      </Button>
                    </HStack>
                  </CardBody>
                </CardRoot>
              ))}
            </SimpleGrid>
          )
        )}
      </Box>
    </Box>
  )
}
