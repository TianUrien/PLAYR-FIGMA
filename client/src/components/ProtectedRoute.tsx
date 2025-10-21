import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const PUBLIC_ROUTES = ['/', '/signup', '/verify-email', '/auth/callback']

/**
 * ProtectedRoute - Centralized auth guard
 * 
 * Public routes (allowlist): /, /signup, /verify-email, /auth/callback
 * Protected routes: Everything else requires authentication
 * 
 * IMPORTANT: Never redirect from /auth/callback or /verify-email
 * before auth processing completes
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check initial session
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setIsAuthenticated(!!session)
      } catch (error) {
        console.error('Auth check error:', error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#6366f1] mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => location.pathname.startsWith(route))

  // Public routes - allow access regardless of auth status
  if (isPublicRoute) {
    return <>{children}</>
  }

  // Protected routes - require authentication
  if (!isAuthenticated) {
    // Store intended destination for redirect after login
    return <Navigate to="/" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}
