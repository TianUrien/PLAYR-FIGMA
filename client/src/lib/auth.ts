import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { Profile } from './supabase'
import { supabase } from './supabase'

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => Promise<void>
  fetchProfile: (userId: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },
  
  fetchProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (!error && data) {
      set({ profile: data })
    }
  }
}))

// Initialize auth listener
export const initializeAuth = () => {
  const { setUser, setProfile, setLoading, fetchProfile } = useAuthStore.getState()
  
  // Check current session
  supabase.auth.getSession().then(({ data: { session } }) => {
    setUser(session?.user ?? null)
    if (session?.user) {
      fetchProfile(session.user.id)
    }
    setLoading(false)
  })
  
  // Listen for auth changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null)
    if (session?.user) {
      fetchProfile(session.user.id)
    } else {
      setProfile(null)
    }
    setLoading(false)
  })
  
  return subscription
}
