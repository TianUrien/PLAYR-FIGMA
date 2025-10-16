import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { Modal, Input, Button } from '@/components'
import { useAuthStore } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export default function Landing() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [showSignIn, setShowSignIn] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Redirect if already logged in
  useEffect(() => {
    if (user && profile) {
      navigate('/dashboard/profile')
    }
  }, [user, profile, navigate])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) throw signInError

      if (data.user) {
        // Check if profile exists
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single()

        if (profileError) {
          setError('Could not load your profile. Please try again.')
          await supabase.auth.signOut()
          return
        }

        if (profileData) {
          navigate('/dashboard/profile')
        } else {
          setError('Profile not found. Please contact support.')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img 
          src="/hero-desktop.webp"
          alt="Field Hockey"
          className="w-full h-full object-cover"
          fetchPriority="high"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex">
        {/* Left Side - Hero Content */}
        <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24">
          <div className="max-w-2xl">
            <img 
              src="/PLAYR logo White.png" 
              alt="PLAYR" 
              className="h-24 md:h-32 mb-6 object-contain object-left"
              fetchPriority="high"
              loading="eager"
            />
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">
              Built for Field Hockey.
            </h2>
            <p className="text-xl md:text-2xl text-gray-300 mb-4">
              Connect players, coaches, and clubs.
            </p>
            <p className="text-xl md:text-2xl text-gray-300">
              Raise the sport together.
            </p>
          </div>
        </div>

        {/* Right Side - Sign In Card */}
        <div className="w-full md:w-[500px] flex items-center justify-center p-8">
          <div className="glass-strong w-full max-w-md rounded-3xl p-8">
            <h3 className="text-3xl font-bold text-white mb-2">Sign In to PLAYR</h3>
            
            <form onSubmit={handleSignIn} className="space-y-4 mt-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/90"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white/90"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:opacity-90"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/signup')}
                className="text-[#8b5cf6] hover:text-[#6366f1] font-medium"
              >
                Don't have an account? Join Now →
              </button>
            </div>

            <p className="text-center text-gray-400 text-sm mt-6 italic">
              PLAYR is where hockey lives.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
