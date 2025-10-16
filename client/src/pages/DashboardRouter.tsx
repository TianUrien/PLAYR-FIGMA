import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/auth'
import PlayerDashboard from './PlayerDashboard'
import ClubDashboard from './ClubDashboard'

export default function DashboardRouter() {
  const navigate = useNavigate()
  const { user, profile, loading } = useAuthStore()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/')
    }
  }, [user, loading, navigate])

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
          <p className="text-gray-600">No profile found. Please complete your profile.</p>
        </div>
      </div>
    )
  }

  // Route based on role
  if (profile.role === 'player' || profile.role === 'coach') {
    return <PlayerDashboard />
  }
  
  return <ClubDashboard />
}
