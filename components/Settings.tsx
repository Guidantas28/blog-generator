'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Box,
  Heading,
  Text,
  VStack,
  Spinner,
  SimpleGrid,
  CardRoot,
  CardBody,
  Badge,
  HStack,
  FieldRoot,
  FieldLabel,
  Input,
  Button,
  AlertRoot,
  AlertIndicator,
  AlertContent,
} from '@chakra-ui/react'
import { useToastContext } from '@/contexts/ToastContext'

export default function Settings({ userId }: { userId: string }) {
  const [sites, setSites] = useState<Array<{ id: string; name: string; cta_text?: string; cta_link?: string; phone_number?: string }>>([])
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('')
  const [currentPasswordForPassword, setCurrentPasswordForPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingEmail, setUpdatingEmail] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const supabase = createClient()
  const toast = useToastContext()

  useEffect(() => {
    loadSites()
    loadUserEmail()
  }, [userId])

  const loadUserEmail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setUserEmail(user.email)
        setNewEmail(user.email)
      }
    } catch (error) {
      console.error('Erro ao carregar email do usuário:', error)
    }
  }

  const loadSites = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('wordpress_sites')
        .select('id, name, cta_text, cta_link, phone_number')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSites(data || [])
    } catch (error) {
      console.error('Erro ao carregar sites:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateEmail = async () => {
    if (!newEmail.trim() || newEmail === userEmail) {
      toast.warning('Email não alterado', 'O novo email deve ser diferente do email atual.')
      return
    }

    if (!currentPasswordForEmail) {
      toast.warning('Senha necessária', 'Por favor, informe sua senha atual para alterar o email.')
      return
    }

    setUpdatingEmail(true)
    try {
      // Verificar senha atual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPasswordForEmail,
      })

      if (signInError) {
        toast.error('Senha incorreta', 'A senha informada está incorreta.')
        setUpdatingEmail(false)
        return
      }

      // Atualizar email
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      })

      if (updateError) throw updateError

      toast.success('Email atualizado', 'Um email de confirmação foi enviado para o novo endereço.')
      setUserEmail(newEmail.trim())
      setCurrentPasswordForEmail('')
    } catch (error: any) {
      console.error('Erro ao atualizar email:', error)
      toast.error('Erro ao atualizar email', error.message || 'Ocorreu um erro ao atualizar o email.')
    } finally {
      setUpdatingEmail(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.warning('Campos obrigatórios', 'Por favor, preencha todos os campos de senha.')
      return
    }

    if (newPassword.length < 6) {
      toast.warning('Senha muito curta', 'A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.warning('Senhas não coincidem', 'A nova senha e a confirmação devem ser iguais.')
      return
    }

    if (!currentPasswordForPassword) {
      toast.warning('Senha atual necessária', 'Por favor, informe sua senha atual.')
      return
    }

    setUpdatingPassword(true)
    try {
      // Verificar senha atual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPasswordForPassword,
      })

      if (signInError) {
        toast.error('Senha incorreta', 'A senha atual informada está incorreta.')
        setUpdatingPassword(false)
        return
      }

      // Atualizar senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) throw updateError

      toast.success('Senha atualizada', 'Sua senha foi atualizada com sucesso!')
      setCurrentPasswordForPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      console.error('Erro ao atualizar senha:', error)
      toast.error('Erro ao atualizar senha', error.message || 'Ocorreu um erro ao atualizar a senha.')
    } finally {
      setUpdatingPassword(false)
    }
  }

  if (loading) {
    return (
      <Box px={4} py={6} display="flex" justifyContent="center">
        <Spinner size="xl" color="blue.500" />
      </Box>
    )
  }

  return (
    <VStack gap={6} align="stretch" px={4} py={6}>
      {/* Seção de Conta */}
      <Box
        bg="gray.800"
        borderRadius="lg"
        shadow="md"
        p={8}
        borderWidth="1px"
        borderColor="gray.700"
      >
        <Heading size="lg" color="gray.50" mb={6}>
          Configurações da Conta
        </Heading>

        <VStack gap={6} align="stretch">
          {/* Alterar Email */}
          <Box>
            <Heading size="md" color="gray.50" mb={4}>
              Alterar Email
            </Heading>
            <VStack gap={4} align="stretch">
              <FieldRoot>
                <FieldLabel color="gray.300" fontWeight="medium">
                  Email Atual
                </FieldLabel>
                <Input
                  type="email"
                  value={userEmail}
                  disabled
                  bg="gray.700"
                  borderColor="gray.600"
                  color="gray.400"
                  size="lg"
                  px={4}
                  py={3}
                />
              </FieldRoot>
              <FieldRoot>
                <FieldLabel color="gray.300" fontWeight="medium">
                  Novo Email
                </FieldLabel>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="novo@email.com"
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
              <FieldRoot>
                <FieldLabel color="gray.300" fontWeight="medium">
                  Senha Atual (necessária para alterar email)
                </FieldLabel>
                <Input
                  type="password"
                  value={currentPasswordForEmail}
                  onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                  placeholder="Digite sua senha atual"
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
              <Button
                onClick={handleUpdateEmail}
                colorPalette="blue"
                size="lg"
                loading={updatingEmail}
                loadingText="Atualizando..."
                disabled={updatingEmail || !newEmail.trim() || newEmail === userEmail || !currentPasswordForEmail}
              >
                Atualizar Email
              </Button>
            </VStack>
          </Box>

          <Box borderTopWidth="1px" borderColor="gray.600" my={2} />

          {/* Alterar Senha */}
          <Box>
            <Heading size="md" color="gray.50" mb={4}>
              Alterar Senha
            </Heading>
            <VStack gap={4} align="stretch">
              <FieldRoot>
                <FieldLabel color="gray.300" fontWeight="medium">
                  Senha Atual
                </FieldLabel>
                <Input
                  type="password"
                  value={currentPasswordForPassword}
                  onChange={(e) => setCurrentPasswordForPassword(e.target.value)}
                  placeholder="Digite sua senha atual"
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
              <FieldRoot>
                <FieldLabel color="gray.300" fontWeight="medium">
                  Nova Senha
                </FieldLabel>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite sua nova senha (mínimo 6 caracteres)"
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
              <FieldRoot>
                <FieldLabel color="gray.300" fontWeight="medium">
                  Confirmar Nova Senha
                </FieldLabel>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme sua nova senha"
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
              <Button
                onClick={handleUpdatePassword}
                colorPalette="blue"
                size="lg"
                loading={updatingPassword}
                loadingText="Atualizando..."
                disabled={updatingPassword || !newPassword || !confirmPassword || !currentPasswordForPassword}
              >
                Atualizar Senha
              </Button>
            </VStack>
          </Box>
        </VStack>
      </Box>

      {/* Seção de CTA por Site */}
      <Box
        bg="gray.800"
        borderRadius="lg"
        shadow="md"
        p={8}
        borderWidth="1px"
        borderColor="gray.700"
      >
        <Heading size="lg" color="gray.50" mb={2}>
          Configurações de CTA por Site
        </Heading>
        <Text color="gray.400" mb={6} fontSize="sm">
          As configurações de CTA (Call to Action) e número de telefone são configuradas individualmente para cada site WordPress.
          Acesse a aba "Meus Sites" para editar as configurações de cada site.
        </Text>

        {loading ? (
          <Box display="flex" justifyContent="center" py={8}>
            <Spinner size="xl" color="blue.500" />
          </Box>
        ) : sites.length === 0 ? (
          <Box textAlign="center" py={12}>
            <Text color="gray.400">Nenhum site cadastrado ainda.</Text>
            <Text color="gray.500" fontSize="sm" mt={2}>
              Adicione um site na aba "Meus Sites" para configurar o CTA.
            </Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            {sites.map((site) => (
              <CardRoot key={site.id} bg="gray.700" borderWidth="1px" borderColor="gray.600">
                <CardBody>
                  <Heading size="md" color="gray.50" mb={3}>
                    {site.name}
                  </Heading>
                  
                  {site.cta_text ? (
                    <VStack align="stretch" gap={2} mb={3}>
                      <Box>
                        <Text fontSize="xs" color="gray.400" mb={1}>
                          CTA Texto:
                        </Text>
                        <Text fontSize="sm" color="gray.200">
                          {site.cta_text}
                        </Text>
                      </Box>
                      {site.cta_link && (
                        <Box>
                          <Text fontSize="xs" color="gray.400" mb={1}>
                            Link WhatsApp:
                          </Text>
                          <Text fontSize="sm" color="blue.300" wordBreak="break-all">
                            {site.cta_link}
                          </Text>
                        </Box>
                      )}
                      {site.phone_number && (
                        <Box>
                          <Text fontSize="xs" color="gray.400" mb={1}>
                            Telefone:
                          </Text>
                          <Text fontSize="sm" color="gray.200">
                            {site.phone_number}
                          </Text>
                        </Box>
                      )}
                    </VStack>
                  ) : (
                    <Box mb={3}>
                      <Badge colorPalette="yellow" fontSize="xs" color="yellow.100" bg="yellow.800">
                        CTA não configurado
                      </Badge>
                    </Box>
                  )}
                  
                  <Text fontSize="xs" color="gray.500" fontStyle="italic">
                    Edite na aba "Meus Sites"
                  </Text>
                </CardBody>
              </CardRoot>
            ))}
          </SimpleGrid>
        )}
      </Box>
    </VStack>
  )
}

