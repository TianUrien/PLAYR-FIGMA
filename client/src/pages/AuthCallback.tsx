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

      console.log('Session established for user:', userId)
      setStatus('Loading your profile...')

      try {
        // Fetch profile to check completion
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', userId)
          .single()

        if (profileError) {
          console.error('Error fetching profile:', profileError)
          setError('Could not load your profile. Please try again or contact support.')
          return
        }

        if (!profile) {
          console.error('Profile not found')
          setError('Profile not found. Please contact support.')
          return
        }

        console.log('Profile found:', profile)

        // Check if profile is complete
        if (!profile.full_name) {
          console.log('Profile incomplete, routing to /complete-profile')
          navigate('/complete-profile')
        } else {
          console.log('Profile complete, routing to /dashboard')
          navigate('/dashboard/profile')
        }

      } catch (err) {
        console.error('Error checking profile:', err)
        setError('Something went wrong. Please try again.')
      }
    }

    // Check hash immediately - if empty, link is invalid
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const hasTokens = hashParams.has('access_token') || hashParams.has('error')
    
    if (!hasTokens && window.location.hash === '#') {
      console.error('Empty hash detected - link expired or already used')
      // Get email from localStorage for resend functionality
      const storedEmail = localStorage.getItem('pending_email')
      const emailParam = storedEmail ? `&email=${encodeURIComponent(storedEmail)}` : ''
      navigate(`/verify-email?error=expired&reason=no_tokens${emailParam}`)
      return
    }

    // OPTION 1: Listen for auth state change (preferred)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.id)

      if (event === 'SIGNED_IN' && session) {
        await handleSession(session.user.id)
      }
    })

    // OPTION 2: Fallback - manually process hash if no event after timeout
    const timeoutId = setTimeout(async () => {
      if (sessionEstablished) return

      console.log('Fallback: manually processing hash parameters')
      setStatus('Establishing session...')

      try {
        // Get URL hash parameters
        const params = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const errorParam = params.get('error')
        const errorDescription = params.get('error_description')

        // Check for errors in URL
        if (errorParam) {
          console.error('Auth error in URL:', errorParam, errorDescription)
          navigate(`/verify-email?error=${encodeURIComponent(errorParam)}`)
          return
        }

        // If no tokens in hash, link is invalid/expired/already used
        if (!accessToken) {
          console.error('No tokens in hash - link expired or already used')
          // Redirect to verify-email with expired error and resend option
          navigate('/verify-email?error=expired&reason=no_tokens')
          return
        }

        // Manually set session with tokens from URL
        console.log('Setting session manually with tokens')
        const { data: { session }, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken!
        })

        if (sessionError) {
          console.error('Error setting session:', sessionError)
          navigate('/verify-email?error=session_failed')
          return
        }

        if (!session) {
          console.error('Session not created')
          navigate('/verify-email?error=no_session')
          return
        }

        // Session created, handle it
        await handleSession(session.user.id)

      } catch (err) {
        console.error('Fallback error:', err)
        setError('Could not establish session. Please try again.')
      }
    }, 2000) // Wait 2 seconds for onAuthStateChange

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
