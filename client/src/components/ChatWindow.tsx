import { useState, useEffect, useRef } from 'react'
import { Send, ArrowLeft, Circle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { monitor } from '@/lib/monitor'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  sent_at: string
  read_at: string | null
}

interface Conversation {
  id: string
  participant_one_id: string
  participant_two_id: string
  otherParticipant?: {
    id: string
    full_name: string
    username: string | null
    avatar_url: string | null
    role: 'player' | 'coach' | 'club'
  }
}

interface ChatWindowProps {
  conversation: Conversation
  currentUserId: string
  onBack: () => void
  onMessageSent: () => void
}

export default function ChatWindow({ conversation, currentUserId, onBack, onMessageSent }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (conversation.id) {
      fetchMessages()
      markMessagesAsRead()
    }
  }, [conversation.id])

  // Set up real-time subscription for new messages in this conversation
  useEffect(() => {
    if (!conversation.id) return

    const channel = supabase
      .channel(`conversation-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload) => {
          const newMessage = payload.new as Message
          setMessages((prev) => {
            // Check if message already exists (avoid duplicates from optimistic updates)
            if (prev.some(msg => msg.id === newMessage.id)) {
              return prev
            }
            return [...prev, newMessage]
          })
          if (newMessage.sender_id !== currentUserId) {
            markMessagesAsRead()
            onMessageSent()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === payload.new.id ? (payload.new as Message) : msg))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation.id, currentUserId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('sent_at', { ascending: true })

      if (error) throw error
      console.log('Fetched messages:', data)
      setMessages(data || [])
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const markMessagesAsRead = async () => {
    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversation.id)
        .neq('sender_id', currentUserId)
        .is('read_at', null)

      onMessageSent()
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    const messageContent = newMessage.trim()
    if (messageContent.length > 1000) {
      alert('Message is too long. Maximum 1000 characters.')
      return
    }

    setSending(true)
    
    await monitor.measure('send_message', async () => {
      try {
        // Generate idempotency key to prevent duplicate messages
        const idempotencyKey = `${currentUserId}-${Date.now()}-${Math.random()}`
        
        const { data, error } = await supabase.from('messages').insert({
          conversation_id: conversation.id,
          sender_id: currentUserId,
          content: messageContent,
          idempotency_key: idempotencyKey
        }).select()

        if (error) throw error

        // Immediately add the message to local state for instant feedback
        if (data && data[0]) {
          console.log('Message sent, adding to local state:', data[0])
          setMessages(prev => [...prev, data[0]])
        }

        setNewMessage('')
        inputRef.current?.focus()
        onMessageSent()
      } catch (error) {
        console.error('Error sending message:', error)
        alert('Failed to send message. Please try again.')
        throw error
      }
    }, {
      conversationId: conversation.id
    }).finally(() => {
      setSending(false)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e as any)
    }
  }

  const getAvatarUrl = (avatarUrl: string | null) => {
    if (!avatarUrl) return null
    if (avatarUrl.startsWith('http')) return avatarUrl
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${avatarUrl}`
  }

  const avatarUrl = getAvatarUrl(conversation.otherParticipant?.avatar_url || null)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center gap-3 bg-white">
        <button
          onClick={onBack}
          className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>

        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={conversation.otherParticipant?.full_name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-semibold">
            {conversation.otherParticipant?.full_name?.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 truncate">
            {conversation.otherParticipant?.full_name}
          </h2>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              conversation.otherParticipant?.role === 'club'
                ? 'bg-orange-50 text-orange-700'
                : conversation.otherParticipant?.role === 'coach'
                ? 'bg-purple-50 text-purple-700'
                : 'bg-blue-50 text-blue-700'
            }`}>
              {conversation.otherParticipant?.role === 'club' 
                ? 'Club' 
                : conversation.otherParticipant?.role === 'coach'
                ? 'Coach'
                : 'Player'}
            </span>
            {/* Active status - placeholder for future feature */}
            {/* <span className="flex items-center gap-1 text-xs text-gray-500">
              <Circle className="w-2 h-2 fill-green-500 text-green-500" />
              Active now
            </span> */}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-center">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isMyMessage = message.sender_id === currentUserId
              const showTimestamp = 
                index === 0 || 
                new Date(message.sent_at).getTime() - new Date(messages[index - 1].sent_at).getTime() > 300000 // 5 minutes

              return (
                <div key={message.id}>
                  {showTimestamp && (
                    <div className="text-center text-xs text-gray-500 mb-2">
                      {format(new Date(message.sent_at), 'MMM d, yyyy h:mm a')}
                    </div>
                  )}
                  <div className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        isMyMessage
                          ? 'bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white'
                          : 'bg-white text-gray-900 border border-gray-200'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      <p className={`text-xs mt-1 ${isMyMessage ? 'text-purple-100' : 'text-gray-500'}`}>
                        {format(new Date(message.sent_at), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-400">
              {newMessage.length}/1000
            </div>
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="p-3 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
}
