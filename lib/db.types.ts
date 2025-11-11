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
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          url: string
          username: string
          password_encrypted: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          url?: string
          username?: string
          password_encrypted?: string
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

