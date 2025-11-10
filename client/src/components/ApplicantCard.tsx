import { MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { VacancyApplicationWithPlayer } from '@/lib/supabase'

interface ApplicantCardProps {
  application: VacancyApplicationWithPlayer
}

export default function ApplicantCard({ application }: ApplicantCardProps) {
  const navigate = useNavigate()
  const { player } = application
  const displayName = player.full_name?.trim() || player.username?.trim() || 'Player'

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleViewProfile = () => {
    if (player.username) {
      navigate(`/players/${player.username}`)
    } else {
      navigate(`/players/id/${player.id}`)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        {/* Player Photo */}
        <button
          onClick={handleViewProfile}
          className="flex-shrink-0 cursor-pointer group"
        >
          {player.avatar_url ? (
            <img
              src={player.avatar_url}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-200 group-hover:ring-blue-500 transition-all"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-gray-200 group-hover:ring-blue-500 transition-all">
              <span className="text-white font-bold text-lg">
                {getInitials(displayName)}
              </span>
            </div>
          )}
        </button>

        {/* Player Info */}
        <div className="flex-1 min-w-0">
          <button
            onClick={handleViewProfile}
            className="text-left group"
          >
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
              {displayName}
            </h3>
          </button>
          
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
            {player.position ? <span className="font-medium">{player.position}</span> : null}
            {player.position && player.base_location ? <span>•</span> : null}
            {player.base_location ? (
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{player.base_location}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-2 text-xs text-gray-500">
            Applied {formatDate(application.applied_at)}
          </div>
        </div>

        {/* View Profile Button */}
        <button
          onClick={handleViewProfile}
          className="flex-shrink-0 px-6 py-2.5 text-sm font-medium text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors"
        >
          View Profile
        </button>
      </div>
    </div>
  )
}
