import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { initializeAuth } from '@/lib/auth'
import { ProtectedRoute } from '@/components'
import Landing from '@/pages/Landing'
import SignUp from '@/pages/SignUp'
import AuthCallback from '@/pages/AuthCallback'
import VerifyEmail from '@/pages/VerifyEmail'
import CompleteProfile from '@/pages/CompleteProfile'
import DashboardRouter from '@/pages/DashboardRouter'
import OpportunitiesPage from '@/pages/OpportunitiesPage'
import CommunityPage from '@/pages/CommunityPage'
import ApplicantsList from '@/pages/ApplicantsList'
import PublicPlayerProfile from '@/pages/PublicPlayerProfile'
import PublicClubProfile from '@/pages/PublicClubProfile'
import MessagesPage from '@/pages/MessagesPage'

function App() {
  useEffect(() => {
    // Initialize auth listener
    const subscription = initializeAuth()
    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <ProtectedRoute>
        <Routes>
          {/* Public Routes (allowlisted in ProtectedRoute) */}
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          
          {/* Protected Routes (require authentication) */}
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/opportunities" element={<OpportunitiesPage />} />
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
      </ProtectedRoute>
    </BrowserRouter>
  )
}

export default App
