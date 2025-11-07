import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Copy, Archive, MapPin, Calendar, Users, Eye, Rocket, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/auth'
import type { Vacancy } from '../lib/supabase'
import Button from './Button'
import CreateVacancyModal from './CreateVacancyModal'
import ApplyToVacancyModal from './ApplyToVacancyModal'
import VacancyDetailView from './VacancyDetailView'
import PublishConfirmationModal from './PublishConfirmationModal'

interface VacanciesTabProps {
  profileId?: string
  readOnly?: boolean
  triggerCreate?: boolean
  onCreateTriggered?: () => void
}

export default function VacanciesTab({ profileId, readOnly = false, triggerCreate, onCreateTriggered }: VacanciesTabProps) {
  const { user, profile } = useAuthStore()
  const targetUserId = profileId || user?.id
  const navigate = useNavigate()
  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [applicantCounts, setApplicantCounts] = useState<Record<string, number>>({})
  const [userApplications, setUserApplications] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingVacancy, setEditingVacancy] = useState<Vacancy | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null) // Track which vacancy action is loading
  
  // Apply modal state
  const [showApplyModal, setShowApplyModal] = useState(false)
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null)
  
  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailVacancy, setDetailVacancy] = useState<Vacancy | null>(null)
  const [clubName, setClubName] = useState<string>('')
  const [clubLogo, setClubLogo] = useState<string | null>(null)
  
  // Publish confirmation modal state
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [vacancyToPublish, setVacancyToPublish] = useState<Vacancy | null>(null)
  const [showSuccessToast, setShowSuccessToast] = useState(false)

  const fetchVacancies = useCallback(async () => {
    if (!targetUserId) return

    setIsLoading(true)
    try {
      // In readOnly mode, only fetch open vacancies. Otherwise fetch all.
      const query = supabase
        .from('vacancies')
        .select('*')
        .eq('club_id', targetUserId)
        .order('created_at', { ascending: false })
      
      if (readOnly) {
        query.eq('status', 'open')
      }

      const { data, error } = await query

      if (error) throw error
      setVacancies(data || [])

      // Only fetch applicant counts if not in readOnly mode and user is the owner
      if (!readOnly && data && data.length > 0 && user?.id === targetUserId) {
        const counts: Record<string, number> = {}
        await Promise.all(
          data.map(async (vacancy: Vacancy) => {
            const { count, error: countError } = await supabase
              .from('vacancy_applications')
              .select('*', { count: 'exact', head: true })
              .eq('vacancy_id', vacancy.id)
            
            if (!countError && count !== null) {
              counts[vacancy.id] = count
            } else {
              counts[vacancy.id] = 0
            }
          })
        )
        setApplicantCounts(counts)
      }
    } catch (error) {
      console.error('Error fetching vacancies:', error)
    } finally {
      setIsLoading(false)
    }
  }, [targetUserId, readOnly, user])

  // Fetch user's applications to check which vacancies they've applied to
  const fetchUserApplications = useCallback(async () => {
    if (!user || !readOnly) return // Only fetch when in readOnly mode (public view)

    try {
      const { data, error } = await supabase
        .from('vacancy_applications')
        .select('vacancy_id')
        .eq('player_id', user.id)

      if (error) throw error
      
      const appliedVacancyIds = new Set(data?.map(app => app.vacancy_id) || [])
      setUserApplications(appliedVacancyIds)
    } catch (error) {
      console.error('Error fetching user applications:', error)
    }
  }, [user, readOnly])

  useEffect(() => {
    if (targetUserId) {
      fetchVacancies()
      fetchUserApplications()
    }
  }, [targetUserId, fetchVacancies, fetchUserApplications])

  // Handle external trigger to create vacancy
  useEffect(() => {
    if (triggerCreate) {
      setShowModal(true)
      setEditingVacancy(null)
      onCreateTriggered?.()
    }
  }, [triggerCreate, onCreateTriggered])

  const handleApply = (vacancy: Vacancy) => {
    if (!user) {
      // Redirect to login with return URL
      const returnUrl = window.location.pathname
      navigate(`/signup?redirect=${encodeURIComponent(returnUrl)}`)
      return
    }

    setSelectedVacancy(vacancy)
    setShowApplyModal(true)
  }

  const canUserApply = (vacancy: Vacancy): boolean => {
    if (!user || !profile) return false
    
    // Check if user role matches vacancy type
    if (vacancy.opportunity_type === 'player' && profile.role !== 'player') return false
    if (vacancy.opportunity_type === 'coach' && profile.role !== 'coach') return false
    
    // Clubs cannot apply
    if (profile.role === 'club') return false
    
    return true
  }

  const handleViewDetails = async (vacancy: Vacancy) => {
    setDetailVacancy(vacancy)
    setShowDetailModal(true)

    // Fetch club details
    try {
      const { data: clubData } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', vacancy.club_id)
        .single()

      if (clubData) {
        setClubName(clubData.full_name || 'Unknown Club')
        setClubLogo(clubData.avatar_url)
      }
    } catch (error) {
      console.error('Error fetching club details:', error)
      setClubName('Unknown Club')
    }
  }

  useEffect(() => {
    if (targetUserId) {
      fetchVacancies()
    }
  }, [targetUserId, fetchVacancies])

  const handleCreateNew = () => {
    setEditingVacancy(null)
    setShowModal(true)
  }

  const handleEdit = (vacancy: Vacancy) => {
    setEditingVacancy(vacancy)
    setShowModal(true)
  }

  const handleDuplicate = async (vacancy: Vacancy) => {
    if (!user || actionLoading) return

    setActionLoading(vacancy.id)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, created_at, updated_at, published_at, closed_at, ...duplicateData } = vacancy
      
      const newVacancy = {
        ...duplicateData,
        title: `${vacancy.title} (Copy)`,
        status: 'draft' as const,
      }

      const { error } = await supabase
        .from('vacancies')
        .insert(newVacancy as never)

      if (error) throw error
      
      await fetchVacancies()
    } catch (error) {
      console.error('Error duplicating vacancy:', error)
      alert('Failed to duplicate vacancy. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleClose = async (vacancyId: string) => {
    if (actionLoading) return
    
    setActionLoading(vacancyId)
    try {
      const { error } = await supabase
        .from('vacancies')
        .update({ status: 'closed' } as never)
        .eq('id', vacancyId)

      if (error) throw error
      
      await fetchVacancies()
    } catch (error) {
      console.error('Error closing vacancy:', error)
      alert('Failed to close vacancy. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePublishClick = (vacancy: Vacancy) => {
    setVacancyToPublish(vacancy)
    setShowPublishModal(true)
  }

  const handlePublish = async () => {
    if (actionLoading || !vacancyToPublish) return
    
    setActionLoading(vacancyToPublish.id)
    try {
      const { error } = await supabase
        .from('vacancies')
        .update({ status: 'open', published_at: new Date().toISOString() } as never)
        .eq('id', vacancyToPublish.id)

      if (error) throw error
      
      await fetchVacancies()
      
      // Close modal and show success toast
      setShowPublishModal(false)
      setVacancyToPublish(null)
      setShowSuccessToast(true)
      
      // Auto-hide toast after 3 seconds
      setTimeout(() => {
        setShowSuccessToast(false)
      }, 3000)
    } catch (error) {
      console.error('Error publishing vacancy:', error)
      alert('Failed to publish vacancy. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: Vacancy['status']) => {
    if (!status) return null
    
    const styles: Record<string, string> = {
      draft: 'bg-amber-100 text-amber-700 border border-amber-300',
      open: 'bg-green-100 text-green-700 border border-green-300',
      closed: 'bg-red-100 text-red-700 border border-red-300',
    }
    
    const labels: Record<string, string> = {
      draft: '⚠️ Draft',
      open: '✓ Published',
      closed: 'Closed',
    }
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'TBD'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading vacancies...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">💼</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {readOnly ? 'Open Vacancies' : 'Club Vacancies'}
              </h2>
              <p className="text-sm text-gray-600">
                {readOnly 
                  ? 'Current open positions at this club' 
                  : 'Manage your player and coaching opportunities'
                }
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 ml-15">{vacancies.length} Total Vacancies</p>
        </div>
        
        {!readOnly && vacancies.length > 0 && (
          <Button
            onClick={handleCreateNew}
            className="flex items-center gap-2 bg-[#10b981] hover:bg-[#059669]"
          >
            <Plus className="w-4 h-4" />
            Create Vacancy
          </Button>
        )}
      </div>

      {/* Empty State */}
      {vacancies.length === 0 && (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">💼</span>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Vacancies Yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first vacancy to start attracting talent to your club
          </p>
          <Button
            onClick={handleCreateNew}
            className="flex items-center gap-2 mx-auto bg-[#10b981] hover:bg-[#059669]"
          >
            <Plus className="w-4 h-4" />
            Create First Vacancy
          </Button>
        </div>
      )}

      {/* Vacancies Grid */}
      {vacancies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vacancies.map((vacancy) => (
            <div
              key={vacancy.id}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{vacancy.title}</h3>
                    {getStatusBadge(vacancy.status)}
                  </div>
                  {vacancy.opportunity_type === 'player' && (
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {vacancy.position && (
                        <>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {vacancy.position.charAt(0).toUpperCase() + vacancy.position.slice(1)}
                          </span>
                          <span>•</span>
                        </>
                      )}
                      {vacancy.gender && <span>{vacancy.gender}</span>}
                    </div>
                  )}
                  {vacancy.opportunity_type === 'coach' && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                        Coach Position
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span>{vacancy.location_city}, {vacancy.location_country}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>Start: {formatDate(vacancy.start_date)}</span>
                </div>
                {vacancy.benefits && vacancy.benefits.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Benefits:</span>
                    <span className="font-medium text-green-600">{vacancy.benefits.length} included</span>
                  </div>
                )}
              </div>

              {/* Applicants Counter */}
              {!readOnly && (vacancy.status === 'open' || vacancy.status === 'closed') && (
                <button
                  onClick={() => navigate(`/dashboard/club/vacancies/${vacancy.id}/applicants`)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-4 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <Users className="w-4 h-4" />
                  {applicantCounts[vacancy.id] || 0} Applicant{applicantCounts[vacancy.id] !== 1 ? 's' : ''}
                </button>
              )}

              {/* Draft Warning Message */}
              {!readOnly && vacancy.status === 'draft' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-amber-800 font-medium">
                    ⚠️ This opportunity is <strong>not visible to players</strong>. Click "Publish" to make it live.
                  </p>
                </div>
              )}

              {/* Apply Button - Public View */}
              {readOnly && vacancy.status === 'open' && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    {!user ? (
                      // Not logged in - show sign in prompt
                      <button
                        onClick={() => handleApply(vacancy)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] hover:shadow-lg rounded-lg transition-all"
                      >
                        Sign in to Apply
                      </button>
                    ) : userApplications.has(vacancy.id) ? (
                      // Already applied
                      <button
                        disabled
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-green-700 bg-green-50 rounded-lg cursor-not-allowed"
                      >
                        ✓ Applied
                      </button>
                    ) : canUserApply(vacancy) ? (
                      // Can apply
                      <button
                        onClick={() => handleApply(vacancy)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] hover:shadow-lg rounded-lg transition-all"
                      >
                        Apply Now
                      </button>
                    ) : (
                      // Cannot apply (wrong role)
                      <div className="flex-1 px-4 py-3 text-sm text-center text-gray-500 bg-gray-50 rounded-lg">
                        {vacancy.opportunity_type === 'player' 
                          ? 'Available for Player accounts only'
                          : 'Available for Coach accounts only'}
                      </div>
                    )}
                    
                    {/* View Details Button (Eye Icon) */}
                    <button
                      onClick={() => handleViewDetails(vacancy)}
                      className="p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                      title="View details"
                      aria-label="View vacancy details"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              {!readOnly && (
                <div className="space-y-3 pt-4 border-t border-gray-200">
                  {/* Primary Action: Publish Button (for drafts) */}
                  {vacancy.status === 'draft' && (
                    <button
                      onClick={() => handlePublishClick(vacancy)}
                      disabled={actionLoading === vacancy.id}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-lg shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
                      title="Publish this opportunity to make it visible to all players"
                    >
                      <Rocket className="w-5 h-5" />
                      {actionLoading === vacancy.id ? 'Publishing...' : 'Publish Opportunity'}
                    </button>
                  )}
                  
                  {/* Close Button (for published) */}
                  {vacancy.status === 'open' && (
                    <button
                      onClick={() => handleClose(vacancy.id)}
                      disabled={actionLoading === vacancy.id}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Close vacancy"
                    >
                      <Archive className="w-4 h-4" />
                      {actionLoading === vacancy.id ? 'Closing...' : 'Close Opportunity'}
                    </button>
                  )}
                  
                  {/* Secondary Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(vacancy)}
                      disabled={actionLoading === vacancy.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Edit vacancy"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDuplicate(vacancy)}
                      disabled={actionLoading === vacancy.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Duplicate vacancy"
                    >
                      <Copy className="w-4 h-4" />
                      {actionLoading === vacancy.id && vacancy.status !== 'draft' ? 'Duplicating...' : 'Duplicate'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <CreateVacancyModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingVacancy(null)
        }}
        onSuccess={fetchVacancies}
        editingVacancy={editingVacancy}
      />

      {/* Apply Modal */}
      {selectedVacancy && (
        <ApplyToVacancyModal
          isOpen={showApplyModal}
          onClose={() => {
            setShowApplyModal(false)
            setSelectedVacancy(null)
          }}
          vacancy={selectedVacancy}
          onSuccess={() => {
            // Add this vacancy to the applied set
            setUserApplications(prev => new Set([...prev, selectedVacancy.id]))
          }}
        />
      )}

      {/* Vacancy Detail Modal */}
      {detailVacancy && showDetailModal && (
        <VacancyDetailView
          vacancy={detailVacancy}
          clubName={clubName}
          clubLogo={clubLogo}
          clubId={detailVacancy.club_id}
          onClose={() => {
            setShowDetailModal(false)
            setDetailVacancy(null)
          }}
          onApply={
            user && (profile?.role === 'player' || profile?.role === 'coach') && canUserApply(detailVacancy)
              ? () => {
                  setShowDetailModal(false)
                  setSelectedVacancy(detailVacancy)
                  setShowApplyModal(true)
                }
              : undefined
          }
          hasApplied={userApplications.has(detailVacancy.id)}
          hideClubProfileButton={true}
        />
      )}

      {/* Publish Confirmation Modal */}
      {vacancyToPublish && (
        <PublishConfirmationModal
          isOpen={showPublishModal}
          onClose={() => {
            setShowPublishModal(false)
            setVacancyToPublish(null)
          }}
          onConfirm={handlePublish}
          vacancyTitle={vacancyToPublish.title}
          isLoading={actionLoading === vacancyToPublish.id}
        />
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className="bg-white rounded-lg shadow-2xl border border-green-200 p-4 flex items-center gap-3 min-w-[300px]">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Published Successfully!</p>
              <p className="text-sm text-gray-600">Your opportunity is now visible to all players</p>
            </div>
            <button
              onClick={() => setShowSuccessToast(false)}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
