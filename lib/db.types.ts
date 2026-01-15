export interface Database {
  public: {
    Tables: {
      wordpress_sites: {
        Row: {
          id: string
          user_id: string
          name: string
          url: string
          username: string
          password_encrypted: string
          created_at: string
          cta_text?: string | null
          cta_link?: string | null
          phone_number?: string | null
          cta_primary_color?: string | null
          cta_secondary_color?: string | null
          whatsapp_color?: string | null
          keywords_bg_color?: string | null
          keywords_text_color?: string | null
          system_prompt?: string | null
          content_prompt_template?: string | null
          tone?: string | null
          writing_style?: string | null
          target_audience?: string | null
          additional_instructions?: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          url: string
          username: string
          password_encrypted: string
          created_at?: string
          cta_text?: string | null
          cta_link?: string | null
          phone_number?: string | null
          cta_primary_color?: string | null
          cta_secondary_color?: string | null
          whatsapp_color?: string | null
          keywords_bg_color?: string | null
          keywords_text_color?: string | null
          system_prompt?: string | null
          content_prompt_template?: string | null
          tone?: string | null
          writing_style?: string | null
          target_audience?: string | null
          additional_instructions?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          url?: string
          username?: string
          password_encrypted?: string
          cta_text?: string | null
          cta_link?: string | null
          phone_number?: string | null
          cta_primary_color?: string | null
          cta_secondary_color?: string | null
          whatsapp_color?: string | null
          keywords_bg_color?: string | null
          keywords_text_color?: string | null
          system_prompt?: string | null
          content_prompt_template?: string | null
          tone?: string | null
          writing_style?: string | null
          target_audience?: string | null
          additional_instructions?: string | null
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          default_cta_text: string | null
          default_cta_link: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          default_cta_text?: string | null
          default_cta_link?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          default_cta_text?: string | null
          default_cta_link?: string | null
          updated_at?: string
        }
      }
    }
  }
}

