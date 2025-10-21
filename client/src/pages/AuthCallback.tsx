import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

/**
 * AuthCallback - Handles email verification redirect from Supabase
 * 
 * Flow:
 * 1. User clicks verification link in email
 * 2. Supabase confirms email and redirects here with tokens
 * 3. Extract tokens, set session
 * 4. Check if profile is complete (has full_name)
 * 5. Route to /signup (complete profile) or /dashboard/profile (already complete)
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  // Check if profile is complete and route accordingly
  const checkProfileAndRoute = useCallback(async (userId: string) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Error fetching profile:', profileError)
        // Profile doesn't exist yet (shouldn't happen with trigger, but handle it)
        navigate('/signup')
        return
      }

      // Check if profile is complete (has full_name filled in)
      if (!profile.full_name) {
        // Profile exists but incomplete - go to signup to complete it
        console.log('Profile incomplete, routing to /signup')
        navigate('/signup')
      } else {
        // Profile is complete - go to dashboard
        console.log('Profile complete, routing to /dashboard/profile')
        navigate('/dashboard/profile')
      }
    } catch (err) {
      console.error('Error checking profile:', err)
      navigate('/signup')
    }
  }, [navigate])

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get URL parameters
        const params = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const errorParam = params.get('error')
        const errorDescription = params.get('error_description')

        // Check for errors in URL (expired/invalid link)
        if (errorParam) {
          console.error('Auth callback error:', errorParam, errorDescription)
          navigate(`/verify-email?error=${errorParam}`)
          return
        }

        // If no tokens, check if there's already a session
        if (!accessToken) {
          const { data: { session } } = await supabase.auth.getSession()
          
          if (!session) {
            console.error('No tokens and no existing session')
            navigate('/verify-email?error=no_session')
            return
          }

          // Session exists, continue with profile check
          await checkProfileAndRoute(session.user.id)
          return
        }

        // Set session with tokens from URL
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

        // Session created successfully, check profile
        await checkProfileAndRoute(session.user.id)

      } catch (err) {
        console.error('Auth callback error:', err)
        setError('Something went wrong during verification. Please try signing in.')
      }
    }

    handleCallback()
  }, [navigate, checkProfileAndRoute])

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
        <p className="text-gray-600">Verifying your email...</p>
      </div>
    </div>
  )
}
