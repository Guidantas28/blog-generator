'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  Box,
  Container,
  Heading,
  FieldRoot,
  FieldLabel,
  Input,
  Button,
  AlertRoot,
  AlertIndicator,
  AlertContent,
  VStack,
  Text,
} from '@chakra-ui/react'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isValid, setIsValid] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)

  // Atualizar validação quando email ou senha mudarem
  useEffect(() => {
    const emailValue = emailInputRef.current?.value || email
    const passwordValue = passwordInputRef.current?.value || password
    setIsValid(emailValue.trim().length > 0 && passwordValue.length > 0)
  }, [email, password])

  // Detectar autofill e atualizar estado
  useEffect(() => {
    const checkAutofill = () => {
      let updated = false
      if (emailInputRef.current) {
        const emailValue = emailInputRef.current.value
        if (emailValue && emailValue !== email) {
          setEmail(emailValue)
          updated = true
        }
      }
      if (passwordInputRef.current) {
        const passwordValue = passwordInputRef.current.value
        if (passwordValue && passwordValue !== password) {
          setPassword(passwordValue)
          updated = true
        }
      }
      // Atualizar validação se houver mudanças
      if (updated) {
        const emailValue = emailInputRef.current?.value || email
        const passwordValue = passwordInputRef.current?.value || password
        setIsValid(emailValue.trim().length > 0 && passwordValue.length > 0)
      }
    }

    // Verificar imediatamente após montagem
    const timeout = setTimeout(checkAutofill, 100)

    // Verificar em eventos de foco/blur
    const emailInput = emailInputRef.current
    const passwordInput = passwordInputRef.current

    if (emailInput) {
      emailInput.addEventListener('focus', checkAutofill)
      emailInput.addEventListener('blur', checkAutofill)
      emailInput.addEventListener('input', checkAutofill)
    }
    if (passwordInput) {
      passwordInput.addEventListener('focus', checkAutofill)
      passwordInput.addEventListener('blur', checkAutofill)
      passwordInput.addEventListener('input', checkAutofill)
    }

    return () => {
      clearTimeout(timeout)
      if (emailInput) {
        emailInput.removeEventListener('focus', checkAutofill)
        emailInput.removeEventListener('blur', checkAutofill)
        emailInput.removeEventListener('input', checkAutofill)
      }
      if (passwordInput) {
        passwordInput.removeEventListener('focus', checkAutofill)
        passwordInput.removeEventListener('blur', checkAutofill)
        passwordInput.removeEventListener('input', checkAutofill)
      }
    }
  }, [email, password])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevenir múltiplos envios
    if (loading) return
    
    setLoading(true)
    setError(null)

    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      
      if (error) {
        // Tratamento específico para rate limit
        if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
          setError('Muitas tentativas de login. Por favor, aguarde alguns minutos antes de tentar novamente.')
        } else {
          setError(error.message)
        }
        setLoading(false)
        return
      }

      // Verificar se o login foi bem-sucedido
      if (data?.user) {
        // Aguardar um pouco antes de redirecionar para evitar problemas
        await new Promise(resolve => setTimeout(resolve, 500))
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err: any) {
      console.error('Erro no login:', err)
      if (err.message?.includes('rate limit') || err.message?.includes('too many requests')) {
        setError('Muitas tentativas de login. Por favor, aguarde alguns minutos antes de tentar novamente.')
      } else {
        setError(err.message || 'Erro ao fazer login. Tente novamente.')
      }
      setLoading(false)
    }
  }

  return (
    <Box
      minH="100vh"
      bgGradient="linear(to-br, gray.900, gray.800)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={4}
    >
      <Container maxW="md">
        <Box bg="gray.800" p={8} borderRadius="lg" boxShadow="2xl" borderWidth="1px" borderColor="gray.700">
          <VStack gap={6} align="stretch">
            <Heading
              as="h1"
              size="xl"
              textAlign="center"
              color="gray.50"
              mb={2}
            >
              Blog Post Platform
            </Heading>

            <form onSubmit={handleAuth}>
              <VStack gap={5} align="stretch">
                <FieldRoot required>
                  <FieldLabel fontWeight="semibold" color="gray.300">
                    Email
                  </FieldLabel>
                  <Input
                    ref={emailInputRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onInput={(e) => {
                      const target = e.target as HTMLInputElement
                      if (target.value !== email) {
                        setEmail(target.value)
                      }
                    }}
                    placeholder="seu@email.com"
                    size="lg"
                    px={4}
                    py={3}
                    bg="gray.700"
                    borderColor="gray.600"
                    color="gray.50"
                    _placeholder={{ color: 'gray.400' }}
                    _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
                  />
                </FieldRoot>

                <FieldRoot required>
                  <FieldLabel fontWeight="semibold" color="gray.300">
                    Senha
                  </FieldLabel>
                  <Input
                    ref={passwordInputRef}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onInput={(e) => {
                      const target = e.target as HTMLInputElement
                      if (target.value !== password) {
                        setPassword(target.value)
                      }
                    }}
                    placeholder="Digite sua senha"
                    size="lg"
                    px={4}
                    py={3}
                    bg="gray.700"
                    borderColor="gray.600"
                    color="gray.50"
                    _placeholder={{ color: 'gray.400' }}
                    _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
                  />
                </FieldRoot>

                {error && (
                  <AlertRoot 
                    status="error" 
                    borderRadius="md" 
                    bg={error.includes('rate limit') || error.includes('Muitas tentativas') ? 'yellow.900' : 'red.900'} 
                    color={error.includes('rate limit') || error.includes('Muitas tentativas') ? 'yellow.100' : 'red.100'}
                  >
                    <AlertIndicator />
                    <AlertContent>
                      <Text fontWeight="medium" mb={1}>{error}</Text>
                      {(error.includes('rate limit') || error.includes('Muitas tentativas')) && (
                        <Text fontSize="sm" opacity={0.9}>
                          O Supabase tem limites de taxa para proteger contra abusos. Aguarde 1-2 minutos antes de tentar novamente.
                        </Text>
                      )}
                    </AlertContent>
                  </AlertRoot>
                )}

                <Button
                  type="submit"
                  colorPalette="blue"
                  size="lg"
                  width="full"
                  loading={loading}
                  loadingText="Carregando..."
                  disabled={loading || !isValid}
                >
                  Entrar
                </Button>
              </VStack>
            </form>
          </VStack>
        </Box>
      </Container>
    </Box>
  )
}

