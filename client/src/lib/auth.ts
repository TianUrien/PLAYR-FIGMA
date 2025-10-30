import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { Profile } from './supabase'
import { supabase } from './supabase'
import { requestCache, generateCacheKey } from './requestCache'
import { monitor } from './monitor'

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
    const cacheKey = generateCacheKey('profile', { id: userId })
    
    const data = await monitor.measure('fetch_profile', async () => {
      return await requestCache.dedupe(
        cacheKey,
        async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
          
          if (error) throw error
          return data
        }
      )
    }, { userId })
    
    if (data) {
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

/**
 * Resend email verification
 * Used when user didn't receive the initial verification email
 */
export const resendVerificationEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    })

    if (error) {
      console.error('Error resending verification email:', error)
      
      // Handle specific error cases
      if (error.message.includes('rate limit')) {
        return { success: false, error: 'Too many requests. Please wait a few minutes before trying again.' }
      }
      
      if (error.message.includes('already confirmed')) {
        return { success: false, error: 'This email is already verified. Try signing in.' }
      }
      
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Unexpected error resending verification:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}
