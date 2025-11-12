'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  Box,
  Container,
  Heading,
  Button,
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  Spinner,
  Flex,
  VStack,
  Text,
} from '@chakra-ui/react'
import SiteManager from './SiteManager'
import PostCreator from './PostCreator'
import Settings from './Settings'
import PostsDashboard from './PostsDashboard'
import AutomationSettings from './AutomationSettings'
import AutoContentGenerator from './AutoContentGenerator'
import AutomationHistory from './AutomationHistory'

interface WordPressSite {
  id: string
  name: string
  url: string
  username: string
  cta_text?: string
  cta_link?: string
  phone_number?: string
}

export default function DashboardClient({ userId }: { userId: string }) {
  const [sites, setSites] = useState<WordPressSite[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadUserEmail()
  }, [userId])

  const loadUserEmail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setUserEmail(user.email)
      }
    } catch (error) {
      console.error('Erro ao carregar email do usuário:', error)
    }
  }

  useEffect(() => {
    loadSites()
  }, [userId])

  const loadSites = async () => {
    try {
      const { data, error } = await supabase
        .from('wordpress_sites')
        .select('id, name, url, username, cta_text, cta_link, phone_number')
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

  if (loading) {
    return (
      <Box minH="100vh" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" color="blue.500" />
      </Box>
    )
  }

  return (
    <Box minH="100vh" bg="gray.900">
      <Box bg="gray.800" shadow="lg" borderBottomWidth="1px" borderColor="gray.700">
        <Container maxW="7xl">
          <Flex justify="space-between" align="center" h={16} px={4}>
            <Heading size="md" color="gray.50">
              Blog Post Platform
            </Heading>
            <Box position="relative" ref={menuRef}>
              <Button
                variant="solid"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                colorPalette="blue"
                bg="blue.600"
                color="blue.50"
                _hover={{ bg: 'blue.500' }}
                size="sm"
                borderRadius="full"
                w={10}
                h={10}
                p={0}
                fontSize="lg"
                fontWeight="bold"
                type="button"
              >
                {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
              </Button>
              
              {isMenuOpen && (
                <Box
                  position="absolute"
                  top="100%"
                  right={0}
                  mt={2}
                  bg="gray.800"
                  borderWidth="1px"
                  borderColor="gray.700"
                  borderRadius="md"
                  w="200px"
                  boxShadow="lg"
                  zIndex={1000}
                >
                  <VStack align="stretch" gap={0}>
                    {userEmail && (
                      <Box px={4} py={3} borderBottomWidth="1px" borderColor="gray.700">
                        <Text fontSize="xs" color="gray.400" mb={1}>
                          Logado como
                        </Text>
                        <Text fontSize="sm" color="gray.200" fontWeight="medium" wordBreak="break-all">
                          {userEmail}
                        </Text>
                      </Box>
                    )}
                    <Box p={2}>
                      <Button
                        variant="solid"
                        onClick={handleLogout}
                        colorPalette="red"
                        bg="red.600"
                        color="red.50"
                        _hover={{ bg: 'red.500' }}
                        size="sm"
                        w="full"
                      >
                        Sair
                      </Button>
                    </Box>
                  </VStack>
                </Box>
              )}
            </Box>
          </Flex>
        </Container>
      </Box>

      <Container maxW="7xl" py={6}>
        <TabsRoot defaultValue="auto" colorPalette="blue">
          <TabsList gap={4} mb={4}>
            <TabsTrigger value="auto" px={6} py={3}>Gerar Automático</TabsTrigger>
            <TabsTrigger value="sites" px={6} py={3}>Meus Sites</TabsTrigger>
            <TabsTrigger value="create" px={6} py={3}>Criar Post</TabsTrigger>
            <TabsTrigger value="posts" px={6} py={3}>Posts Publicados</TabsTrigger>
            <TabsTrigger value="automation" px={6} py={3}>Automação</TabsTrigger>
            <TabsTrigger value="settings" px={6} py={3}>Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="auto" px={0}>
            <AutoContentGenerator sites={sites} userId={userId} />
          </TabsContent>
          <TabsContent value="sites" px={0}>
            <SiteManager sites={sites} onSitesChange={loadSites} userId={userId} />
          </TabsContent>
          <TabsContent value="create" px={0}>
            <PostCreator sites={sites} />
          </TabsContent>
          <TabsContent value="posts" px={0}>
            <PostsDashboard userId={userId} />
          </TabsContent>
          <TabsContent value="automation" px={0}>
            <AutomationSettings userId={userId} />
            <Box mt={8}>
              <AutomationHistory userId={userId} />
            </Box>
          </TabsContent>
          <TabsContent value="settings" px={0}>
            <Settings userId={userId} />
          </TabsContent>
        </TabsRoot>
      </Container>
    </Box>
  )
}

