import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, LogOut, Users, Briefcase, LayoutDashboard, Settings } from 'lucide-react'
import { Avatar, NotificationBadge } from '@/components'
import { useAuthStore } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { monitor } from '@/lib/monitor'
import { requestCache, generateCacheKey } from '@/lib/requestCache'

export default function Header() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuthStore()
  const [unreadCount, setUnreadCount] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch unread message count
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return

    const cacheKey = generateCacheKey('unread_count', { userId: user.id })
    console.log('🔍 [Header] Fetching unread count...', { cacheKey })

    await monitor.measure('fetch_unread_count', async () => {
      const count = await requestCache.dedupe(
        cacheKey,
        async () => {
          console.log('📡 [Header] Querying user_unread_counts_secure view...')
          // Use regular view for instant unread count (10-50ms with indexes)
          const { data, error } = await supabase
            .from('user_unread_counts_secure')
            .select('unread_count')
            .maybeSingle()

          if (error) {
            console.error('❌ [Header] Failed to fetch unread count:', error)
            return 0
          }

          const unreadCount = data?.unread_count || 0
          console.log('✅ [Header] Fetched unread count from DB:', unreadCount)
          return unreadCount
        },
        5000 // 🔥 FIX #3: Reduced from 60s to 5s for faster recovery
      )

      console.log('📊 [Header] Setting unread count state:', count)
      setUnreadCount(count)
    }, { userId: user.id })
  }, [user?.id]) // Only depend on user.id to prevent unnecessary recreations

  // 🔥 FIX #4: Export method for optimistic badge updates
  // This allows ChatWindow to instantly decrement the badge
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__updateUnreadBadge = (delta: number) => {
        console.log(`🎯 [Header] __updateUnreadBadge called with delta: ${delta}`)
        setUnreadCount(prev => {
          const newCount = Math.max(0, prev + delta)
          console.log(`🎯 [Header] Badge count: ${prev} → ${newCount}`)
          return newCount
        })
      }
      
      // Add function to force refresh badge from database
      window.__refreshUnreadBadge = () => {
        console.log('🔄 [Header] __refreshUnreadBadge called - forcing database refresh')
        fetchUnreadCount()
      }
      
      console.log('✅ [Header] window.__updateUnreadBadge registered')
      console.log('✅ [Header] window.__refreshUnreadBadge registered')
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.__updateUnreadBadge
        delete window.__refreshUnreadBadge
        console.log('🗑️ [Header] window.__updateUnreadBadge cleaned up')
        console.log('🗑️ [Header] window.__refreshUnreadBadge cleaned up')
      }
    }
  }, [fetchUnreadCount])

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
        (payload) => {
          console.log('🔔 [Header] Real-time message event:', payload.eventType)
          // Add a small delay to ensure DB transaction is committed
          // This prevents fetching stale data due to race conditions
          setTimeout(() => {
            console.log('⏰ [Header] Fetching unread count after DB sync delay')
            fetchUnreadCount()
          }, 250) // 250ms delay for DB sync
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

        </div>

        {/* Mobile Menu - Hidden, navigation handled by MobileBottomNav */}
      </nav>
    </header>
  )
}
