import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { initializeAuth } from '@/lib/auth'
import { ProtectedRoute, ErrorBoundary } from '@/components'
import Landing from '@/pages/Landing'
import SignUp from '@/pages/SignUp'
import AuthCallback from '@/pages/AuthCallback'
import VerifyEmail from '@/pages/VerifyEmail'

// Lazy load heavy components
const CompleteProfile = lazy(() => import('@/pages/CompleteProfile'))
const DashboardRouter = lazy(() => import('@/pages/DashboardRouter'))
const OpportunitiesPage = lazy(() => import('@/pages/OpportunitiesPage'))
const OpportunityDetailPage = lazy(() => import('@/pages/OpportunityDetailPage'))
const CommunityPage = lazy(() => import('@/pages/CommunityPage'))
const ApplicantsList = lazy(() => import('@/pages/ApplicantsList'))
const PublicPlayerProfile = lazy(() => import('@/pages/PublicPlayerProfile'))
const PublicClubProfile = lazy(() => import('@/pages/PublicClubProfile'))
const MessagesPage = lazy(() => import('@/pages/MessagesPage'))

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-600 text-sm">Loading...</p>
    </div>
  </div>
)

function App() {
  useEffect(() => {
    // Initialize auth listener
    const subscription = initializeAuth()
    return () => subscription.unsubscribe()
  }, [])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Routes (allowlisted in ProtectedRoute) */}
              <Route path="/" element={<Landing />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              
              {/* Protected Routes (require authentication) - Lazy loaded */}
              <Route path="/complete-profile" element={<CompleteProfile />} />
              <Route path="/community" element={<CommunityPage />} />
              <Route path="/opportunities" element={<OpportunitiesPage />} />
              <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/dashboard/profile" element={<DashboardRouter />} />
              <Route path="/dashboard/club/vacancies/:vacancyId/applicants" element={<ApplicantsList />} />
              <Route path="/players/:username" element={<PublicPlayerProfile />} />
              <Route path="/players/id/:id" element={<PublicPlayerProfile />} />
              <Route path="/clubs/:username" element={<PublicClubProfile />} />
              <Route path="/clubs/id/:id" element={<PublicClubProfile />} />
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ProtectedRoute>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
