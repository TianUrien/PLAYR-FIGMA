import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create Supabase client with typed database
// Using implicit flow for better compatibility with Supabase email verification
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit', // Implicit flow works better with Supabase email verification
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // Automatically detect session from URL hash
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }
})

// Export types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Vacancy = Database['public']['Tables']['vacancies']['Row']
export type VacancyInsert = Database['public']['Tables']['vacancies']['Insert']
export type VacancyUpdate = Database['public']['Tables']['vacancies']['Update']

export type VacancyApplication = Database['public']['Tables']['vacancy_applications']['Row']
export type VacancyApplicationInsert = Database['public']['Tables']['vacancy_applications']['Insert']
export type VacancyApplicationUpdate = Database['public']['Tables']['vacancy_applications']['Update']

export type GalleryPhoto = Database['public']['Tables']['gallery_photos']['Row']
export type GalleryPhotoInsert = Database['public']['Tables']['gallery_photos']['Insert']
export type GalleryPhotoUpdate = Database['public']['Tables']['gallery_photos']['Update']

export type PlayingHistory = Database['public']['Tables']['playing_history']['Row']
export type PlayingHistoryInsert = Database['public']['Tables']['playing_history']['Insert']
export type PlayingHistoryUpdate = Database['public']['Tables']['playing_history']['Update']

export type Message = Database['public']['Tables']['messages']['Row']
export type MessageInsert = Database['public']['Tables']['messages']['Insert']
export type MessageUpdate = Database['public']['Tables']['messages']['Update']

export type Conversation = Database['public']['Tables']['conversations']['Row']
export type ConversationInsert = Database['public']['Tables']['conversations']['Insert']
export type ConversationUpdate = Database['public']['Tables']['conversations']['Update']

// Complex joined types
export type VacancyApplicationWithPlayer = VacancyApplication & {
  player: Profile
}
