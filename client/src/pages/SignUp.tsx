import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, User, Mail, Lock, MapPin, Globe, Calendar, Upload, Building2, Briefcase } from 'lucide-react'
import { Input, Button } from '@/components'
import { supabase } from '@/lib/supabase'

type UserRole = 'player' | 'coach' | 'club'

export default function SignUp() {
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  // Form data states
  const [formData, setFormData] = useState({
    fullName: '',
    clubName: '',
    email: '',
    password: '',
    city: '',
    nationality: '',
    country: '',
    dateOfBirth: '',
    position: '',
    gender: '',
    yearFounded: '',
    leagueDivision: '',
    website: '',
    contactEmail: '',
    clubBio: '',
    clubHistory: ''
  })

  // Check for existing session on mount (user coming from email verification)
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          // User has a verified session, check their profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', session.user.id)
            .single()

          if (profile) {
            // If profile has full_name, they've completed signup - go to dashboard
            if (profile.full_name) {
              navigate('/dashboard/profile')
              return
            }
            
            // Profile exists with role but no full_name - set role and show form
            if (profile.role) {
              setSelectedRole(profile.role as UserRole)
              setFormData(prev => ({ ...prev, email: session.user.email || '' }))
            }
          }
        }
      } catch (error) {
        console.error('Error checking session:', error)
      } finally {
        setCheckingSession(false)
      }
    }

    checkExistingSession()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (formData.password.length < 8) {
        throw new Error('Password must be at least 8 characters long')
      }

      // Create auth account (no session until email verified)
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            role: selectedRole,
          }
        }
      })

      if (signUpError) throw signUpError
      if (!authData.user) throw new Error('No user data returned from signup')

      // Store email for verification page
      localStorage.setItem('pendingVerificationEmail', formData.email)

      // Redirect to verification page (no profile creation yet)
      navigate(`/verify-email?email=${encodeURIComponent(formData.email)}`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.')
      setLoading(false)
    }
  }

  // Show loading while checking for existing session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#6366f1] mb-4"></div>
          <p className="text-gray-600">Loading...</p>
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
        <div className="bg-white rounded-2xl shadow-2xl animate-scale-in overflow-hidden">
          <>
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]">
              <div className="flex items-center gap-3 mb-2">
                <img 
                  src="/PLAYR logo White.png" 
                  alt="PLAYR" 
                  className="h-8"
                />
              </div>
              <p className="text-white/90 text-sm">
                Create your account and start your field hockey journey
              </p>
            </div>

            {!selectedRole && (
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2 text-center">Join PLAYR</h3>
                  <p className="text-gray-600 mb-8 text-center">Select your role to get started</p>

                  <div className="space-y-4">
                    <button
                      onClick={() => setSelectedRole('player')}
                      className="w-full flex items-center gap-4 p-6 border-2 border-gray-200 rounded-xl hover:border-[#6366f1] hover:bg-[#6366f1]/5 transition-all group"
                    >
                      <div className="w-14 h-14 rounded-full bg-[#6366f1]/10 group-hover:bg-[#6366f1] flex items-center justify-center transition-colors">
                        <User className="w-7 h-7 text-[#6366f1] group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="text-lg font-bold text-gray-900 mb-1">Join as Player</h4>
                        <p className="text-sm text-gray-600">Showcase your skills and connect with clubs</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedRole('coach')}
                      className="w-full flex items-center gap-4 p-6 border-2 border-gray-200 rounded-xl hover:border-[#8b5cf6] hover:bg-[#8b5cf6]/5 transition-all group"
                    >
                      <div className="w-14 h-14 rounded-full bg-[#8b5cf6]/10 group-hover:bg-[#8b5cf6] flex items-center justify-center transition-colors">
                        <Briefcase className="w-7 h-7 text-[#8b5cf6] group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="text-lg font-bold text-gray-900 mb-1">Join as Coach</h4>
                        <p className="text-sm text-gray-600">Find opportunities and mentor players</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedRole('club')}
                      className="w-full flex items-center gap-4 p-6 border-2 border-gray-200 rounded-xl hover:border-[#ec4899] hover:bg-[#ec4899]/5 transition-all group"
                    >
                      <div className="w-14 h-14 rounded-full bg-[#ec4899]/10 group-hover:bg-[#ec4899] flex items-center justify-center transition-colors">
                        <Building2 className="w-7 h-7 text-[#ec4899] group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="text-lg font-bold text-gray-900 mb-1">Join as Club</h4>
                        <p className="text-sm text-gray-600">Discover talent and build your team</p>
                      </div>
                    </button>
                  </div>

                  <div className="mt-6 text-center">
                    <button
                      onClick={() => navigate('/')}
                      className="text-sm text-[#6366f1] hover:text-[#4f46e5] font-medium"
                    >
                      Already have an account? Sign in
                    </button>
                  </div>
                </div>
              )}

              {selectedRole === 'player' && (
                <form onSubmit={handleSubmit} className="p-8 max-h-[80vh] overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedRole(null)}
                    className="mb-6 text-sm text-[#6366f1] hover:text-[#4f46e5] font-medium"
                  >
                    ← Back
                  </button>

                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Create Player Account</h3>
                  <p className="text-gray-600 mb-6">Join PLAYR as a player</p>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <Input
                      label="Full Name"
                      icon={<User className="w-5 h-5" />}
                      placeholder="Enter your full name"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      required
                    />

                    <Input
                      label="Email"
                      type="email"
                      icon={<Mail className="w-5 h-5" />}
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Create a password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="pl-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture (Optional)</label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#6366f1] cursor-pointer">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Click to upload profile picture</p>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-6 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]"
                  >
                    {loading ? 'Creating Account...' : 'Create Player Account'}
                  </Button>
                </form>
              )}

              {selectedRole === 'coach' && (
                <form onSubmit={handleSubmit} className="p-8 max-h-[80vh] overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedRole(null)}
                    className="mb-6 text-sm text-[#8b5cf6] hover:text-[#7c3aed] font-medium"
                  >
                    ← Back
                  </button>

                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Create Coach Account</h3>
                  <p className="text-gray-600 mb-6">Join PLAYR as a coach</p>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <Input
                      label="Full Name"
                      icon={<User className="w-5 h-5" />}
                      placeholder="Enter your full name"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      required
                    />

                    <Input
                      label="Email"
                      type="email"
                      icon={<Mail className="w-5 h-5" />}
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Create a password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="pl-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <Input
                      label="City"
                      icon={<MapPin className="w-5 h-5" />}
                      placeholder="Where are you based?"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                    />

                    <Input
                      label="Country"
                      icon={<Globe className="w-5 h-5" />}
                      placeholder="Your country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      required
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture (Optional)</label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#8b5cf6] cursor-pointer">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Click to upload profile picture</p>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-6 bg-gradient-to-r from-[#8b5cf6] to-[#ec4899]"
                  >
                    {loading ? 'Creating Account...' : 'Create Coach Account'}
                  </Button>
                </form>
              )}

              {selectedRole === 'club' && (
                <form onSubmit={handleSubmit} className="p-8 max-h-[80vh] overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedRole(null)}
                    className="mb-6 text-sm text-[#ec4899] hover:text-[#db2777] font-medium"
                  >
                    ← Back
                  </button>

                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Create Club Account</h3>
                  <p className="text-gray-600 mb-6">Join PLAYR as a club</p>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <Input
                      label="Club Name"
                      icon={<Building2 className="w-5 h-5" />}
                      placeholder="Enter your club name"
                      value={formData.clubName}
                      onChange={(e) => setFormData({ ...formData, clubName: e.target.value })}
                      required
                    />

                    <Input
                      label="Email"
                      type="email"
                      icon={<Mail className="w-5 h-5" />}
                      placeholder="Enter club email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Create a password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="pl-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

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
                      placeholder="Club country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      required
                    />

                    <Input
                      label="Year Founded (Optional)"
                      type="number"
                      icon={<Calendar className="w-5 h-5" />}
                      placeholder="e.g., 1995"
                      value={formData.yearFounded}
                      onChange={(e) => setFormData({ ...formData, yearFounded: e.target.value })}
                    />

                    <Input
                      label="League/Division (Optional)"
                      icon={<Globe className="w-5 h-5" />}
                      placeholder="e.g., National League"
                      value={formData.leagueDivision}
                      onChange={(e) => setFormData({ ...formData, leagueDivision: e.target.value })}
                    />

                    <Input
                      label="Website (Optional)"
                      type="url"
                      icon={<Globe className="w-5 h-5" />}
                      placeholder="www.yourclub.com"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    />

                    <Input
                      label="Contact Email (Optional)"
                      type="email"
                      icon={<Mail className="w-5 h-5" />}
                      placeholder="contact@yourclub.com"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Club Description (Optional)</label>
                      <textarea
                        placeholder="Tell us about your club..."
                        value={formData.clubBio}
                        onChange={(e) => setFormData({ ...formData, clubBio: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ec4899] focus:border-transparent"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Club History (Optional)</label>
                      <textarea
                        placeholder="Share your club's history and achievements..."
                        value={formData.clubHistory}
                        onChange={(e) => setFormData({ ...formData, clubHistory: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ec4899] focus:border-transparent"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Club Logo (Optional)</label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#ec4899] cursor-pointer">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Click to upload club logo</p>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-6 bg-gradient-to-r from-[#ec4899] to-[#f97316]"
                  >
                    {loading ? 'Creating Account...' : 'Create Club Account'}
                  </Button>
                </form>
              )}
            </>
        </div>
      </div>
    </div>
  )
}
