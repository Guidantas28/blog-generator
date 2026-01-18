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
import PostScheduler from './PostScheduler'
import CalendarView from './CalendarView'
import ContentLibrary from './ContentLibrary'
import AnalyticsDashboard from './AnalyticsDashboard'
import ApprovalTracking from './ApprovalTracking'
import { 
  Sparkles, 
  Globe, 
  FileText, 
  Calendar, 
  List, 
  BookOpen, 
  Settings as SettingsIcon,
  Zap,
  BarChart3,
  CheckCircle2
} from 'lucide-react'

interface WordPressSite {
  id: string
  name: string
  url: string
  username: string
  cta_text?: string
  cta_link?: string
  phone_number?: string
  cta_primary_color?: string
  cta_secondary_color?: string
  whatsapp_color?: string
  keywords_bg_color?: string
  keywords_text_color?: string
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
        .select('id, name, url, username, cta_text, cta_link, phone_number, cta_primary_color, cta_secondary_color, whatsapp_color, keywords_bg_color, keywords_text_color, system_prompt, content_prompt_template, tone, writing_style, target_audience, additional_instructions')
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
          <Box 
            borderBottomWidth="1px" 
            borderColor="gray.700" 
            mb={6}
            overflowX="auto"
            css={{
              '&::-webkit-scrollbar': {
                height: '6px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#4B5563',
                borderRadius: '3px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: '#6B7280',
              },
            }}
          >
            <TabsList 
              gap={2} 
              mb={0}
              borderBottom="none"
              minW="max-content"
              flexWrap="nowrap"
            >
              <TabsTrigger 
                value="auto" 
                px={4} 
                py={3}
                display="flex"
                alignItems="center"
                gap={2}
                whiteSpace="nowrap"
                fontSize="sm"
                fontWeight="medium"
                minW="fit-content"
              >
                <Sparkles size={18} />
                <Text as="span">Gerar</Text>
              </TabsTrigger>
              <TabsTrigger 
                value="sites" 
                px={4} 
                py={3}
                display="flex"
                alignItems="center"
                gap={2}
                whiteSpace="nowrap"
                fontSize="sm"
                fontWeight="medium"
                minW="fit-content"
              >
                <Globe size={18} />
                <Text as="span">Sites</Text>
              </TabsTrigger>
              <TabsTrigger 
                value="create" 
                px={4} 
                py={3}
                display="flex"
                alignItems="center"
                gap={2}
                whiteSpace="nowrap"
                fontSize="sm"
                fontWeight="medium"
                minW="fit-content"
              >
                <FileText size={18} />
                <Text as="span">Criar</Text>
              </TabsTrigger>
              <TabsTrigger 
                value="schedule" 
                px={4} 
                py={3}
                display="flex"
                alignItems="center"
                gap={2}
                whiteSpace="nowrap"
                fontSize="sm"
                fontWeight="medium"
                minW="fit-content"
              >
                <Calendar size={18} />
                <Text as="span">Agendar</Text>
              </TabsTrigger>
              <TabsTrigger 
                value="posts" 
                px={4} 
                py={3}
                display="flex"
                alignItems="center"
                gap={2}
                whiteSpace="nowrap"
                fontSize="sm"
                fontWeight="medium"
                minW="fit-content"
              >
                <List size={18} />
                <Text as="span">Publicados</Text>
              </TabsTrigger>
              <TabsTrigger 
                value="library" 
                px={4} 
                py={3}
                display="flex"
                alignItems="center"
                gap={2}
                whiteSpace="nowrap"
                fontSize="sm"
                fontWeight="medium"
                minW="fit-content"
              >
                <BookOpen size={18} />
                <Text as="span">Biblioteca</Text>
              </TabsTrigger>
              <TabsTrigger 
                value="automation" 
                px={4} 
                py={3}
                display="flex"
                alignItems="center"
                gap={2}
                whiteSpace="nowrap"
                fontSize="sm"
                fontWeight="medium"
                minW="fit-content"
              >
                <Zap size={18} />
                <Text as="span">Automação</Text>
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                px={4} 
                py={3}
                display="flex"
                alignItems="center"
                gap={2}
                whiteSpace="nowrap"
                fontSize="sm"
                fontWeight="medium"
                minW="fit-content"
              >
                <BarChart3 size={18} />
                <Text as="span">Analytics</Text>
              </TabsTrigger>
              <TabsTrigger 
                value="approvals" 
                px={4} 
                py={3}
                display="flex"
                alignItems="center"
                gap={2}
                whiteSpace="nowrap"
                fontSize="sm"
                fontWeight="medium"
                minW="fit-content"
              >
                <CheckCircle2 size={18} />
                <Text as="span">Aprovações</Text>
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                px={4} 
                py={3}
                display="flex"
                alignItems="center"
                gap={2}
                whiteSpace="nowrap"
                fontSize="sm"
                fontWeight="medium"
                minW="fit-content"
              >
                <SettingsIcon size={18} />
                <Text as="span">Config</Text>
              </TabsTrigger>
            </TabsList>
          </Box>

          <TabsContent value="auto" px={0}>
            <AutoContentGenerator sites={sites} userId={userId} />
          </TabsContent>
          <TabsContent value="sites" px={0}>
            <SiteManager sites={sites} onSitesChange={loadSites} userId={userId} />
          </TabsContent>
          <TabsContent value="create" px={0}>
            <PostCreator sites={sites} />
          </TabsContent>
          <TabsContent value="schedule" px={0}>
            <PostScheduler sites={sites} onScheduled={loadSites} />
            <Box mt={8}>
              <CalendarView userId={userId} />
            </Box>
          </TabsContent>
          <TabsContent value="posts" px={0}>
            <PostsDashboard userId={userId} />
          </TabsContent>
          <TabsContent value="library" px={0}>
            <ContentLibrary />
          </TabsContent>
          <TabsContent value="automation" px={0}>
            <AutomationSettings userId={userId} />
            <Box mt={8}>
              <AutomationHistory userId={userId} />
            </Box>
          </TabsContent>
          <TabsContent value="analytics" px={0}>
            <AnalyticsDashboard userId={userId} />
          </TabsContent>
          <TabsContent value="approvals" px={0}>
            <ApprovalTracking />
          </TabsContent>
          <TabsContent value="settings" px={0}>
            <Settings userId={userId} />
          </TabsContent>
        </TabsRoot>
      </Container>
    </Box>
  )
}

