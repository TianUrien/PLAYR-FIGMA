import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, MapPin, Globe, Calendar, Building2 } from 'lucide-react'
import { Input, Button } from '@/components'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/auth'

type UserRole = 'player' | 'coach' | 'club'

/**
 * CompleteProfile - Step 2 of signup (POST email verification)
 * 
 * Flow:
 * 1. User has verified email and active session
 * 2. Profile row exists from DB trigger (id, email, role)
 * 3. User fills long form with complete details
 * 4. Update profile row with full data
 * 5. Redirect to dashboard
 */
export default function CompleteProfile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [error, setError] = useState('')
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [userId, setUserId] = useState<string>('')

  // Form data states
  const [formData, setFormData] = useState({
    fullName: '',
    clubName: '',
    city: '',
    nationality: '',
    country: '',
    dateOfBirth: '',
    position: '',
    gender: '',
    passport1: '',
    passport2: '',
    yearFounded: '',
    leagueDivision: '',
    website: '',
    contactEmail: '',
    clubBio: '',
    clubHistory: '',
  })

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          console.error('No session found in CompleteProfile')
          navigate('/signup')
          return
        }

        setUserId(session.user.id)

        // Fetch existing profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, full_name, email')
          .eq('id', session.user.id)
          .single()

        // If profile doesn't exist, create it now
        if (profileError && profileError.code === 'PGRST116') {
          console.log('Profile not found, creating basic profile')
          
          // Get role from user metadata or localStorage
          const role = session.user.user_metadata?.role || localStorage.getItem('pending_role') || 'player'
          
          // Create basic profile (type assertion needed until DB types are regenerated after migration)
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              email: session.user.email!,
              role: role,
              full_name: null,
              base_location: null,
              nationality: null
            } as unknown as never)

          if (insertError) {
            console.error('Error creating profile:', insertError)
            setError('Could not create your profile. Please try again or contact support.')
            setCheckingProfile(false)
            return
          }

          console.log('Basic profile created successfully')

          // Use the newly created profile
          setUserRole(role as UserRole)
          setFormData(prev => ({ ...prev, contactEmail: session.user.email || '' }))
          setCheckingProfile(false)
          return
        }

        if (profileError) {
          console.error('Error fetching profile:', profileError)
          setError('Could not load your profile. Please try again.')
          setCheckingProfile(false)
          return
        }

        if (!profile) {
          console.error('Profile not found and could not be created')
          setError('Profile not found. Please contact support.')
          setCheckingProfile(false)
          return
        }

        // If profile already complete, go to dashboard
        if (profile.full_name) {
          console.log('Profile already complete, redirecting to dashboard')
          navigate('/dashboard/profile')
          return
        }

        // Set role from profile
        setUserRole(profile.role as UserRole)
        
        // Pre-fill email if available
        if (profile.email) {
          setFormData(prev => ({ ...prev, contactEmail: profile.email }))
        }

      } catch (err) {
        console.error('Error checking session:', err)
        setError('Something went wrong. Please try again.')
      } finally {
        setCheckingProfile(false)
      }
    }

    checkSession()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!userId || !userRole) {
        throw new Error('Session or role not found')
      }

      // Prepare data based on role
      let updateData: Record<string, unknown> = {
        role: userRole, // IMPORTANT: Always include role in update
        full_name: formData.fullName || formData.clubName,
        base_location: formData.city,
        nationality: formData.nationality,
      }

      if (userRole === 'player') {
        updateData = {
          ...updateData,
          position: formData.position,
          gender: formData.gender,
          date_of_birth: formData.dateOfBirth || null,
        }
      } else if (userRole === 'coach') {
        updateData = {
          ...updateData,
          gender: formData.gender || null,
          date_of_birth: formData.dateOfBirth || null,
          passport_1: formData.passport1 || null,
          passport_2: formData.passport2 || null,
        }
      } else if (userRole === 'club') {
        updateData = {
          ...updateData,
          full_name: formData.clubName,
          base_location: formData.city, // City is stored in base_location
          // Note: country field is not in profiles table, using nationality instead
          year_founded: formData.yearFounded ? parseInt(formData.yearFounded) : null,
          league_division: formData.leagueDivision,
          website: formData.website,
          contact_email: formData.contactEmail,
          club_bio: formData.clubBio,
          club_history: formData.clubHistory,
        }
      }

      console.log('Updating profile with data:', updateData)

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)

      if (updateError) {
        console.error('Error updating profile:', updateError)
        throw new Error(`Failed to update profile: ${updateError.message}`)
      }

      console.log('Profile updated successfully')

      // Fetch the updated profile to verify
      const { data: updatedProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (fetchError || !updatedProfile) {
        console.error('Error fetching updated profile:', fetchError)
        throw new Error('Profile updated but could not verify. Please refresh the page.')
      }

      console.log('Updated profile verified:', updatedProfile)

      // Refresh the auth store with the updated profile
      const { fetchProfile } = useAuthStore.getState()
      await fetchProfile(userId)
      
      console.log('Auth store refreshed with updated profile')

      // Redirect to dashboard with role-specific route
      const dashboardRoute = updatedProfile.role === 'club' ? '/dashboard/profile' : '/dashboard/profile'
      console.log('Redirecting to:', dashboardRoute)
      navigate(dashboardRoute)

    } catch (err) {
      console.error('Complete profile error:', err)
      setError(err instanceof Error ? err.message : 'Failed to complete profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#6366f1] mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    )
  }

  if (error && !userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0">
        <img 
          src="/hero-desktop.webp"
          alt="Field Hockey"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]">
            <div className="flex items-center gap-3 mb-2">
              <img 
                src="/PLAYR logo White.png" 
                alt="PLAYR" 
                className="h-8"
              />
            </div>
            <p className="text-white/90 text-sm">
              Complete your profile to get started
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 max-h-[80vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {userRole === 'player' && 'Complete Player Profile'}
              {userRole === 'coach' && 'Complete Coach Profile'}
              {userRole === 'club' && 'Complete Club Profile'}
            </h3>
            <p className="text-gray-600 mb-6">Fill in your details below</p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Player Form */}
              {userRole === 'player' && (
                <>
                  <Input
                    label="Full Name"
                    icon={<User className="w-5 h-5" />}
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />

                  <Input
                    label="Base Location (City)"
                    icon={<MapPin className="w-5 h-5" />}
                    placeholder="Where are you currently based?"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />

                  <Input
                    label="Nationality"
                    icon={<Globe className="w-5 h-5" />}
                    placeholder="Your nationality"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    required
                  />

                  <div>
                    <label htmlFor="position-select" className="block text-sm font-medium text-gray-700 mb-2">
                      Position <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="position-select"
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6366f1] focus:border-transparent"
                      required
                    >
                      <option value="">Select your position</option>
                      <option value="Goalkeeper">Goalkeeper</option>
                      <option value="Defender">Defender</option>
                      <option value="Midfielder">Midfielder</option>
                      <option value="Forward">Forward</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="gender-select" className="block text-sm font-medium text-gray-700 mb-2">
                      Gender <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="gender-select"
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6366f1] focus:border-transparent"
                      required
                    >
                      <option value="">Select gender</option>
                      <option value="Men">Men</option>
                      <option value="Women">Women</option>
                    </select>
                  </div>

                  <Input
                    label="Date of Birth (Optional)"
                    type="date"
                    icon={<Calendar className="w-5 h-5" />}
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                </>
              )}

              {/* Coach Form */}
              {userRole === 'coach' && (
                <>
                  <Input
                    label="Full Name"
                    icon={<User className="w-5 h-5" />}
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />

                  <Input
                    label="Base Location (City)"
                    icon={<MapPin className="w-5 h-5" />}
                    placeholder="Where are you currently based?"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />

                  <Input
                    label="Nationality"
                    icon={<Globe className="w-5 h-5" />}
                    placeholder="Your nationality"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="coach-gender">
                      Gender
                    </label>
                    <select
                      id="coach-gender"
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6366f1] focus:border-transparent"
                      required
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <Input
                    label="Date of Birth"
                    type="date"
                    icon={<Calendar className="w-5 h-5" />}
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />

                  <Input
                    label="Passport 1"
                    icon={<Globe className="w-5 h-5" />}
                    placeholder="Primary passport/nationality (optional)"
                    value={formData.passport1}
                    onChange={(e) => setFormData({ ...formData, passport1: e.target.value })}
                  />

                  <Input
                    label="Passport 2"
                    icon={<Globe className="w-5 h-5" />}
                    placeholder="Secondary passport/nationality (optional)"
                    value={formData.passport2}
                    onChange={(e) => setFormData({ ...formData, passport2: e.target.value })}
                  />
                </>
              )}

              {/* Club Form */}
              {userRole === 'club' && (
                <>
                  <Input
                    label="Club Name"
                    icon={<Building2 className="w-5 h-5" />}
                    placeholder="Enter your club name"
                    value={formData.clubName}
                    onChange={(e) => setFormData({ ...formData, clubName: e.target.value })}
                    required
                  />

                  <Input
                    label="City"
                    icon={<MapPin className="w-5 h-5" />}
                    placeholder="Club location"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />

                  <Input
                    label="Country"
                    icon={<Globe className="w-5 h-5" />}
                    placeholder="Country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    required
                  />

                  <Input
                    label="Year Founded (Optional)"
                    type="number"
                    placeholder="YYYY"
                    value={formData.yearFounded}
                    onChange={(e) => setFormData({ ...formData, yearFounded: e.target.value })}
                  />

                  <Input
                    label="League/Division (Optional)"
                    placeholder="e.g., Premier League"
                    value={formData.leagueDivision}
                    onChange={(e) => setFormData({ ...formData, leagueDivision: e.target.value })}
                  />

                  <Input
                    label="Website (Optional)"
                    type="url"
                    placeholder="https://yourclub.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />

                  <Input
                    label="Contact Email"
                    type="email"
                    placeholder="contact@club.com"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Club Bio (Optional)
                    </label>
                    <textarea
                      value={formData.clubBio}
                      onChange={(e) => setFormData({ ...formData, clubBio: e.target.value })}
                      placeholder="Tell us about your club..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6366f1] focus:border-transparent"
                      rows={4}
                    />
                  </div>
                </>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]"
            >
              {loading ? 'Saving Profile...' : 'Complete Profile'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
