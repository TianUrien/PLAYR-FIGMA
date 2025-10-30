import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

/**
 * AuthCallback - Handles email verification redirect from Supabase
 * 
 * ROBUST APPROACH:
 * 1. Listen for onAuthStateChange (SIGNED_IN event)
 * 2. Fallback: manually extract hash params and setSession
 * 3. Wait patiently for session to establish
 * 4. Check profile completion
 * 5. Route to /complete-profile (incomplete) or /dashboard (complete)
 * 
 * NEVER redirect away before session is confirmed!
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Verifying your email...')

  useEffect(() => {
    let sessionEstablished = false

    const handleSession = async (userId: string) => {
      if (sessionEstablished) return
      sessionEstablished = true

      console.log('✅ Session established for user:', userId)
      setStatus('Loading your profile...')

      try {
        // Fetch profile to check completion
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', userId)
          .single()

        // If profile doesn't exist (PGRST116), send to CompleteProfile to create it
        if (profileError && profileError.code === 'PGRST116') {
          console.log('📝 Profile not found (new user), routing to /complete-profile')
          navigate('/complete-profile')
          return
        }

        // Other errors
        if (profileError) {
          console.error('❌ Error fetching profile:', profileError)
          setError('Could not load your profile. Please try again or contact support.')
          return
        }

        if (!profile) {
          console.error('❌ Profile is null (unexpected)')
          setError('Profile not found. Please contact support.')
          return
        }

        console.log('📋 Profile found:', profile)

        // Check if profile is complete
        if (!profile.full_name) {
          console.log('➡️ Profile incomplete, routing to /complete-profile')
          navigate('/complete-profile')
        } else {
          console.log('➡️ Profile complete, routing to /dashboard')
          navigate('/dashboard/profile')
        }

      } catch (err) {
        console.error('💥 Error checking profile:', err)
        setError('Something went wrong. Please try again.')
      }
    }

    // � Log initial state
    const queryParams = new URLSearchParams(window.location.search)
    const pkceCode = queryParams.get('code')
    const hash = window.location.hash
    const hashParams = new URLSearchParams(hash.substring(1))
    const hasAccessToken = hashParams.has('access_token')
    const hasError = hashParams.has('error')
    
    console.log('🔍 AuthCallback initialized')
    console.log('📍 Full URL:', window.location.href)
    console.log('🔑 PKCE code present:', !!pkceCode)
    console.log('🔑 Access token in hash:', hasAccessToken)
    console.log('⚠️ Error in hash:', hasError)

    // 🎯 STRATEGY: Let Supabase SDK handle everything via detectSessionInUrl
    // The SDK is configured with detectSessionInUrl: true, which means it will:
    // 1. Automatically detect ?code= parameter (PKCE flow)
    // 2. Call exchangeCodeForSession() internally
    // 3. Trigger onAuthStateChange with SIGNED_IN event
    //
    // We just need to:
    // - Listen for SIGNED_IN event
    // - Wait patiently for SDK to complete
    // - Handle errors if things go wrong

    // Listen for auth state changes (SDK will trigger this after processing URL)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 Auth state change:', event, session?.user?.id)

      if (event === 'SIGNED_IN' && session) {
        await handleSession(session.user.id)
      }
    })

    // Fallback timeout - check status after giving SDK time to process
    const timeoutId = setTimeout(async () => {
      if (sessionEstablished) {
        console.log('✅ Session already established, timeout is no-op')
        return
      }

      console.log('⏱️ Timeout reached - checking session status...')
      
      // Check if SDK already established a session (might have missed the event)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        console.log('✅ Session found via getSession() - SDK completed exchange')
        await handleSession(session.user.id)
        return
      }

      // No session found - check for errors or handle implicit flow
      const params = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const errorParam = params.get('error')
      
      if (errorParam) {
        console.error('❌ Auth error in URL:', errorParam)
        navigate(`/verify-email?error=${encodeURIComponent(errorParam)}`)
        return
      }
      
      // Handle implicit flow tokens (non-PKCE)
      if (accessToken && refreshToken) {
        console.log('🔧 Implicit flow tokens found, setting session manually...')
        setStatus('Establishing session...')

        const { data: { session }, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })

        if (sessionError) {
          console.error('❌ Error setting session:', sessionError)
          navigate('/verify-email?error=session_failed')
          return
        }

        if (session) {
          console.log('✅ Session created from implicit flow tokens')
          await handleSession(session.user.id)
          return
        }
      }

      // No session, no tokens, nothing worked - link is invalid/expired
      console.error('❌ No session established - link may be expired or already used')
      const storedEmail = localStorage.getItem('pending_email')
      const emailParam = storedEmail ? `&email=${encodeURIComponent(storedEmail)}` : ''
      navigate(`/verify-email?error=expired&reason=no_tokens${emailParam}`)
    }, 5000) // Wait 5 seconds for SDK to process (increased from 3s)

    // Cleanup
    return () => {
      subscription.unsubscribe()
      clearTimeout(timeoutId)
    }
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#6366f1] mb-4"></div>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  )
}
