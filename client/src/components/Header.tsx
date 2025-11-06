import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, X, MessageCircle, LogOut, Users, Briefcase, LayoutDashboard, Settings } from 'lucide-react'
import { Avatar, NotificationBadge } from '@/components'
import { useAuthStore } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { monitor } from '@/lib/monitor'
import { requestCache, generateCacheKey } from '@/lib/requestCache'

export default function Header() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuthStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

    // Fetch unread message count
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return

    const cacheKey = generateCacheKey('unread_count', { userId: user.id })

    await monitor.measure('fetch_unread_count', async () => {
      const count = await requestCache.dedupe(
        cacheKey,
        async () => {
          // Use materialized view for instant unread count (<10ms)
          const { data, error } = await supabase
            .from('user_unread_counts_secure')
            .select('unread_count')
            .maybeSingle()

          if (error) {
            console.error('Failed to fetch unread count:', error)
            return 0
          }

          return data?.unread_count || 0
        },
        60000 // Cache for 60 seconds (increased from 10s)
      )

      setUnreadCount(count)
    }, { userId: user.id })
  }, [user?.id]) // Only depend on user.id to prevent unnecessary recreations

  useEffect(() => {
    if (!user?.id) return
    
    fetchUnreadCount()
    
    // Set up real-time subscription for message updates
    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          fetchUnreadCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, fetchUnreadCount]) // Fixed: Use user?.id instead of user object

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <nav className="max-w-7xl mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <img 
                src="/New-LogoBlack.svg" 
                alt="PLAYR" 
                className="h-8"
              />
            </button>
            
            <span 
              className="hidden md:inline-block px-3 py-1 rounded-full text-xs font-medium text-white bg-[#ff9500]"
            >
              The Home of Field Hockey.
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            {user && profile ? (
              <>
                <button
                  onClick={() => navigate('/community')}
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <span>Community</span>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/opportunities')}
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    <span>Opportunities</span>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/messages')}
                  className="relative text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    <span>Messages</span>
                  </div>
                  <NotificationBadge count={unreadCount} />
                </button>
                <button
                  onClick={() => navigate('/dashboard/profile')}
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5" />
                    <span>Dashboard</span>
                  </div>
                </button>
                
                {/* Avatar Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    aria-label="Open user menu"
                    aria-expanded={dropdownOpen}
                    aria-haspopup="true"
                  >
                    <Avatar
                      src={profile.avatar_url}
                      initials={profile.full_name.split(' ').map(n => n[0]).join('')}
                      size="sm"
                    />
                    <span className="text-sm font-medium text-gray-700">{profile.full_name}</span>
                  </button>

                  {/* Dropdown Menu */}
                  {dropdownOpen && (
                    <div 
                      className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                      role="menu"
                      aria-orientation="vertical"
                    >
                      <button
                        onClick={() => {
                          setDropdownOpen(false)
                          navigate('/settings')
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                        role="menuitem"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </button>
                      <button
                        onClick={() => {
                          setDropdownOpen(false)
                          handleSignOut()
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                        role="menuitem"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/community')}
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <span>Community</span>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/opportunities')}
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    <span>Opportunities</span>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors px-4 py-2"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Join PLAYR
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-600 hover:text-gray-900"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-gray-200 pt-4 animate-slide-in-down">
            {user && profile ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                  <Avatar
                    src={profile.avatar_url}
                    initials={profile.full_name.split(' ').map(n => n[0]).join('')}
                    size="md"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{profile.full_name}</p>
                    <p className="text-sm text-gray-500 capitalize">{profile.role}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigate('/community')
                    setMobileMenuOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <span>Community</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    navigate('/opportunities')
                    setMobileMenuOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    <span>Opportunities</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    navigate('/messages')
                    setMobileMenuOpen(false)
                  }}
                  className="relative w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    <span>Messages</span>
                    <NotificationBadge 
                      count={unreadCount} 
                      className="notification-badge--inline"
                    />
                  </div>
                </button>
                <button
                  onClick={() => {
                    navigate('/settings')
                    setMobileMenuOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    <span>Settings</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handleSignOut()
                    setMobileMenuOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </div>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    navigate('/community')
                    setMobileMenuOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <span>Community</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    navigate('/opportunities')
                    setMobileMenuOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    <span>Opportunities</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    navigate('/')
                    setMobileMenuOpen(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    navigate('/signup')
                    setMobileMenuOpen(false)
                  }}
                  className="block w-full text-center px-4 py-2 rounded-lg bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white text-sm font-medium"
                >
                  Join PLAYR
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  )
}
