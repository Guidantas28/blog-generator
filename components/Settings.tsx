'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export default function Settings({ userId }: { userId: string }) {
  const [ctaText, setCtaText] = useState('')
  const [ctaLink, setCtaLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadSettings()
  }, [userId])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('default_cta_text, default_cta_link')
        .eq('user_id', userId)
        .maybeSingle()

      // maybeSingle() retorna null se não encontrar, sem erro
      if (error) {
        console.error('Erro ao carregar configurações:', error)
        // Não lançar erro, apenas logar
        return
      }

      if (data) {
        setCtaText(data.default_cta_text || '')
        setCtaLink(data.default_cta_link || '')
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('user_settings').upsert({
        user_id: userId,
        default_cta_text: ctaText || null,
        default_cta_link: ctaLink || null,
        updated_at: new Date().toISOString(),
      })

      if (error) throw error
      alert('Configurações salvas com sucesso!')
    } catch (error: any) {
      alert('Erro ao salvar configurações: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="text-center">Carregando configurações...</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Configurações</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CTA Padrão - Texto
            </label>
            <input
              type="text"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              placeholder="Ex: Quer saber mais? Entre em contato conosco!"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Este texto será usado como padrão nos seus posts (pode ser sobrescrito ao criar um post)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CTA Padrão - Link do WhatsApp
            </label>
            <input
              type="url"
              value={ctaLink}
              onChange={(e) => setCtaLink(e.target.value)}
              placeholder="https://wa.me/5511999999999"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Link do WhatsApp que será usado por padrão nos seus posts
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  )
}

