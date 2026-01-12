'use client'

import { useRef, useEffect } from 'react'
import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  FieldRoot,
  FieldLabel,
} from '@chakra-ui/react'
import { Bold, Italic, List, Link as LinkIcon, Undo, Redo } from 'lucide-react'

interface ContentEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
}

export default function ContentEditor({
  value,
  onChange,
  placeholder = 'Digite o conteúdo...',
  label = 'Conteúdo',
}: ContentEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef<number>(-1)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleChange()
  }

  const handleChange = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML
      onChange(html)
      
      // Adicionar ao histórico
      if (historyRef.current[historyIndexRef.current] !== html) {
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
        historyRef.current.push(html)
        historyIndexRef.current = historyRef.current.length - 1
        
        // Limitar histórico a 50 itens
        if (historyRef.current.length > 50) {
          historyRef.current.shift()
          historyIndexRef.current--
        }
      }
    }
  }

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--
      const previous = historyRef.current[historyIndexRef.current]
      if (editorRef.current) {
        editorRef.current.innerHTML = previous
        onChange(previous)
      }
    }
  }

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++
      const next = historyRef.current[historyIndexRef.current]
      if (editorRef.current) {
        editorRef.current.innerHTML = next
        onChange(next)
      }
    }
  }

  const handleLink = () => {
    const url = prompt('Digite a URL do link:')
    if (url) {
      execCommand('createLink', url)
    }
  }

  return (
    <FieldRoot>
      <FieldLabel color="gray.300" fontWeight="medium" mb={2}>
        {label}
      </FieldLabel>
      <VStack align="stretch" gap={2}>
        {/* Toolbar */}
        <HStack
          gap={1}
          p={2}
          bg="gray.700"
          borderRadius="md"
          borderWidth="1px"
          borderColor="gray.600"
          flexWrap="wrap"
        >
          <Button
            size="sm"
            variant="ghost"
            onClick={() => execCommand('bold')}
            title="Negrito (Ctrl+B)"
            colorPalette="gray"
            _hover={{ bg: 'gray.600' }}
          >
            <Bold size={16} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => execCommand('italic')}
            title="Itálico (Ctrl+I)"
            colorPalette="gray"
            _hover={{ bg: 'gray.600' }}
          >
            <Italic size={16} />
          </Button>
          <Box w="1px" h={6} bg="gray.600" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => execCommand('insertUnorderedList')}
            title="Lista não ordenada"
            colorPalette="gray"
            _hover={{ bg: 'gray.600' }}
          >
            <List size={16} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleLink}
            title="Inserir link"
            colorPalette="gray"
            _hover={{ bg: 'gray.600' }}
          >
            <LinkIcon size={16} />
          </Button>
          <Box w="1px" h={6} bg="gray.600" />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleUndo}
            title="Desfazer (Ctrl+Z)"
            colorPalette="gray"
            _hover={{ bg: 'gray.600' }}
            disabled={historyIndexRef.current <= 0}
          >
            <Undo size={16} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRedo}
            title="Refazer (Ctrl+Y)"
            colorPalette="gray"
            _hover={{ bg: 'gray.600' }}
            disabled={historyIndexRef.current >= historyRef.current.length - 1}
          >
            <Redo size={16} />
          </Button>
        </HStack>

        {/* Editor */}
        <Box
          ref={editorRef}
          contentEditable
          onInput={handleChange}
          onBlur={handleChange}
          data-placeholder={placeholder}
          minH="300px"
          maxH="600px"
          overflowY="auto"
          p={4}
          bg="gray.700"
          borderWidth="1px"
          borderColor="gray.600"
          borderRadius="md"
          color="gray.50"
          fontSize="sm"
          lineHeight="1.6"
          _focus={{
            outline: 'none',
            borderColor: 'blue.500',
            boxShadow: '0 0 0 1px blue.500',
          }}
          css={{
            '&:empty:before': {
              content: `attr(data-placeholder)`,
              color: '#9CA3AF',
            },
            '& p': {
              marginBottom: '0.5rem',
            },
            '& ul, & ol': {
              marginLeft: '1.5rem',
              marginBottom: '0.5rem',
            },
            '& a': {
              color: '#60A5FA',
              textDecoration: 'underline',
            },
            '& strong': {
              fontWeight: 'bold',
            },
            '& em': {
              fontStyle: 'italic',
            },
          }}
        />

        {/* Preview */}
        <Box
          p={3}
          bg="gray.800"
          borderRadius="md"
          borderWidth="1px"
          borderColor="gray.700"
        >
          <Text fontSize="xs" color="gray.400" mb={2}>
            Preview:
          </Text>
          <Box
            fontSize="sm"
            color="gray.300"
            dangerouslySetInnerHTML={{ __html: value || '<em>Nenhum conteúdo ainda</em>' }}
          />
        </Box>
      </VStack>
    </FieldRoot>
  )
}
