'use client'

import { useState } from 'react'
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
} from '@chakra-ui/react'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        alert('Conta criada! Verifique seu email para confirmar.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
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
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    size="lg"
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
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    size="lg"
                    bg="gray.700"
                    borderColor="gray.600"
                    color="gray.50"
                    _placeholder={{ color: 'gray.400' }}
                    _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
                  />
                </FieldRoot>

                {error && (
                  <AlertRoot status="error" borderRadius="md" bg="red.900" color="red.100">
                    <AlertIndicator />
                    <AlertContent>{error}</AlertContent>
                  </AlertRoot>
                )}

                <Button
                  type="submit"
                  colorPalette="blue"
                  size="lg"
                  width="full"
                  loading={loading}
                  loadingText="Carregando..."
                >
                  {isSignUp ? 'Criar Conta' : 'Entrar'}
                </Button>
              </VStack>
            </form>

            <Box textAlign="center" mt={2}>
              <Button
                variant="ghost"
                colorPalette="blue"
                size="sm"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                }}
              >
                {isSignUp
                  ? 'Já tem uma conta? Entrar'
                  : 'Não tem uma conta? Criar conta'}
              </Button>
            </Box>
          </VStack>
        </Box>
      </Container>
    </Box>
  )
}

