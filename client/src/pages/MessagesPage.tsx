import { useState, useEffect } from 'react'
import { Search, MessageCircle } from 'lucide-react'
import { useAuthStore } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'react-router-dom'
import ConversationList from '@/components/ConversationList'
import ChatWindow from '@/components/ChatWindow'
import Header from '@/components/Header'
import { requestCache } from '@/lib/requestCache'
import { monitor } from '@/lib/monitor'

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
    username: string
    avatar_url: string | null
    role: 'player' | 'coach' | 'club'
  }
  lastMessage?: {
    content: string
    sent_at: string
    sender_id: string
  }
  unreadCount?: number
}

export default function MessagesPage() {
  const { user } = useAuthStore()
  const [searchParams] = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Set selected conversation from URL parameter
  useEffect(() => {
    const conversationId = searchParams.get('conversation')
    if (conversationId) {
      setSelectedConversationId(conversationId)
    }
  }, [searchParams])

  useEffect(() => {
    if (user) {
      fetchConversations()
    }
  }, [user])

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
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
          table: 'messages'
        },
        () => {
          fetchConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const fetchConversations = async () => {
    if (!user) return

    await monitor.measure('fetch_conversations', async () => {
      const cacheKey = `conversations-${user.id}`
      
      try {
        const enrichedConversations = await requestCache.dedupe(
          cacheKey,
          async () => {
            // Fetch conversations where user is a participant
            const { data: conversationsData, error: conversationsError } = await supabase
              .from('conversations')
              .select('*')
              .or(`participant_one_id.eq.${user.id},participant_two_id.eq.${user.id}`)
              .order('last_message_at', { ascending: false, nullsFirst: false })

            if (conversationsError) throw conversationsError

            // Fetch profile data and last message for each conversation
            return await Promise.all(
              (conversationsData || []).map(async (conv) => {
                const otherParticipantId =
                  conv.participant_one_id === user.id ? conv.participant_two_id : conv.participant_one_id

                // Fetch other participant's profile
                const { data: profileData } = await supabase
                  .from('profiles')
                  .select('id, full_name, username, avatar_url, role')
                  .eq('id', otherParticipantId)
                  .single()

                // Fetch last message
                const { data: lastMessageData } = await supabase
                  .from('messages')
                  .select('content, sent_at, sender_id')
                  .eq('conversation_id', conv.id)
                  .order('sent_at', { ascending: false })
                  .limit(1)
                  .single()

                // Count unread messages
                const { count: unreadCount } = await supabase
                  .from('messages')
                  .select('*', { count: 'exact', head: true })
                  .eq('conversation_id', conv.id)
                  .neq('sender_id', user.id)
                  .is('read_at', null)

                return {
                  ...conv,
                  otherParticipant: profileData || undefined,
                  lastMessage: lastMessageData || undefined,
                  unreadCount: unreadCount || 0
                }
              })
            )
          },
          15000 // 15 second cache for conversations
        )

        setConversations(enrichedConversations)
      } catch (error) {
        console.error('Error fetching conversations:', error)
      } finally {
        setLoading(false)
      }
    }, { userId: user.id })
  }

  const filteredConversations = conversations.filter((conv) =>
    conv.otherParticipant?.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedConversation = conversations.find((conv) => conv.id === selectedConversationId)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 80px)', paddingTop: '80px' }}>
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading messages...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-24 pb-6">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
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
                    onSelectConversation={setSelectedConversationId}
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
                  onBack={() => setSelectedConversationId(null)}
                  onMessageSent={fetchConversations}
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
