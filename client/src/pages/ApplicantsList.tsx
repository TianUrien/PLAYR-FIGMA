import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/auth'
import type { VacancyApplicationWithPlayer, Vacancy, Json } from '@/lib/supabase'
import ApplicantCard from '@/components/ApplicantCard'

export default function ApplicantsList() {
  const { vacancyId } = useParams<{ vacancyId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [vacancy, setVacancy] = useState<Vacancy | null>(null)
  const [applications, setApplications] = useState<VacancyApplicationWithPlayer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!vacancyId || !user) return

      setIsLoading(true)
      setError(null)

      try {
        // Fetch vacancy details
        const { data: vacancyData, error: vacancyError } = await supabase
          .from('vacancies')
          .select('*')
          .eq('id', vacancyId)
          .eq('club_id', user.id) // Ensure club owns this vacancy
          .single()

        if (vacancyError) {
          if (vacancyError.code === 'PGRST116') {
            setError('Vacancy not found or you do not have permission to view it.')
          } else {
            throw vacancyError
          }
          return
        }

        setVacancy(vacancyData)

        // Fetch applications with player profiles
        const { data: applicationsData, error: applicationsError } = await supabase
          .from('vacancy_applications')
          .select(`
            *,
            player:player_id (
              id,
              full_name,
              avatar_url,
              position,
              base_location,
              nationality,
              username
            )
          `)
          .eq('vacancy_id', vacancyId)
          .order('applied_at', { ascending: false })

        if (applicationsError) {
          throw applicationsError
        }

        // Transform the data to match our type
        interface ApplicationWithProfile {
          id: string
          vacancy_id: string
          player_id: string
          cover_letter: string | null
          status: string
          applied_at: string
          updated_at: string
          metadata: Json
          player: {
            id: string
            full_name: string
            avatar_url: string | null
            position: string | null
            base_location: string
            nationality: string
            username: string | null
          }
        }

        const transformedApplications: VacancyApplicationWithPlayer[] = (applicationsData as ApplicationWithProfile[] || []).map((app) => ({
          id: app.id,
          vacancy_id: app.vacancy_id,
          player_id: app.player_id,
          cover_letter: app.cover_letter,
          status: app.status as VacancyApplicationWithPlayer['status'],
          applied_at: app.applied_at,
          updated_at: app.updated_at,
          metadata: app.metadata as Json,
          player: {
            id: app.player.id,
            full_name: app.player.full_name,
            avatar_url: app.player.avatar_url,
            position: app.player.position,
            base_location: app.player.base_location,
            nationality: app.player.nationality,
            username: app.player.username,
          },
        }))

        setApplications(transformedApplications)
      } catch {
        setError('Failed to load applicants. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [vacancyId, user])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading applicants...</p>
        </div>
      </div>
    )
  }

  if (error || !vacancy) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error || 'Vacancy not found.'}</p>
          <button
            onClick={() => navigate('/dashboard/profile')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Back Button */}
          <button
            onClick={() => navigate('/dashboard/profile')}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Vacancies
          </button>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Applicants for {vacancy.title}
          </h1>
          <p className="text-gray-600">
            {applications.length} applicant{applications.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {applications.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Applicants Yet</h3>
            <p className="text-gray-600">
              Applications will appear here once players start applying to this vacancy.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((application) => (
              <ApplicantCard key={application.id} application={application} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
