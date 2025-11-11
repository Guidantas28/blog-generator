'use client'

import { useState, useEffect } from 'react'
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
}

export default function DashboardClient({ userId }: { userId: string }) {
  const [sites, setSites] = useState<WordPressSite[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadSites()
  }, [userId])

  const loadSites = async () => {
    try {
      const { data, error } = await supabase
        .from('wordpress_sites')
        .select('id, name, url, username')
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
          <Flex justify="space-between" align="center" h={16}>
            <Heading size="md" color="gray.50">
              Blog Post Platform
            </Heading>
            <Button variant="ghost" onClick={handleLogout} colorPalette="gray">
              Sair
            </Button>
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

