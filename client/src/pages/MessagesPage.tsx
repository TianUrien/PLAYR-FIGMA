import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, MessageCircle } from 'lucide-react'
import { useAuthStore } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'react-router-dom'
import ConversationList from '@/components/ConversationList'
import ChatWindow from '@/components/ChatWindow'
import Header from '@/components/Header'
import { ConversationSkeleton } from '@/components/Skeleton'
import { requestCache } from '@/lib/requestCache'
import { monitor } from '@/lib/monitor'
import { logger } from '@/lib/logger'
import { withRetry } from '@/lib/retry'

interface Conversation {
  id: string
  participant_one_id: string
  participant_two_id: string
  created_at: string
  updated_at: string
  last_message_at: string | null
  otherParticipant?: {
    id: string
    full_name: string
    username: string | null
    avatar_url: string | null
    role: 'player' | 'coach' | 'club'
  }
  lastMessage?: {
    content: string
    sent_at: string
    sender_id: string
  }
  unreadCount?: number
  isPending?: boolean
}

export default function MessagesPage() {
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [pendingConversation, setPendingConversation] = useState<Conversation | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Set selected conversation from URL parameter
  useEffect(() => {
    const conversationId = searchParams.get('conversation')
    if (conversationId) {
      setSelectedConversationId(conversationId)
      return
    }

    const pendingUserId = searchParams.get('new')
    if (!pendingUserId) {
      setSelectedConversationId(null)
    }
  }, [searchParams])

  const fetchConversations = useCallback(async (options?: { force?: boolean }) => {
    if (!user?.id) return

    await monitor.measure('fetch_conversations', async () => {
      const cacheKey = `conversations-${user.id}`
      if (options?.force) {
        requestCache.invalidate(cacheKey)
        logger.debug('Forcing conversations refresh due to direct navigation', { cacheKey })
      }
      
      try {
        const enrichedConversations = await requestCache.dedupe(
          cacheKey,
          async () => {
            // Fetch conversations where user is a participant - with retry
            const conversationsResult = await withRetry(async () => {
              const result = await supabase
                .from('conversations')
                .select('*')
                .or(`participant_one_id.eq.${user.id},participant_two_id.eq.${user.id}`)
                .order('last_message_at', { ascending: false, nullsFirst: false })
              if (result.error) throw result.error
              return result
            })

            const { data: conversationsData, error: conversationsError } = conversationsResult
            if (conversationsError) throw conversationsError
            if (!conversationsData || conversationsData.length === 0) return []

            // Extract all participant IDs (not the current user)
            const otherParticipantIds = conversationsData.map(conv => 
              conv.participant_one_id === user.id ? conv.participant_two_id : conv.participant_one_id
            )

            // Batch fetch all profiles in a single query - with retry
            const profilesResult = await withRetry(async () => {
              const result = await supabase
                .from('profiles')
                .select('id, full_name, username, avatar_url, role')
                .in('id', otherParticipantIds)
              if (result.error) throw result.error
              return result
            })
            const { data: profilesData } = profilesResult

            // Create a map for fast lookup
            const profilesMap = new Map(
              (profilesData || []).map(p => [p.id, p])
            )

            // Extract all conversation IDs
            const conversationIds = conversationsData.map(conv => conv.id)

            // Batch fetch last messages - use a subquery approach
            // Get all messages for these conversations, ordered, then filter to first per conversation
            const { data: messagesData } = await supabase
              .from('messages')
              .select('conversation_id, content, sent_at, sender_id')
              .in('conversation_id', conversationIds)
              .order('sent_at', { ascending: false })

            // Group messages by conversation and take the first (most recent) for each
            const lastMessagesMap = new Map()
            messagesData?.forEach(msg => {
              if (!lastMessagesMap.has(msg.conversation_id)) {
                lastMessagesMap.set(msg.conversation_id, msg)
              }
            })

            // Batch fetch unread messages and count client-side
            const { data: unreadMessagesData } = await supabase
              .from('messages')
              .select('conversation_id')
              .in('conversation_id', conversationIds)
              .neq('sender_id', user.id)
              .is('read_at', null)

            // Count unread messages per conversation
            const unreadCountsMap = new Map()
            unreadMessagesData?.forEach(msg => {
              const currentCount = unreadCountsMap.get(msg.conversation_id) || 0
              unreadCountsMap.set(msg.conversation_id, currentCount + 1)
            })

            // Enrich conversations with the fetched data
            return conversationsData.map(conv => {
              const otherParticipantId = conv.participant_one_id === user.id 
                ? conv.participant_two_id 
                : conv.participant_one_id
              
              const profileData = profilesMap.get(otherParticipantId)

              return {
                ...conv,
                otherParticipant: profileData ? {
                  ...profileData,
                  role: profileData.role as 'player' | 'coach' | 'club'
                } : undefined,
                lastMessage: lastMessagesMap.get(conv.id) || undefined,
                unreadCount: unreadCountsMap.get(conv.id) || 0
              }
            })
          },
          15000 // 15 second cache for conversations
        )

        setConversations(enrichedConversations)
      } catch (error) {
        logger.error('Error fetching conversations:', error)
      } finally {
        setLoading(false)
      }
    }, { userId: user.id })
  }, [user?.id]) // Fixed: Only depend on user.id to prevent unnecessary recreations

  useEffect(() => {
    if (user?.id) {
      fetchConversations()
    }
  }, [user?.id, fetchConversations]) // Fixed: Use user?.id instead of user object

  // Remove forced refresh on navigation - rely on real-time updates instead

  useEffect(() => {
    if (!user?.id) return

    const targetUserId = searchParams.get('new')

    if (!targetUserId) {
      setPendingConversation(null)
      return
    }

    if (targetUserId === user.id) {
      logger.warn('Ignoring request to start conversation with self', { targetUserId })
      setPendingConversation(null)
      return
    }

    const existingConversation = conversations.find(
      (conv) =>
        (conv.participant_one_id === user.id && conv.participant_two_id === targetUserId) ||
        (conv.participant_two_id === user.id && conv.participant_one_id === targetUserId)
    )

    if (existingConversation) {
      setPendingConversation(null)
      setSelectedConversationId(existingConversation.id)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('conversation', existingConversation.id)
        next.delete('new')
        return next
      })
      return
    }

    if (
      pendingConversation &&
      ((pendingConversation.participant_one_id === user.id && pendingConversation.participant_two_id === targetUserId) ||
        (pendingConversation.participant_two_id === user.id && pendingConversation.participant_one_id === targetUserId))
    ) {
      setSelectedConversationId(pendingConversation.id)
      return
    }

    let isCancelled = false

    const loadPendingParticipant = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, role')
          .eq('id', targetUserId)
          .maybeSingle()

        if (isCancelled) return

        if (error || !data) {
          logger.error('Failed to load participant for pending conversation', { error, targetUserId })
          setPendingConversation(null)
          return
        }

        const pendingId = `pending-${targetUserId}`
        setPendingConversation({
          id: pendingId,
          participant_one_id: user.id,
          participant_two_id: targetUserId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: null,
          otherParticipant: {
            id: data.id,
            full_name: data.full_name,
            username: data.username,
            avatar_url: data.avatar_url,
            role: ((data.role ?? 'player') as 'player' | 'coach' | 'club')
          },
          unreadCount: 0,
          isPending: true
        })
        setSelectedConversationId(pendingId)
      } catch (error) {
        if (isCancelled) return
        logger.error('Unexpected error loading pending conversation', { error, targetUserId })
        setPendingConversation(null)
      }
    }

    loadPendingParticipant()

    return () => {
      isCancelled = true
    }
  }, [searchParams, user?.id, conversations, pendingConversation, setSearchParams])

  const activeConversationIds = useMemo(() => {
    return conversations.map((conv) => conv.id).sort()
  }, [conversations])

  const conversationFilter = useMemo(() => {
    if (activeConversationIds.length === 0) {
      return ''
    }
    const quotedIds = activeConversationIds.map((id) => `"${id}"`).join(',')
    return `conversation_id=in.(${quotedIds})`
  }, [activeConversationIds])

  // Set up scoped real-time subscription for relevant conversations only
  useEffect(() => {
    if (!user?.id || !conversationFilter) {
      return
    }
    const channel = supabase
      .channel(`messages-realtime:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: conversationFilter
        },
        () => {
          fetchConversations()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: conversationFilter
        },
        () => {
          fetchConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, conversationFilter, fetchConversations])

  const combinedConversations = useMemo(() => {
    if (!pendingConversation) return conversations

    const duplicateExists = conversations.some(
      (conv) =>
        (conv.participant_one_id === pendingConversation.participant_one_id &&
          conv.participant_two_id === pendingConversation.participant_two_id) ||
        (conv.participant_one_id === pendingConversation.participant_two_id &&
          conv.participant_two_id === pendingConversation.participant_one_id)
    )

    if (duplicateExists) {
      return conversations
    }

    return [pendingConversation, ...conversations]
  }, [conversations, pendingConversation])

  const filteredConversations = combinedConversations.filter((conv) =>
    conv.otherParticipant?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedConversation = combinedConversations.find((conv) => conv.id === selectedConversationId)

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      setSelectedConversationId(conversationId)

      const selected = combinedConversations.find((conv) => conv.id === conversationId)

      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)

        if (selected?.isPending) {
          const targetId =
            selected.participant_one_id === user?.id
              ? selected.participant_two_id
              : selected.participant_one_id

          if (targetId) {
            next.set('new', targetId)
          }
          next.delete('conversation')
        } else {
          next.set('conversation', conversationId)
          next.delete('new')
        }

        return next
      })
    },
    [combinedConversations, setSearchParams, user?.id]
  )

  const handleBackToList = useCallback(() => {
    setSelectedConversationId(null)
    setPendingConversation(null)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('conversation')
      next.delete('new')
      return next
    })
  }, [setSearchParams])

  const handleConversationCreated = useCallback(
    (createdConversation: Conversation) => {
      setPendingConversation(null)
      setSelectedConversationId(createdConversation.id)

      // Optimistically add/update conversation in local state
      setConversations((prev) => {
        const existingIndex = prev.findIndex((conv) => conv.id === createdConversation.id)
        const normalizedConversation: Conversation = {
          ...createdConversation,
          last_message_at: createdConversation.last_message_at ?? createdConversation.updated_at,
          unreadCount: createdConversation.unreadCount ?? 0
        }

        if (existingIndex >= 0) {
          const next = [...prev]
          next[existingIndex] = {
            ...next[existingIndex],
            ...normalizedConversation
          }
          return next
        }

        return [normalizedConversation, ...prev]
      })

      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('conversation', createdConversation.id)
        next.delete('new')
        return next
      })
      // Don't force refresh - real-time subscription will handle updates
    },
    [setSearchParams]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center pt-20 h-[calc(100vh-80px)]">
          <main className="max-w-7xl mx-auto px-4 md:px-6 w-full">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden h-[calc(100vh-140px)]">
              <div className="flex h-full">
                {/* Conversation List Skeleton */}
                <div className="w-full md:w-96 border-r border-gray-200 flex flex-col">
                  <div className="p-4 border-b border-gray-200">
                    <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-4"></div>
                    <div className="h-10 bg-gray-100 rounded-lg animate-pulse"></div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {[...Array(8)].map((_, i) => (
                      <ConversationSkeleton key={i} />
                    ))}
                  </div>
                </div>
                {/* Empty State Skeleton */}
                <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse mx-auto mb-4"></div>
                    <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mx-auto"></div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-24 pb-6">
  <div className="bg-white rounded-2xl shadow-sm overflow-hidden h-[calc(100vh-140px)]">
          <div className="flex h-full">
            {/* Left Column - Conversations List */}
            <div className={`w-full md:w-96 border-r border-gray-200 flex flex-col ${selectedConversationId ? 'hidden md:flex' : 'flex'}`}>
              {/* Header */}
              <div className="p-4 border-b border-gray-200">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Messages</h1>
                
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto">
                {filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <MessageCircle className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No messages yet</h3>
                    <p className="text-sm text-gray-600">
                      Start a conversation from a player or club profile
                    </p>
                  </div>
                ) : (
                  <ConversationList
                    conversations={filteredConversations}
                    selectedConversationId={selectedConversationId}
                    onSelectConversation={handleSelectConversation}
                    currentUserId={user?.id || ''}
                  />
                )}
              </div>
            </div>

            {/* Right Column - Chat Window */}
            <div className={`flex-1 ${selectedConversationId ? 'flex' : 'hidden md:flex'} flex-col`}>
              {selectedConversation ? (
                <ChatWindow
                  conversation={selectedConversation}
                  currentUserId={user?.id || ''}
                  onBack={handleBackToList}
                  onMessageSent={() => {
                    // Mark messages as read, but don't force full refresh
                    // Real-time subscription will handle conversation list updates
                  }}
                  onConversationCreated={handleConversationCreated}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <MessageCircle className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a conversation</h3>
                  <p className="text-gray-600">
                    Choose a conversation from the list to start messaging
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
