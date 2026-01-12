'use client'

import { Box, Heading, Text, VStack, HStack, Badge } from '@chakra-ui/react'

interface Version {
  id: string
  version_number: number
  title: string
  content: string
  excerpt: string | null
}

interface VersionDiffProps {
  version1: Version
  version2: Version
}

export default function VersionDiff({ version1, version2 }: VersionDiffProps) {
  // Função simples para destacar diferenças (pode ser melhorada com uma biblioteca de diff)
  const highlightDifferences = (text1: string, text2: string) => {
    if (text1 === text2) {
      return { same: true, content: text1 }
    }
    return { same: false, content: text2 }
  }

  const titleDiff = highlightDifferences(version1.title, version2.title)
  const contentDiff = highlightDifferences(version1.content, version2.content)
  const excerptDiff = version1.excerpt && version2.excerpt
    ? highlightDifferences(version1.excerpt, version2.excerpt)
    : { same: version1.excerpt === version2.excerpt, content: version2.excerpt || '' }

  return (
    <VStack gap={6} align="stretch">
      <Heading size="md" color="gray.50">
        Comparação de Versões
      </Heading>

      <HStack gap={4} justify="center">
        <Badge colorPalette="blue" fontSize="md" px={4} py={2}>
          Versão {version1.version_number}
        </Badge>
        <Text color="gray.400">vs</Text>
        <Badge colorPalette="green" fontSize="md" px={4} py={2}>
          Versão {version2.version_number}
        </Badge>
      </HStack>

      <Box>
        <Heading size="sm" color="gray.50" mb={2}>
          Título
        </Heading>
        <Box
          p={4}
          bg={titleDiff.same ? 'gray.700' : 'yellow.900'}
          borderRadius="md"
          borderWidth="1px"
          borderColor={titleDiff.same ? 'gray.600' : 'yellow.600'}
        >
          <Text color="gray.50">
            {titleDiff.same ? (
              version1.title
            ) : (
              <>
                <Text as="span" textDecoration="line-through" color="red.300">
                  {version1.title}
                </Text>
                {' → '}
                <Text as="span" color="green.300">
                  {version2.title}
                </Text>
              </>
            )}
          </Text>
        </Box>
      </Box>

      {excerptDiff.content && (
        <Box>
          <Heading size="sm" color="gray.50" mb={2}>
            Resumo
          </Heading>
          <Box
            p={4}
            bg={excerptDiff.same ? 'gray.700' : 'yellow.900'}
            borderRadius="md"
            borderWidth="1px"
            borderColor={excerptDiff.same ? 'gray.600' : 'yellow.600'}
          >
            <Text color="gray.50" whiteSpace="pre-wrap">
              {excerptDiff.same ? (
                version1.excerpt
              ) : (
                <>
                  <Text as="span" textDecoration="line-through" color="red.300">
                    {version1.excerpt}
                  </Text>
                  {'\n→\n'}
                  <Text as="span" color="green.300">
                    {version2.excerpt}
                  </Text>
                </>
              )}
            </Text>
          </Box>
        </Box>
      )}

      <Box>
        <Heading size="sm" color="gray.50" mb={2}>
          Conteúdo
        </Heading>
        <Box
          p={4}
          bg={contentDiff.same ? 'gray.700' : 'yellow.900'}
          borderRadius="md"
          borderWidth="1px"
          borderColor={contentDiff.same ? 'gray.600' : 'yellow.600'}
          maxH="400px"
          overflowY="auto"
        >
          <Text color="gray.50" whiteSpace="pre-wrap" fontSize="sm">
            {contentDiff.same ? (
              version1.content.substring(0, 1000) + (version1.content.length > 1000 ? '...' : '')
            ) : (
              <>
                <Text as="span" color="red.300" fontSize="xs">
                  (Conteúdo alterado - mostrando versão {version2.version_number})
                </Text>
                {'\n\n'}
                {version2.content.substring(0, 1000)}
                {version2.content.length > 1000 && '...'}
              </>
            )}
          </Text>
        </Box>
      </Box>
    </VStack>
  )
}
