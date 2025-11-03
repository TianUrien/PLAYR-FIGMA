import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/auth'
import PlayerDashboard from './PlayerDashboard'
import CoachDashboard from './CoachDashboard'
import ClubDashboard from './ClubDashboard'

export default function DashboardRouter() {
  const navigate = useNavigate()
  const { user, profile, loading } = useAuthStore()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/')
      return
    }

    // Check if profile is incomplete (verified but no full_name)
    if (!loading && profile && !profile.full_name) {
      console.warn('[ROUTER] Profile incomplete (no full_name), redirecting to /complete-profile')
      navigate('/complete-profile', { replace: true })
      return
    }
  }, [user, profile, loading, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#6366f1] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No profile found. Please complete your profile.</p>
          <button
            onClick={() => navigate('/complete-profile')}
            className="px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            Complete Profile
          </button>
        </div>
      </div>
    )
  }

  // If profile incomplete, show loading (useEffect will redirect)
  if (!profile.full_name) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#6366f1] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    )
  }

  // Route based on role
  if (profile.role === 'player') {
    return <PlayerDashboard />
  }
  
  if (profile.role === 'coach') {
    return <CoachDashboard />
  }
  
  return <ClubDashboard />
}
